import { createHash, randomBytes, scryptSync } from "node:crypto";
import { deliverEmail, verifyEmailTransport } from "./mailer.js";
import { verifyPassword } from "./onboarding.js";

const RESET_EXPIRY_MS = 30 * 60 * 1000;
const RESET_REQUEST_WINDOW_MS = 60 * 1000;

function id(prefix) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function digest(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

export function createPasswordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function safeText(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function passwordErrors(password) {
  const value = String(password || "");
  const errors = [];
  if (value.length < 10) errors.push("Password must contain at least 10 characters");
  if (!/[A-Z]/.test(value)) errors.push("Include at least one uppercase letter");
  if (!/[a-z]/.test(value)) errors.push("Include at least one lowercase letter");
  if (!/[0-9]/.test(value)) errors.push("Include at least one number");
  return errors;
}

export async function requestPasswordReset(db, email, appUrl = "http://localhost:3000") {
  db.passwordResetTokens ||= [];
  db.auditLogs ||= [];
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = db.users.find((item) => item.email.toLowerCase() === normalizedEmail && item.status === "active");
  const now = new Date();

  if (!user) return { accepted: true };

  const recent = db.passwordResetTokens.some((item) => item.userId === user.id && Date.parse(item.createdAt) > now.getTime() - RESET_REQUEST_WINDOW_MS);
  if (recent) return { accepted: true };

  for (const token of db.passwordResetTokens.filter((item) => item.userId === user.id && !item.usedAt && !item.revokedAt)) token.revokedAt = now.toISOString();

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + RESET_EXPIRY_MS).toISOString();
  const resetToken = { id: id("password-reset"), userId: user.id, tokenDigest: digest(rawToken), expiresAt, usedAt: "", revokedAt: "", createdAt: now.toISOString() };
  db.passwordResetTokens.push(resetToken);

  try {
    await verifyEmailTransport(db);
    const resetLink = `${appUrl}/reset-password#token=${rawToken}`;
    const expiry = new Date(expiresAt).toLocaleString("en-IN");
    const delivery = await deliverEmail({
      to: user.email,
      subject: "Reset your Booking Dashboard password",
      text: `Hello ${user.name},\n\nWe received a request to reset your Booking Dashboard password.\n\nReset your password: ${resetLink}\n\nThis link expires ${expiry}. If you did not request this, you can ignore this email.`,
      html: `<p>Hello ${safeText(user.name)},</p><p>We received a request to reset your Booking Dashboard password.</p><p><a href="${safeText(resetLink)}">Reset your password</a></p><p>This link expires ${safeText(expiry)}. If you did not request this, you can ignore this email.</p>`
    }, { db });
    db.auditLogs.unshift({ id: id("audit"), action: "password_reset_requested", entityId: user.id, userId: user.id, outcome: { delivered: true, provider: delivery.provider }, createdAt: now.toISOString() });
  } catch (error) {
    resetToken.revokedAt = new Date().toISOString();
    db.auditLogs.unshift({ id: id("audit"), action: "password_reset_requested", entityId: user.id, userId: user.id, outcome: { delivered: false, reasonCode: error.code || "EMAIL_DELIVERY_FAILED" }, createdAt: now.toISOString() });
  }

  return { accepted: true };
}

export function adminSetTemporaryPassword(db, userId, adminId, password, { activatePending = false } = {}) {
  db.passwordResetTokens ||= [];
  db.sessions ||= [];
  db.auditLogs ||= [];
  db.activationTokens ||= [];
  const user = db.users.find((item) => item.id === userId);
  if (!user) return { valid: false, status: 404, error: "User not found." };
  const activating = user.status === "pending_invitation" && activatePending;
  if (user.status !== "active" && !activating) {
    return {
      valid: false,
      status: 409,
      error: user.status === "pending_invitation"
        ? "Activate this pending user while setting the temporary password."
        : "A temporary password can be set only for active or pending-invitation users."
    };
  }
  const errors = passwordErrors(password);
  if (errors.length) return { valid: false, status: 422, error: "Password does not meet the security requirements.", errors };
  if (user.passwordHash && verifyPassword(String(password || ""), user.passwordHash)) {
    return { valid: false, status: 422, error: "Temporary password must be different from the current password." };
  }
  const now = new Date().toISOString();
  user.passwordHash = createPasswordHash(password);
  user.mustChangePassword = true;
  user.updatedAt = now;
  if (activating) {
    user.status = "active";
    user.activatedAt = now;
    for (const token of db.activationTokens.filter((item) => item.userId === user.id && !item.usedAt && !item.revokedAt)) token.revokedAt = now;
  }
  for (const session of db.sessions.filter((item) => item.userId === user.id && !item.revokedAt)) session.revokedAt = now;
  for (const token of db.passwordResetTokens.filter((item) => item.userId === user.id && !item.usedAt && !item.revokedAt)) token.revokedAt = now;
  db.auditLogs.unshift({
    id: id("audit"),
    action: activating ? "admin_user_activated_with_temporary_password" : "admin_temporary_password_set",
    entityId: user.id,
    userId: adminId,
    createdAt: now
  });
  return { valid: true, userId: user.id, mustChangePassword: true, activated: activating };
}
export function validatePasswordResetToken(db, rawToken) {
  const token = (db.passwordResetTokens || []).find((item) => item.tokenDigest === digest(rawToken));
  if (!token || token.usedAt || token.revokedAt || Date.parse(token.expiresAt) <= Date.now()) return { valid: false, error: "This password reset link is invalid or has expired." };
  const user = db.users.find((item) => item.id === token.userId && item.status === "active");
  if (!user) return { valid: false, error: "This password reset link is invalid or has expired." };
  return { valid: true, token, user };
}

export function resetPassword(db, rawToken, password) {
  const validation = validatePasswordResetToken(db, rawToken);
  if (!validation.valid) return validation;
  const errors = passwordErrors(password);
  if (errors.length) return { valid: false, error: "Password does not meet the security requirements.", errors };
  const now = new Date().toISOString();
  validation.user.passwordHash = createPasswordHash(password);
  validation.user.updatedAt = now;
  validation.token.usedAt = now;
  for (const session of db.sessions || []) if (session.userId === validation.user.id && !session.revokedAt) session.revokedAt = now;
  db.auditLogs.unshift({ id: id("audit"), action: "password_reset_completed", entityId: validation.user.id, userId: validation.user.id, createdAt: now });
  return { valid: true };
}

export function changePassword(db, user, currentPassword, newPassword) {
  const currentMatches = Boolean(user?.passwordHash) && verifyPassword(String(currentPassword || ""), user.passwordHash);
  if (!currentMatches) return { valid: false, status: 422, error: "Current password is incorrect." };
  const errors = passwordErrors(newPassword);
  if (errors.length) return { valid: false, status: 422, error: "Password does not meet the security requirements.", errors };
  if (verifyPassword(String(newPassword || ""), user.passwordHash)) return { valid: false, status: 422, error: "New password must be different from your current password." };
  const now = new Date().toISOString();
  user.passwordHash = createPasswordHash(newPassword);
  user.updatedAt = now;
  for (const session of db.sessions || []) if (session.userId === user.id && !session.revokedAt) session.revokedAt = now;
  db.auditLogs.unshift({ id: id("audit"), action: "password_changed", entityId: user.id, userId: user.id, createdAt: now });
  return { valid: true };
}




