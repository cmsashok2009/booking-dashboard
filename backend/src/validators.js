import { ensureDealerAssignments } from "./dealer-assignments.js";
import {
  activeRoleNames,
  normalizeRoleDefinitions,
} from "./role-definitions.js";
import { createMockBookingRows, pad } from "./tabular-data.js";
export {
  ROLE_DEFINITIONS,
  activeRoleNames,
  normalizeRoleDefinitions,
} from "./role-definitions.js";
export {
  createBookingTemplate,
  createMockBookingRows,
  createMockUserRows,
  createUserTemplate,
  exportBookingsAsExcelHtml,
  parseCsv,
} from "./tabular-data.js";
import { bookingFromRow } from "./validation-support.js";
export {
  USER_REQUIRED_COLUMNS,
  upsertUsers,
  validateSingleUser,
  validateUserRows,
  validateUserUpdate,
} from "./user-validation.js";
export {
  BOOKING_REQUIRED_COLUMNS,
  upsertBookings,
  validateBookingRows,
} from "./validation-support.js";
export function seedData() {
  const now = new Date().toISOString();
  const users = [
    {
      id: "u-admin",
      name: "Admin User",
      email: "admin@example.com",
      phone: "9999990000",
      role: "Admin",
      region: "All",
      reportingManagerEmail: "",
      status: "active",
      mustChangePassword: false,
      createdAt: now,
    },
    {
      id: "u-am-west",
      name: "Area Manager West",
      email: "am.west@example.com",
      phone: "9999990001",
      role: "Area Manager",
      region: "West",
      reportingManagerEmail: "rm.west@example.com",
      status: "active",
      mustChangePassword: true,
      createdAt: now,
    },
    {
      id: "u-rm-west",
      name: "Regional Manager West",
      email: "rm.west@example.com",
      phone: "9999990002",
      role: "Regional Manager",
      region: "West",
      reportingManagerEmail: "all.india1@example.com",
      status: "active",
      mustChangePassword: true,
      createdAt: now,
    },
    {
      id: "u-all-india-1",
      name: "All India I",
      email: "all.india1@example.com",
      phone: "9999990004",
      role: "All India I",
      region: "All",
      reportingManagerEmail: "all.india2@example.com",
      status: "active",
      mustChangePassword: true,
      createdAt: now,
    },
    {
      id: "u-all-india-2",
      name: "All India II",
      email: "all.india2@example.com",
      phone: "9999990005",
      role: "All India II",
      region: "All",
      reportingManagerEmail: "all.india@example.com",
      status: "active",
      mustChangePassword: true,
      createdAt: now,
    },
    {
      id: "u-all-india",
      name: "All India",
      email: "all.india@example.com",
      phone: "9999990003",
      role: "All India",
      region: "All",
      reportingManagerEmail: "",
      status: "active",
      mustChangePassword: true,
      createdAt: now,
    },
  ];
  const operationalRegions = ["North", "South", "East", "Central"];
  operationalRegions.forEach((region, index) => {
    const slug = region.toLowerCase();
    users.push(
      {
        id: `u-am-${slug}`,
        name: `Area Manager ${region}`,
        email: `am.${slug}@example.com`,
        phone: `99999901${String(index).padStart(2, "0")}`,
        role: "Area Manager",
        region,
        reportingManagerEmail: `rm.${slug}@example.com`,
        status: "active",
        mustChangePassword: true,
        createdAt: now,
      },
      {
        id: `u-rm-${slug}`,
        name: `Regional Manager ${region}`,
        email: `rm.${slug}@example.com`,
        phone: `99999902${String(index).padStart(2, "0")}`,
        role: "Regional Manager",
        region,
        reportingManagerEmail: "all.india1@example.com",
        status: "active",
        mustChangePassword: true,
        createdAt: now,
      },
    );
  });
  const data = {
    roles: normalizeRoleDefinitions(),
    users,
    lookups: {
      bookingCategory: [
        "TO BE CANCELLED",
        "WANTS PH2 VIN2026",
        "CONVINCED TO PH2 2025",
        "CONVINCED TO PH12025",
      ],
      wholesalesFeedback: [
        "TO BE WHOLESALED",
        "TO BE CANCELLED",
        "NOT YET DECIDED",
      ],
      wsPlanning: [
        "STOCK AVAILABLE",
        "RPOS ORDER AVAILABLE",
        "RPOS ORDER TO BE PLACED TODAY",
        "NOT YET DECIDED",
        "BOOKING CANCELLED",
      ],
      cancellationReason: [
        "Change of model",
        "Change of name",
        "Vehicle not available",
        "Buying competition",
        "Buying Used Car",
        "Down payment issue",
        "Loan rejected",
        "Personal issue",
      ],
    },
    bookings: createSeedBookings(now),
    fileUploads: [],
    auditLogs: [],
  };
  ensureDealerAssignments(data);
  return data;
}
export function reconcileSeededDemoUsers(data, seededUsers, includeDemoUsers) {
  const demoUsers = seededUsers.filter(
    (user) =>
      ["All India I", "All India II"].includes(user.role) ||
      /^u-(am|rm)-/.test(user.id),
  );
  const originalCount = data.users.length;
  if (includeDemoUsers) {
    for (const demoUser of demoUsers) {
      if (
        !data.users.some(
          (user) => user.email.toLowerCase() === demoUser.email.toLowerCase(),
        )
      )
        data.users.push(demoUser);
    }
  } else {
    const demoIdentities = new Set(
      demoUsers.map((user) => `${user.id}:${user.email.toLowerCase()}`),
    );
    data.users = data.users.filter(
      (user) =>
        !demoIdentities.has(`${user.id}:${String(user.email).toLowerCase()}`),
    );
  }
  return data.users.length !== originalCount;
}
function createSeedBookings(now) {
  return createMockBookingRows(100).map((row, index) => {
    const booking = bookingFromRow(row);
    const areaUpdated = index % 3 !== 0;
    const regionalUpdated = index % 4 !== 0;
    return {
      ...booking,
      sourceFileName: "booking form.xlsx",
      assignedAreaManagerId: "u-am-west",
      assignedRegionalManagerId: "u-rm-west",
      areaInputs: {
        bookingCategory: areaUpdated
          ? index % 2 === 0
            ? "TO BE CANCELLED"
            : "WANTS PH2 VIN2026"
          : "",
        wholesalesFeedback: areaUpdated
          ? index % 2 === 0
            ? "TO BE WHOLESALED"
            : "NOT YET DECIDED"
          : "",
        wsPlanning: areaUpdated
          ? index % 2 === 0
            ? "STOCK AVAILABLE"
            : "RPOS ORDER AVAILABLE"
          : "",
        expectedRetailDate: areaUpdated
          ? `2026-08-${pad((index % 25) + 1, 2)}`
          : "",
        cancellationReason:
          areaUpdated && index % 2 === 0 ? "Vehicle not available" : "",
        updatedBy: areaUpdated ? "u-am-west" : "",
        updatedAt: areaUpdated ? now : "",
      },
      regionalInputs: {
        wholesaleInput: regionalUpdated
          ? `Wholesale review completed for ${row["Sales Order Id"]}.`
          : "",
        retailInput: regionalUpdated
          ? `Retail follow-up planned for ${row.Region} region.`
          : "",
        updatedBy: regionalUpdated ? "u-rm-west" : "",
        updatedAt: regionalUpdated ? now : "",
      },
      importedAt: now,
    };
  });
}
