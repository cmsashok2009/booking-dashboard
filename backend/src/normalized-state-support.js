export function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function json(value) {
  return JSON.stringify(value ?? null);
}

export function nullableDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString().slice(0, 23).replace("T", " ");
}

export function requiredDate(value) {
  return (
    nullableDate(value) ||
    new Date().toISOString().slice(0, 23).replace("T", " ")
  );
}

export function entity(value) {
  if (value && typeof value === "object") return value;
  if (typeof value === "string") return JSON.parse(value);
  return null;
}

export async function insertRows(connection, table, columns, rows) {
  if (!rows.length) return;
  const placeholders = rows
    .map(() => `(${columns.map(() => "?").join(", ")})`)
    .join(", ");
  try {
    await connection.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${placeholders}`,
      rows.flat(),
    );
  } catch (error) {
    error.persistenceTable = table;
    delete error.sql;
    throw error;
  }
}

export const DELETE_ORDER = [
  "email_delivery_events",
  "activation_tokens",
  "email_recipients",
  "email_campaigns",
  "email_template_versions",
  "email_templates",
  "email_template_samples",
  "onboarding_workflows",
  "password_reset_tokens",
  "sessions",
  "notifications",
  "file_uploads",
  "audit_logs",
  "email_oauth_states",
  "email_provider_connections",
  "bookings",
  "dealer_assignments",
  "dealer_codes",
  "lookup_options",
  "users",
  "regions",
  "roles",
  "runtime_metadata",
];

export const MODELED_KEYS = new Set([
  "roles",
  "regions",
  "users",
  "dealerCodes",
  "dealerAssignments",
  "lookupOptions",
  "bookings",
  "sessions",
  "passwordResetTokens",
  "onboardingWorkflows",
  "emailTemplateSamples",
  "emailTemplates",
  "emailTemplateVersions",
  "emailCampaigns",
  "activationTokens",
  "emailDeliveryEvents",
  "fileUploads",
  "auditLogs",
  "notifications",
  "emailProviderConnections",
  "emailOAuthStates",
]);
