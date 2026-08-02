import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { seedData } from "../src/validators.js";
import { activateUser } from "../src/onboarding.js";
import { changePassword, adminSetTemporaryPassword, requestPasswordReset, resetPassword, validatePasswordResetToken } from "../src/passwords.js";

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function activeUserWithPassword(db, password = "OriginalPass123") {
  const user = db.users.find((item) => item.id === "u-admin");
  user.status = "invited";
  db.activationTokens = [{ id: "activation-test", userId: user.id, tokenDigest: digest("activation-token"), expiresAt: new Date(Date.now() + 60_000).toISOString(), usedAt: "", revokedAt: "", createdAt: new Date().toISOString() }];
  const activated = activateUser(db, "activation-token", password);
  assert.equal(activated.valid, true);
  return user;
}

test("forgot password response does not reveal whether an account exists", async () => {
  const db = seedData();
  db.auditLogs = [];
  db.passwordResetTokens = [];
  const known = await requestPasswordReset(db, "admin@example.com");
  const unknown = await requestPasswordReset(db, "missing@example.com");
  assert.deepEqual(known, { accepted: true });
  assert.deepEqual(unknown, { accepted: true });
  assert.equal(db.passwordResetTokens.length, 1);
  assert.equal("rawToken" in db.passwordResetTokens[0], false);
});

test("password reset tokens are single-use and revoke existing sessions", () => {
  const db = seedData();
  const user = activeUserWithPassword(db);
  db.passwordResetTokens = [{ id: "reset-test", userId: user.id, tokenDigest: digest("reset-token"), expiresAt: new Date(Date.now() + 60_000).toISOString(), usedAt: "", revokedAt: "", createdAt: new Date().toISOString() }];
  db.sessions = [{ id: "session-test", userId: user.id, tokenDigest: "digest", expiresAt: new Date(Date.now() + 60_000).toISOString(), revokedAt: "" }];
  assert.equal(validatePasswordResetToken(db, "reset-token").valid, true);
  assert.equal(resetPassword(db, "reset-token", "ReplacementPass456").valid, true);
  assert.ok(db.passwordResetTokens[0].usedAt);
  assert.ok(db.sessions[0].revokedAt);
  assert.equal(validatePasswordResetToken(db, "reset-token").valid, false);
});

test("change password requires the current password and rejects reuse", () => {
  const db = seedData();
  const user = activeUserWithPassword(db);
  assert.equal(changePassword(db, user, "wrong", "ReplacementPass456").error, "Current password is incorrect.");
  assert.equal(changePassword(db, user, "OriginalPass123", "OriginalPass123").error, "New password must be different from your current password.");
  assert.equal(changePassword(db, user, "OriginalPass123", "ReplacementPass456").valid, true);
});

test("admin can set a temporary password without storing plaintext", () => {
  const db = seedData();
  db.auditLogs = [];
  db.passwordResetTokens = [{ id: "reset", userId: "u-am-west", tokenDigest: "digest", expiresAt: new Date(Date.now() + 60000).toISOString(), usedAt: "", revokedAt: "" }];
  db.sessions = [{ id: "session", userId: "u-am-west", tokenDigest: "digest", expiresAt: new Date(Date.now() + 60000).toISOString(), revokedAt: "" }];
  const result = adminSetTemporaryPassword(db, "u-am-west", "u-admin", "TemporaryPass123");
  assert.equal(result.valid, true);
  const user = db.users.find((item) => item.id === "u-am-west");
  assert.equal(user.mustChangePassword, true);
  assert.equal("password" in user, false);
  assert.doesNotMatch(user.passwordHash, /TemporaryPass123/);
  assert.ok(db.sessions[0].revokedAt);
  assert.ok(db.passwordResetTokens[0].revokedAt);
  assert.equal(db.auditLogs[0].action, "admin_temporary_password_set");
  assert.equal(db.auditLogs[0].userId, "u-admin");
});

test("admin can activate a pending invitation while setting a temporary password", () => {
  const db = seedData();
  const user = db.users.find((item) => item.id === "u-am-west");
  user.status = "pending_invitation";
  db.activationTokens = [{ id: "activation", userId: user.id, usedAt: "", revokedAt: "" }];

  const result = adminSetTemporaryPassword(db, user.id, "u-admin", "TemporaryPass123", { activatePending: true });

  assert.equal(result.valid, true);
  assert.equal(result.activated, true);
  assert.equal(user.status, "active");
  assert.equal(user.mustChangePassword, true);
  assert.ok(user.activatedAt);
  assert.ok(db.activationTokens[0].revokedAt);
  assert.equal(db.auditLogs[0].action, "admin_user_activated_with_temporary_password");
});

test("admin temporary password validates account and password policy", () => {
  const db = seedData();
  assert.equal(adminSetTemporaryPassword(db, "missing", "u-admin", "TemporaryPass123").status, 404);
  const user = db.users.find((item) => item.id === "u-am-west");
  user.status = "inactive";
  assert.equal(adminSetTemporaryPassword(db, user.id, "u-admin", "TemporaryPass123").status, 409);
  user.status = "active";
  assert.equal(adminSetTemporaryPassword(db, user.id, "u-admin", "weak").status, 422);
  assert.equal(adminSetTemporaryPassword(db, user.id, "u-admin", "Abcdefgh1").status, 422);
  assert.equal(adminSetTemporaryPassword(db, user.id, "u-admin", "Abcdefghi1").valid, true);
});

