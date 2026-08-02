const AREA_INPUT_ROLES = new Set([
  "Admin",
  "Area Manager",
  "Regional Manager",
  "All India",
  "All India I",
  "All India II"
]);

const REGIONAL_INPUT_ROLES = new Set(["Admin", "Regional Manager", "All India", "All India I", "All India II"]);

export function canViewAreaInputs(role) {
  return AREA_INPUT_ROLES.has(role);
}

export function canViewRegionalInputs(role) {
  return REGIONAL_INPUT_ROLES.has(role);
}

export function canEditAreaInputs(role) {
  return role === "Area Manager";
}

export function canEditRegionalInputs(role) {
  return role === "Regional Manager";
}
