const MAX_REQUEST_BYTES = Number(
  process.env.MAX_REQUEST_BYTES || 2 * 1024 * 1024,
);

export function cookieMap(header = "") {
  return Object.fromEntries(
    String(header || "")
      .split(";")
      .map((item) => item.trim().split("="))
      .filter((parts) => parts.length === 2),
  );
}

export function securityHeaders(correlationId) {
  return {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "x-correlation-id": correlationId,
  };
}

export function sessionCookie(token, maxAge = 28_800) {
  const secureByDefault = process.env.NODE_ENV === "production";
  const secureEnabled =
    process.env.SESSION_COOKIE_SECURE === undefined
      ? secureByDefault
      : process.env.SESSION_COOKIE_SECURE === "true";
  const secure = secureEnabled ? "; Secure" : "";
  return `booking_session=${token ? encodeURIComponent(token) : ""}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function defaultErrorCode(status) {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "AUTHENTICATION_REQUIRED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 405) return "METHOD_NOT_ALLOWED";
  if (status === 409) return "CONFLICT";
  if (status === 413) return "REQUEST_TOO_LARGE";
  if (status === 422) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status === 502) return "BAD_GATEWAY";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  return status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR";
}

function responseBody(res, status, body) {
  if (
    status < 400 ||
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Buffer.isBuffer(body)
  ) {
    return body;
  }
  return {
    ...body,
    code: body.code || defaultErrorCode(status),
    correlationId: body.correlationId || res.correlationId,
  };
}

export function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(responseBody(res, status, body));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

export function sendText(
  res,
  status,
  body,
  contentType = "text/plain; charset=utf-8",
  extraHeaders = {},
) {
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

export function oauthCallbackPage(payload) {
  const appOrigin = new URL(process.env.APP_URL || "http://localhost:3000")
    .origin;
  const safePayload = JSON.stringify({
    type: "booking-google-oauth",
    ...payload,
  }).replaceAll("<", "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Google email connection</title></head><body><p>Completing Google email connection...</p><script>if(window.opener){window.opener.postMessage(${safePayload},${JSON.stringify(appOrigin)});window.close();}else{window.location.replace(${JSON.stringify(appOrigin)});}</script></body></html>`;
}

export async function readBody(req) {
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

export function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}
