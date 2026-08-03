import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { seedData } from "../src/validators.js";
import { encodeStoredData } from "../src/storage-crypto.js";
import { createPasswordHash } from "../src/passwords.js";

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startBackend(environment = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "booking-security-"));
  const port = await availablePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      BOOKING_DB_PATH: path.join(directory, "db.json"),
      ALLOW_DEMO_CREDENTIALS: "true",
      NODE_ENV: "test",
      ...environment,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error(`Backend exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok)
        return {
          baseUrl,
          child,
          directory,
          get stdout() {
            return stdout;
          },
          get stderr() {
            return stderr;
          },
        };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error(`Backend did not become ready: ${stderr}`);
}

async function login(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Password@123" }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

test("booking routes derive identity from the session and reject spoofing", async (t) => {
  const runtime = await startBackend();
  t.after(async () => {
    runtime.child.kill();
    await rm(runtime.directory, { recursive: true, force: true });
  });

  const data = seedData();
  const admin = data.users.find(
    (user) => user.role === "Admin" && user.status === "active",
  );
  const areaManager = data.users.find(
    (user) => user.role === "Area Manager" && user.status === "active",
  );
  const regionalManager = data.users.find(
    (user) => user.role === "Regional Manager" && user.status === "active",
  );

  const unauthenticatedList = await fetch(
    `${runtime.baseUrl}/api/bookings?userId=${admin.id}`,
  );
  assert.equal(unauthenticatedList.status, 401);

  const areaCookie = await login(runtime.baseUrl, areaManager.email);
  const scopedResponse = await fetch(
    `${runtime.baseUrl}/api/bookings?userId=${admin.id}`,
    {
      headers: { cookie: areaCookie },
    },
  );
  assert.equal(scopedResponse.status, 200);
  const scoped = await scopedResponse.json();
  assert.ok(scoped.rows.length > 0);
  assert.ok(
    scoped.rows.every(
      (booking) => booking.assignedAreaManagerId === areaManager.id,
    ),
  );

  const pagedResponse = await fetch(
    `${runtime.baseUrl}/api/bookings?page=1&pageSize=1`,
    {
      headers: { cookie: areaCookie },
    },
  );
  assert.equal(pagedResponse.status, 200);
  const paged = await pagedResponse.json();
  assert.equal(paged.rows.length, 1);
  assert.equal(paged.pagination.page, 1);
  assert.equal(paged.pagination.pageSize, 1);
  assert.equal(paged.pagination.total, scoped.total);

  const excessivePage = await fetch(
    `${runtime.baseUrl}/api/bookings?pageSize=1000`,
    {
      headers: { cookie: areaCookie },
    },
  );
  assert.equal(excessivePage.status, 422);
  const excessivePageBody = await excessivePage.json();
  assert.equal(excessivePageBody.code, "INVALID_PAGE_SIZE");
  assert.equal(
    excessivePageBody.correlationId,
    excessivePage.headers.get("x-correlation-id"),
  );

  const booking = scoped.rows[0];
  const spoofedUpdate = await fetch(
    `${runtime.baseUrl}/api/bookings/${booking.id}/area-inputs`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        updatedBy: areaManager.id,
        bookingCategory: "priority",
      }),
    },
  );
  assert.equal(spoofedUpdate.status, 403);

  const regionalCookie = await login(runtime.baseUrl, regionalManager.email);
  const wrongRoleUpdate = await fetch(
    `${runtime.baseUrl}/api/bookings/${booking.id}/area-inputs`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: regionalCookie },
      body: JSON.stringify({
        updatedBy: areaManager.id,
        bookingCategory: "priority",
      }),
    },
  );
  assert.equal(wrongRoleUpdate.status, 403);

  const crossSiteUpdate = await fetch(
    `${runtime.baseUrl}/api/bookings/${booking.id}/area-inputs`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: areaCookie,
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({
        bookingCategory: "priority",
      }),
    },
  );
  assert.equal(crossSiteUpdate.status, 403);
  assert.equal((await crossSiteUpdate.json()).code, "CSRF_CROSS_SITE");

  const foreignOriginUpdate = await fetch(
    `${runtime.baseUrl}/api/bookings/${booking.id}/area-inputs`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: areaCookie,
        origin: "https://attacker.example",
      },
      body: JSON.stringify({
        bookingCategory: "priority",
      }),
    },
  );
  assert.equal(foreignOriginUpdate.status, 403);
  assert.equal((await foreignOriginUpdate.json()).code, "CSRF_ORIGIN_MISMATCH");

  const authenticatedUpdate = await fetch(
    `${runtime.baseUrl}/api/bookings/${booking.id}/area-inputs`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: areaCookie,
        origin: runtime.baseUrl,
      },
      body: JSON.stringify({
        updatedBy: regionalManager.id,
        bookingCategory: "priority",
      }),
    },
  );
  assert.equal(
    authenticatedUpdate.status,
    200,
    `${await authenticatedUpdate.clone().text()} ${runtime.stderr}`,
  );
  const updated = await authenticatedUpdate.json();
  assert.equal(updated.booking.areaInputs.updatedBy, areaManager.id);
});

test("production cookies are Secure and demo credentials are disabled", async (t) => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "booking-production-security-"),
  );
  const databasePath = path.join(directory, "db.json");
  const encryptionKey = Buffer.alloc(32, 9).toString("base64");
  const data = seedData();
  const admin = data.users.find((user) => user.role === "Admin");
  admin.passwordHash = createPasswordHash("A-production-test-password-123");
  await writeFile(
    databasePath,
    encodeStoredData(data, {
      NODE_ENV: "production",
      PERSISTENCE_DRIVER: "file",
      RATE_LIMIT_DRIVER: "memory",
      DATA_ENCRYPTION_KEY: encryptionKey,
    }),
    "utf8",
  );
  const port = await availablePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      BOOKING_DB_PATH: databasePath,
      NODE_ENV: "production",
      APP_URL: "http://localhost:3000",
      SESSION_COOKIE_SECURE: "true",
      ALLOW_DEMO_CREDENTIALS: "false",
      GOOGLE_REDIRECT_URI: "",
      PERSISTENCE_DRIVER: "file",
      RATE_LIMIT_DRIVER: "memory",
      DATA_ENCRYPTION_KEY: encryptionKey,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    child.kill();
    await rm(directory, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const demoResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "Password@123" }),
  });
  assert.equal(demoResponse.status, 401);
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: admin.email,
      password: "A-production-test-password-123",
    }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /; Secure(?:;|$)/);
});
test("production startup rejects unsafe public HTTP origin", async () => {
  const port = await availablePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production",
      APP_URL: "http://booking.example.com",
      PERSISTENCE_DRIVER: "file",
      RATE_LIMIT_DRIVER: "memory",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const exitCode = await new Promise((resolve) => child.once("exit", resolve));
  assert.notEqual(exitCode, 0);
  assert.match(stderr, /Production APP_URL must use HTTPS/);
});
test("metrics are admin-only and request logs redact query secrets", async (t) => {
  const runtime = await startBackend();
  t.after(async () => {
    runtime.child.kill();
    await rm(runtime.directory, { recursive: true, force: true });
  });

  const unauthenticated = await fetch(`${runtime.baseUrl}/api/metrics`);
  assert.equal(unauthenticated.status, 403);
  const unauthenticatedBody = await unauthenticated.json();
  assert.equal(unauthenticatedBody.code, "ADMIN_REQUIRED");
  assert.equal(
    unauthenticatedBody.correlationId,
    unauthenticated.headers.get("x-correlation-id"),
  );

  const data = seedData();
  const admin = data.users.find(
    (user) => user.role === "Admin" && user.status === "active",
  );
  const adminCookie = await login(runtime.baseUrl, admin.email);
  const secretQuery = "token=super-secret-token&email=private@example.com";
  const bookingResponse = await fetch(
    `${runtime.baseUrl}/api/bookings?${secretQuery}`,
    {
      headers: { cookie: adminCookie },
    },
  );
  assert.equal(bookingResponse.status, 200);

  const metricsResponse = await fetch(
    `${runtime.baseUrl}/api/metrics?${secretQuery}`,
    {
      headers: { cookie: adminCookie },
    },
  );
  assert.equal(metricsResponse.status, 200);
  const metrics = await metricsResponse.json();
  assert.ok(metrics.requests.total >= 3);
  assert.ok(metrics.requests.byRoute["GET /api/bookings"] >= 1);
  assert.ok(metrics.requests.byRoute["GET /api/metrics"] >= 1);
  assert.ok(metrics.requests.byStatus["2xx"] >= 2);
  assert.ok(metrics.requests.byStatus["4xx"] >= 1);
  assert.equal(JSON.stringify(metrics).includes("super-secret-token"), false);
  assert.equal(JSON.stringify(metrics).includes("private@example.com"), false);

  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(runtime.stdout.includes("super-secret-token"), false);
  assert.equal(runtime.stdout.includes("private@example.com"), false);
  assert.equal(runtime.stderr.includes("super-secret-token"), false);
  assert.equal(runtime.stderr.includes("private@example.com"), false);
});

test("endpoint authorization matrix protects admin and role-scoped routes", async (t) => {
  const runtime = await startBackend();
  t.after(async () => {
    runtime.child.kill();
    await rm(runtime.directory, { recursive: true, force: true });
  });

  const data = seedData();
  const users = Object.fromEntries(data.users.map((user) => [user.role, user]));
  const adminCookie = await login(runtime.baseUrl, users.Admin.email);
  const areaCookie = await login(runtime.baseUrl, users["Area Manager"].email);
  const regionalCookie = await login(
    runtime.baseUrl,
    users["Regional Manager"].email,
  );
  const allIndiaCookie = await login(runtime.baseUrl, users["All India"].email);
  const booking = data.bookings.find(
    (item) =>
      item.assignedAreaManagerId === users["Area Manager"].id &&
      item.assignedRegionalManagerId === users["Regional Manager"].id,
  );
  assert.ok(
    booking,
    "seed data includes a booking assigned to the West Area/Regional managers",
  );

  const request = async ({ method = "GET", path: route, cookie, body }) => {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      headers.origin = runtime.baseUrl;
    }
    return fetch(`${runtime.baseUrl}${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  const protectedGets = [
    ["/api/admin/email-templates", 200],
    ["/api/admin/email-campaigns", 200],
    ["/api/admin/users/template", 200],
    ["/api/admin/bookings/template", 200],
    ["/api/admin/bookings/export", 200],
    ["/api/metrics", 200],
  ];
  for (const [route, adminStatus] of protectedGets) {
    assert.equal(
      (await request({ path: route })).status,
      403,
      `${route} rejects unauthenticated access`,
    );
    assert.equal(
      (await request({ path: route, cookie: areaCookie })).status,
      403,
      `${route} rejects Area Manager access`,
    );
    assert.equal(
      (await request({ path: route, cookie: regionalCookie })).status,
      403,
      `${route} rejects Regional Manager access`,
    );
    assert.equal(
      (await request({ path: route, cookie: allIndiaCookie })).status,
      403,
      `${route} rejects oversight-role access`,
    );
    assert.equal(
      (await request({ path: route, cookie: adminCookie })).status,
      adminStatus,
      `${route} allows Admin access`,
    );
  }

  const userPageResponse = await request({
    path: "/api/admin/users?page=1&pageSize=1&role=Admin&sortKey=name&sortDir=asc",
    cookie: adminCookie,
  });
  assert.equal(userPageResponse.status, 200);
  const userPage = await userPageResponse.json();
  assert.equal(userPage.users.length, 1);
  assert.equal(userPage.pagination.pageSize, 1);
  assert.ok(userPage.pagination.total >= 1);
  assert.equal(JSON.stringify(userPage).includes("passwordHash"), false);

  const invalidUserSortResponse = await request({
    path: "/api/admin/users?sortKey=passwordHash",
    cookie: adminCookie,
  });
  assert.equal(invalidUserSortResponse.status, 422);
  assert.equal(
    (await invalidUserSortResponse.json()).code,
    "INVALID_SORT_FIELD",
  );
  const campaignPageResponse = await request({
    path: "/api/admin/email-campaigns?page=1&pageSize=1&status=all&sortKey=createdAt&sortDir=desc",
    cookie: adminCookie,
  });
  assert.equal(campaignPageResponse.status, 200);
  const campaignPage = await campaignPageResponse.json();
  assert.ok(campaignPage.campaigns.length <= 1);
  assert.equal(campaignPage.pagination.pageSize, 1);
  assert.ok(campaignPage.events.length <= 100);
  assert.equal(campaignPage.eventPagination.limit, 100);

  const invalidCampaignPageResponse = await request({
    path: "/api/admin/email-campaigns?pageSize=101",
    cookie: adminCookie,
  });
  assert.equal(invalidCampaignPageResponse.status, 422);
  assert.equal(
    (await invalidCampaignPageResponse.json()).code,
    "INVALID_PAGE_SIZE",
  );
  const templatePageResponse = await request({
    path: "/api/admin/email-templates?page=1&pageSize=1&status=active&type=user_activation&sortKey=updatedAt&sortDir=desc",
    cookie: adminCookie,
  });
  assert.equal(templatePageResponse.status, 200);
  const templatePage = await templatePageResponse.json();
  assert.ok(templatePage.templates.length <= 1);
  assert.equal(templatePage.pagination.pageSize, 1);
  assert.ok(templatePage.samples.length <= 100);
  assert.equal(templatePage.samplePagination.limit, 100);
  assert.deepEqual(Object.keys(templatePage.summary).sort(), [
    "active",
    "draft",
    "total",
  ]);

  const invalidTemplateSortResponse = await request({
    path: "/api/admin/email-templates?sortKey=bodyHtml",
    cookie: adminCookie,
  });
  assert.equal(invalidTemplateSortResponse.status, 422);
  assert.equal(
    (await invalidTemplateSortResponse.json()).code,
    "INVALID_SORT_FIELD",
  );
  const notificationPageResponse = await request({
    path: "/api/notifications?page=1&pageSize=1&sortKey=createdAt&sortDir=desc&userId=spoofed",
    cookie: areaCookie,
  });
  assert.equal(notificationPageResponse.status, 200);
  const notificationPage = await notificationPageResponse.json();
  assert.ok(notificationPage.notifications.length <= 1);
  assert.equal(notificationPage.pagination.pageSize, 1);
  assert.ok(notificationPage.unreadCount >= notificationPage.pagination.total);

  const referencePageResponse = await request({
    path: "/api/admin/reference-data?collection=dealerCodes&page=1&pageSize=1",
    cookie: adminCookie,
  });
  assert.equal(referencePageResponse.status, 200);
  const referencePage = await referencePageResponse.json();
  assert.ok(referencePage.items.length <= 1);
  assert.equal(referencePage.pagination.pageSize, 1);

  const invalidReferencePageResponse = await request({
    path: "/api/admin/reference-data?collection=dealerCodes&pageSize=101",
    cookie: adminCookie,
  });
  assert.equal(invalidReferencePageResponse.status, 422);
  assert.equal(
    (await invalidReferencePageResponse.json()).code,
    "INVALID_PAGE_SIZE",
  );

  const deliveryEventPageResponse = await request({
    path: "/api/admin/email-delivery-events?page=1&pageSize=1",
    cookie: adminCookie,
  });
  assert.equal(deliveryEventPageResponse.status, 200);
  const deliveryEventPage = await deliveryEventPageResponse.json();
  assert.ok(deliveryEventPage.events.length <= 1);
  assert.equal(deliveryEventPage.pagination.pageSize, 1);
  assert.equal(
    deliveryEventPage.events.every(
      (event) => !("userId" in event) && !("providerReference" in event),
    ),
    true,
  );

  const invalidDeliveryEventPageResponse = await request({
    path: "/api/admin/email-delivery-events?pageSize=101",
    cookie: adminCookie,
  });
  assert.equal(invalidDeliveryEventPageResponse.status, 422);
  assert.equal(
    (await invalidDeliveryEventPageResponse.json()).code,
    "INVALID_PAGE_SIZE",
  );

  const auditPageResponse = await request({
    path: "/api/admin/audit-events?page=1&pageSize=1",
    cookie: adminCookie,
  });
  assert.equal(auditPageResponse.status, 200);
  const auditPage = await auditPageResponse.json();
  assert.ok(auditPage.events.length <= 1);
  assert.equal(auditPage.pagination.pageSize, 1);
  assert.equal(
    auditPage.events.every(
      (event) => !("details" in event) && !("outcome" in event),
    ),
    true,
  );

  const invalidAuditPageResponse = await request({
    path: "/api/admin/audit-events?pageSize=101",
    cookie: adminCookie,
  });
  assert.equal(invalidAuditPageResponse.status, 422);
  assert.equal(
    (await invalidAuditPageResponse.json()).code,
    "INVALID_PAGE_SIZE",
  );

  const uploadPageResponse = await request({
    path: "/api/admin/uploads?page=1&pageSize=1",
    cookie: adminCookie,
  });
  assert.equal(uploadPageResponse.status, 200);
  const uploadPage = await uploadPageResponse.json();
  assert.ok(uploadPage.uploads.length <= 1);
  assert.equal(uploadPage.pagination.pageSize, 1);
  assert.equal(
    uploadPage.uploads.every(
      (upload) => !("errors" in upload) && !("credentials" in upload),
    ),
    true,
  );

  const invalidUploadPageResponse = await request({
    path: "/api/admin/uploads?pageSize=101",
    cookie: adminCookie,
  });
  assert.equal(invalidUploadPageResponse.status, 422);
  assert.equal(
    (await invalidUploadPageResponse.json()).code,
    "INVALID_PAGE_SIZE",
  );

  const onboardingPageResponse = await request({
    path: "/api/admin/onboarding?page=1&pageSize=1",
    cookie: adminCookie,
  });
  assert.equal(onboardingPageResponse.status, 200);
  const onboardingPage = await onboardingPageResponse.json();
  assert.ok(onboardingPage.workflows.length <= 1);
  assert.equal(onboardingPage.pagination.pageSize, 1);
  assert.equal(
    onboardingPage.workflows.every((workflow) => !("rows" in workflow)),
    true,
  );

  const invalidOnboardingPageResponse = await request({
    path: "/api/admin/onboarding?pageSize=101",
    cookie: adminCookie,
  });
  assert.equal(invalidOnboardingPageResponse.status, 422);
  assert.equal(
    (await invalidOnboardingPageResponse.json()).code,
    "INVALID_PAGE_SIZE",
  );

  const invalidNotificationPageResponse = await request({
    path: "/api/notifications?pageSize=101",
    cookie: areaCookie,
  });
  assert.equal(invalidNotificationPageResponse.status, 422);
  assert.equal(
    (await invalidNotificationPageResponse.json()).code,
    "INVALID_PAGE_SIZE",
  );
  const protectedPosts = [
    [
      "/api/admin/onboarding/validate",
      { fileName: "users.csv", content: "Name,Email,Role,Status\n" },
      200,
    ],
    [
      "/api/admin/users",
      {
        Name: "Matrix User",
        Email: "matrix.user@example.com",
        Role: "Admin",
        Status: "active",
      },
      200,
    ],
  ];
  for (const [route, body, adminStatus] of protectedPosts) {
    assert.equal(
      (await request({ method: "POST", path: route, body })).status,
      403,
      `${route} rejects unauthenticated writes`,
    );
    assert.equal(
      (await request({ method: "POST", path: route, cookie: areaCookie, body }))
        .status,
      403,
      `${route} rejects non-admin writes`,
    );
    assert.equal(
      (
        await request({
          method: "POST",
          path: route,
          cookie: adminCookie,
          body,
        })
      ).status,
      adminStatus,
      `${route} allows Admin writes`,
    );
  }

  const areaInputBody = { bookingCategory: "priority" };
  assert.equal(
    (
      await request({
        method: "PATCH",
        path: `/api/bookings/${booking.id}/area-inputs`,
        cookie: adminCookie,
        body: areaInputBody,
      })
    ).status,
    403,
    "Admin cannot update Area Manager booking inputs",
  );
  assert.equal(
    (
      await request({
        method: "PATCH",
        path: `/api/bookings/${booking.id}/area-inputs`,
        cookie: regionalCookie,
        body: areaInputBody,
      })
    ).status,
    403,
    "Regional Manager cannot update Area Manager booking inputs",
  );
  assert.equal(
    (
      await request({
        method: "PATCH",
        path: `/api/bookings/${booking.id}/area-inputs`,
        cookie: allIndiaCookie,
        body: areaInputBody,
      })
    ).status,
    403,
    "All India cannot update Area Manager booking inputs",
  );
  assert.equal(
    (
      await request({
        method: "PATCH",
        path: `/api/bookings/${booking.id}/area-inputs`,
        cookie: areaCookie,
        body: areaInputBody,
      })
    ).status,
    200,
    "assigned Area Manager can update Area Manager booking inputs",
  );

  const regionalInputBody = {
    wholesaleInput: "approved",
    retailInput: "pending",
  };
  assert.equal(
    (
      await request({
        method: "PATCH",
        path: `/api/bookings/${booking.id}/regional-inputs`,
        cookie: adminCookie,
        body: regionalInputBody,
      })
    ).status,
    403,
    "Admin cannot update Regional Manager booking inputs",
  );
  assert.equal(
    (
      await request({
        method: "PATCH",
        path: `/api/bookings/${booking.id}/regional-inputs`,
        cookie: areaCookie,
        body: regionalInputBody,
      })
    ).status,
    403,
    "Area Manager cannot update Regional Manager booking inputs",
  );
  assert.equal(
    (
      await request({
        method: "PATCH",
        path: `/api/bookings/${booking.id}/regional-inputs`,
        cookie: allIndiaCookie,
        body: regionalInputBody,
      })
    ).status,
    403,
    "All India cannot update Regional Manager booking inputs",
  );
  assert.equal(
    (
      await request({
        method: "PATCH",
        path: `/api/bookings/${booking.id}/regional-inputs`,
        cookie: regionalCookie,
        body: regionalInputBody,
      })
    ).status,
    200,
    "assigned Regional Manager can update Regional Manager booking inputs",
  );

  const adminBootstrap = await (
    await request({ path: "/api/bootstrap", cookie: adminCookie })
  ).json();
  const areaBootstrap = await (
    await request({ path: "/api/bootstrap", cookie: areaCookie })
  ).json();
  assert.equal(adminBootstrap.currentUser.id, users.Admin.id);
  assert.equal(adminBootstrap.currentUser.role, "Admin");
  assert.equal("passwordHash" in adminBootstrap.currentUser, false);
  assert.equal("activationToken" in adminBootstrap.currentUser, false);
  assert.equal(areaBootstrap.currentUser.id, users["Area Manager"].id);
  assert.equal(areaBootstrap.currentUser.role, "Area Manager");
  assert.ok(
    adminBootstrap.users.length > 1,
    "Admin bootstrap includes managed users",
  );
  assert.ok(adminBootstrap.users.length <= 100);
  assert.equal(adminBootstrap.collectionPagination.users.pageSize, 100);
  assert.equal(
    adminBootstrap.collectionPagination.users.total,
    adminBootstrap.users.length,
  );
  assert.equal(adminBootstrap.collectionLinks.users, "/api/admin/users");
  assert.ok(adminBootstrap.emailCampaigns.length <= 100);
  assert.equal(
    adminBootstrap.collectionPagination.emailCampaigns.pageSize,
    100,
  );
  assert.equal(
    adminBootstrap.collectionLinks.emailCampaigns,
    "/api/admin/email-campaigns",
  );
  assert.ok(adminBootstrap.emailTemplates.length <= 100);
  assert.ok(adminBootstrap.emailTemplateSamples.length <= 100);
  assert.equal(
    adminBootstrap.collectionPagination.emailTemplates.pageSize,
    100,
  );
  assert.equal(
    adminBootstrap.collectionLinks.emailTemplates,
    "/api/admin/email-templates",
  );
  assert.equal(adminBootstrap.collectionCaps.emailTemplateSamples.limit, 100);
  assert.ok(adminBootstrap.regionOptions.length <= 100);
  assert.ok(adminBootstrap.dealerCodes.length <= 100);
  assert.ok(adminBootstrap.dealerAssignments.length <= 100);
  assert.equal(adminBootstrap.referenceDataPagination.regions.limit, 100);
  assert.equal(adminBootstrap.referenceDataPagination.dealerCodes.limit, 100);
  assert.equal(
    adminBootstrap.referenceDataPagination.dealerAssignments.limit,
    100,
  );
  assert.equal(
    adminBootstrap.collectionLinks.referenceData,
    "/api/admin/reference-data",
  );
  assert.equal(
    Object.values(adminBootstrap.lookupOptions).every(
      (options) => options.length <= 100,
    ),
    true,
  );
  assert.deepEqual(
    areaBootstrap.users.map((user) => user.id),
    [users["Area Manager"].id],
    "non-admin bootstrap exposes only the authenticated user",
  );
});

test(
  "SIGTERM drains the server and closes dependencies cleanly",
  {
    skip:
      process.platform === "win32"
        ? "Windows cannot deliver POSIX SIGTERM to a child process"
        : false,
  },
  async () => {
    const runtime = await startBackend();
    try {
      const exited = new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Backend did not exit after SIGTERM")),
          5000,
        );
        runtime.child.once("exit", (code) => {
          clearTimeout(timeout);
          resolve(code);
        });
      });
      assert.equal(runtime.child.kill("SIGTERM"), true);
      assert.equal(await exited, 0);
      assert.match(runtime.stdout, /Received SIGTERM; shutting down\./);
      await assert.rejects(fetch(`${runtime.baseUrl}/api/health`));
    } finally {
      runtime.child.kill();
      await rm(runtime.directory, { recursive: true, force: true });
    }
  },
);

test("readiness degrades safely when Redis is unavailable", async () => {
  const unavailablePort = await availablePort();
  const runtime = await startBackend({
    RATE_LIMIT_DRIVER: "redis",
    REDIS_URL: `redis://127.0.0.1:${unavailablePort}`,
  });
  try {
    assert.equal((await fetch(`${runtime.baseUrl}/api/health`)).status, 200);
    assert.equal(
      (await fetch(`${runtime.baseUrl}/api/readiness-fixture`)).status,
      404,
    );
    const response = await fetch(`${runtime.baseUrl}/api/ready`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.ready, false);
    assert.equal(body.dependencies.persistence.ready, true);
    assert.equal(body.dependencies.abuseControl.ready, false);
    assert.equal(body.dependencies.abuseControl.driver, "redis");
    assert.equal(JSON.stringify(body).includes("redis://"), false);
  } finally {
    runtime.child.kill();
    await rm(runtime.directory, { recursive: true, force: true });
  }
});

test("readiness degrades safely when MySQL is unavailable", async () => {
  const unavailablePort = await availablePort();
  const runtime = await startBackend({
    PERSISTENCE_DRIVER: "mysql",
    DATABASE_URL: `mysql://test:test@127.0.0.1:${unavailablePort}/booking_dashboard`,
    DB_CONNECT_TIMEOUT_MS: "250",
    RATE_LIMIT_DRIVER: "memory",
  });
  try {
    assert.equal((await fetch(`${runtime.baseUrl}/api/health`)).status, 200);
    const response = await fetch(`${runtime.baseUrl}/api/ready`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.ready, false);
    assert.equal(body.dependencies.persistence.ready, false);
    assert.equal(body.dependencies.persistence.driver, "mysql-normalized");
    assert.equal(body.dependencies.abuseControl.ready, true);
    assert.equal(JSON.stringify(body).includes("mysql://"), false);
  } finally {
    runtime.child.kill();
    await rm(runtime.directory, { recursive: true, force: true });
  }
});

test("Admin can move a user to another Region by clearing an incompatible Dealer Code", async (t) => {
  const runtime = await startBackend();
  t.after(async () => {
    runtime.child.kill();
    await rm(runtime.directory, { recursive: true, force: true });
  });
  const seeded = seedData();
  const admin = seeded.users.find(
    (user) => user.role === "Admin" && user.status === "active",
  );
  const target = seeded.users.find((user) => user.id === "u-am-west");
  const cookie = await login(runtime.baseUrl, admin.email);
  const headers = { "content-type": "application/json", cookie };

  const regionResponse = await fetch(`${runtime.baseUrl}/api/admin/regions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Moved Region" }),
  });
  assert.equal(regionResponse.status, 201);

  const updateResponse = await fetch(
    `${runtime.baseUrl}/api/admin/users/${target.id}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ region: "Moved Region", dealerCode: "" }),
    },
  );
  assert.equal(updateResponse.status, 200);
  const body = await updateResponse.json();
  assert.equal(body.user.region, "Moved Region");
  assert.equal(body.user.dealerCode, "");
});
test("reference mutations return bounded continuation contracts", async (t) => {
  const runtime = await startBackend();
  t.after(async () => {
    runtime.child.kill();
    await rm(runtime.directory, { recursive: true, force: true });
  });
  const admin = seedData().users.find(
    (user) => user.role === "Admin" && user.status === "active",
  );
  const cookie = await login(runtime.baseUrl, admin.email);
  const headers = { "content-type": "application/json", cookie };

  const optionResponse = await fetch(
    `${runtime.baseUrl}/api/admin/lookups/bookingCategory/options`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ label: "Bounded Contract Option" }),
    },
  );
  assert.equal(optionResponse.status, 200);
  const optionBody = await optionResponse.json();
  assert.equal(optionBody.option.label, "Bounded Contract Option");
  assert.equal(
    optionBody.collectionUrl,
    "/api/admin/reference-data?collection=lookupOptions&fieldCode=bookingCategory",
  );
  assert.equal("lookups" in optionBody, false);
  assert.equal("lookupOptions" in optionBody, false);

  const regionResponse = await fetch(`${runtime.baseUrl}/api/admin/regions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Bounded Contract Region" }),
  });
  assert.equal(regionResponse.status, 201);
  const regionBody = await regionResponse.json();
  assert.equal(regionBody.region.name, "Bounded Contract Region");
  assert.equal(
    regionBody.collectionUrl,
    "/api/admin/reference-data?collection=regions",
  );
  assert.equal("regions" in regionBody, false);
  assert.equal("regionOptions" in regionBody, false);

  const pageResponse = await fetch(
    `${runtime.baseUrl}/api/admin/reference-data?collection=lookupOptions&fieldCode=bookingCategory&search=Bounded%20Contract`,
    { headers: { cookie } },
  );
  assert.equal(pageResponse.status, 200);
  const page = await pageResponse.json();
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].label, "Bounded Contract Option");
});
