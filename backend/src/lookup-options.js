export const LOOKUP_FIELDS = [
  "bookingCategory",
  "wholesalesFeedback",
  "wsPlanning",
  "cancellationReason",
];

export function makeOptionId(fieldCode, label, index = 0) {
  const slug = String(label || "option")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${fieldCode}-${slug || "option"}-${index}`;
}
export function migrateLookupOptions(lookups = {}) {
  return Object.fromEntries(
    LOOKUP_FIELDS.map((fieldCode) => [
      fieldCode,
      (lookups[fieldCode] || []).map((label, index) => ({
        id: makeOptionId(fieldCode, label, index),
        label,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    ]),
  );
}

export function activeLookups(lookupOptions = {}) {
  return Object.fromEntries(
    LOOKUP_FIELDS.map((fieldCode) => [
      fieldCode,
      (lookupOptions[fieldCode] || [])
        .filter((option) => option.status === "active")
        .map((option) => option.label),
    ]),
  );
}

export function syncActiveLookups(db) {
  db.lookups = activeLookups(db.lookupOptions);
}

export function normalizeOptionLabel(label) {
  return String(label || "").trim();
}
