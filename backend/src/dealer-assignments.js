import { normalizeManagerName } from "./access.js";

export function normalizeDealerCode(value) {
  return String(value || "").trim().toUpperCase();
}

export function dealerAssignmentForCode(db, dealerCode) {
  const code = normalizeDealerCode(dealerCode);
  return (db.dealerAssignments || []).find((item) => item.isActive !== false && normalizeDealerCode(item.dealerCode) === code) || null;
}

function activeManager(users, role, region, managerName = "") {
  const normalizedName = normalizeManagerName(managerName);
  return (
    users.find(
      (user) =>
        user.status === "active" &&
        user.role === role &&
        normalizedName &&
        normalizeManagerName(user.name) === normalizedName
    ) ||
    users.find((user) => user.status === "active" && user.role === role && user.region === region) ||
    null
  );
}

export function assignmentFromBooking(db, booking) {
  const areaManager = activeManager(db.users, "Area Manager", booking.region, booking.amNameFromFile);
  const regionalManager = activeManager(db.users, "Regional Manager", booking.region);
  if (!areaManager || !regionalManager) return null;
  return {
    id: `dealer-${normalizeDealerCode(booking.dealerCode).toLowerCase()}`,
    dealerCode: normalizeDealerCode(booking.dealerCode),
    areaManagerUserId: areaManager.id,
    regionalManagerUserId: regionalManager.id,
    region: booking.region,
    isActive: true
  };
}

export function ensureDealerAssignments(db) {
  db.dealerAssignments ||= [];
  const now = new Date().toISOString();
  let changed = false;

  for (const booking of db.bookings || []) {
    const code = normalizeDealerCode(booking.dealerCode);
    if (!code) continue;
    let assignment = dealerAssignmentForCode(db, code);
    if (!assignment) {
      const generated = assignmentFromBooking(db, booking);
      if (!generated) continue;
      assignment = { ...generated, createdAt: now, updatedAt: now };
      db.dealerAssignments.push(assignment);
      changed = true;
    }
    if (
      booking.assignedAreaManagerId !== assignment.areaManagerUserId ||
      booking.assignedRegionalManagerId !== assignment.regionalManagerUserId
    ) {
      booking.assignedAreaManagerId = assignment.areaManagerUserId;
      booking.assignedRegionalManagerId = assignment.regionalManagerUserId;
      changed = true;
    }
  }

  return changed;
}

export function validateDealerAssignments(rows, db) {
  const errors = [];
  rows.forEach((row, index) => {
    if (!dealerAssignmentForCode(db, row["Dealer Code"])) {
      errors.push({
        rowNumber: index + 2,
        columnName: "Dealer Code",
        errorMessage: "Dealer Code does not have an active Area Manager and Regional Manager mapping",
        rawValue: row["Dealer Code"] || ""
      });
    }
  });
  return errors;
}