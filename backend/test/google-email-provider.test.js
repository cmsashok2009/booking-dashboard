import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  beginGoogleAuthorization,
  completeGoogleAuthorization,
  disconnectGoogleAccount,
  googleEmailStatus,
  sendGoogleTestEmail
} from "../src/google-email-provider.js";
import { deliverEmailWithPolicy } from "../src/mailer.js";

const originalFetch = global.fetch;
const ENV_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "TOKEN_ENCRYPTION_KEY", "APP_URL", "EMAIL_TRANSPORT"];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function db() {
  return { emailProviderConnections: [], emailOAuthStates: [], auditLogs: [] };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/admin/email-provider/google/callback";
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.APP_URL = "http://localhost:3000";
  process.env.EMAIL_TRANSPORT = "gmail_api";
});

afterEach(() => {
  global.fetch = originalFetch;
  for (const key of ENV_KEYS) originalEnv[key] === undefined ? delete process.env[key] : process.env[key] = originalEnv[key];
});

test("OAuth state is short-lived, single-use, and refresh tokens are encrypted", async () => {
  const data = db();
  const start = beginGoogleAuthorization(data, "u-admin");
  const authorizationUrl = new URL(start.authorizationUrl);
  const state = authorizationUrl.searchParams.get("state");
  assert.equal(authorizationUrl.searchParams.get("scope").includes("gmail.send"), true);
  assert.equal(JSON.stringify(data).includes(state), false);

  const responses = [
    json({ access_token: "access-1", refresh_token: "sensitive-refresh-token", scope: "openid email https://www.googleapis.com/auth/gmail.send" }),
    json({ email: "sender@example.com", email_verified: true })
  ];
  global.fetch = async () => responses.shift();
  const connected = await completeGoogleAuthorization(data, { code: "auth-code", state });
  assert.equal(connected.ready, true);
  assert.equal(connected.accountEmail, "sender@example.com");
  assert.equal(JSON.stringify(data).includes("sensitive-refresh-token"), false);
  assert.match(data.emailProviderConnections[0].encryptedRefreshToken, /^v1\./);

  const reused = await completeGoogleAuthorization(data, { code: "another-code", state });
  assert.equal(reused.status, 400);
});

test("test delivery refreshes access and sends a Gmail API message", async () => {
  const data = db();
  const start = beginGoogleAuthorization(data, "u-admin");
  const state = new URL(start.authorizationUrl).searchParams.get("state");
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) return json({ access_token: "access-1", refresh_token: "refresh-1" });
    if (calls === 2) return json({ email: "sender@example.com", email_verified: true });
    if (calls === 3) return json({ access_token: "access-2" });
    return json({ id: "gmail-message-1" });
  };
  await completeGoogleAuthorization(data, { code: "auth-code", state });
  const result = await sendGoogleTestEmail(data, "u-admin", "recipient@example.com");
  assert.equal(result.provider, "gmail_api");
  assert.equal(result.providerReference, "gmail-message-1");
  assert.ok(googleEmailStatus(data).lastTestAt);
});

test("Gmail 429 response retries once before acceptance", async () => {
  const data = db();
  const start = beginGoogleAuthorization(data, "u-admin");
  const state = new URL(start.authorizationUrl).searchParams.get("state");
  const responses = [
    json({ access_token: "access-1", refresh_token: "refresh-1" }),
    json({ email: "sender@example.com", email_verified: true }),
    json({ access_token: "access-2" }),
    json({ error: { message: "rate limited" } }, 429),
    json({ access_token: "access-3" }),
    json({ id: "gmail-message-after-retry" })
  ];
  global.fetch = async () => responses.shift();
  await completeGoogleAuthorization(data, { code: "auth-code", state });

  const result = await deliverEmailWithPolicy({
    to: "recipient@example.com",
    subject: "Invitation",
    text: "Body"
  }, {
    db: data,
    policy: { timeoutMs: 1_000, maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 20 },
    random: () => 1,
    sleep: async () => {}
  });

  assert.equal(result.reference, "gmail-message-after-retry");
  assert.equal(result.attemptCount, 2);
  assert.deepEqual(result.retryEvents, [{ attempt: 1, code: "GOOGLE_API_ERROR", delayMs: 10 }]);
  assert.equal(responses.length, 0);
});
test("disconnect erases stored authorization even when Google revoke is unavailable", async () => {
  const data = db();
  const start = beginGoogleAuthorization(data, "u-admin");
  const state = new URL(start.authorizationUrl).searchParams.get("state");
  const responses = [json({ access_token: "access-1", refresh_token: "refresh-1" }), json({ email: "sender@example.com", email_verified: true })];
  global.fetch = async () => responses.shift();
  await completeGoogleAuthorization(data, { code: "auth-code", state });
  global.fetch = async () => { throw new Error("network unavailable"); };
  const status = await disconnectGoogleAccount(data, "u-admin");
  assert.equal(status.connected, false);
  assert.equal(data.emailProviderConnections[0].encryptedRefreshToken, "");
  assert.equal(data.emailProviderConnections[0].status, "disconnected");
});
