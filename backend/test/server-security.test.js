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

async function startBackend() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "booking-security-"));
  const port = await availablePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      BOOKING_DB_PATH: path.join(directory, "db.json"),
      ALLOW_DEMO_CREDENTIALS: "true",
      NODE_ENV: "test"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Backend exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return { baseUrl, child, directory, get stderr() { return stderr; } };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  child.kill();
  throw new Error(`Backend did not become ready: ${stderr}`);
}

async function login(baseUrl, email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Password@123" })
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
  const admin = data.users.find((user) => user.role === "Admin" && user.status === "active");
  const areaManager = data.users.find((user) => user.role === "Area Manager" && user.status === "active");
  const regionalManager = data.users.find((user) => user.role === "Regional Manager" && user.status === "active");

  const unauthenticatedList = await fetch(`${runtime.baseUrl}/api/bookings?userId=${admin.id}`);
  assert.equal(unauthenticatedList.status, 401);

  const areaCookie = await login(runtime.baseUrl, areaManager.email);
  const scopedResponse = await fetch(`${runtime.baseUrl}/api/bookings?userId=${admin.id}`, {
    headers: { cookie: areaCookie }
  });
  assert.equal(scopedResponse.status, 200);
  const scoped = await scopedResponse.json();
  assert.ok(scoped.rows.length > 0);
  assert.ok(scoped.rows.every((booking) => booking.assignedAreaManagerId === areaManager.id));

  const booking = scoped.rows[0];
  const spoofedUpdate = await fetch(`${runtime.baseUrl}/api/bookings/${booking.id}/area-inputs`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ updatedBy: areaManager.id, bookingCategory: "priority" })
  });
  assert.equal(spoofedUpdate.status, 403);

  const regionalCookie = await login(runtime.baseUrl, regionalManager.email);
  const wrongRoleUpdate = await fetch(`${runtime.baseUrl}/api/bookings/${booking.id}/area-inputs`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: regionalCookie },
    body: JSON.stringify({ updatedBy: areaManager.id, bookingCategory: "priority" })
  });
  assert.equal(wrongRoleUpdate.status, 403);

  const authenticatedUpdate = await fetch(`${runtime.baseUrl}/api/bookings/${booking.id}/area-inputs`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: areaCookie },
    body: JSON.stringify({ updatedBy: regionalManager.id, bookingCategory: "priority" })
  });
  assert.equal(authenticatedUpdate.status, 200, `${await authenticatedUpdate.clone().text()} ${runtime.stderr}`);
  const updated = await authenticatedUpdate.json();
  assert.equal(updated.booking.areaInputs.updatedBy, areaManager.id);
});

test("production cookies are Secure and demo credentials are disabled", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "booking-production-security-"));
  const databasePath = path.join(directory, "db.json");
  const encryptionKey = Buffer.alloc(32, 9).toString("base64");
  const data = seedData();
  const admin = data.users.find((user) => user.role === "Admin");
  admin.passwordHash = createPasswordHash("A-production-test-password-123");
  await writeFile(databasePath, encodeStoredData(data, { NODE_ENV: "production", PERSISTENCE_DRIVER: "file", RATE_LIMIT_DRIVER: "memory", DATA_ENCRYPTION_KEY: encryptionKey }), "utf8");
  const port = await availablePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, PORT: String(port), BOOKING_DB_PATH: databasePath, NODE_ENV: "production", PERSISTENCE_DRIVER: "file", RATE_LIMIT_DRIVER: "memory", DATA_ENCRYPTION_KEY: encryptionKey },
    stdio: ["ignore", "pipe", "pipe"]
  });
  t.after(async () => {
    child.kill();
    await rm(directory, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const demoResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "Password@123" })
  });
  assert.equal(demoResponse.status, 401);
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: "A-production-test-password-123" })
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /; Secure(?:;|$)/);
});



