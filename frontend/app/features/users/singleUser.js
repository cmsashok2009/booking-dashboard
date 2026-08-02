export function getSingleUserRequirements(role, roleDefinitions = []) {
  const definition = roleDefinitions.find((item) => item.name === role);
  return {
    needsRegion: ["Area Manager", "Regional Manager"].includes(role),
    needsManager: Boolean(definition?.managerRoleCode),
    managerRole: roleDefinitions.find((item) => item.code === definition?.managerRoleCode)?.name
  };
}

export function validateSingleUser(values, roleDefinitions = []) {
  const errors = {};
  const requirements = getSingleUserRequirements(values.Role, roleDefinitions);
  if (!String(values.Name || "").trim()) errors.Name = "Name is required.";
  if (!String(values.Email || "").trim()) errors.Email = "Email is required.";
  if (!values.Role) errors.Role = "Role is required.";
  if (requirements.needsRegion && !values.Region) errors.Region = `Region is required for ${values.Role}.`;
  if (requirements.needsManager && !String(values["Reporting Manager Email"] || "").trim()) {
    errors["Reporting Manager Email"] = `Reporting Manager Email is required for ${values.Role}.`;
  }
  return errors;
}

export function buildSingleUserPayload(values, roleDefinitions = []) {
  const requirements = getSingleUserRequirements(values.Role, roleDefinitions);
  return {
    ...values,
    Region: requirements.needsRegion ? values.Region : "All",
    "Reporting Manager Email": requirements.needsManager ? values["Reporting Manager Email"] : "",
    Status: "active"
  };
}
