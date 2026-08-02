import { excelColumns } from "../constants/dashboard";
import { readPath } from "./bookings";
import { sanitizeSpreadsheetValue } from "./spreadsheet";

const userExportColumns = [
  ["name", "Name", 26],
  ["email", "Email", 34],
  ["phone", "Phone", 18],
  ["role", "Role", 22],
  ["region", "Region", 16],
  ["dealerCode", "Dealer Code", 16],
  ["reportingManagerEmail", "Reporting Manager Email", 34],
  ["status", "Status", 14]
];

function safeRow(entries) {
  return Object.fromEntries(entries.map(([key, value]) => [key, sanitizeSpreadsheetValue(value)]));
}

function styleWorksheet(worksheet, columnCount) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: "A1", to: worksheet.getRow(1).getCell(columnCount).address };
  worksheet.properties.defaultRowHeight = 20;
  const header = worksheet.getRow(1);
  header.height = 28;
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Aptos", size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4F8A" } };
  header.alignment = { vertical: "middle" };
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
  });
}

async function saveWorkbook(workbook, fileName) {
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadBookingsExcel(bookings) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Booking Dashboard";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Bookings");
  worksheet.columns = excelColumns.map(([key, header]) => ({
    key,
    header,
    width: key.startsWith("regionalInputs.") ? 34 : Math.max(14, Math.min(24, header.length + 4))
  }));
  bookings.forEach((booking) => worksheet.addRow(safeRow(excelColumns.map(([key]) => [key, readPath(booking, key)]))));
  styleWorksheet(worksheet, excelColumns.length);
  await saveWorkbook(workbook, `bookings-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function downloadUsersExcel(users) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Booking Dashboard";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Users");
  worksheet.columns = userExportColumns.map(([key, header, width]) => ({ key, header, width }));
  users.forEach((user) => worksheet.addRow(safeRow(userExportColumns.map(([key]) => [key, user[key] || ""]))));
  styleWorksheet(worksheet, userExportColumns.length);
  await saveWorkbook(workbook, `users-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
