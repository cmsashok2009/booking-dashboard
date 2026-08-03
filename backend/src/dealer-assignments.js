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

function activeAreaManager(db, booking) {
  const code = normalizeDealerCode(booking.dealerCode);
  const mappedUser = db.users.find(
    (user) =>
      user.status === "active" &&
      user.role === "Area Manager" &&
      normalizeDealerCode(user.dealerCode) === code &&
      user.region === booking.region
  );
  if (mappedUser) return mappedUser;

  const knownDealerCode =
    (db.dealerCodes || []).some(
      (item) =>
        item.status !== "inactive" &&
        normalizeDealerCode(item.code) === code &&
        item.region === booking.region
    ) ||
    (db.bookings || []).some(
      (item) =>
        normalizeDealerCode(item.dealerCode) === code &&
        item.region === booking.region
    );
  return knownDealerCode
    ? activeManager(db.users, "Area Manager", booking.region, booking.amNameFromFile)
    : null;
}

export function assignmentFromBooking(db, booking) {
  const areaManager = activeAreaManager(db, booking);
  const regionalManager = activeManager(db.users, "Regional Manager", booking.region);
  if (!areaManager) return null;
  return {
    id: `dealer-${normalizeDealerCode(booking.dealerCode).toLowerCase()}`,
    dealerCode: normalizeDealerCode(booking.dealerCode),
    areaManagerUserId: areaManager.id,
    regionalManagerUserId: regionalManager?.id || "",
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
      if (assignment.regionalManagerUserId) {
        db.dealerAssignments.push(assignment);
        changed = true;
      }
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
    const booking = {
      dealerCode: row["Dealer Code"],
      region: row.Region,
      amNameFromFile: row.AM
    };
    if (!dealerAssignmentForCode(db, row["Dealer Code"]) && !assignmentFromBooking(db, booking)) {
      errors.push({
        rowNumber: index + 2,
        columnName: "Dealer Code",
        errorMessage: "Dealer Code does not have an active Area Manager mapping",
        rawValue: row["Dealer Code"] || ""
      });
    }
  });
  return errors;
}