import { spawn } from "node:child_process";
import path from "node:path";
import { performance } from "node:perf_hooks";

function parsePositiveNumber(value, fallback, name) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return parsed;
}

function redactionValues(environment) {
  return Object.entries(environment)
    .filter(([key, value]) => /PASSWORD|SECRET|TOKEN|KEY|DATABASE_URL/i.test(key) && String(value || "").length >= 4)
    .map(([, value]) => String(value));
}

function redactOutput(output, environment = process.env) {
  let redacted = String(output || "");
  for (const value of redactionValues(environment)) {
    redacted = redacted.split(value).join("[REDACTED]");
  }
  return redacted.replace(/mysql:\/\/[^@\s]+@/gi, "mysql://[REDACTED]@");
}

function lastJsonLine(output, label) {
  const lines = String(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of [...lines].reverse()) {
    try {
      return JSON.parse(line);
    } catch {
      // Continue scanning; child process output may include npm banners.
    }
  }
  throw new Error(`${label} did not produce a JSON summary`);
}

export function createSubprocessRunner({ cwd = process.cwd(), stdio = "pipe" } = {}) {
  return ({ command, args = [], env = {}, label }) =>
    new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        shell: process.platform === "win32",
        stdio: ["ignore", stdio, stdio],
      });
      let stdout = "";
      let stderr = "";
      if (child.stdout) child.stdout.on("data", (chunk) => (stdout += chunk));
      if (child.stderr) child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve({ code, stdout, stderr });
          return;
        }
        const error = new Error(`${label} failed with exit code ${code}`);
        error.code = code;
        error.stdout = redactOutput(stdout, { ...process.env, ...env });
        error.stderr = redactOutput(stderr, { ...process.env, ...env });
        reject(error);
      });
    });
}

export async function runRecoveryDrill({
  env = process.env,
  now = () => new Date(),
  timer = () => performance.now(),
  runner = createSubprocessRunner(),
} = {}) {
  if (env.CONFIRM_RECOVERY_DRILL !== "yes") {
    throw new Error("Set CONFIRM_RECOVERY_DRILL=yes to run the destructive recovery drill");
  }
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const startedAt = now();
  const startedMs = timer();
  const rpoTargetMinutes = parsePositiveNumber(
    env.RECOVERY_DRILL_RPO_MINUTES,
    15,
    "RECOVERY_DRILL_RPO_MINUTES",
  );
  const rtoTargetMinutes = parsePositiveNumber(
    env.RECOVERY_DRILL_RTO_MINUTES,
    60,
    "RECOVERY_DRILL_RTO_MINUTES",
  );
  const backupPath = path.resolve(
    env.BACKUP_PATH ||
      path.join(
        ".tmp",
        "recovery-drills",
        `booking-dashboard-drill-${startedAt.toISOString().replace(/[:.]/g, "-")}.json.enc`,
      ),
  );
  const stepResults = [];

  const runStep = async (name, command, args, stepEnv = {}) => {
    const stepStarted = timer();
    let result;
    try {
      result = await runner({
        label: name,
        command,
        args,
        env: { ...env, ...stepEnv },
      });
    } catch (error) {
      error.stdout = redactOutput(error.stdout, { ...env, ...stepEnv });
      error.stderr = redactOutput(error.stderr, { ...env, ...stepEnv });
      throw error;
    }
    const durationMs = Math.max(0, timer() - stepStarted);
    const summary = lastJsonLine(result.stdout, name);
    stepResults.push({ name, durationMs: Math.round(durationMs), summary });
    return summary;
  };

  const backup = await runStep("backup", process.execPath, ["scripts/mysql-backup.js"], {
    BACKUP_PATH: backupPath,
  });
  const check = await runStep("integrity-check", process.execPath, [
    "scripts/mysql-backup-check.js",
    backup.backupPath || backupPath,
  ]);
  const restore = await runStep("restore", process.execPath, [
    "scripts/mysql-restore.js",
    backup.backupPath || backupPath,
  ], {
    CONFIRM_RESTORE: "yes",
  });

  let smoke = null;
  if (env.RECOVERY_DRILL_SKIP_SMOKE !== "yes") {
    const smokeCommand = env.RECOVERY_DRILL_SMOKE_COMMAND || process.execPath;
    const smokeArgs = env.RECOVERY_DRILL_SMOKE_COMMAND
      ? []
      : ["scripts/load-smoke.js"];
    smoke = await runStep("post-restore-smoke", smokeCommand, smokeArgs, {
      LOAD_SMOKE_START_BACKEND: env.LOAD_SMOKE_START_BACKEND || "true",
    });
  }

  const completedAt = now();
  const elapsedMs = Math.max(0, timer() - startedMs);
  const recoveryPoint = new Date(check.createdAt || backup.createdAt || startedAt);
  const recoveryPointAgeMinutes = Math.max(
    0,
    (completedAt.getTime() - recoveryPoint.getTime()) / 60000,
  );
  const rtoMinutes = elapsedMs / 60000;

  return {
    ok: recoveryPointAgeMinutes <= rpoTargetMinutes && rtoMinutes <= rtoTargetMinutes,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    backupPath: backup.backupPath || backupPath,
    targets: {
      rpoMinutes: rpoTargetMinutes,
      rtoMinutes: rtoTargetMinutes,
    },
    measurements: {
      recoveryPointAgeMinutes: Number(recoveryPointAgeMinutes.toFixed(3)),
      rtoMinutes: Number(rtoMinutes.toFixed(3)),
      elapsedMs: Math.round(elapsedMs),
    },
    restored: {
      tableCount: restore.tableCount,
      rowCount: restore.rowCount,
    },
    smoke: smoke
      ? {
          requests: smoke.requests ?? smoke.requestCount,
          failures: smoke.failures ?? smoke.failureCount,
          p95Ms: smoke.p95Ms ?? smoke.latencyMs?.p95,
        }
      : { skipped: true },
    steps: stepResults.map((step) => ({
      name: step.name,
      durationMs: step.durationMs,
      tableCount: step.summary.tableCount,
      rowCount: step.summary.rowCount,
      requests: step.summary.requests ?? step.summary.requestCount,
      failures: step.summary.failures ?? step.summary.failureCount,
      p95Ms: step.summary.p95Ms ?? step.summary.latencyMs?.p95,
    })),
  };
}
