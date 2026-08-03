import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { runLoadSmoke } from "../src/load-smoke.js";

function intEnv(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer`);
  return value;
}

function numberEnv(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${name} must be zero or greater`);
  return value;
}

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

async function waitForHealth(baseUrl, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error(`load-smoke backend exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("load-smoke backend did not become healthy");
}

async function startBackend() {
  const useCurrentEnvironment = process.env.LOAD_SMOKE_USE_CURRENT_ENV === "true";
  const directory = useCurrentEnvironment
    ? null
    : await mkdtemp(path.join(os.tmpdir(), "booking-load-smoke-"));
  const port = await availablePort();
  const childEnvironment = useCurrentEnvironment
    ? { ...process.env, PORT: String(port) }
    : {
        ...process.env,
        PORT: String(port),
        BOOKING_DB_PATH: path.join(directory, "db.json"),
        ALLOW_DEMO_CREDENTIALS: "true",
        NODE_ENV: "test",
      };
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: childEnvironment,
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForHealth(baseUrl, child);
  } catch (error) {
    child.kill();
    if (directory) await rm(directory, { recursive: true, force: true });
    throw new Error(`${error.message}: ${stderr}`);
  }
  return { baseUrl, child, directory };
}

let runtime;
try {
  runtime =
    process.env.LOAD_SMOKE_START_BACKEND === "true"
      ? await startBackend()
      : { baseUrl: process.env.BASE_URL || "http://127.0.0.1:8000" };

  const report = await runLoadSmoke({
    baseUrl: runtime.baseUrl,
    email: process.env.LOAD_SMOKE_EMAIL || "admin@example.com",
    password: process.env.LOAD_SMOKE_PASSWORD || "Password@123",
    concurrency: intEnv("LOAD_SMOKE_CONCURRENCY", 3),
    durationSeconds: intEnv("LOAD_SMOKE_DURATION_SECONDS", 8),
    pauseMs: intEnv("LOAD_SMOKE_PAUSE_MS", 50),
    includeWrites: process.env.LOAD_SMOKE_INCLUDE_WRITES === "true",
    thresholds: {
      minRequests: intEnv("LOAD_SMOKE_MIN_REQUESTS", 30),
      maxErrorRate: numberEnv("LOAD_SMOKE_MAX_ERROR_RATE", 0.01),
      maxP95Ms: numberEnv("LOAD_SMOKE_MAX_P95_MS", 750),
    },
  });

  const outputPath = process.env.LOAD_SMOKE_REPORT_PATH;
  if (outputPath) {
    await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
    await writeFile(
      path.resolve(outputPath),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
  }
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
} finally {
  if (runtime?.child) {
    runtime.child.kill();
    if (runtime.directory) await rm(runtime.directory, { recursive: true, force: true });
  }
}
