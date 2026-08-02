export function sanitizeSpreadsheetValue(value) {
  if (typeof value !== "string") return value;
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
}
