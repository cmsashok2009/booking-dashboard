import "dotenv/config";
import http from "node:http";
import { readFile, mkdir, rename, writeFile, chmod, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import {
  BOOKING_REQUIRED_COLUMNS,
  USER_REQUIRED_COLUMNS,
  createBookingTemplate,
  createUserTemplate,
  exportBookingsAsExcelHtml,
  parseCsv,
  activeRoleNames,
  normalizeRoleDefinitions,
  reconcileSeededDemoUsers,
  seedData,
  upsertBookings,
  upsertUsers,
  validateSingleUser,
  validateUserUpdate
} from "./src/validators.js";
import { isBookingAssignedToAreaManager, scopeBookingsForUser } from "./src/access.js";
import { createDealerCode, createRegion, ensureAccessMasterData, updateDealerCode, updateRegion } from "./src/access-master-data.js";
import { ensureDealerAssignments } from "./src/dealer-assignments.js";
import {
  changedNotificationFields,
  createBookingUpdateNotification,
  createBookingImportNotifications,
  markNotificationRead,
  unreadNotificationsForUser
} from "./src/notifications.js";
import {
  activateUser,
  cancelOnboardingWorkflow,
  cloneTemplateSample,
  createOnboardingWorkflow,
  createSingleUserOnboarding,
  ensureOnboardingData,
  importOnboardingUsers,
  listOnboardingWorkflows,
  previewWorkflowEmail,
  publicCampaign,
  returnWorkflowToTemplate,
  saveEmailTemplate,
  selectWorkflowTemplate,
  sendInvitationCampaign,
  validateActivationToken,
  verifyPassword,
  workflowRecipients
} from "./src/onboarding.js";
import {
  beginGoogleAuthorization,
  completeGoogleAuthorization,
  disconnectGoogleAccount,
  googleEmailStatus,
  sendGoogleTestEmail
} from "./src/google-email-provider.js";
import { changePassword, createPasswordHash, adminSetTemporaryPassword, requestPasswordReset, resetPassword, validatePasswordResetToken } from "./src/passwords.js";
import { decodeStoredData, encodeStoredData } from "./src/storage-crypto.js";
import { createStateStore } from "./src/state-store.js";
import { createRateLimiter } from "./src/rate-limiter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 5178);
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = process.env.BOOKING_DB_PATH ? path.resolve(process.env.BOOKING_DB_PATH) : path.join(DATA_DIR, "mock-db.json");
const STATE_VERSION = Symbol("stateVersion");
const stateStore = createStateStore({ filePath: DB_PATH });
const rateLimiter = createRateLimiter();
const OPENAPI_PATH = path.join(__dirname, "openapi.json");
const SWAGGER_UI_PATH = path.join(__dirname, "swagger-ui.html");
const LOOKUP_FIELDS = ["bookingCategory", "wholesalesFeedback", "wsPlanning", "cancellationReason"];
const notificationStreams = new Map();
const MAX_REQUEST_BYTES = Number(process.env.MAX_REQUEST_BYTES || 2 * 1024 * 1024);
const requestBuckets = new Map();

function securityHeaders(correlationId) {
  return {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "x-correlation-id": correlationId
  };
}

function sessionCookie(token, maxAge = 28800) {
  const secureByDefault = process.env.NODE_ENV === "production";
  const secureEnabled = process.env.SESSION_COOKIE_SECURE === undefined
    ? secureByDefault
    : process.env.SESSION_COOKIE_SECURE === "true";
  const secure = secureEnabled ? "; Secure" : "";
  return `booking_session=${token ? encodeURIComponent(token) : ""}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function applyRetentionPolicy(data, now = Date.now()) {
  const expired = (value) => value && Date.parse(value) <= now;
  const olderThan = (value, days) => value && Date.parse(value) < now - days * 24 * 60 * 60 * 1000;
  data.sessions = (data.sessions || []).filter((item) => !olderThan(item.revokedAt || item.expiresAt, 7));
  data.passwordResetTokens = (data.passwordResetTokens || []).filter((item) => !olderThan(item.usedAt || item.revokedAt || item.expiresAt, 7));
  data.activationTokens = (data.activationTokens || []).filter((item) => !olderThan(item.usedAt || item.revokedAt || item.expiresAt, 30));
  data.emailOAuthStates = (data.emailOAuthStates || []).filter((item) => !item.usedAt && !expired(item.expiresAt));
  data.fileUploads = (data.fileUploads || []).filter((item) => !olderThan(item.createdAt, Number(process.env.UPLOAD_RETENTION_DAYS || 30)));
  data.auditLogs = (data.auditLogs || []).filter((item) => !olderThan(item.createdAt, Number(process.env.AUDIT_RETENTION_DAYS || 365)));
}
async function ensureDb() {
  let snapshot;
  try {
    snapshot = await stateStore.load();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (process.env.NODE_ENV === "production") throw new Error("Production database is not initialized");
    const seeded = seedData();
    snapshot = await stateStore.initialize(encodeStoredData(seeded));
  }
  const data = decodeStoredData(snapshot.payload);
  Object.defineProperty(data, STATE_VERSION, { value: snapshot.version, writable: true, enumerable: false });
  let migrated = false;
  data.lookups ||= seedData().lookups;
  data.lookupOptions ||= migrateLookupOptions(data.lookups);
  data.auditLogs ||= [];
  data.fileUploads ||= [];
  data.notifications ||= [];
  data.passwordResetTokens ||= [];
  if (ensureOnboardingData(data)) migrated = true;
  if (!Array.isArray(data.roles) || data.roles.some((role) => typeof role === "string")) migrated = true;
  data.roles = normalizeRoleDefinitions(data.roles);
  const seededUsers = seedData().users;
  if (reconcileSeededDemoUsers(data, seededUsers, process.env.NODE_ENV !== "production")) migrated = true;
  const regionalManager = data.users.find((user) => user.id === "u-rm-west");
  if (regionalManager?.reportingManagerEmail === "all.india@example.com") {
    regionalManager.reportingManagerEmail = "all.india1@example.com";
    migrated = true;
  }
  if (ensureDealerAssignments(data)) migrated = true;
  if (ensureAccessMasterData(data)) migrated = true;
  syncActiveLookups(data);
  applyRetentionPolicy(data);
  if (migrated) await saveDb(data);
  return data;
}
function activeAdmin(db, userId) {
  return db.users.find((user) => user.id === userId && user.role === "Admin" && user.status === "active");
}

function authenticatedUser(req, db) {
  const authorization = String(req.headers.authorization || "");
  const cookies = Object.fromEntries(String(req.headers.cookie || "").split(";").map((item) => item.trim().split("=")).filter((parts) => parts.length === 2));
  const rawToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : decodeURIComponent(cookies.booking_session || "");
  if (!rawToken) return null;
  const digest = createHash("sha256").update(rawToken).digest("hex");
  const session = (db.sessions || []).find((item) => item.tokenDigest === digest && !item.revokedAt && Date.parse(item.expiresAt) > Date.now());
  return session ? db.users.find((user) => user.id === session.userId && user.status === "active") || null : null;
}

function authenticatedAdmin(req, db) {
  const user = authenticatedUser(req, db);
  return user?.role === "Admin" ? user : null;
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastNotification(notification) {
  for (const recipientUserId of notification.recipientUserIds) {
    for (const response of notificationStreams.get(recipientUserId) || []) {
      try {
        writeSse(response, { type: "notification", notification });
      } catch {
        notificationStreams.get(recipientUserId)?.delete(response);
      }
    }
  }
}

function makeOptionId(fieldCode, label, index = 0) {
  const slug = String(label || "option")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${fieldCode}-${slug || "option"}-${index}`;
}

function migrateLookupOptions(lookups = {}) {
  return Object.fromEntries(
    LOOKUP_FIELDS.map((fieldCode) => [
      fieldCode,
      (lookups[fieldCode] || []).map((label, index) => ({
        id: makeOptionId(fieldCode, label, index),
        label,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))
    ])
  );
}

function activeLookups(lookupOptions = {}) {
  return Object.fromEntries(
    LOOKUP_FIELDS.map((fieldCode) => [
      fieldCode,
      (lookupOptions[fieldCode] || []).filter((option) => option.status === "active").map((option) => option.label)
    ])
  );
}

function syncActiveLookups(db) {
  db.lookups = activeLookups(db.lookupOptions);
}

function normalizeOptionLabel(label) {
  return String(label || "").trim();
}

async function saveDb(data) {
  const nextVersion = await stateStore.save(encodeStoredData(data), data[STATE_VERSION]);
  data[STATE_VERSION] = nextVersion;
}
function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...extraHeaders
  });
  res.end(payload);
}

function sendText(res, status, body, contentType = "text/plain; charset=utf-8", extraHeaders = {}) {
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(body),
    ...extraHeaders
  });
  res.end(body);
}

function oauthCallbackPage(payload) {
  const appOrigin = new URL(process.env.APP_URL || "http://localhost:3000").origin;
  const safePayload = JSON.stringify({ type: "booking-google-oauth", ...payload }).replaceAll("<", "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Google email connection</title></head><body><p>Completing Google email connection...</p><script>if(window.opener){window.opener.postMessage(${safePayload},${JSON.stringify(appOrigin)});window.close();}else{window.location.replace(${JSON.stringify(appOrigin)});}</script></body></html>`;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) {
      const error = new Error("Request body is too large");
      error.status = 413;
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

function applyBookingFilters(bookings, query, users = []) {
  let rows = [...bookings];
  const search = (query.get("search") || "").trim().toLowerCase();
  const userId = query.get("userId") || "";
  const region = query.get("region") || "";
  const wholesaleInput = query.get("wholesaleInput") || "";
  const retailInput = query.get("retailInput") || "";

  if (search) {
    rows = rows.filter((booking) =>
      [
        booking.dealerCode,
        booking.contactFirstName,
        booking.contactLastName,
        booking.phoneNumber,
        booking.salesOrderId,
        booking.region,
        booking.model,
        booking.variant,
        booking.areaInputs?.bookingCategory,
        booking.areaInputs?.wsPlanning,
        booking.regionalInputs?.wholesaleInput,
        booking.regionalInputs?.retailInput
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    );
  }

  if (region) rows = rows.filter((booking) => booking.region === region);
  if (wholesaleInput === "filled") rows = rows.filter((booking) => Boolean(booking.regionalInputs?.wholesaleInput));
  if (wholesaleInput === "missing") rows = rows.filter((booking) => !booking.regionalInputs?.wholesaleInput);
  if (retailInput === "filled") rows = rows.filter((booking) => Boolean(booking.regionalInputs?.retailInput));
  if (retailInput === "missing") rows = rows.filter((booking) => !booking.regionalInputs?.retailInput);
  const actor = users.find((item) => item.id === userId && item.status === "active");
  return scopeBookingsForUser(rows, actor);
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, app: "booking-dashboard" });
  }
  if (req.method === "GET" && pathname === "/api/ready") {
    const [persistence, abuseControl] = await Promise.all([stateStore.readiness(), rateLimiter.readiness()]);
    const ready = persistence.ready && abuseControl.ready;
    return sendJson(res, ready ? 200 : 503, { ready, dependencies: { persistence, abuseControl } });
  }

  const db = await ensureDb();

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const limitResult = await rateLimiter.check("login", req.socket.remoteAddress, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!limitResult.allowed) return sendJson(res, 429, { error: "Too many sign-in attempts. Try again later.", code: "RATE_LIMITED" }, { "retry-after": limitResult.retryAfterSeconds });
    const body = await readBody(req);
    const user = db.users.find((item) => item.email.toLowerCase() === String(body.email || "").toLowerCase());
    const allowDemoCredentials = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_CREDENTIALS === "true";
    const validPassword = user && (user.passwordHash ? verifyPassword(String(body.password || ""), user.passwordHash) : allowDemoCredentials && body.password === "Password@123");
    if (!user || user.status !== "active" || !validPassword) {
      return sendJson(res, 401, { error: "Invalid email or password." });
    }
    if (!user.passwordHash) user.passwordHash = createPasswordHash(String(body.password || ""));
    const sessionToken = randomBytes(32).toString("base64url");
    const now = new Date();
    db.sessions ||= [];
    db.sessions.push({ id: `session-${Date.now()}`, userId: user.id, tokenDigest: createHash("sha256").update(sessionToken).digest("hex"), createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(), revokedAt: "" });
    await saveDb(db);
    const { passwordHash, ...safeUser } = user;
    return sendJson(res, 200, { user: safeUser }, { "set-cookie": sessionCookie(sessionToken) });
  }

  if (req.method === "GET" && pathname === "/api/auth/session") {
    const user = authenticatedUser(req, db);
    if (!user) return sendJson(res, 401, { error: "Your session has expired. Sign in again." });
    const { passwordHash, ...safeUser } = user;
    return sendJson(res, 200, { user: safeUser });
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    const cookies = Object.fromEntries(String(req.headers.cookie || "").split(";").map((item) => item.trim().split("=")).filter((parts) => parts.length === 2));
    const rawToken = decodeURIComponent(cookies.booking_session || "");
    const digest = rawToken ? createHash("sha256").update(rawToken).digest("hex") : "";
    const session = (db.sessions || []).find((item) => item.tokenDigest === digest);
    if (session) { session.revokedAt = new Date().toISOString(); await saveDb(db); }
    return sendJson(res, 200, { ok: true }, { "set-cookie": sessionCookie("", 0) });
  }

  if (req.method === "POST" && pathname === "/api/auth/password/forgot") {
    const limitResult = await rateLimiter.check("forgot-password", req.socket.remoteAddress, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!limitResult.allowed) return sendJson(res, 429, { error: "Too many requests. Try again later.", code: "RATE_LIMITED" }, { "retry-after": limitResult.retryAfterSeconds });
    const body = await readBody(req);
    await requestPasswordReset(db, body.email, process.env.APP_URL || "http://localhost:3000");
    await saveDb(db);
    return sendJson(res, 202, { message: "If an active account matches that email, a password reset link has been sent." });
  }

  if (req.method === "POST" && pathname === "/api/auth/password/reset/validate") {
    const body = await readBody(req);
    const result = validatePasswordResetToken(db, body.token);
    return sendJson(res, result.valid ? 200 : 422, result.valid ? { valid: true, email: result.user.email, expiresAt: result.token.expiresAt } : result);
  }

  if (req.method === "POST" && pathname === "/api/auth/password/reset") {
    const body = await readBody(req);
    if (body.password !== body.confirmPassword) return sendJson(res, 422, { valid: false, error: "Passwords do not match." });
    const result = resetPassword(db, body.token, body.password);
    if (result.valid) await saveDb(db);
    return sendJson(res, result.valid ? 200 : 422, result);
  }

  if (req.method === "POST" && pathname === "/api/auth/password/change") {
    const viewer = authenticatedUser(req, db);
    if (!viewer) return sendJson(res, 401, { error: "Authentication is required" });
    const body = await readBody(req);
    if (body.newPassword !== body.confirmPassword) return sendJson(res, 422, { valid: false, error: "Passwords do not match." });
    const result = changePassword(db, viewer, body.currentPassword, body.newPassword);
    if (result.valid) await saveDb(db);
    return sendJson(res, result.valid ? 200 : result.status || 422, result);
  }

  if (req.method === "PATCH" && pathname === "/api/profile") {
    const viewer = authenticatedUser(req, db);
    if (!viewer) return sendJson(res, 401, { error: "Authentication is required" });
    const body = await readBody(req);
    const avatarUrl = String(body.avatarUrl || "");
    if (avatarUrl && !/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(avatarUrl)) return sendJson(res, 422, { error: "Choose a valid JPEG, PNG, or WebP image" });
    if (Buffer.byteLength(avatarUrl, "utf8") > 1_400_000) return sendJson(res, 413, { error: "Choose an image smaller than 1 MB" });
    viewer.avatarUrl = avatarUrl;
    viewer.updatedAt = new Date().toISOString();
    await saveDb(db);
    const { passwordHash, ...safeUser } = viewer;
    return sendJson(res, 200, { user: safeUser });
  }

  if (req.method === "POST" && pathname === "/api/admin/regions") {
    const admin = authenticatedAdmin(req, db);
    if (!admin) return sendJson(res, 403, { error: "Admin access is required", code: "ADMIN_REQUIRED" });
    const result = createRegion(db, await readBody(req), admin.id);
    if (!result.error) await saveDb(db);
    return sendJson(res, result.error ? result.status : 201, result.error ? result : { ...result, regions: db.regions.filter((item) => item.status === "active").map((item) => item.name), regionOptions: db.regions });
  }

  if (req.method === "POST" && pathname === "/api/admin/dealer-codes") {
    const admin = authenticatedAdmin(req, db);
    if (!admin) return sendJson(res, 403, { error: "Admin access is required", code: "ADMIN_REQUIRED" });
    const result = createDealerCode(db, await readBody(req), admin.id);
    if (!result.error) await saveDb(db);
    return sendJson(res, result.error ? result.status : 201, result.error ? result : { ...result, dealerCodes: db.dealerCodes });
  }

  const regionMatch = pathname.match(/^\/api\/admin\/regions\/([^\/]+)$/);
  if (req.method === "PATCH" && regionMatch) {
    const admin = authenticatedAdmin(req, db);
    if (!admin) return sendJson(res, 403, { error: "Admin access is required", code: "ADMIN_REQUIRED" });
    const result = updateRegion(db, decodeURIComponent(regionMatch[1]), await readBody(req), admin.id);
    if (!result.error) await saveDb(db);
    return sendJson(res, result.error ? result.status : 200, result.error ? result : {
      ...result,
      regions: db.regions.filter((item) => item.status === "active").map((item) => item.name),
      regionOptions: db.regions
    });
  }

  const dealerCodeMatch = pathname.match(/^\/api\/admin\/dealer-codes\/([^\/]+)$/);
  if (req.method === "PATCH" && dealerCodeMatch) {
    const admin = authenticatedAdmin(req, db);
    if (!admin) return sendJson(res, 403, { error: "Admin access is required", code: "ADMIN_REQUIRED" });
    const result = updateDealerCode(db, decodeURIComponent(dealerCodeMatch[1]), await readBody(req), admin.id);
    if (!result.error) await saveDb(db);
    return sendJson(res, result.error ? result.status : 200, result.error ? result : { ...result, dealerCodes: db.dealerCodes });
  }
  if (req.method === "GET" && pathname === "/api/admin/email-provider/google/callback") {
    const result = await completeGoogleAuthorization(db, {
      code: url.searchParams.get("code") || "",
      state: url.searchParams.get("state") || ""
    });
    await saveDb(db);
    const payload = result.error ? { ok: false, message: result.error } : { ok: true, message: `Google sender ${result.accountEmail} connected.` };
    return sendText(res, result.error ? result.status || 400 : 200, oauthCallbackPage(payload), "text/html; charset=utf-8", { "cache-control": "no-store" });
  }

  if (pathname.startsWith("/api/admin/") && !authenticatedAdmin(req, db)) {
    return sendJson(res, 403, { error: "Admin access is required" });
  }

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    const viewer = authenticatedUser(req, db);
    if (!viewer) return sendJson(res, 401, { error: "Authentication is required" });
    const isAdmin = viewer.role === "Admin";
    return sendJson(res, 200, {
      roles: activeRoleNames(db),
      roleDefinitions: normalizeRoleDefinitions(db.roles).filter((role) => role.isActive),
      onboardingWorkflows: isAdmin ? listOnboardingWorkflows(db, viewer.id) : [],
      emailTemplateSamples: isAdmin ? db.emailTemplateSamples : [],
      emailTemplates: isAdmin ? db.emailTemplates : [],
      emailCampaigns: isAdmin ? db.emailCampaigns.map(publicCampaign) : [],
      emailProvider: isAdmin ? googleEmailStatus(db) : null,
      users: (isAdmin ? db.users : [viewer]).map(({ passwordHash, ...user }) => user),
      dealerAssignments: isAdmin ? db.dealerAssignments : [],
      dealerCodes: isAdmin ? db.dealerCodes : [],
      regionOptions: isAdmin ? db.regions : [],
      lookups: activeLookups(db.lookupOptions),
      lookupOptions: db.lookupOptions,
      regions: db.regions.filter((item) => item.status === "active").map((item) => item.name)
    });
  }

  if (req.method === "POST" && pathname === "/api/admin/email-provider/google/start") {
    const admin = authenticatedAdmin(req, db);
    try {
      const result = beginGoogleAuthorization(db, admin.id);
      await saveDb(db);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 503, { error: "Email provider configuration is unavailable.", code: error.code || "EMAIL_CONFIG" });
    }
  }

  if (req.method === "POST" && pathname === "/api/admin/email-provider/google/test") {
    const admin = authenticatedAdmin(req, db);
    const body = await readBody(req);
    const recipientEmail = String(body.recipientEmail || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) return sendJson(res, 422, { error: "Enter a valid test recipient email" });
    try {
      const result = await sendGoogleTestEmail(db, admin.id, recipientEmail);
      await saveDb(db);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, error.status || 502, { error: "The test email could not be delivered.", code: error.code || "EMAIL_DELIVERY" });
    }
  }

  if (req.method === "POST" && pathname === "/api/admin/email-provider/google/disconnect") {
    const admin = authenticatedAdmin(req, db);
    const result = await disconnectGoogleAccount(db, admin.id);
    if (result.error) return sendJson(res, result.status || 409, result);
    await saveDb(db);
    return sendJson(res, 200, result);
  }

  if (req.method === "PATCH" && pathname === "/api/admin/lookups") {
    const body = await readBody(req);
    const fieldCode = String(body.fieldCode || "");
    if (!LOOKUP_FIELDS.includes(fieldCode)) {
      return sendJson(res, 422, { error: "Lookup field is not editable or does not exist." });
    }
    const options = Array.isArray(body.options)
      ? body.options.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const uniqueOptions = [...new Set(options)];
    if (!uniqueOptions.length) {
      return sendJson(res, 422, { error: "At least one dropdown value is required." });
    }
    db.lookupOptions[fieldCode] = uniqueOptions.map((label, index) => ({
      id: makeOptionId(fieldCode, label, index),
      label,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    syncActiveLookups(db);
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: "lookup_values_updated",
      entityId: fieldCode,
      userId: authenticatedAdmin(req, db).id,
      createdAt: new Date().toISOString()
    });
    await saveDb(db);
    return sendJson(res, 200, { fieldCode, options: uniqueOptions, lookups: activeLookups(db.lookupOptions), lookupOptions: db.lookupOptions });
  }

  if (req.method === "POST" && pathname.match(/^\/api\/admin\/lookups\/[^/]+\/options$/)) {
    const fieldCode = pathname.split("/")[4];
    if (!LOOKUP_FIELDS.includes(fieldCode)) {
      return sendJson(res, 422, { error: "Lookup field is not editable or does not exist." });
    }
    const body = await readBody(req);
    const label = normalizeOptionLabel(body.label);
    if (!label) return sendJson(res, 422, { error: "Option label is required." });
    db.lookupOptions[fieldCode] ||= [];
    const duplicate = db.lookupOptions[fieldCode].some((option) => option.label.toLowerCase() === label.toLowerCase());
    if (duplicate) return sendJson(res, 422, { error: "This option already exists for the selected field." });
    const now = new Date().toISOString();
    const option = {
      id: makeOptionId(fieldCode, label, Date.now()),
      label,
      status: "active",
      createdAt: now,
      updatedAt: now
    };
    db.lookupOptions[fieldCode].push(option);
    syncActiveLookups(db);
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: "lookup_option_added",
      entityId: option.id,
      userId: authenticatedAdmin(req, db).id,
      createdAt: now
    });
    await saveDb(db);
    return sendJson(res, 200, { option, lookups: activeLookups(db.lookupOptions), lookupOptions: db.lookupOptions });
  }

  if (req.method === "PATCH" && pathname.match(/^\/api\/admin\/lookups\/[^/]+\/options\/[^/]+$/)) {
    const parts = pathname.split("/");
    const fieldCode = parts[4];
    const optionId = decodeURIComponent(parts[6]);
    if (!LOOKUP_FIELDS.includes(fieldCode)) {
      return sendJson(res, 422, { error: "Lookup field is not editable or does not exist." });
    }
    const body = await readBody(req);
    const option = (db.lookupOptions[fieldCode] || []).find((item) => item.id === optionId);
    if (!option) return sendJson(res, 404, { error: "Option not found." });
    const nextLabel = body.label === undefined ? option.label : normalizeOptionLabel(body.label);
    const nextStatus = body.status === undefined ? option.status : String(body.status);
    if (!nextLabel) return sendJson(res, 422, { error: "Option label is required." });
    if (!["active", "inactive"].includes(nextStatus)) {
      return sendJson(res, 422, { error: "Option status must be active or inactive." });
    }
    const duplicate = (db.lookupOptions[fieldCode] || []).some(
      (item) => item.id !== optionId && item.label.toLowerCase() === nextLabel.toLowerCase()
    );
    if (duplicate) return sendJson(res, 422, { error: "This option already exists for the selected field." });
    option.label = nextLabel;
    option.status = nextStatus;
    option.updatedAt = new Date().toISOString();
    syncActiveLookups(db);
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: nextStatus === "inactive" ? "lookup_option_deactivated" : "lookup_option_updated",
      entityId: option.id,
      userId: authenticatedAdmin(req, db).id,
      createdAt: new Date().toISOString()
    });
    await saveDb(db);
    return sendJson(res, 200, { option, lookups: activeLookups(db.lookupOptions), lookupOptions: db.lookupOptions });
  }

  if (req.method === "GET" && pathname === "/api/bookings") {
    const viewer = authenticatedUser(req, db);
    if (!viewer) return sendJson(res, 401, { error: "Authentication is required" });
    url.searchParams.set("userId", viewer.id);
    const rows = applyBookingFilters(db.bookings, url.searchParams, db.users);
    return sendJson(res, 200, { rows, total: rows.length });
  }

  if (req.method === "GET" && pathname.match(/^\/api\/bookings\/[^/]+$/)) {
    const viewer = authenticatedUser(req, db);
    if (!viewer) return sendJson(res, 401, { error: "Authentication is required" });
    const bookingId = decodeURIComponent(pathname.split("/")[3]);
    const booking = db.bookings.find((item) => item.id === bookingId);
    if (!booking) return sendJson(res, 404, { error: "Booking not found" });
    url.searchParams.set("userId", viewer.id);
    const rows = applyBookingFilters([booking], url.searchParams, db.users);
    if (!rows.length) return sendJson(res, 403, { error: "You do not have access to this booking" });
    return sendJson(res, 200, { booking: rows[0] });
  }

  if (req.method === "GET" && pathname === "/api/notifications") {
    const viewer = authenticatedUser(req, db);
    if (!viewer) return sendJson(res, 401, { error: "Authentication is required" });
    const notifications = unreadNotificationsForUser(db, viewer.id);
    return sendJson(res, 200, { notifications, unreadCount: notifications.length });
  }

  if (req.method === "GET" && pathname === "/api/notifications/stream") {
    const viewer = authenticatedUser(req, db);
    if (!viewer) return sendJson(res, 401, { error: "Authentication is required" });
    const userId = viewer.id;
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    });
    res.write(": connected\n\n");
    if (!notificationStreams.has(userId)) notificationStreams.set(userId, new Set());
    notificationStreams.get(userId).add(res);
    writeSse(res, { type: "snapshot", notifications: unreadNotificationsForUser(db, userId) });
    const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 20000);
    req.on("close", () => {
      clearInterval(keepAlive);
      notificationStreams.get(userId)?.delete(res);
      if (!notificationStreams.get(userId)?.size) notificationStreams.delete(userId);
    });
    return;
  }

  if (req.method === "PATCH" && pathname.match(/^\/api\/notifications\/[^/]+\/read$/)) {
    const notificationId = decodeURIComponent(pathname.split("/")[3]);
    const body = await readBody(req);
    const viewer = authenticatedUser(req, db);
    if (!viewer) return sendJson(res, 401, { error: "Authentication is required" });
    const notification = markNotificationRead(db, notificationId, viewer.id);
    if (!notification) return sendJson(res, 404, { error: "Notification not found" });
    await saveDb(db);
    const unreadCount = unreadNotificationsForUser(db, viewer.id).length;
    return sendJson(res, 200, { notificationId, unreadCount });
  }

  if (req.method === "PATCH" && pathname.match(/^\/api\/bookings\/[^/]+\/area-inputs$/)) {
    const bookingId = pathname.split("/")[3];
    const body = await readBody(req);
    const booking = db.bookings.find((item) => item.id === bookingId);
    if (!booking) return sendJson(res, 404, { error: "Booking not found" });
    const actor = authenticatedUser(req, db);
    if (!actor || actor.status !== "active" || actor.role !== "Area Manager") {
      return sendJson(res, 403, { error: "Only an active Area Manager can update Area Manager inputs" });
    }
    if (!isBookingAssignedToAreaManager(booking, actor)) {
      return sendJson(res, 403, { error: "Area Managers can update only their assigned bookings" });
    }
    const previousInputs = booking.areaInputs || {};
    const nextInputs = {
      bookingCategory: body.bookingCategory || "",
      wholesalesFeedback: body.wholesalesFeedback || "",
      wsPlanning: body.wsPlanning || "",
      expectedRetailDate: body.expectedRetailDate || "",
      cancellationReason: body.cancellationReason || "",
      updatedBy: actor.id,
      updatedAt: new Date().toISOString()
    };
    const changedFields = changedNotificationFields(previousInputs, nextInputs, ["bookingCategory", "wholesalesFeedback", "wsPlanning", "expectedRetailDate", "cancellationReason"]);
    booking.areaInputs = nextInputs;
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: "area_inputs_updated",
      entityId: bookingId,
      userId: actor.id,
      createdAt: new Date().toISOString()
    });
    const notification = createBookingUpdateNotification(db, { booking, actor, changedFields });
    await saveDb(db);
    if (notification) broadcastNotification(notification);
    return sendJson(res, 200, { booking });
  }

  if (req.method === "PATCH" && pathname.match(/^\/api\/bookings\/[^/]+\/regional-inputs$/)) {
    const bookingId = pathname.split("/")[3];
    const body = await readBody(req);
    const booking = db.bookings.find((item) => item.id === bookingId);
    if (!booking) return sendJson(res, 404, { error: "Booking not found" });
    const actor = authenticatedUser(req, db);
    if (!actor || actor.status !== "active" || actor.role !== "Regional Manager") {
      return sendJson(res, 403, { error: "Only an active Regional Manager can update Regional Manager inputs" });
    }
    if (booking.assignedRegionalManagerId !== actor.id) {
      return sendJson(res, 403, { error: "Regional Managers can update only their assigned bookings" });
    }
    const previousInputs = booking.regionalInputs || {};
    const nextInputs = {
      wholesaleInput: body.wholesaleInput || "",
      retailInput: body.retailInput || "",
      updatedBy: actor.id,
      updatedAt: new Date().toISOString()
    };
    const changedFields = changedNotificationFields(previousInputs, nextInputs, ["wholesaleInput", "retailInput"]);
    booking.regionalInputs = nextInputs;
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: "regional_inputs_updated",
      entityId: bookingId,
      userId: actor.id,
      createdAt: new Date().toISOString()
    });
    const notification = createBookingUpdateNotification(db, { booking, actor, changedFields });
    await saveDb(db);
    if (notification) broadcastNotification(notification);
    return sendJson(res, 200, { booking });
  }

  if (req.method === "GET" && pathname === "/api/admin/bookings/template") {
    return sendText(res, 200, createBookingTemplate(), "text/csv; charset=utf-8", {
      "content-disposition": "attachment; filename=\"booking-upload-template.csv\""
    });
  }

  if (req.method === "POST" && pathname === "/api/admin/bookings/import") {
    const admin = authenticatedAdmin(req, db);
    const body = await readBody(req);
    const parsed = parseCsv(body.content || "");
    const beforeBookings = db.bookings.map((booking) => ({ ...booking }));
    const result = upsertBookings(db, parsed.rows, {
      fileName: body.fileName || "booking-upload.csv",
      requiredColumns: BOOKING_REQUIRED_COLUMNS
    });
    const importNotifications = result.failedRows
      ? []
      : createBookingImportNotifications(db, {
          beforeBookings,
          importedSalesOrderIds: parsed.rows.map((row) => row["Sales Order Id"]),
          actor: admin
        });
    await saveDb(db);
    importNotifications.forEach(broadcastNotification);
    return sendJson(res, result.failedRows ? 422 : 200, { ...result, notificationsCreated: importNotifications.length });
  }

  if (req.method === "GET" && pathname === "/api/admin/bookings/export") {
    const rows = applyBookingFilters(db.bookings, url.searchParams, db.users);
    const workbook = exportBookingsAsExcelHtml(rows);
    return sendText(res, 200, workbook, "application/vnd.ms-excel; charset=utf-8", {
      "content-disposition": `attachment; filename="booking-dashboard-export-${new Date().toISOString().slice(0, 10)}.xls"`
    });
  }

  if (req.method === "POST" && pathname === "/api/auth/activation/validate") {
    const body = await readBody(req);
    const result = validateActivationToken(db, body.token);
    return sendJson(res, result.valid ? 200 : 422, result.valid ? { valid: true, user: result.user, expiresAt: result.token.expiresAt } : result);
  }

  if (req.method === "POST" && pathname === "/api/auth/activation/complete") {
    const body = await readBody(req);
    if (body.password !== body.confirmPassword) return sendJson(res, 422, { valid: false, error: "Passwords do not match", errors: ["Enter the same password in both fields"] });
    const result = activateUser(db, body.token, String(body.password || ""));
    if (result.valid) await saveDb(db);
    return sendJson(res, result.valid ? 200 : 422, result);
  }

  if (req.method === "POST" && pathname === "/api/admin/onboarding/validate") {
    const body = await readBody(req);
    const admin = authenticatedAdmin(req, db);
    if (!admin) return sendJson(res, 403, { error: "Admin access is required" });
    const parsed = parseCsv(body.content || "");
    if (parsed.rows.length > 500) return sendJson(res, 422, { error: "Upload at most 500 users per batch" });
    const workflow = createOnboardingWorkflow(db, parsed.rows, { fileName: body.fileName, actorId: admin.id });
    await saveDb(db);
    return sendJson(res, 200, workflow);
  }

  if (req.method === "POST" && pathname === "/api/admin/onboarding/single") {
    const body = await readBody(req);
    const admin = authenticatedAdmin(req, db);
    if (!admin) return sendJson(res, 403, { error: "Admin access is required" });
    const result = createSingleUserOnboarding(db, body, admin.id);
    if (!result.error) await saveDb(db);
    return sendJson(res, result.error ? result.status || 422 : 201, result);
  }

  const onboardingMatch = pathname.match(/^\/api\/admin\/onboarding\/([^/]+)$/);
  if (req.method === "GET" && onboardingMatch) {
    if (!authenticatedAdmin(req, db)) return sendJson(res, 403, { error: "Admin access is required" });
    const workflow = db.onboardingWorkflows.find((item) => item.id === decodeURIComponent(onboardingMatch[1]));
    if (!workflow) return sendJson(res, 404, { error: "Onboarding workflow not found" });
    return sendJson(res, 200, { ...workflow, recipients: workflowRecipients(db, workflow), campaign: publicCampaign(db.emailCampaigns.find((item) => item.id === workflow.campaignId)) });
  }

  const onboardingActionMatch = pathname.match(/^\/api\/admin\/onboarding\/([^/]+)\/(import|template|preview|recipients|back|send|cancel)$/);
  if (onboardingActionMatch) {
    const workflowId = decodeURIComponent(onboardingActionMatch[1]);
    const action = onboardingActionMatch[2];
    if (req.method === "GET" && action === "preview") {
      if (!authenticatedAdmin(req, db)) return sendJson(res, 403, { error: "Admin access is required" });
      const result = previewWorkflowEmail(db, workflowId, url.searchParams.get("templateId"));
      return sendJson(res, result.error ? result.status : 200, result);
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const admin = authenticatedAdmin(req, db);
      if (!admin) return sendJson(res, 403, { error: "Admin access is required" });
      let result;
      if (action === "import") result = importOnboardingUsers(db, workflowId, admin.id);
      if (action === "template") result = selectWorkflowTemplate(db, workflowId, body.templateId, admin.id);
      if (action === "back") result = returnWorkflowToTemplate(db, workflowId, admin.id);
      if (action === "recipients") {
        const workflow = db.onboardingWorkflows.find((item) => item.id === workflowId);
        if (!workflow) result = { error: "Onboarding workflow not found", status: 404 };
        else {
          workflow.excludedRecipientIds = Array.isArray(body.excludedRecipientIds) ? body.excludedRecipientIds : [];
          workflow.currentStep = "recipients";
          workflow.updatedAt = new Date().toISOString();
          workflow.version += 1;
          result = workflow;
        }
      }
      if (action === "send") result = await sendInvitationCampaign(db, workflowId, admin.id, process.env.APP_URL || body.appUrl || "http://localhost:3000");
      if (action === "cancel") result = cancelOnboardingWorkflow(db, workflowId, admin.id);
      if (!result) return sendJson(res, 405, { error: "Unsupported onboarding action" });
      if (result.error) {
        return sendJson(res, result.status || 422, { error: result.error, code: result.code || "ONBOARDING_ACTION_FAILED" });
      }
      await saveDb(db);
      return sendJson(res, 200, action === "send" ? publicCampaign(result) : result);
    }
  }

  if (req.method === "GET" && pathname === "/api/admin/email-templates") {
    if (!authenticatedAdmin(req, db)) return sendJson(res, 403, { error: "Admin access is required" });
    return sendJson(res, 200, { samples: db.emailTemplateSamples, templates: db.emailTemplates });
  }

  const cloneSampleMatch = pathname.match(/^\/api\/admin\/email-templates\/samples\/([^/]+)\/clone$/);
  if (req.method === "POST" && cloneSampleMatch) {
    const body = await readBody(req);
    const admin = authenticatedAdmin(req, db);
    if (!admin) return sendJson(res, 403, { error: "Admin access is required" });
    const result = cloneTemplateSample(db, decodeURIComponent(cloneSampleMatch[1]), admin.id);
    if (!result.error) await saveDb(db);
    return sendJson(res, result.error ? result.status : 201, result);
  }

  const templateMatch = pathname.match(/^\/api\/admin\/email-templates\/([^/]+)$/);
  if (req.method === "PATCH" && templateMatch) {
    const body = await readBody(req);
    const admin = authenticatedAdmin(req, db);
    if (!admin) return sendJson(res, 403, { error: "Admin access is required" });
    const result = saveEmailTemplate(db, decodeURIComponent(templateMatch[1]), body, admin.id);
    if (!result.error) await saveDb(db);
    return sendJson(res, result.error ? result.status : 200, result);
  }

  if (req.method === "GET" && pathname === "/api/admin/email-campaigns") {
    if (!authenticatedAdmin(req, db)) return sendJson(res, 403, { error: "Admin access is required" });
    return sendJson(res, 200, { campaigns: db.emailCampaigns.map(publicCampaign), events: db.emailDeliveryEvents });
  }

  if (req.method === "GET" && pathname === "/api/admin/users/template") {
    return sendText(res, 200, createUserTemplate(), "text/csv; charset=utf-8", {
      "content-disposition": "attachment; filename=\"user-upload-template.csv\""
    });
  }

  if (req.method === "POST" && pathname === "/api/admin/users") {
    const body = await readBody(req);
    const validation = validateSingleUser(body, db);
    if (!validation.valid) return sendJson(res, 422, validation);
    const result = upsertUsers(db, [body], { fileName: "single-user-form", requiredColumns: USER_REQUIRED_COLUMNS });
    await saveDb(db);
    return sendJson(res, 200, result);
  }

  if (req.method === "POST" && pathname === "/api/admin/users/import") {
    const body = await readBody(req);
    const parsed = parseCsv(body.content || "");
    const result = upsertUsers(db, parsed.rows, {
      fileName: body.fileName || "user-upload.csv",
      requiredColumns: USER_REQUIRED_COLUMNS
    });
    await saveDb(db);
    return sendJson(res, result.failedRows ? 422 : 200, result);
  }

  if (req.method === "POST" && pathname.match(/^\/api\/admin\/users\/[^/]+\/temporary-password$/)) {
    const admin = authenticatedAdmin(req, db);
    const limitResult = await rateLimiter.check("admin-temporary-password", admin.id, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!limitResult.allowed) return sendJson(res, 429, { error: "Too many temporary-password requests. Try again later.", code: "RATE_LIMITED" }, { "retry-after": limitResult.retryAfterSeconds });
    const userId = decodeURIComponent(pathname.split("/")[4]);
    const body = await readBody(req);
    if (body.password !== body.confirmPassword) return sendJson(res, 422, { error: "Passwords do not match." });
    const result = adminSetTemporaryPassword(db, userId, admin.id, String(body.password || ""), {
      activatePending: body.activatePending === true
    });
    if (result.valid) await saveDb(db);
    const updatedUser = db.users.find((item) => item.id === userId);
    const { passwordHash: _passwordHash, ...safeUser } = updatedUser || {};
    return sendJson(
      res,
      result.valid ? 200 : result.status || 422,
      result.valid
        ? { updated: true, activated: result.activated, mustChangePassword: true, user: safeUser }
        : { error: result.error, errors: result.errors || [] }
    );
  }
  if (req.method === "PATCH" && pathname.match(/^\/api\/admin\/users\/[^/]+$/)) {
    const userId = decodeURIComponent(pathname.split("/")[4]);
    const body = await readBody(req);
    const validation = validateUserUpdate(body, db, userId);
    if (!validation.valid) return sendJson(res, validation.errors.some((error) => error.errorMessage === "User not found") ? 404 : 422, validation);

    const user = db.users.find((item) => item.id === userId);
    user.name = validation.value.Name;
    user.email = validation.value.Email;
    user.role = validation.value.Role;
    user.region = validation.value.Region;
    user.status = validation.value.Status;
    user.updatedAt = new Date().toISOString();
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: "user_updated",
      entityId: userId,
      userId: authenticatedAdmin(req, db).id,
      createdAt: user.updatedAt
    });
    await saveDb(db);
    const { passwordHash, ...safeUser } = user;
    return sendJson(res, 200, { user: safeUser });
  }

  return notFound(res);
}

const server = http.createServer(async (req, res) => {
  const correlationId = randomBytes(12).toString("hex");
  for (const [name, value] of Object.entries(securityHeaders(correlationId))) res.setHeader(name, value);
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/openapi.json") {
      const payload = await readFile(OPENAPI_PATH, "utf8");
      return sendText(res, 200, payload, "application/json; charset=utf-8", {
        "cache-control": "no-store, max-age=0"
      });
    }
    if (req.method === "GET" && ["/api-docs", "/api-docs/"].includes(url.pathname)) {
      const html = await readFile(SWAGGER_UI_PATH, "utf8");
      return sendText(res, 200, html, "text/html; charset=utf-8", {
        "cache-control": "no-store, max-age=0"
      });
    }
    if (req.url.startsWith("/api/")) return await handleApi(req, res);
    return sendJson(res, 404, {
      error: "Backend API only. Open the frontend at http://localhost:3000",
      docs: "/api-docs",
      health: "/api/health"
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    const code = error.code || (status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
    console.error(JSON.stringify({ level: "error", code, correlationId, method: req.method, path: req.url?.split("?")[0] }));
    sendJson(res, status, { error: status === 500 ? "An unexpected error occurred." : error.message, code, correlationId });
  }
});

async function shutdown(signal) {
  console.log(`Received ${signal}; shutting down.`);
  server.close(async () => {
    await Promise.all([stateStore.close(), rateLimiter.close()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
server.listen(PORT, () => {
  console.log(`Booking dashboard running at http://localhost:${PORT}`);
});



















