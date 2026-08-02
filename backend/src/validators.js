import { dealerAssignmentForCode, ensureDealerAssignments, validateDealerAssignments } from "./dealer-assignments.js";

export const BOOKING_REQUIRED_COLUMNS = [
  "Dealer Code",
  "Contact First Name",
  "Contact Last Name",
  "Phone Number",
  "Sales Order Id",
  "Creation Date",
  "Dlr GRP",
  "AM",
  "Region",
  "Category",
  "MODEL",
  "VARIANT",
  "VINYEAR",
  "MATCHED STATUS",
  "AVL STATUS",
  "RPOS ORDER STATUS"
];

export const USER_REQUIRED_COLUMNS = ["Name", "Email", "Role", "Status"];

export const ROLE_DEFINITIONS = [
  { code: "AM", name: "Area Manager", hierarchyLevel: 1, managerRoleCode: "RM", isActive: true, isSystem: true },
  { code: "RM", name: "Regional Manager", hierarchyLevel: 2, managerRoleCode: "ALL_INDIA_I", isActive: true, isSystem: true },
  { code: "ALL_INDIA_I", name: "All India I", hierarchyLevel: 3, managerRoleCode: "ALL_INDIA_II", isActive: true, isSystem: true },
  { code: "ALL_INDIA_II", name: "All India II", hierarchyLevel: 4, managerRoleCode: "ALL_INDIA", isActive: true, isSystem: true },
  { code: "ALL_INDIA", name: "All India", hierarchyLevel: 5, managerRoleCode: null, isActive: true, isSystem: true },
  { code: "ADMIN", name: "Admin", hierarchyLevel: 99, managerRoleCode: null, isActive: true, isSystem: true }
];

export function normalizeRoleDefinitions(roles = []) {
  const stored = new Map(roles.map((role) => [typeof role === "string" ? role : role.name, role]));
  return ROLE_DEFINITIONS.map((definition) => {
    const current = stored.get(definition.name);
    return typeof current === "object" ? { ...definition, ...current, name: definition.name, code: definition.code } : { ...definition };
  });
}

export function activeRoleNames(db) {
  return normalizeRoleDefinitions(db.roles).filter((role) => role.isActive).map((role) => role.name);
}

const BOOKING_UPLOAD_HEADERS = [
  "Dealer Code",
  "Contact First Name",
  "Contact Last Name",
  "Institution Name",
  "Phone Number",
  "Sales Order Id",
  "Creation Date",
  "Dlr GRP",
  "AM",
  "Region",
  "Category",
  "MODEL",
  "VARIANT",
  "Color mapped",
  "CAT",
  "VINYEAR",
  "matching vin stock",
  "MATCHED STATUS",
  "AGING BOOKINFS",
  "AVL STATUS",
  "RPOS ORDER STATUS",
  "RPASS BKG",
  "COMB1"
];

const USER_UPLOAD_HEADERS = [
  "Name",
  "Email",
  "Phone",
  "Role",
  "Region",
  "Dealer Code",
  "Reporting Manager Email",
  "Status",
  "Temporary Password"
];

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
      createdAt: now
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
      createdAt: now
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
      createdAt: now
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
      createdAt: now
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
      createdAt: now
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
      createdAt: now
    }
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
        createdAt: now
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
        createdAt: now
      }
    );
  });

  const data = {
    roles: normalizeRoleDefinitions(),
    users,
    lookups: {
      bookingCategory: ["TO BE CANCELLED", "WANTS PH2 VIN2026", "CONVINCED TO PH2 2025", "CONVINCED TO PH12025"],
      wholesalesFeedback: ["TO BE WHOLESALED", "TO BE CANCELLED", "NOT YET DECIDED"],
      wsPlanning: [
        "STOCK AVAILABLE",
        "RPOS ORDER AVAILABLE",
        "RPOS ORDER TO BE PLACED TODAY",
        "NOT YET DECIDED",
        "BOOKING CANCELLED"
      ],
      cancellationReason: [
        "Change of model",
        "Change of name",
        "Vehicle not available",
        "Buying competition",
        "Buying Used Car",
        "Down payment issue",
        "Loan rejected",
        "Personal issue"
      ]
    },
    bookings: createSeedBookings(now),
    fileUploads: [],
    auditLogs: []
  };
  ensureDealerAssignments(data);
  return data;
}

export function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === "\"" && insideQuotes && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (!rows.length) return { headers: [], rows: [] };

  const headers = rows[0].map((header) => header.trim());
  return {
    headers,
    rows: rows.slice(1).map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()]))
    )
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}

function toCsv(headers, rows) {
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

function pad(value, length = 3) {
  return String(value).padStart(length, "0");
}

export function createMockBookingRows(count = 100) {
  const regions = ["West", "North", "South", "East", "Central"];
  const models = ["New DUSTER", "KIGER", "TRIBER", "KWID"];
  const variants = [
    "DUSTER ADVENTURE TCE 160 MT",
    "KIGER RXZ TURBO CVT",
    "TRIBER RXZ EASY-R AMT",
    "KWID CLIMBER AMT"
  ];
  const colors = ["PWHITE", "MRED", "BLACK", "SILVER", "BLUE"];
  const avlStatuses = ["NO DLR STK/NO RPOS ORDER", "DEALER STOCK AVAILABLE", "RPOS ORDER AVAILABLE", "VIN ALLOCATED"];
  const rposStatuses = ["ORDER NOT AVL", "ORDER AVAILABLE", "ORDER TO BE PLACED", "PENDING APPROVAL"];
  const matchedStatuses = ["UNMATCHED WITH DEALERSHIP STK", "MATCHED WITH DEALERSHIP STK", "PARTIALLY MATCHED"];
  const firstNames = ["ravi", "meera", "arun", "kavya", "naveen", "priya", "suresh", "anita", "vikram", "deepa"];
  const lastNames = ["kumar", "sharma", "reddy", "nair", "patel", "singh", "rao", "iyer", "das", "jain"];

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const model = models[index % models.length];
    const variant = variants[index % variants.length];
    const region = regions[index % regions.length];
    const dealerCode = index === 0 ? "abcd" : `DLR${pad(number)}`;
    const salesOrderId = index === 0 ? "sob12367" : `SOB${10000 + number}`;
    const day = pad((number % 25) + 1, 2);
    const month = pad((number % 6) + 1, 2);
    const dealerGroup = `GRP${pad((index % 12) + 1, 2)}`;

    return {
      "Dealer Code": dealerCode,
      "Contact First Name": firstNames[index % firstNames.length],
      "Contact Last Name": lastNames[index % lastNames.length],
      "Institution Name": index % 5 === 0 ? `Fleet Account ${pad(number)}` : "0",
      "Phone Number": `98${String(76000000 + number).slice(-8)}`,
      "Sales Order Id": salesOrderId,
      "Creation Date": `2026-${month}-${day}`,
      "Dlr GRP": dealerGroup,
      AM: `AM ${region}`,
      Region: region,
      Category: index % 4 === 0 ? "priority" : "open",
      MODEL: model,
      VARIANT: variant,
      "Color mapped": colors[index % colors.length],
      CAT: index % 3 === 0 ? "RETAIL" : "NEW",
      VINYEAR: index % 2 === 0 ? "VIN26" : "VIN25",
      "matching vin stock": index % 3 === 0 ? `VINSTK${pad(number)}` : "#N/A",
      "MATCHED STATUS": matchedStatuses[index % matchedStatuses.length],
      "AGING BOOKINFS": String((index % 18) + 1),
      "AVL STATUS": avlStatuses[index % avlStatuses.length],
      "RPOS ORDER STATUS": rposStatuses[index % rposStatuses.length],
      "RPASS BKG": index % 2 === 0 ? "NOT DUSTER RPASS BKG" : "DUSTER RPASS BKG",
      COMB1: `${dealerGroup}${model.replaceAll(" ", "")}${index % 2 === 0 ? "VIN26" : "VIN25"}${avlStatuses[index % avlStatuses.length]}`
    };
  });
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
        bookingCategory: areaUpdated ? (index % 2 === 0 ? "TO BE CANCELLED" : "WANTS PH2 VIN2026") : "",
        wholesalesFeedback: areaUpdated ? (index % 2 === 0 ? "TO BE WHOLESALED" : "NOT YET DECIDED") : "",
        wsPlanning: areaUpdated ? (index % 2 === 0 ? "STOCK AVAILABLE" : "RPOS ORDER AVAILABLE") : "",
        expectedRetailDate: areaUpdated ? `2026-08-${pad((index % 25) + 1, 2)}` : "",
        cancellationReason: areaUpdated && index % 2 === 0 ? "Vehicle not available" : "",
        updatedBy: areaUpdated ? "u-am-west" : "",
        updatedAt: areaUpdated ? now : ""
      },
      regionalInputs: {
        wholesaleInput: regionalUpdated ? `Wholesale review completed for ${row["Sales Order Id"]}.` : "",
        retailInput: regionalUpdated ? `Retail follow-up planned for ${row.Region} region.` : "",
        updatedBy: regionalUpdated ? "u-rm-west" : "",
        updatedAt: regionalUpdated ? now : ""
      },
      importedAt: now
    };
  });
}

export function createMockUserRows(count = 50) {
  const roles = ["Area Manager", "Regional Manager", "All India I", "All India II", "All India"];
  const regions = ["West", "North", "South", "East", "Central"];

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const role = roles[index % roles.length];
    const region = role.startsWith("All India") ? "All" : regions[index % regions.length];
    const managerEmailByRole = {
      "Area Manager": "rm.west@example.com",
      "Regional Manager": "all.india1@example.com",
      "All India I": "all.india2@example.com",
      "All India II": "all.india@example.com"
    };
    const managerEmail = managerEmailByRole[role] || "";
    const dealerCode = number === 1 ? "abcd" : `DLR${pad(((number - 1) % 99) + 1)}`;

    return {
      Name: `${role} Mock ${pad(number, 2)}`,
      Email: `mock.user${pad(number, 2)}@example.com`,
      Phone: `99${String(88000000 + number).slice(-8)}`,
      Role: role,
      Region: region,
      "Dealer Code": dealerCode,
      "Reporting Manager Email": managerEmail,
      Status: "active",
      "Temporary Password": ""
    };
  });
}

export function createBookingTemplate() {
  return toCsv(BOOKING_UPLOAD_HEADERS, createMockBookingRows(100));
}

export function createUserTemplate() {
  return toCsv(USER_UPLOAD_HEADERS, createMockUserRows(50));
}

function rowError(rowNumber, columnName, errorMessage, rawValue = "") {
  return { rowNumber, columnName, errorMessage, rawValue };
}

function missingHeaders(rows, requiredColumns) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return requiredColumns.filter((column) => !headers.includes(column));
}

function isValidDate(value) {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function validateBookingRows(rows, requiredColumns = BOOKING_REQUIRED_COLUMNS) {
  const errors = [];
  if (!rows.length) errors.push(rowError(1, "File", "File must contain at least one data row"));
  for (const header of missingHeaders(rows, requiredColumns)) {
    errors.push(rowError(1, header, "Required column is missing"));
  }

  const salesOrderIds = new Set();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (!row["Dealer Code"]) errors.push(rowError(rowNumber, "Dealer Code", "Dealer Code is required"));
    if (!row["Sales Order Id"]) errors.push(rowError(rowNumber, "Sales Order Id", "Sales Order Id is required"));
    if (!row["Phone Number"]) errors.push(rowError(rowNumber, "Phone Number", "Phone Number is required"));
    if (row["Creation Date"] && !isValidDate(row["Creation Date"])) {
      errors.push(rowError(rowNumber, "Creation Date", "Creation Date must be a valid date", row["Creation Date"]));
    }
    if (row["Sales Order Id"]) {
      const key = row["Sales Order Id"].toLowerCase();
      if (salesOrderIds.has(key)) errors.push(rowError(rowNumber, "Sales Order Id", "Duplicate Sales Order Id in upload", row["Sales Order Id"]));
      salesOrderIds.add(key);
    }
  });
  return { valid: errors.length === 0, errors };
}

function bookingFromRow(row, existing = {}, assignment = null) {
  const source = {
    dealerCode: row["Dealer Code"],
    contactFirstName: row["Contact First Name"],
    contactLastName: row["Contact Last Name"],
    institutionName: row["Institution Name"] || "",
    phoneNumber: row["Phone Number"],
    salesOrderId: row["Sales Order Id"],
    creationDate: row["Creation Date"],
    dealerGroup: row["Dlr GRP"],
    amNameFromFile: row.AM,
    region: row.Region,
    category: row.Category,
    model: row.MODEL,
    variant: row.VARIANT,
    colorMapped: row["Color mapped"] || "",
    cat: row.CAT || "",
    vinYear: row.VINYEAR,
    matchingVinStock: row["matching vin stock"] || "",
    matchedStatus: row["MATCHED STATUS"],
    agingBookings: row["AGING BOOKINFS"] || "",
    avlStatus: row["AVL STATUS"],
    rposOrderStatus: row["RPOS ORDER STATUS"],
    rpassBkg: row["RPASS BKG"] || "",
    comb1: row.COMB1 || ""
  };
  return {
    ...existing,
    ...source,
    id: existing.id || `b-${source.salesOrderId}`,
    assignedAreaManagerId: assignment?.areaManagerUserId || existing.assignedAreaManagerId || "",
    assignedRegionalManagerId: assignment?.regionalManagerUserId || existing.assignedRegionalManagerId || "",
    areaInputs: existing.areaInputs || {},
    regionalInputs: existing.regionalInputs || {},
    importedAt: new Date().toISOString()
  };
}

export function upsertBookings(db, rows, options = {}) {
  const validation = validateBookingRows(rows, options.requiredColumns || BOOKING_REQUIRED_COLUMNS);
  const assignmentErrors = validation.valid ? validateDealerAssignments(rows, db) : [];
  validation.errors.push(...assignmentErrors);
  validation.valid = validation.errors.length === 0;
  const upload = {
    id: `upload-${Date.now()}`,
    uploadCategory: "booking_import",
    originalFileName: options.fileName || "booking-upload.csv",
    totalRows: rows.length,
    insertedRows: 0,
    updatedRows: 0,
    failedRows: validation.errors.length,
    status: validation.valid ? "completed" : "failed",
    errors: validation.errors,
    uploadedAt: new Date().toISOString()
  };

  if (!validation.valid) {
    db.fileUploads.unshift(upload);
    return upload;
  }

  for (const row of rows) {
    const index = db.bookings.findIndex((booking) => booking.salesOrderId.toLowerCase() === row["Sales Order Id"].toLowerCase());
    if (index >= 0) {
      db.bookings[index] = bookingFromRow(row, db.bookings[index], dealerAssignmentForCode(db, row["Dealer Code"]));
      upload.updatedRows += 1;
    } else {
      db.bookings.push(bookingFromRow(row, {}, dealerAssignmentForCode(db, row["Dealer Code"])));
      upload.insertedRows += 1;
    }
  }
  db.fileUploads.unshift(upload);
  return upload;
}

export function validateSingleUser(row, db, rowNumber = 2, uploadEmails = new Set()) {
  const errors = [];
  const role = row.Role || row.role;
  const email = row.Email || row.email;
  const status = row.Status || row.status;
  const managerEmail = row["Reporting Manager Email"] || row.reportingManagerEmail || "";
  const region = row.Region || row.region || "";
  const dealerCode = row["Dealer Code"] || row.dealerCode || "";

  if (!(row.Name || row.name)) errors.push(rowError(rowNumber, "Name", "Name is required"));
  if (!email) errors.push(rowError(rowNumber, "Email", "Email is required"));
  if (email && !isValidEmail(email)) errors.push(rowError(rowNumber, "Email", "Email format is invalid", email));
  if (email && uploadEmails.has(email.toLowerCase())) errors.push(rowError(rowNumber, "Email", "Duplicate email in upload", email));
  if (!role) errors.push(rowError(rowNumber, "Role", "Role is required"));
  const roleDefinitions = normalizeRoleDefinitions(db.roles);
  const activeRoles = roleDefinitions.filter((item) => item.isActive);
  const selectedRole = activeRoles.find((item) => item.name === role);
  if (role && !selectedRole) {
    errors.push(rowError(rowNumber, "Role", `Use one of the approved roles: ${activeRoles.map((item) => item.name).join(", ")}`, role));
  }
  if (!status) errors.push(rowError(rowNumber, "Status", "Status is required"));
  if (status && !["active", "inactive", "locked"].includes(status.toLowerCase())) {
    errors.push(rowError(rowNumber, "Status", "Status must be active, inactive, or locked", status));
  }
  if (["Area Manager", "Regional Manager"].includes(role) && !region) {
    errors.push(rowError(rowNumber, "Region", "Region is required for this role"));
  }
  if (selectedRole?.managerRoleCode && !managerEmail) {
    errors.push(rowError(rowNumber, "Reporting Manager Email", `Reporting Manager Email is required for ${selectedRole.name}`));
  }
  if (managerEmail) {
    const manager = db.users.find((user) => user.email.toLowerCase() === managerEmail.toLowerCase() && user.status === "active");
    if (!manager) {
      errors.push(rowError(rowNumber, "Reporting Manager Email", "Reporting Manager Email must belong to an active existing user", managerEmail));
    } else if (selectedRole?.managerRoleCode) {
      const requiredManagerRole = activeRoles.find((item) => item.code === selectedRole.managerRoleCode);
      if (manager.role !== requiredManagerRole?.name) {
        errors.push(rowError(rowNumber, "Reporting Manager Email", `${selectedRole.name} must report to ${requiredManagerRole?.name}`, managerEmail));
      }
    } else {
      errors.push(rowError(rowNumber, "Reporting Manager Email", `${selectedRole?.name || role} does not require a reporting manager`, managerEmail));
    }
  }
  if (dealerCode && !db.bookings.some((booking) => booking.dealerCode.toLowerCase() === dealerCode.toLowerCase())) {
    errors.push(rowError(rowNumber, "Dealer Code", "Dealer Code is not known from booking data", dealerCode));
  }
  return { valid: errors.length === 0, errors };
}

export function validateUserUpdate(input, db, userId) {
  const current = db.users.find((user) => user.id === userId);
  if (!current) return { valid: false, errors: [rowError(1, "User", "User not found")] };

  const row = {
    Name: String(input.name ?? current.name ?? "").trim(),
    Email: String(input.email ?? current.email ?? "").trim(),
    Role: String(input.role ?? current.role ?? "").trim(),
    Region: String(input.region ?? current.region ?? "").trim(),
    Status: String(input.status ?? current.status ?? "").trim().toLowerCase(),
    "Dealer Code": current.dealerCode || "",
    "Reporting Manager Email": current.reportingManagerEmail || ""
  };
  const lifecycleStatusUnchanged = ["pending_invitation", "invited"].includes(current.status) && row.Status === current.status;
  const validation = validateSingleUser(lifecycleStatusUnchanged ? { ...row, Status: "active" } : row, db, 1);
  const errors = [...validation.errors];

  if (!row.Region) errors.push(rowError(1, "Region", "Region is required"));
  const duplicate = db.users.some(
    (user) => user.id !== userId && user.email.toLowerCase() === row.Email.toLowerCase()
  );
  if (row.Email && duplicate) errors.push(rowError(1, "Email", "Email is already assigned to another user", row.Email));
  const emailChanged = row.Email.toLowerCase() !== String(current.email || "").toLowerCase();
  const invitationIssued = current.status === "invited" || Boolean(current.invitedAt || current.activatedAt);
  if (emailChanged && invitationIssued) {
    errors.push(rowError(1, "Email", "Login email cannot be changed after an invitation is sent. Use a verified email-change workflow.", row.Email));
  }

  return { valid: errors.length === 0, errors, value: row };
}

export function validateUserRows(rows, db, requiredColumns = USER_REQUIRED_COLUMNS) {
  const errors = [];
  if (!rows.length) errors.push(rowError(1, "File", "File must contain at least one data row"));
  for (const header of missingHeaders(rows, requiredColumns)) {
    errors.push(rowError(1, header, "Required column is missing"));
  }

  const uploadEmails = new Set();
  rows.forEach((row, index) => {
    const result = validateSingleUser(row, db, index + 2, uploadEmails);
    errors.push(...result.errors);
    const email = row.Email || row.email;
    if (email) uploadEmails.add(email.toLowerCase());
  });
  return { valid: errors.length === 0, errors };
}

export function upsertUsers(db, rows, options = {}) {
  const validation = validateUserRows(rows, db, options.requiredColumns || USER_REQUIRED_COLUMNS);
  const upload = {
    id: `upload-${Date.now()}`,
    uploadCategory: "user_import",
    originalFileName: options.fileName || "user-upload.csv",
    totalRows: rows.length,
    insertedRows: 0,
    updatedRows: 0,
    failedRows: validation.errors.length,
    credentials: [],
    status: validation.valid ? "completed" : "failed",
    errors: validation.errors,
    uploadedAt: new Date().toISOString()
  };

  if (!validation.valid) {
    db.fileUploads.unshift(upload);
    return upload;
  }

  for (const row of rows) {
    const email = row.Email || row.email;
    const existingIndex = db.users.findIndex((user) => user.email.toLowerCase() === email.toLowerCase());
    const user = {
      id: existingIndex >= 0 ? db.users[existingIndex].id : `u-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: row.Name || row.name,
      email,
      phone: row.Phone || row.phone || "",
      role: row.Role || row.role,
      region: row.Region || row.region || "",
      dealerCode: row["Dealer Code"] || row.dealerCode || "",
      reportingManagerEmail: row["Reporting Manager Email"] || row.reportingManagerEmail || "",
      status: (row.Status || row.status || "active").toLowerCase(),
      mustChangePassword: true,
      createdAt: existingIndex >= 0 ? db.users[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (existingIndex >= 0) {
      db.users[existingIndex] = user;
      upload.updatedRows += 1;
    } else {
      db.users.push(user);
      upload.insertedRows += 1;
      upload.credentials.push({
        email,
        temporaryPassword: row["Temporary Password"] || "Auto@12345",
        mustChangePassword: true
      });
    }
  }
  db.fileUploads.unshift(upload);
  return upload;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

export function exportBookingsAsExcelHtml(bookings) {
  const columns = [
    ["dealerCode", "Dealer Code"],
    ["contactFirstName", "Contact First Name"],
    ["contactLastName", "Contact Last Name"],
    ["institutionName", "Institution Name"],
    ["phoneNumber", "Phone Number"],
    ["salesOrderId", "Sales Order Id"],
    ["creationDate", "Creation Date"],
    ["dealerGroup", "Dlr GRP"],
    ["amNameFromFile", "AM"],
    ["region", "Region"],
    ["category", "Category"],
    ["model", "MODEL"],
    ["variant", "VARIANT"],
    ["colorMapped", "Color mapped"],
    ["cat", "CAT"],
    ["vinYear", "VINYEAR"],
    ["matchingVinStock", "Matching VIN Stock"],
    ["matchedStatus", "Matched Status"],
    ["agingBookings", "Aging Bookings"],
    ["avlStatus", "AVL Status"],
    ["rposOrderStatus", "RPOS Order Status"],
    ["rpassBkg", "RPASS BKG"],
    ["comb1", "COMB1"]
  ];
  const workflowColumns = [
    ["areaInputs.bookingCategory", "Booking Category"],
    ["areaInputs.wholesalesFeedback", "Wholesales Feedback"],
    ["areaInputs.wsPlanning", "WS Planning"],
    ["areaInputs.expectedRetailDate", "Expected Retail Date"],
    ["areaInputs.cancellationReason", "Remarks for Cancellation or Not Yet Decided"],
    ["regionalInputs.wholesaleInput", "Wholesale Input"],
    ["regionalInputs.retailInput", "Retail Input"],
    ["areaInputs.updatedBy", "Last Area Updated By"],
    ["areaInputs.updatedAt", "Last Area Updated At"],
    ["regionalInputs.updatedBy", "Last Regional Updated By"],
    ["regionalInputs.updatedAt", "Last Regional Updated At"]
  ];
  const allColumns = [...columns, ...workflowColumns];
  const read = (row, key) => key.split(".").reduce((value, part) => value?.[part], row) || "";

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><style>td,th{border:1px solid #999;padding:4px;}th{background:#e8eef8;}</style></head>
<body>
<table>
<thead><tr>${allColumns.map(([, label]) => `<th>${htmlEscape(label)}</th>`).join("")}</tr></thead>
<tbody>
${bookings
  .map((booking) => `<tr>${allColumns.map(([key]) => `<td>${htmlEscape(read(booking, key))}</td>`).join("")}</tr>`)
  .join("\n")}
</tbody>
</table>
</body>
</html>`;
}
