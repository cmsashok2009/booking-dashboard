const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function editableUserValues(user) {
  return {
    name: user.name || "",
    email: user.email || "",
    role: user.role || "",
    region: user.region || "",
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
