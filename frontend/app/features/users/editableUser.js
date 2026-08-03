const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function editableUserValues(user) {
  return {
    name: user.name || "",
    email: user.email || "",
    role: user.role || "",
    region: user.region || "",
    dealerCode: user.dealerCode || "",
    status: user.status || ""
  };
}

export function validateEditableUser(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = "Name is required.";
  if (!values.email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email address.";
  if (!values.role) errors.role = "Role is required.";
  if (!values.region) errors.region = "Region is required.";
  if (!values.status) errors.status = "Status is required.";
  return errors;
}

export function editableUserServerErrors(items = []) {
  const fieldMap = {
    Name: "name",
    Email: "email",
    Role: "role",
    Region: "region",
    "Dealer Code": "dealerCode",
    Status: "status"
  };
  return Object.fromEntries(items.map((item) => [fieldMap[item.columnName] || item.columnName, item.errorMessage]));
}

export function editableUserRegionChange(current, region, dealerCodes) {
  const selectedDealer = dealerCodes.find((item) => item.code === current.dealerCode);
  return {
    ...current,
    region,
    dealerCode: selectedDealer && selectedDealer.region !== region ? "" : current.dealerCode
  };
}
