import "dotenv/config";
import http from "node:http";
import {
  readFile,
  mkdir,
  rename,
  writeFile,
  chmod,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import {
  normalizeRoleDefinitions,
  reconcileSeededDemoUsers,
  seedData,
} from "./src/validators.js";
import { ensureAccessMasterData } from "./src/access-master-data.js";
import { ensureDealerAssignments } from "./src/dealer-assignments.js";
import { notificationForResponse } from "./src/notification-query.js";
import { ensureOnboardingData } from "./src/onboarding.js";
import { decodeStoredData, encodeStoredData } from "./src/storage-crypto.js";
import { createStateStore } from "./src/state-store.js";
import { createRateLimiter } from "./src/rate-limiter.js";
import { validateRuntimeConfig } from "./src/config.js";
import { authorizeApiRequest } from "./src/api-access-policy.js";
import { handleAdminCollectionRoutes } from "./src/routes/admin-collection-routes.js";
import { handleOnboardingRoutes } from "./src/routes/onboarding-routes.js";
import { handleBookingRoutes } from "./src/routes/booking-routes.js";
import { handleAuthRoutes } from "./src/routes/auth-routes.js";
import {
  migrateLookupOptions,
  syncActiveLookups,
} from "./src/lookup-options.js";
import { handleAdminSettingsRoutes } from "./src/routes/admin-settings-routes.js";
import { applyRetentionPolicy } from "./src/retention-policy.js";
import {
  cookieMap,
  notFound,
  oauthCallbackPage,
  readBody,
  securityHeaders,
  sendJson,
  sendText,
  sessionCookie,
} from "./src/http-response.js";

const runtimeConfig = validateRuntimeConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 5178);
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = process.env.BOOKING_DB_PATH
  ? path.resolve(process.env.BOOKING_DB_PATH)
  : path.join(DATA_DIR, "mock-db.json");
const STATE_VERSION = Symbol("stateVersion");
const stateStore = createStateStore({ filePath: DB_PATH });
const rateLimiter = createRateLimiter();
const OPENAPI_PATH = path.join(__dirname, "openapi.json");
const SWAGGER_UI_PATH = path.join(__dirname, "swagger-ui.html");
const notificationStreams = new Map();
const appOrigin = new URL(runtimeConfig.appUrl).origin;
const requestBuckets = new Map();
const requestMetrics = {
  startedAt: new Date().toISOString(),
  total: 0,
  byRoute: new Map(),
  byStatus: new Map(),
  latencyMs: { count: 0, total: 0, max: 0 },
};

function hasSessionCookie(req) {
  return Boolean(cookieMap(req.headers.cookie).booking_session);
}

function requestOrigin(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host) return appOrigin;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const proto = forwardedProto || (req.socket.encrypted ? "https" : "http");
  return `${proto}://${host}`;
}

function csrfViolation(req) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return null;
  if (!hasSessionCookie(req)) return null;

  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "cross-site") {
    return {
      error: "Cross-site authenticated requests are not allowed.",
      code: "CSRF_CROSS_SITE",
    };
  }

  const origin = req.headers.origin;
  if (!origin) return null;
  const allowedOrigins = new Set([appOrigin, requestOrigin(req)]);
  if (!allowedOrigins.has(origin)) {
    return {
      error: "Request origin is not allowed for authenticated changes.",
      code: "CSRF_ORIGIN_MISMATCH",
    };
  }
  return null;
}
function routeLabel(method, requestUrl = "/") {
  let pathname = "/";
  try {
    pathname = new URL(requestUrl, "http://localhost").pathname;
  } catch {}
  const normalized = pathname
    .replace(
      /^\/api\/bookings\/[^/]+\/area-inputs$/,
      "/api/bookings/:id/area-inputs",
    )
    .replace(
      /^\/api\/bookings\/[^/]+\/regional-inputs$/,
      "/api/bookings/:id/regional-inputs",
    )
    .replace(/^\/api\/bookings\/[^/]+$/, "/api/bookings/:id")
    .replace(
      /^\/api\/admin\/users\/[^/]+\/temporary-password$/,
      "/api/admin/users/:id/temporary-password",
    )
    .replace(/^\/api\/admin\/users\/[^/]+$/, "/api/admin/users/:id")
    .replace(/^\/api\/admin\/regions\/[^/]+$/, "/api/admin/regions/:id")
    .replace(
      /^\/api\/admin\/dealer-codes\/[^/]+$/,
      "/api/admin/dealer-codes/:id",
    )
    .replace(
      /^\/api\/notifications\/[^/]+\/read$/,
      "/api/notifications/:id/read",
    )
    .replace(
      /^\/api\/admin\/lookups\/[^/]+\/options\/[^/]+$/,
      "/api/admin/lookups/:field/options/:id",
    )
    .replace(
      /^\/api\/admin\/lookups\/[^/]+\/options$/,
      "/api/admin/lookups/:field/options",
    );
  return `${method || "GET"} ${normalized}`;
}

function recordRequestMetric(method, requestUrl, statusCode, durationMs) {
  const route = routeLabel(method, requestUrl);
  const statusGroup = `${Math.floor(Number(statusCode || 500) / 100)}xx`;
  requestMetrics.total += 1;
  requestMetrics.byRoute.set(
    route,
    (requestMetrics.byRoute.get(route) || 0) + 1,
  );
  requestMetrics.byStatus.set(
    statusGroup,
    (requestMetrics.byStatus.get(statusGroup) || 0) + 1,
  );
  requestMetrics.latencyMs.count += 1;
  requestMetrics.latencyMs.total += durationMs;
  requestMetrics.latencyMs.max = Math.max(
    requestMetrics.latencyMs.max,
    durationMs,
  );
  console.log(
    JSON.stringify({
      level: "info",
      event: "request_completed",
      method,
      route,
      statusCode,
      durationMs,
    }),
  );
}

function publicMetricsSnapshot() {
  const average = requestMetrics.latencyMs.count
    ? requestMetrics.latencyMs.total / requestMetrics.latencyMs.count
    : 0;
  return {
    startedAt: requestMetrics.startedAt,
    requests: {
      total: requestMetrics.total,
      byRoute: Object.fromEntries([...requestMetrics.byRoute.entries()].sort()),
      byStatus: Object.fromEntries(
        [...requestMetrics.byStatus.entries()].sort(),
      ),
    },
    latencyMs: {
      count: requestMetrics.latencyMs.count,
      average: Number(average.toFixed(2)),
      max: requestMetrics.latencyMs.max,
    },
  };
}

async function ensureDb() {
  let snapshot;
  try {
    snapshot = await stateStore.load();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (process.env.NODE_ENV === "production")
      throw new Error("Production database is not initialized");
    const seeded = seedData();
    snapshot = await stateStore.initialize(encodeStoredData(seeded));
  }
  const data = decodeStoredData(snapshot.payload);
  Object.defineProperty(data, STATE_VERSION, {
    value: snapshot.version,
    writable: true,
    enumerable: false,
  });
  let migrated = false;
  data.lookups ||= seedData().lookups;
  data.lookupOptions ||= migrateLookupOptions(data.lookups);
  data.auditLogs ||= [];
  data.fileUploads ||= [];
  data.notifications ||= [];
  data.passwordResetTokens ||= [];
  if (ensureOnboardingData(data)) migrated = true;
  if (
    !Array.isArray(data.roles) ||
    data.roles.some((role) => typeof role === "string")
  )
    migrated = true;
  data.roles = normalizeRoleDefinitions(data.roles);
  const seededUsers = seedData().users;
  if (
    reconcileSeededDemoUsers(
      data,
      seededUsers,
      process.env.NODE_ENV !== "production",
    )
  )
    migrated = true;
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
  return db.users.find(
    (user) =>
      user.id === userId && user.role === "Admin" && user.status === "active",
  );
}

function authenticatedUser(req, db) {
  const authorization = String(req.headers.authorization || "");
  const cookies = Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim().split("="))
      .filter((parts) => parts.length === 2),
  );
  const rawToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : decodeURIComponent(cookies.booking_session || "");
  if (!rawToken) return null;
  const digest = createHash("sha256").update(rawToken).digest("hex");
  const session = (db.sessions || []).find(
    (item) =>
      item.tokenDigest === digest &&
      !item.revokedAt &&
      Date.parse(item.expiresAt) > Date.now(),
  );
  return session
    ? db.users.find(
        (user) => user.id === session.userId && user.status === "active",
      ) || null
    : null;
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
        writeSse(response, {
          type: "notification",
          notification: notificationForResponse(notification),
        });
      } catch {
        notificationStreams.get(recipientUserId)?.delete(response);
      }
    }
  }
}

async function saveDb(data) {
  const nextVersion = await stateStore.save(
    encodeStoredData(data),
    data[STATE_VERSION],
  );
  data[STATE_VERSION] = nextVersion;
}
async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, app: "booking-dashboard" });
  }
  if (req.method === "GET" && pathname === "/api/ready") {
    const [persistence, abuseControl] = await Promise.all([
      stateStore.readiness(),
      rateLimiter.readiness(),
    ]);
    const ready = persistence.ready && abuseControl.ready;
    return sendJson(res, ready ? 200 : 503, {
      ready,
      dependencies: { persistence, abuseControl },
    });
  }

  const csrfError = csrfViolation(req);
  if (csrfError) return sendJson(res, 403, csrfError);

  const db = await ensureDb();

  const authorization = authorizeApiRequest({
    method: req.method,
    pathname,
    user: authenticatedUser(req, db),
  });
  if (!authorization.allowed) {
    return sendJson(res, authorization.status, {
      error: authorization.error,
      code: authorization.code,
    });
  }

  const authResult = await handleAuthRoutes({
    req,
    res,
    pathname,
    db,
    sendJson,
    readBody,
    saveDb,
    authenticatedUser,
    rateLimiter,
    cookieMap,
    sessionCookie,
  });
  if (authResult !== null) return authResult;
  const adminSettingsResult = await handleAdminSettingsRoutes({
    req,
    res,
    url,
    pathname,
    db,
    sendJson,
    sendText,
    readBody,
    saveDb,
    authenticatedUser,
    authenticatedAdmin,
    oauthCallbackPage,
    publicMetricsSnapshot,
  });
  if (adminSettingsResult !== null) return adminSettingsResult;
  const bookingResult = await handleBookingRoutes({
    req,
    res,
    url,
    pathname,
    db,
    sendJson,
    sendText,
    readBody,
    saveDb,
    authenticatedUser,
    authenticatedAdmin,
    broadcastNotification,
    notificationStreams,
    writeSse,
  });
  if (bookingResult !== null) return bookingResult;
  const onboardingResult = await handleOnboardingRoutes({
    req,
    res,
    url,
    pathname,
    db,
    sendJson,
    readBody,
    saveDb,
    authenticatedAdmin,
  });
  if (onboardingResult !== null) return onboardingResult;
  const adminCollectionResult = await handleAdminCollectionRoutes({
    req,
    res,
    url,
    pathname,
    db,
    sendJson,
    sendText,
    readBody,
    saveDb,
    authenticatedAdmin,
    rateLimiter,
  });
  if (adminCollectionResult !== null) return adminCollectionResult;
  return notFound(res);
}

const server = http.createServer(async (req, res) => {
  const correlationId = randomBytes(12).toString("hex");
  res.correlationId = correlationId;
  const startedAt = Date.now();
  res.once("finish", () =>
    recordRequestMetric(
      req.method,
      req.url,
      res.statusCode,
      Date.now() - startedAt,
    ),
  );
  for (const [name, value] of Object.entries(securityHeaders(correlationId)))
    res.setHeader(name, value);
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/openapi.json") {
      const payload = await readFile(OPENAPI_PATH, "utf8");
      return sendText(res, 200, payload, "application/json; charset=utf-8", {
        "cache-control": "no-store, max-age=0",
      });
    }
    if (
      req.method === "GET" &&
      ["/api-docs", "/api-docs/"].includes(url.pathname)
    ) {
      const html = await readFile(SWAGGER_UI_PATH, "utf8");
      return sendText(res, 200, html, "text/html; charset=utf-8", {
        "cache-control": "no-store, max-age=0",
      });
    }
    if (req.url.startsWith("/api/")) return await handleApi(req, res);
    return sendJson(res, 404, {
      error: "Backend API only. Open the frontend at http://localhost:3000",
      docs: "/api-docs",
      health: "/api/health",
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    const code =
      error.code || (status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
    console.error(
      JSON.stringify({
        level: "error",
        code,
        correlationId,
        method: req.method,
        route: routeLabel(req.method, req.url),
      }),
    );
    sendJson(res, status, {
      error: status === 500 ? "An unexpected error occurred." : error.message,
      code,
      correlationId,
    });
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
