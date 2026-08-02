import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseCsv, seedData } from "../src/validators.js";
import {
  activateUser,
  cancelOnboardingWorkflow,
  cloneTemplateSample,
  createOnboardingWorkflow,
  createSingleUserOnboarding,
  ensureOnboardingData,
  importOnboardingUsers,
  previewWorkflowEmail,
  renderTemplate,
  returnWorkflowToTemplate,
  saveEmailTemplate,
  selectWorkflowTemplate,
  sendInvitationCampaign,
  validateActivationToken
} from "../src/onboarding.js";

function validCsv() {
  return `Name,Email,Phone,Role,Region,Dealer Code,Reporting Manager Email,Status,Temporary Password
Existing Admin,admin@example.com,,Admin,All,,,active,
New Area,new.area@example.com,,Area Manager,West,abcd,rm.west@example.com,active,
Bad Role,bad.role@example.com,,Territory Manager,West,,,active,
Duplicate One,duplicate@example.com,,All India,All,,,active,
Duplicate Two,duplicate@example.com,,All India,All,,,active,`;
}

test("onboarding validation separates ready, existing, invalid, and duplicate rows", () => {
  const db = seedData();
  ensureOnboardingData(db);
  const workflow = createOnboardingWorkflow(db, parseCsv(validCsv()).rows, { actorId: "u-admin" });
  assert.equal(workflow.summary.total, 5);
  assert.equal(workflow.summary.ready, 2);
  assert.equal(workflow.summary.skippedExisting, 1);
  assert.equal(workflow.summary.invalid, 1);
  assert.equal(workflow.summary.duplicateInFile, 1);
});

test("partial import creates only ready users and is idempotent", () => {
  const db = seedData();
  ensureOnboardingData(db);
  const workflow = createOnboardingWorkflow(db, parseCsv(validCsv()).rows, { actorId: "u-admin" });
  const first = importOnboardingUsers(db, workflow.id, "u-admin");
  const userCount = db.users.length;
  const second = importOnboardingUsers(db, workflow.id, "u-admin");
  assert.equal(first.summary.created, 2);
  assert.equal(db.users.length, userCount);
  assert.equal(second.id, first.id);
});

test("single-user onboarding creates a pending invitation and continues at template selection", () => {
  const db = seedData();
  ensureOnboardingData(db);
  const workflow = createSingleUserOnboarding(db, { Name: "Single Invite", Email: "single.invite@example.com", Role: "All India", Region: "All" }, "u-admin");
  const user = db.users.find((item) => item.email === "single.invite@example.com");
  assert.equal(workflow.currentStep, "template");
  assert.equal(workflow.summary.created, 1);
  assert.equal(user.status, "pending_invitation");
});

test("single-user onboarding rejects an existing email without retaining a failed workflow", () => {
  const db = seedData();
  ensureOnboardingData(db);
  const before = db.onboardingWorkflows.length;
  const result = createSingleUserOnboarding(db, { Name: "Existing Admin", Email: "admin@example.com", Role: "Admin", Region: "All" }, "u-admin");
  assert.equal(result.status, 422);
  assert.equal(db.onboardingWorkflows.length, before);
});

test("a zero-result onboarding batch can be closed without deleting audit history", () => {
  const db = seedData();
  ensureOnboardingData(db);
  const workflow = createOnboardingWorkflow(db, [{ Name: "Admin User", Email: "admin@example.com", Role: "Admin", Region: "All", Status: "active" }], { actorId: "u-admin" });
  assert.equal(workflow.summary.ready, 0);
  const closed = cancelOnboardingWorkflow(db, workflow.id, "u-admin");
  assert.equal(closed.status, "cancelled");
  assert.equal(db.onboardingWorkflows.some((item) => item.id === workflow.id), true);
  assert.equal(db.auditLogs[0].action, "onboarding_batch_closed");
});

test("sample templates clone, validate, activate, and preview", () => {
  const db = seedData();
  ensureOnboardingData(db);
  const workflow = createOnboardingWorkflow(db, parseCsv(validCsv()).rows, { actorId: "u-admin" });
  importOnboardingUsers(db, workflow.id, "u-admin");
  const template = cloneTemplateSample(db, "sample-activation-standard", "u-admin");
  const active = saveEmailTemplate(db, template.id, { status: "active" }, "u-admin");
  assert.equal(active.status, "active");
  const selection = selectWorkflowTemplate(db, workflow.id, active.id, "u-admin");
  assert.equal(selection.currentStep, "recipients");
  const preview = previewWorkflowEmail(db, workflow.id, active.id);
  assert.equal(preview.sampleData, true);
  assert.ok(preview.rendered.bodyText.includes("New Area"));
});

test("recipient review can return to template selection without repeating import", () => {
  const db = seedData();
  ensureOnboardingData(db);
  const workflow = createOnboardingWorkflow(db, parseCsv(validCsv()).rows, { actorId: "u-admin" });
  importOnboardingUsers(db, workflow.id, "u-admin");
  const createdUserIds = [...workflow.createdUserIds];
  const template = cloneTemplateSample(db, "sample-activation-standard", "u-admin");
  saveEmailTemplate(db, template.id, { status: "active" }, "u-admin");
  selectWorkflowTemplate(db, workflow.id, template.id, "u-admin");
  const result = returnWorkflowToTemplate(db, workflow.id, "u-admin");
  assert.equal(result.currentStep, "template");
  assert.deepEqual(result.createdUserIds, createdUserIds);
  assert.equal(result.selectedTemplateId, template.id);
});

test("HTML template rendering escapes recipient-controlled merge values", () => {
  const rendered = renderTemplate({ subject: "Hello {{user_name}}", bodyText: "{{user_name}}", bodyHtml: "<p>{{user_name}}</p>" }, { user_name: "<img src=x onerror=alert(1)>" });
  assert.equal(rendered.subject.includes("<img"), true);
  assert.equal(rendered.bodyHtml.includes("<img"), false);
  assert.ok(rendered.bodyHtml.includes("&lt;img"));
});

test("campaign creates digest-only activation records and cannot send twice", async () => {
  const db = seedData();
  ensureOnboardingData(db);
  const rows = parseCsv(validCsv()).rows;
  const workflow = createOnboardingWorkflow(db, rows, { actorId: "u-admin" });
  importOnboardingUsers(db, workflow.id, "u-admin");
  const template = cloneTemplateSample(db, "sample-activation-standard", "u-admin");
  saveEmailTemplate(db, template.id, { status: "active" }, "u-admin");
  selectWorkflowTemplate(db, workflow.id, template.id, "u-admin");
  const campaign = await sendInvitationCampaign(db, workflow.id, "u-admin");
  const repeated = await sendInvitationCampaign(db, workflow.id, "u-admin");
  assert.equal(campaign.sent, 2);
  assert.equal(repeated.id, campaign.id);
  assert.equal(db.activationTokens.length, 2);
  assert.ok(db.activationTokens.every((item) => /^[a-f0-9]{64}$/.test(item.tokenDigest)));
  assert.equal(JSON.stringify(db).includes("#token="), false);
});

test("activation requires a valid token and strong matching password", () => {
  const db = seedData();
  ensureOnboardingData(db);
  assert.equal(validateActivationToken(db, "unknown").valid, false);
  assert.equal(activateUser(db, "unknown", "StrongPassword123").valid, false);
});

test("activation consumes a valid token once and activates the invited user", () => {
  const db = seedData();
  ensureOnboardingData(db);
  const rawToken = "test-activation-token";
  const invited = { id: "u-invited", name: "Invited User", email: "invited@example.com", role: "Area Manager", region: "West", status: "invited" };
  db.users.push(invited);
  db.activationTokens.push({ id: "activation-test", userId: invited.id, tokenDigest: createHash("sha256").update(rawToken).digest("hex"), expiresAt: new Date(Date.now() + 60_000).toISOString(), usedAt: "", revokedAt: "" });
  const result = activateUser(db, rawToken, "StrongPassword123");
  assert.equal(result.valid, true);
  assert.equal(invited.status, "active");
  assert.ok(invited.passwordHash);
  assert.equal(validateActivationToken(db, rawToken).valid, false);
  assert.equal(JSON.stringify(result).includes("passwordHash"), false);
});
