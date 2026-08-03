import nodemailer from "nodemailer";
import { googleEmailStatus, sendWithGmailApi } from "./google-email-provider.js";
import { emailDeliveryPolicy, executeEmailDelivery } from "./email-delivery-policy.js";

let cachedTransporter = null;
let cachedTransportKey = "";

function readConfig() {
  const mode = String(process.env.EMAIL_TRANSPORT || "mock").trim().toLowerCase();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  return {
    mode,
    host: String(process.env.SMTP_HOST || "").trim(),
    port,
    secure,
    user: String(process.env.SMTP_USER || "").trim(),
    password: String(process.env.SMTP_PASS || ""),
    fromName: String(process.env.SMTP_FROM_NAME || "Booking Dashboard").trim(),
    fromEmail: String(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "").trim()
  };
}

function missingSmtpFields(config) {
  return [
    ["SMTP_HOST", config.host],
    ["SMTP_PORT", config.port],
    ["SMTP_USER", config.user],
    ["SMTP_PASS", config.password],
    ["SMTP_FROM_EMAIL", config.fromEmail]
  ].filter(([, value]) => !value).map(([name]) => name);
}

function smtpTransporter(config) {
  const key = [config.host, config.port, config.secure, config.user, config.password].join("|");
  if (cachedTransporter && cachedTransportKey === key) return cachedTransporter;
  const timeoutMs = emailDeliveryPolicy().timeoutMs;
  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 60_000
  });
  cachedTransportKey = key;
  return cachedTransporter;
}

export function emailTransportStatus(db) {
  const config = readConfig();
  if (config.mode === "gmail_api") return googleEmailStatus(db);
  const missing = config.mode === "smtp" ? missingSmtpFields(config) : [];
  return {
    mode: config.mode,
    configured: config.mode === "mock" || missing.length === 0,
    provider: config.mode === "smtp" ? "smtp" : "local-mock",
    host: config.mode === "smtp" ? config.host : "",
    port: config.mode === "smtp" ? config.port : null,
    fromEmail: config.fromEmail,
    missing
  };
}

export async function verifyEmailTransport(db) {
  const status = emailTransportStatus(db);
  if (status.provider === "gmail_api") {
    if (!status.ready) {
      const detail = status.missing?.length ? `Missing: ${status.missing.join(", ")}` : "Connect a Google sender account in Email Settings";
      const error = new Error(`Google email delivery is not ready. ${detail}`);
      error.code = status.missing?.length ? "EMAIL_CONFIG" : "EMAIL_NOT_CONNECTED";
      throw error;
    }
    return { ...status, verified: true };
  }
  if (status.mode !== "smtp") return { ...status, verified: true };
  if (!status.configured) {
    const error = new Error(`SMTP configuration is incomplete: ${status.missing.join(", ")}`);
    error.code = "EMAIL_CONFIG";
    throw error;
  }
  await smtpTransporter(readConfig()).verify();
  return { ...status, verified: true };
}

export async function deliverEmail({ to, subject, text, html }, { db, signal } = {}) {
  const config = readConfig();
  if (config.mode === "gmail_api") return sendWithGmailApi(db, { to, subject, text, html }, { signal });
  if (config.mode !== "smtp") {
    return { provider: "local-mock", reference: `mock-${Date.now()}`, accepted: [to], rejected: [] };
  }

  const missing = missingSmtpFields(config);
  if (missing.length) {
    const error = new Error(`SMTP configuration is incomplete: ${missing.join(", ")}`);
    error.code = "EMAIL_CONFIG";
    throw error;
  }

  const info = await smtpTransporter(config).sendMail({
    from: { name: config.fromName, address: config.fromEmail },
    to,
    subject,
    text,
    html: html || undefined
  });
  if (info.rejected?.length) {
    const error = new Error(`SMTP rejected recipient: ${info.rejected.join(", ")}`);
    error.code = "EMAIL_REJECTED";
    throw error;
  }
  return {
    provider: "smtp",
    reference: info.messageId || info.response || "smtp-accepted",
    accepted: info.accepted || [to],
    rejected: info.rejected || []
  };
}

export async function deliverEmailWithPolicy(message, { db, policy, sleep, random, deliver = deliverEmail } = {}) {
  return executeEmailDelivery(
    ({ signal }) => deliver(message, { db, signal }),
    { policy, sleep, random }
  );
}
