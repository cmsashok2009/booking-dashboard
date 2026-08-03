export const ROLE_DEFINITIONS = [
  {
    code: "AM",
    name: "Area Manager",
    hierarchyLevel: 1,
    managerRoleCode: "RM",
    isActive: true,
    isSystem: true,
  },
  {
    code: "RM",
    name: "Regional Manager",
    hierarchyLevel: 2,
    managerRoleCode: "ALL_INDIA_I",
    isActive: true,
    isSystem: true,
  },
  {
    code: "ALL_INDIA_I",
    name: "All India I",
    hierarchyLevel: 3,
    managerRoleCode: "ALL_INDIA_II",
    isActive: true,
    isSystem: true,
  },
  {
    code: "ALL_INDIA_II",
    name: "All India II",
    hierarchyLevel: 4,
    managerRoleCode: "ALL_INDIA",
    isActive: true,
    isSystem: true,
  },
  {
    code: "ALL_INDIA",
    name: "All India",
    hierarchyLevel: 5,
    managerRoleCode: null,
    isActive: true,
    isSystem: true,
  },
  {
    code: "ADMIN",
    name: "Admin",
    hierarchyLevel: 99,
    managerRoleCode: null,
    isActive: true,
    isSystem: true,
  },
];

export function normalizeRoleDefinitions(roles = []) {
  const stored = new Map(
    roles.map((role) => [typeof role === "string" ? role : role.name, role]),
  );
  return ROLE_DEFINITIONS.map((definition) => {
    const current = stored.get(definition.name);
    return typeof current === "object"
      ? {
          ...definition,
          ...current,
          name: definition.name,
          code: definition.code,
        }
      : { ...definition };
  });
}
export function activeRoleNames(db) {
  return normalizeRoleDefinitions(db.roles)
    .filter((role) => role.isActive)
    .map((role) => role.name);
}
