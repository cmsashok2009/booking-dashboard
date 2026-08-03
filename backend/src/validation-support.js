import {
  assignmentFromBooking,
  dealerAssignmentForCode,
  validateDealerAssignments,
} from "./dealer-assignments.js";

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
  "RPOS ORDER STATUS",
];
export function rowError(rowNumber, columnName, errorMessage, rawValue = "") {
  return { rowNumber, columnName, errorMessage, rawValue };
}
export function storedUpload(upload, uploadedBy = "") {
  return {
    id: upload.id,
    uploadCategory: upload.uploadCategory,
    originalFileName: upload.originalFileName,
    totalRows: upload.totalRows,
    insertedRows: upload.insertedRows,
    updatedRows: upload.updatedRows,
    failedRows: upload.failedRows,
    status: upload.status,
    errors: (upload.errors || []).map(
      ({ rowNumber, columnName, errorMessage }) => ({
        rowNumber,
        columnName,
        errorMessage,
      }),
    ),
    uploadedBy,
    createdAt: upload.uploadedAt,
    uploadedAt: upload.uploadedAt,
  };
}
export function missingHeaders(rows, requiredColumns) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return requiredColumns.filter((column) => !headers.includes(column));
}
export function isValidDate(value) {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}
export function validateBookingRows(
  rows,
  requiredColumns = BOOKING_REQUIRED_COLUMNS,
) {
  const errors = [];
  if (!rows.length)
    errors.push(rowError(1, "File", "File must contain at least one data row"));
  for (const header of missingHeaders(rows, requiredColumns)) {
    errors.push(rowError(1, header, "Required column is missing"));
  }
  const salesOrderIds = new Set();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (!row["Dealer Code"])
      errors.push(
        rowError(rowNumber, "Dealer Code", "Dealer Code is required"),
      );
    if (!row["Sales Order Id"])
      errors.push(
        rowError(rowNumber, "Sales Order Id", "Sales Order Id is required"),
      );
    if (!row["Phone Number"])
      errors.push(
        rowError(rowNumber, "Phone Number", "Phone Number is required"),
      );
    if (row["Creation Date"] && !isValidDate(row["Creation Date"])) {
      errors.push(
        rowError(
          rowNumber,
          "Creation Date",
          "Creation Date must be a valid date",
          row["Creation Date"],
        ),
      );
    }
    if (row["Sales Order Id"]) {
      const key = row["Sales Order Id"].toLowerCase();
      if (salesOrderIds.has(key))
        errors.push(
          rowError(
            rowNumber,
            "Sales Order Id",
            "Duplicate Sales Order Id in upload",
            row["Sales Order Id"],
          ),
        );
      salesOrderIds.add(key);
    }
  });
  return { valid: errors.length === 0, errors };
}
export function bookingFromRow(row, existing = {}, assignment = null) {
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
    comb1: row.COMB1 || "",
  };
  return {
    ...existing,
    ...source,
    id: existing.id || `b-${source.salesOrderId}`,
    assignedAreaManagerId:
      assignment?.areaManagerUserId || existing.assignedAreaManagerId || "",
    assignedRegionalManagerId:
      assignment?.regionalManagerUserId ||
      existing.assignedRegionalManagerId ||
      "",
    areaInputs: existing.areaInputs || {},
    regionalInputs: existing.regionalInputs || {},
    importedAt: new Date().toISOString(),
  };
}
function assignmentForRow(db, row) {
  return (
    dealerAssignmentForCode(db, row["Dealer Code"]) ||
    assignmentFromBooking(db, {
      dealerCode: row["Dealer Code"],
      region: row.Region,
      amNameFromFile: row.AM,
    })
  );
}

export function upsertBookings(db, rows, options = {}) {
  const validation = validateBookingRows(
    rows,
    options.requiredColumns || BOOKING_REQUIRED_COLUMNS,
  );
  const assignmentErrors = validation.valid
    ? validateDealerAssignments(rows, db)
    : [];
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
    uploadedAt: new Date().toISOString(),
  };
  if (!validation.valid) {
    db.fileUploads.unshift(storedUpload(upload, options.uploadedBy));
    return upload;
  }
  for (const row of rows) {
    const index = db.bookings.findIndex(
      (booking) =>
        booking.salesOrderId.toLowerCase() ===
        row["Sales Order Id"].toLowerCase(),
    );
    if (index >= 0) {
      db.bookings[index] = bookingFromRow(
        row,
        db.bookings[index],
        assignmentForRow(db, row),
      );
      upload.updatedRows += 1;
    } else {
      db.bookings.push(
        bookingFromRow(
          row,
          {},
          assignmentForRow(db, row),
        ),
      );
      upload.insertedRows += 1;
    }
  }
  db.fileUploads.unshift(storedUpload(upload, options.uploadedBy));
  return upload;
}
