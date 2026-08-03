import { normalizeRoleDefinitions } from "./role-definitions.js";
import {
  isValidEmail,
  missingHeaders,
  rowError,
  storedUpload,
} from "./validation-support.js";

export const USER_REQUIRED_COLUMNS = ["Name", "Email", "Role", "Status"];

export function validateSingleUser(
  row,
  db,
  rowNumber = 2,
  uploadEmails = new Set(),
) {
  const errors = [];
  const role = row.Role || row.role;
  const email = row.Email || row.email;
  const phone = String(row.Phone || row.phone || "").trim();
  const status = row.Status || row.status;
  const managerEmail =
    row["Reporting Manager Email"] || row.reportingManagerEmail || "";
  const region = row.Region || row.region || "";
  const dealerCode = row["Dealer Code"] || row.dealerCode || "";
  if (!(row.Name || row.name))
    errors.push(rowError(rowNumber, "Name", "Name is required"));
  if (!email) errors.push(rowError(rowNumber, "Email", "Email is required"));
  if (email && !isValidEmail(email))
    errors.push(rowError(rowNumber, "Email", "Email format is invalid", email));
  if (email && uploadEmails.has(email.toLowerCase()))
    errors.push(
      rowError(rowNumber, "Email", "Duplicate email in upload", email),
    );
  if (phone && !/^\d{10}$/.test(phone)) {
    errors.push(
      rowError(
        rowNumber,
        "Phone",
        "Phone must contain exactly 10 digits",
        phone,
      ),
    );
  }
  if (!role) errors.push(rowError(rowNumber, "Role", "Role is required"));
  const roleDefinitions = normalizeRoleDefinitions(db.roles);
  const activeRoles = roleDefinitions.filter((item) => item.isActive);
  const selectedRole = activeRoles.find((item) => item.name === role);
  if (role && !selectedRole) {
    errors.push(
      rowError(
        rowNumber,
        "Role",
        `Use one of the approved roles: ${activeRoles.map((item) => item.name).join(", ")}`,
        role,
      ),
    );
  }
  if (!status) errors.push(rowError(rowNumber, "Status", "Status is required"));
  if (
    status &&
    !["active", "inactive", "locked"].includes(status.toLowerCase())
  ) {
    errors.push(
      rowError(
        rowNumber,
        "Status",
        "Status must be active, inactive, or locked",
        status,
      ),
    );
  }
  if (["Area Manager", "Regional Manager"].includes(role) && !region) {
    errors.push(
      rowError(rowNumber, "Region", "Region is required for this role"),
    );
  }
  const knownRegions = (db.regions || []).length
    ? db.regions
        .filter((item) => item.status === "active")
        .map((item) => item.name)
    : db.bookings.map((booking) => booking.region).filter(Boolean);
  if (
    ["Area Manager", "Regional Manager"].includes(role) &&
    region &&
    !knownRegions.some((name) => name.toLowerCase() === region.toLowerCase())
  ) {
    errors.push(
      rowError(
        rowNumber,
        "Region",
        "Region must be an active value from Reference Data",
        region,
      ),
    );
  }
  if (selectedRole?.managerRoleCode && !managerEmail) {
    errors.push(
      rowError(
        rowNumber,
        "Reporting Manager Email",
        `Reporting Manager Email is required for ${selectedRole.name}`,
      ),
    );
  }
  if (managerEmail) {
    const manager = db.users.find(
      (user) =>
        user.email.toLowerCase() === managerEmail.toLowerCase() &&
        user.status === "active",
    );
    if (!manager) {
      errors.push(
        rowError(
          rowNumber,
          "Reporting Manager Email",
          "Reporting Manager Email must belong to an active existing user",
          managerEmail,
        ),
      );
    } else if (selectedRole?.managerRoleCode && selectedRole.code !== "AM") {
      const requiredManagerRole = activeRoles.find(
        (item) => item.code === selectedRole.managerRoleCode,
      );
      if (manager.role !== requiredManagerRole?.name) {
        errors.push(
          rowError(
            rowNumber,
            "Reporting Manager Email",
            `${selectedRole.name} must report to ${requiredManagerRole?.name}`,
            managerEmail,
          ),
        );
      }
    } else if (!selectedRole?.managerRoleCode) {
      errors.push(
        rowError(
          rowNumber,
          "Reporting Manager Email",
          `${selectedRole?.name || role} does not require a reporting manager`,
          managerEmail,
        ),
      );
    }
  }
  const selectedDealer = (db.dealerCodes || []).find(
    (item) =>
      item.status === "active" &&
      item.code.toLowerCase() === dealerCode.toLowerCase(),
  );
  const knownDealerCode = (db.dealerCodes || []).length
    ? Boolean(selectedDealer)
    : db.bookings.some(
        (booking) =>
          booking.dealerCode.toLowerCase() === dealerCode.toLowerCase(),
      );
  if (dealerCode && !knownDealerCode) {
    errors.push(
      rowError(
        rowNumber,
        "Dealer Code",
        "Dealer Code is not known from booking data",
        dealerCode,
      ),
    );
  }
  if (
    dealerCode &&
    selectedDealer &&
    selectedDealer.region.toLowerCase() !== region.toLowerCase()
  ) {
    errors.push(
      rowError(
        rowNumber,
        "Region",
        `Region must be ${selectedDealer.region} for Dealer Code ${selectedDealer.code}`,
        region,
      ),
    );
  }
  return { valid: errors.length === 0, errors };
}
export function validateUserUpdate(input, db, userId) {
  const current = db.users.find((user) => user.id === userId);
  if (!current)
    return { valid: false, errors: [rowError(1, "User", "User not found")] };
  const row = {
    Name: String(input.name ?? current.name ?? "").trim(),
    Email: String(input.email ?? current.email ?? "").trim(),
    Role: String(input.role ?? current.role ?? "").trim(),
    Region: String(input.region ?? current.region ?? "").trim(),
    Status: String(input.status ?? current.status ?? "")
      .trim()
      .toLowerCase(),
    "Dealer Code": String(input.dealerCode ?? current.dealerCode ?? "").trim(),
    "Reporting Manager Email": current.reportingManagerEmail || "",
  };
  const lifecycleStatusUnchanged =
    ["pending_invitation", "invited"].includes(current.status) &&
    row.Status === current.status;
  const validation = validateSingleUser(
    lifecycleStatusUnchanged ? { ...row, Status: "active" } : row,
    db,
    1,
  );
  const errors = [...validation.errors];
  if (!row.Region) errors.push(rowError(1, "Region", "Region is required"));
  const duplicate = db.users.some(
    (user) =>
      user.id !== userId &&
      user.email.toLowerCase() === row.Email.toLowerCase(),
  );
  if (row.Email && duplicate)
    errors.push(
      rowError(
        1,
        "Email",
        "Email is already assigned to another user",
        row.Email,
      ),
    );
  const emailChanged =
    row.Email.toLowerCase() !== String(current.email || "").toLowerCase();
  const invitationIssued =
    current.status === "invited" ||
    Boolean(current.invitedAt || current.activatedAt);
  if (emailChanged && invitationIssued) {
    errors.push(
      rowError(
        1,
        "Email",
        "Login email cannot be changed after an invitation is sent. Use a verified email-change workflow.",
        row.Email,
      ),
    );
  }
  return { valid: errors.length === 0, errors, value: row };
}
export function validateUserRows(
  rows,
  db,
  requiredColumns = USER_REQUIRED_COLUMNS,
) {
  const errors = [];
  if (!rows.length)
    errors.push(rowError(1, "File", "File must contain at least one data row"));
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
  const validation = validateUserRows(
    rows,
    db,
    options.requiredColumns || USER_REQUIRED_COLUMNS,
  );
  const upload = {
    id: `upload-${Date.now()}`,
    uploadCategory: "user_import",
    originalFileName: options.fileName || "user-upload.csv",
    totalRows: rows.length,
    insertedRows: 0,
    updatedRows: 0,
    failedRows: validation.errors.length,
    status: validation.valid ? "completed" : "failed",
    errors: validation.errors,
    uploadedAt: new Date().toISOString(),
  };
  if (!validation.valid) {
    db.fileUploads.unshift(storedUpload(upload, options.uploadedBy));
    return upload;
  }
  for (const row of rows) {
    const email = row.Email || row.email;
    const existingIndex = db.users.findIndex(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
    const user = {
      id:
        existingIndex >= 0
          ? db.users[existingIndex].id
          : `u-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: row.Name || row.name,
      email,
      phone: row.Phone || row.phone || "",
      role: row.Role || row.role,
      region: row.Region || row.region || "",
      dealerCode: row["Dealer Code"] || row.dealerCode || "",
      reportingManagerEmail:
        row["Reporting Manager Email"] || row.reportingManagerEmail || "",
      status: "pending_invitation",
      mustChangePassword: false,
      createdAt:
        existingIndex >= 0
          ? db.users[existingIndex].createdAt
          : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (existingIndex >= 0) {
      db.users[existingIndex] = user;
      upload.updatedRows += 1;
    } else {
      db.users.push(user);
      upload.insertedRows += 1;
    }
  }
  db.fileUploads.unshift(storedUpload(upload, options.uploadedBy));
  return upload;
}
