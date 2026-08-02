import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { activeRoleNames, validateSingleUser } from "./validators.js";
import { deliverEmail, verifyEmailTransport } from "./mailer.js";
import { ensureGoogleEmailData } from "./google-email-provider.js";

export const ACTIVATION_TOKENS = ["user_name", "login_email", "activation_link", "activation_expiry", "login_url", "role", "region", "reporting_manager", "support_email"];
const REQUIRED_ACTIVATION_TOKENS = ["user_name", "activation_link", "activation_expiry", "support_email"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SAMPLE_TEMPLATES = [
  {
    id: "sample-activation-standard",
    name: "User Account Activation - Standard",
    description: "A complete account invitation with role and expiry information.",
    type: "user_activation",
    subject: "Activate your Booking Dashboard account",
    bodyText: "Hello {{user_name}},\n\nYour Booking Dashboard account is ready. Use this secure link to create your password: {{activation_link}}\n\nThis link expires {{activation_expiry}}. Your login email is {{login_email}} and your role is {{role}}.\n\nSupport: {{support_email}}",
    bodyHtml: "<p>Hello <strong>{{user_name}}</strong>,</p><p>Your Booking Dashboard account is ready.</p><p><a href=\"{{activation_link}}\">Create your password</a></p><p>This link expires {{activation_expiry}}. Your login email is {{login_email}} and your role is {{role}}.</p><p>Support: {{support_email}}</p>",
    isSystem: true,
    status: "active",
    reviewedAt: "2026-07-29T00:00:00.000Z"
  },
  {
    id: "sample-activation-concise",
    name: "User Account Activation - Concise",
    description: "A shorter invitation for familiar internal users.",
    type: "user_activation",
    subject: "Your Booking Dashboard access is ready",
    bodyText: "Hello {{user_name}},\n\nCreate your password using {{activation_link}}. The link expires {{activation_expiry}}.\n\n{{support_email}}",
    bodyHtml: "<p>Hello {{user_name}},</p><p><a href=\"{{activation_link}}\">Create your password</a>. This link expires {{activation_expiry}}.</p><p>{{support_email}}</p>",
    isSystem: true,
    status: "active",
    reviewedAt: "2026-07-29T00:00:00.000Z"
  },
  {
    id: "sample-activation-role-aware",
    name: "User Account Activation - Role Aware",
    description: "Highlights the assigned role, region, and reporting manager.",
    type: "user_activation",
    subject: "Booking Dashboard access for {{role}}",
    bodyText: "Hello {{user_name}},\n\nYou have been invited as {{role}} for {{region}}. Reporting manager: {{reporting_manager}}.\n\nCreate your password: {{activation_link}}\nExpires: {{activation_expiry}}\nSupport: {{support_email}}",
    bodyHtml: "<p>Hello {{user_name}},</p><p>You have been invited as <strong>{{role}}</strong> for {{region}}. Reporting manager: {{reporting_manager}}.</p><p><a href=\"{{activation_link}}\">Create your password</a></p><p>Expires: {{activation_expiry}}<br>Support: {{support_email}}</p>",
    isSystem: true,
    status: "active",
    reviewedAt: "2026-07-29T00:00:00.000Z"
  }
];

function id(prefix) {
  return `${prefix}-${Date.now()}-${randomBytes(5).toString("hex")}`;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function safeUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export function ensureOnboardingData(db) {
  let changed = false;
  for (const [key, fallback] of Object.entries({
    onboardingWorkflows: [],
    emailTemplateSamples: SAMPLE_TEMPLATES,
    emailTemplates: [],
    emailCampaigns: [],
    activationTokens: [],
    emailDeliveryEvents: [],
    sessions: []
  })) {
    if (!Array.isArray(db[key])) {
      db[key] = structuredClone(fallback);
      changed = true;
    }
  }
  if (!db.emailTemplateSamples.length) {
    db.emailTemplateSamples = structuredClone(SAMPLE_TEMPLATES);
    changed = true;
  }
  if (ensureGoogleEmailData(db)) changed = true;
  return changed;
}

function summarizeRows(rows) {
  const summary = { total: rows.length, ready: 0, created: 0, skippedExisting: 0, duplicateInFile: 0, invalid: 0, failed: 0 };
  for (const row of rows) {
    if (row.outcome === "ready") summary.ready += 1;
    if (row.outcome === "created") summary.created += 1;
    if (row.outcome === "skipped_existing") summary.skippedExisting += 1;
    if (row.outcome === "duplicate_in_file") summary.duplicateInFile += 1;
    if (["invalid", "dependency_error"].includes(row.outcome)) summary.invalid += 1;
    if (row.outcome === "failed") summary.failed += 1;
  }
  return summary;
}

export function createOnboardingWorkflow(db, rows, { fileName = "user-upload.csv", actorId = "u-admin" } = {}) {
  ensureOnboardingData(db);
  const now = new Date().toISOString();
  const existingEmails = new Set(db.users.map((user) => normalizeEmail(user.email)));
  const uploadEmails = new Set();
  const virtualUsers = rows.map((row, index) => ({
    id: `batch-user-${index}`,
    name: row.Name || row.name || "",
    email: normalizeEmail(row.Email || row.email),
    role: row.Role || row.role || "",
    status: String(row.Status || row.status || "active").toLowerCase()
  })).filter((user) => user.email);
  const validationDb = { ...db, users: [...db.users, ...virtualUsers] };

  const outcomes = rows.map((source, index) => {
    const email = normalizeEmail(source.Email || source.email);
    const base = { id: id("import-row"), rowNumber: index + 2, source, name: source.Name || source.name || "", email, role: source.Role || source.role || "", region: source.Region || source.region || "", errors: [] };
    if (email && uploadEmails.has(email)) return { ...base, outcome: "duplicate_in_file", errors: [{ columnName: "Email", errorMessage: "Email appears more than once in this upload", rawValue: email }] };
    if (email) uploadEmails.add(email);
    if (email && existingEmails.has(email)) return { ...base, outcome: "skipped_existing", errors: [{ columnName: "Email", errorMessage: "An existing user already has this email", rawValue: email }] };
    const validation = validateSingleUser(source, validationDb, index + 2);
    if (!validation.valid) return { ...base, outcome: "invalid", errors: validation.errors };
    return { ...base, outcome: "ready" };
  });

  const invalidEmails = new Set(outcomes.filter((row) => !["ready", "skipped_existing"].includes(row.outcome)).map((row) => row.email));
  for (const outcome of outcomes.filter((row) => row.outcome === "ready")) {
    const managerEmail = normalizeEmail(outcome.source["Reporting Manager Email"] || outcome.source.reportingManagerEmail);
    if (managerEmail && invalidEmails.has(managerEmail)) {
      outcome.outcome = "dependency_error";
      outcome.errors.push({ columnName: "Reporting Manager Email", errorMessage: "The reporting manager row in this upload is invalid", rawValue: managerEmail });
    }
  }

  const workflow = {
    id: id("onboarding"),
    fileName,
    ownerUserId: actorId,
    status: "validation_review",
    currentStep: "validation",
    version: 1,
    rows: outcomes,
    summary: summarizeRows(outcomes),
    createdUserIds: [],
    excludedRecipientIds: [],
    selectedTemplateId: "",
    selectedTemplateVersion: 0,
    campaignId: "",
    createdAt: now,
    updatedAt: now
  };
  db.onboardingWorkflows.unshift(workflow);
  return workflow;
}

export function createSingleUserOnboarding(db, input, actorId = "u-admin") {
  const email = normalizeEmail(input.Email || input.email);
  const workflow = createOnboardingWorkflow(db, [{ ...input, Status: "active" }], {
    fileName: `single-user-${email || "new"}`,
    actorId
  });
  if (workflow.summary.ready !== 1) {
    db.onboardingWorkflows = db.onboardingWorkflows.filter((item) => item.id !== workflow.id);
    const errors = workflow.rows.flatMap((row) => row.errors.map((error) => ({ ...error, rowNumber: 1 })));
    return { error: errors[0]?.errorMessage || "User validation failed", errors, status: 422 };
  }
  return importOnboardingUsers(db, workflow.id, actorId);
}

export function importOnboardingUsers(db, workflowId, actorId = "u-admin") {
  const workflow = db.onboardingWorkflows.find((item) => item.id === workflowId);
  if (!workflow) return { error: "Onboarding workflow not found", status: 404 };
  if (workflow.ownerUserId !== actorId) return { error: "This workflow is owned by another Admin", status: 409 };
  if (workflow.currentStep !== "validation") return workflow;
  const now = new Date().toISOString();
  for (const row of workflow.rows.filter((item) => item.outcome === "ready")) {
    if (db.users.some((user) => normalizeEmail(user.email) === row.email)) {
      row.outcome = "skipped_existing";
      row.errors = [{ columnName: "Email", errorMessage: "User was created after validation and has been skipped", rawValue: row.email }];
      continue;
    }
    const source = row.source;
    const user = {
      id: id("u"),
      name: source.Name || source.name,
      email: row.email,
      phone: source.Phone || source.phone || "",
      role: source.Role || source.role,
      region: source.Region || source.region || "",
      dealerCode: source["Dealer Code"] || source.dealerCode || "",
      reportingManagerEmail: source["Reporting Manager Email"] || source.reportingManagerEmail || "",
      status: "pending_invitation",
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now
    };
    db.users.push(user);
    workflow.createdUserIds.push(user.id);
    row.userId = user.id;
    row.outcome = "created";
  }
  workflow.summary = summarizeRows(workflow.rows);
  workflow.status = "template_selection";
  workflow.currentStep = "template";
  workflow.version += 1;
  workflow.updatedAt = now;
  db.auditLogs.unshift({ id: id("audit"), action: "user_onboarding_imported", entityId: workflow.id, userId: actorId, outcome: workflow.summary, createdAt: now });
  return workflow;
}

export function listOnboardingWorkflows(db, actorId) {
  return db.onboardingWorkflows.filter((item) => !actorId || item.ownerUserId === actorId).map((item) => ({ ...item, rows: undefined }));
}

export function cancelOnboardingWorkflow(db, workflowId, actorId = "u-admin") {
  const workflow = db.onboardingWorkflows.find((item) => item.id === workflowId);
  if (!workflow) return { error: "Onboarding workflow not found", status: 404 };
  if (workflow.ownerUserId !== actorId) return { error: "This workflow is owned by another Admin", status: 409 };
  if (workflow.status === "completed") return { error: "A completed invitation campaign cannot be closed", status: 409 };
  if (workflow.status === "cancelled") return workflow;
  const now = new Date().toISOString();
  const removableUserIds = new Set(
    workflow.campaignId
      ? []
      : workflow.createdUserIds.filter((userId) =>
          db.users.some((user) => user.id === userId && user.status === "pending_invitation")
        )
  );
  db.users = db.users.filter((user) => !removableUserIds.has(user.id));
  db.activationTokens = db.activationTokens.filter((token) => !removableUserIds.has(token.userId));
  workflow.status = "cancelled";
  workflow.currentStep = "cancelled";
  workflow.cancelledAt = now;
  workflow.updatedAt = now;
  workflow.version += 1;
  workflow.removedUserCount = removableUserIds.size;
  db.auditLogs.unshift({
    id: id("audit"),
    action: "onboarding_batch_closed",
    entityId: workflow.id,
    userId: actorId,
    outcome: { removedPendingUsers: removableUserIds.size },
    createdAt: now
  });
  return workflow;
}

function templateTokens(text) {
  return [...String(text || "").matchAll(/{{\s*([a-z0-9_]+)\s*}}/gi)].map((match) => match[1]);
}

export function validateTemplate(input) {
  const errors = [];
  if (!String(input.name || "").trim()) errors.push({ field: "name", message: "Template name is required" });
  if (!String(input.subject || "").trim()) errors.push({ field: "subject", message: "Subject is required" });
  if (!String(input.bodyText || "").trim()) errors.push({ field: "bodyText", message: "Plain-text body is required" });
  const allTokens = new Set([...templateTokens(input.subject), ...templateTokens(input.bodyText), ...templateTokens(input.bodyHtml)]);
  for (const token of allTokens) if (!ACTIVATION_TOKENS.includes(token)) errors.push({ field: "mergeFields", message: `Unknown merge field: {{${token}}}` });
  for (const token of REQUIRED_ACTIVATION_TOKENS) if (!allTokens.has(token)) errors.push({ field: "mergeFields", message: `Required merge field is missing: {{${token}}}` });
  if (/<script\b/i.test(String(input.bodyHtml || ""))) errors.push({ field: "bodyHtml", message: "Script content is not allowed" });
  if (/\bon[a-z]+\s*=/i.test(String(input.bodyHtml || "")) || /javascript\s*:/i.test(String(input.bodyHtml || ""))) errors.push({ field: "bodyHtml", message: "Unsafe HTML attributes or URLs are not allowed" });
  return { valid: !errors.length, errors };
}

export function cloneTemplateSample(db, sampleId, actorId = "u-admin") {
  const sample = db.emailTemplateSamples.find((item) => item.id === sampleId);
  if (!sample) return { error: "Sample template not found", status: 404 };
  const now = new Date().toISOString();
  const template = { ...structuredClone(sample), id: id("template"), sourceSampleId: sample.id, name: sample.name.replace(" - Standard", ""), isSystem: false, status: "draft", version: 1, createdBy: actorId, createdAt: now, updatedAt: now };
  db.emailTemplates.unshift(template);
  return template;
}

export function saveEmailTemplate(db, templateId, input, actorId = "u-admin") {
  const template = db.emailTemplates.find((item) => item.id === templateId);
  if (!template) return { error: "Email template not found", status: 404 };
  const candidate = { ...template, ...input, id: template.id, isSystem: false };
  const validation = validateTemplate(candidate);
  if (!validation.valid) return { ...validation, error: "Template validation failed", status: 422 };
  Object.assign(template, candidate, { version: template.version + 1, updatedBy: actorId, updatedAt: new Date().toISOString() });
  return template;
}

export function renderTemplate(template, values) {
  const replace = (text, transform = (value) => value) => String(text || "").replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key) => transform(String(values[key] ?? "NA")));
  const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  return { subject: replace(template.subject), bodyText: replace(template.bodyText), bodyHtml: replace(template.bodyHtml, escapeHtml) };
}

export function selectWorkflowTemplate(db, workflowId, templateId, actorId = "u-admin") {
  const workflow = db.onboardingWorkflows.find((item) => item.id === workflowId);
  const template = db.emailTemplates.find((item) => item.id === templateId && item.status === "active");
  if (!workflow) return { error: "Onboarding workflow not found", status: 404 };
  if (workflow.ownerUserId !== actorId) return { error: "This workflow is owned by another Admin", status: 409 };
  if (!template) return { error: "Select an active activation template", status: 422 };
  workflow.selectedTemplateId = template.id;
  workflow.selectedTemplateVersion = template.version;
  workflow.currentStep = "recipients";
  workflow.status = "recipient_review";
  workflow.version += 1;
  workflow.updatedAt = new Date().toISOString();
  return workflow;
}

export function returnWorkflowToTemplate(db, workflowId, actorId = "u-admin") {
  const workflow = db.onboardingWorkflows.find((item) => item.id === workflowId);
  if (!workflow) return { error: "Onboarding workflow not found", status: 404 };
  if (workflow.ownerUserId !== actorId) return { error: "This workflow is owned by another Admin", status: 409 };
  if (workflow.campaignId || workflow.currentStep === "delivery" || workflow.status === "completed") {
    return { error: "A sent invitation campaign cannot return to template selection", status: 409 };
  }
  if (workflow.currentStep !== "recipients") {
    return { error: "Back navigation is only available during recipient review", status: 409 };
  }
  const now = new Date().toISOString();
  workflow.currentStep = "template";
  workflow.status = "template_selection";
  workflow.updatedAt = now;
  workflow.version += 1;
  db.auditLogs.unshift({ id: id("audit"), action: "onboarding_returned_to_template", entityId: workflow.id, userId: actorId, createdAt: now });
  return workflow;
}

export function workflowRecipients(db, workflow) {
  const excluded = new Set(workflow.excludedRecipientIds || []);
  return workflow.createdUserIds.map((userId) => db.users.find((user) => user.id === userId)).filter((user) => user && !excluded.has(user.id) && user.status === "pending_invitation").map(safeUser);
}

function tokenDigest(token) {
  return createHash("sha256").update(token).digest("hex");
}

function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored?.includes(":")) return false;
  const [salt, expectedHex] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function sendInvitationCampaign(db, workflowId, actorId = "u-admin", appUrl = "http://localhost:3000") {
  const workflow = db.onboardingWorkflows.find((item) => item.id === workflowId);
  if (!workflow) return { error: "Onboarding workflow not found", status: 404 };
  if (workflow.campaignId) return db.emailCampaigns.find((item) => item.id === workflow.campaignId);
  const template = db.emailTemplates.find((item) => item.id === workflow.selectedTemplateId && item.status === "active");
  if (!template) return { error: "The selected template is no longer active", status: 422 };
  const recipients = workflowRecipients(db, workflow);
  if (!recipients.length) return { error: "No eligible recipients remain", status: 422 };
  try {
    await verifyEmailTransport(db);
  } catch (error) {
    const code = error.code || "EMAIL_DELIVERY_UNAVAILABLE";
    const recovery = code === "EMAIL_NOT_CONNECTED"
      ? "Connect a Google sender in Email Configuration, then return here and try again."
      : "Review Email Configuration, then return here and try again.";
    return {
      error: `Activation emails were not sent. The users and onboarding progress are saved. ${recovery}`,
      code,
      status: 503
    };
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const campaign = { id: id("campaign"), workflowId, templateId: template.id, templateVersion: template.version, status: "completed", total: recipients.length, sent: 0, failed: 0, recipients: [], createdBy: actorId, createdAt: now.toISOString(), completedAt: "" };
  for (const user of recipients) {
    for (const existing of db.activationTokens.filter((item) => item.userId === user.id && !item.usedAt && !item.revokedAt)) existing.revokedAt = now.toISOString();
    const rawToken = randomBytes(32).toString("base64url");
    db.activationTokens.push({ id: id("activation"), userId: user.id, tokenDigest: tokenDigest(rawToken), expiresAt, usedAt: "", revokedAt: "", createdAt: now.toISOString() });
    const manager = db.users.find((item) => normalizeEmail(item.email) === normalizeEmail(user.reportingManagerEmail));
    const values = { user_name: user.name, login_email: user.email, activation_link: `${appUrl}/activate#token=${rawToken}`, activation_expiry: new Date(expiresAt).toLocaleString("en-IN"), login_url: `${appUrl}/`, role: user.role, region: user.region || "All", reporting_manager: manager?.name || "NA", support_email: process.env.SUPPORT_EMAIL || "support@example.com" };
    const rendered = renderTemplate(template, values);
    const attemptedAt = new Date().toISOString();
    const recipient = { id: id("recipient"), userId: user.id, email: user.email, name: user.name, status: "pending", provider: "", providerReference: "", renderedSubject: rendered.subject, attemptedAt, sentAt: "", failureReason: "" };
    campaign.recipients.push(recipient);
    try {
      const delivery = await deliverEmail({ to: user.email, subject: rendered.subject, text: rendered.bodyText, html: rendered.bodyHtml }, { db });
      recipient.status = "sent";
      recipient.provider = delivery.provider;
      recipient.providerReference = delivery.reference;
      recipient.sentAt = new Date().toISOString();
      campaign.sent += 1;
      user.status = "invited";
      user.invitedAt = recipient.sentAt;
      db.emailDeliveryEvents.unshift({ id: id("delivery"), campaignId: campaign.id, recipientId: recipient.id, userId: user.id, eventType: "sent", provider: delivery.provider, providerReference: delivery.reference, createdAt: recipient.sentAt });
    } catch (error) {
      recipient.status = "failed";
      recipient.provider = String(process.env.EMAIL_TRANSPORT || "mock");
      recipient.failureReason = error.code || "EMAIL_DELIVERY_FAILED";
      campaign.failed += 1;
      const activation = db.activationTokens.find((item) => item.userId === user.id && item.tokenDigest === tokenDigest(rawToken));
      if (activation) activation.revokedAt = new Date().toISOString();
      db.emailDeliveryEvents.unshift({ id: id("delivery"), campaignId: campaign.id, recipientId: recipient.id, userId: user.id, eventType: "failed", provider: recipient.provider, failureReason: recipient.failureReason, createdAt: new Date().toISOString() });
    }
  }
  campaign.status = campaign.failed === 0 ? "completed" : campaign.sent === 0 ? "failed" : "partially_completed";
  campaign.completedAt = new Date().toISOString();
  db.emailCampaigns.unshift(campaign);
  workflow.campaignId = campaign.id;
  workflow.currentStep = "delivery";
  workflow.status = "completed";
  workflow.updatedAt = campaign.completedAt;
  db.auditLogs.unshift({ id: id("audit"), action: "activation_campaign_sent", entityId: campaign.id, userId: actorId, outcome: { sent: campaign.sent, failed: campaign.failed }, createdAt: campaign.completedAt });
  return campaign;
}

export function validateActivationToken(db, rawToken) {
  const digest = tokenDigest(String(rawToken || ""));
  const token = db.activationTokens.find((item) => item.tokenDigest === digest);
  if (!token || token.revokedAt || token.usedAt || Date.parse(token.expiresAt) <= Date.now()) return { valid: false, error: "This activation link is invalid or has expired" };
  const user = db.users.find((item) => item.id === token.userId);
  if (!user || !["pending_invitation", "invited"].includes(user.status)) return { valid: false, error: "This account is not eligible for activation" };
  return { valid: true, token, user: safeUser(user) };
}

export function activateUser(db, rawToken, password) {
  const validation = validateActivationToken(db, rawToken);
  if (!validation.valid) return validation;
  const errors = [];
  if (String(password || "").length < 10) errors.push("Password must contain at least 10 characters");
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) errors.push("Use uppercase, lowercase, and a number");
  if (errors.length) return { valid: false, error: "Password does not meet the security requirements", errors };
  const now = new Date().toISOString();
  validation.user = db.users.find((item) => item.id === validation.token.userId);
  validation.user.passwordHash = passwordHash(password);
  validation.user.status = "active";
  validation.user.activatedAt = now;
  validation.user.updatedAt = now;
  validation.token.usedAt = now;
  db.auditLogs.unshift({ id: id("audit"), action: "user_activated", entityId: validation.user.id, userId: validation.user.id, createdAt: now });
  return { valid: true, user: safeUser(validation.user) };
}

export function previewWorkflowEmail(db, workflowId, templateId) {
  const workflow = db.onboardingWorkflows.find((item) => item.id === workflowId);
  const template = db.emailTemplates.find((item) => item.id === templateId);
  if (!workflow || !template) return { error: "Workflow or template not found", status: 404 };
  const recipients = workflowRecipients(db, workflow);
  const sample = recipients[0] || { name: "Sample User", email: "sample.user@example.com", role: "Area Manager", region: "West", reportingManagerEmail: "manager@example.com" };
  const rendered = renderTemplate(template, { user_name: sample.name, login_email: sample.email, activation_link: "https://example.com/activate/sample-link", activation_expiry: "30 July 2026, 5:00 PM", login_url: "https://example.com/login", role: sample.role, region: sample.region, reporting_manager: "Sample Manager", support_email: "support@example.com" });
  return { rendered, recipients, sampleData: true };
}

export function publicCampaign(campaign) {
  if (!campaign) return null;
  return { ...campaign, recipients: campaign.recipients.map(({ renderedSubject, ...recipient }) => recipient) };
}

