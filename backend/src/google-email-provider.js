import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.send"];

function id(prefix) {
  return `${prefix}-${Date.now()}-${randomBytes(6).toString("hex")}`;
}

function digest(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function googleConfig() {
  return {
    clientId: String(process.env.GOOGLE_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.GOOGLE_CLIENT_SECRET || "").trim(),
    redirectUri: String(process.env.GOOGLE_REDIRECT_URI || "").trim(),
    appUrl: String(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
    encryptionKey: String(process.env.TOKEN_ENCRYPTION_KEY || "").trim()
  };
}

function missingConfig(config = googleConfig()) {
  const missing = [];
  if (!config.clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!config.clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  if (!config.redirectUri) missing.push("GOOGLE_REDIRECT_URI");
  try {
    if (Buffer.from(config.encryptionKey, "base64").length !== 32) missing.push("TOKEN_ENCRYPTION_KEY");
  } catch {
    missing.push("TOKEN_ENCRYPTION_KEY");
  }
  return [...new Set(missing)];
}

function encryptionKey() {
  const key = Buffer.from(googleConfig().encryptionKey, "base64");
  if (key.length !== 32) {
    const error = new Error("TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
    error.code = "EMAIL_CONFIG";
    throw error;
  }
  return key;
}

function encryptToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptToken(payload) {
  const [version, ivValue, tagValue, ciphertextValue] = String(payload || "").split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error("Stored Google authorization is invalid");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
}

export function ensureGoogleEmailData(db) {
  let changed = false;
  for (const key of ["emailProviderConnections", "emailOAuthStates"]) {
    if (!Array.isArray(db[key])) {
      db[key] = [];
      changed = true;
    }
  }
  return changed;
}

function activeConnection(db) {
  ensureGoogleEmailData(db);
  return db.emailProviderConnections.find((connection) => connection.provider === "gmail_api" && connection.status === "active") || null;
}

export function googleEmailStatus(db) {
  const config = googleConfig();
  const missing = missingConfig(config);
  const connection = activeConnection(db);
  return {
    provider: "gmail_api",
    configured: missing.length === 0,
    connected: Boolean(connection),
    ready: missing.length === 0 && Boolean(connection),
    missing,
    accountEmail: connection?.accountEmail || "",
    connectedAt: connection?.connectedAt || "",
    connectedBy: connection?.connectedBy || "",
    lastVerifiedAt: connection?.lastVerifiedAt || "",
    lastTestAt: connection?.lastTestAt || "",
    status: connection?.status || "disconnected"
  };
}

function requireGoogleConfig() {
  const config = googleConfig();
  const missing = missingConfig(config);
  if (missing.length) {
    const error = new Error(`Google email configuration is incomplete: ${missing.join(", ")}`);
    error.code = "EMAIL_CONFIG";
    throw error;
  }
  return config;
}

async function googleJson(url, options, label) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error_description || payload.error?.message || payload.error || `${label} failed`;
    const error = new Error(String(message));
    error.code = "GOOGLE_API_ERROR";
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function beginGoogleAuthorization(db, adminId) {
  const config = requireGoogleConfig();
  ensureGoogleEmailData(db);
  const rawState = randomBytes(32).toString("base64url");
  const now = Date.now();
  db.emailOAuthStates = db.emailOAuthStates.filter((state) => !state.usedAt && Date.parse(state.expiresAt) > now);
  db.emailOAuthStates.push({
    id: id("oauth-state"),
    stateDigest: digest(rawState),
    adminId,
    expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
    usedAt: "",
    createdAt: new Date(now).toISOString()
  });
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES.join(" "),
    state: rawState
  });
  return { authorizationUrl: `${GOOGLE_AUTH_URL}?${params}`, expiresInSeconds: 600 };
}

async function exchangeAuthorizationCode(code, config) {
  return googleJson(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    })
  }, "Google authorization");
}

async function accountIdentity(accessToken) {
  return googleJson(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` }
  }, "Google account lookup");
}

export async function completeGoogleAuthorization(db, { code, state }) {
  const config = requireGoogleConfig();
  ensureGoogleEmailData(db);
  const storedState = db.emailOAuthStates.find((item) => item.stateDigest === digest(state));
  if (!storedState || storedState.usedAt || Date.parse(storedState.expiresAt) <= Date.now()) {
    return { error: "This Google connection request is invalid or has expired", status: 400 };
  }
  storedState.usedAt = new Date().toISOString();
  if (!code) return { error: "Google did not return an authorization code", status: 400 };

  try {
    const tokens = await exchangeAuthorizationCode(code, config);
    if (!tokens.refresh_token) return { error: "Google did not issue a refresh token. Reconnect and approve access again.", status: 422 };
    const identity = await accountIdentity(tokens.access_token);
    if (!identity.email || identity.email_verified === false) return { error: "Google account email could not be verified", status: 422 };
    const now = new Date().toISOString();
    for (const connection of db.emailProviderConnections.filter((item) => item.status === "active")) {
      connection.status = "replaced";
      connection.disconnectedAt = now;
    }
    const connection = {
      id: id("email-connection"),
      provider: "gmail_api",
      accountEmail: String(identity.email).toLowerCase(),
      encryptedRefreshToken: encryptToken(tokens.refresh_token),
      scopes: String(tokens.scope || GOOGLE_SCOPES.join(" ")).split(" ").filter(Boolean),
      status: "active",
      connectedBy: storedState.adminId,
      connectedAt: now,
      lastVerifiedAt: now,
      lastTestAt: "",
      disconnectedAt: ""
    };
    db.emailProviderConnections.unshift(connection);
    db.auditLogs.unshift({ id: id("audit"), action: "gmail_sender_connected", entityId: connection.id, userId: storedState.adminId, outcome: { provider: "gmail_api" }, createdAt: now });
    return googleEmailStatus(db);
  } catch (error) {
    return { error: "Google connection could not be completed.", code: error.code || "GOOGLE_CONNECTION_FAILED", status: error.status || 502 };
  }
}

async function accessTokenForConnection(connection) {
  const config = requireGoogleConfig();
  const refreshToken = decryptToken(connection.encryptedRefreshToken);
  const payload = await googleJson(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  }, "Google token refresh");
  return { accessToken: payload.access_token, refreshToken };
}

async function rawEmail({ from, to, subject, text, html }) {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const message = await transport.sendMail({ from, to, subject, text, html: html || undefined });
  return message.message.toString("base64url");
}

export async function sendWithGmailApi(db, { to, subject, text, html }) {
  const connection = activeConnection(db);
  if (!connection) {
    const error = new Error("No Google sender account is connected");
    error.code = "EMAIL_NOT_CONNECTED";
    throw error;
  }
  const { accessToken } = await accessTokenForConnection(connection);
  const raw = await rawEmail({ from: { name: process.env.SMTP_FROM_NAME || "Booking Dashboard", address: connection.accountEmail }, to, subject, text, html });
  const result = await googleJson(GOOGLE_GMAIL_SEND_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ raw })
  }, "Gmail delivery");
  connection.lastVerifiedAt = new Date().toISOString();
  return { provider: "gmail_api", reference: result.id || result.threadId || "gmail-accepted", accepted: [to], rejected: [] };
}

export async function sendGoogleTestEmail(db, adminId, recipientEmail) {
  const result = await sendWithGmailApi(db, {
    to: recipientEmail,
    subject: "Booking Dashboard email connection test",
    text: "Your Booking Dashboard Google email connection is working correctly. No action is required.",
    html: "<p>Your Booking Dashboard Google email connection is working correctly.</p><p>No action is required.</p>"
  });
  const connection = activeConnection(db);
  connection.lastTestAt = new Date().toISOString();
  db.auditLogs.unshift({ id: id("audit"), action: "gmail_sender_tested", entityId: connection.id, userId: adminId, outcome: { provider: result.provider, providerReference: result.reference }, createdAt: connection.lastTestAt });
  return { ok: true, recipientEmail, provider: result.provider, providerReference: result.reference, sentAt: connection.lastTestAt };
}

export async function disconnectGoogleAccount(db, adminId) {
  const connection = activeConnection(db);
  if (!connection) return { error: "No Google sender account is connected", status: 409 };
  try {
    const refreshToken = decryptToken(connection.encryptedRefreshToken);
    await fetch(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken })
    });
  } catch {
    // Local disconnection must still complete if Google is temporarily unavailable.
  }
  const now = new Date().toISOString();
  connection.status = "disconnected";
  connection.encryptedRefreshToken = "";
  connection.disconnectedAt = now;
  db.auditLogs.unshift({ id: id("audit"), action: "gmail_sender_disconnected", entityId: connection.id, userId: adminId, outcome: { provider: "gmail_api" }, createdAt: now });
  return googleEmailStatus(db);
}


