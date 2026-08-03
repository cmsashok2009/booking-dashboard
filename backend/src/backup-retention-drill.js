import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function lastJsonLine(output, label) {
  const lines = String(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of [...lines].reverse()) {
    try {
      return JSON.parse(line);
    } catch {}
  }
  throw new Error(`${label} did not produce a JSON summary`);
}

function runCleanup({ cwd, env, label }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/mysql-backup-cleanup.js"], {
      cwd,
      env: { ...process.env, ...env },
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, summary: lastJsonLine(stdout, label) });
        return;
      }
      const error = new Error(`${label} failed with exit code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function seedBackupFiles(directory, now) {
  const files = [
    { name: "booking-dashboard-001-newest.json.enc", ageDays: 0 },
    { name: "booking-dashboard-002-recent.json.enc", ageDays: 1 },
    { name: "booking-dashboard-003-extra.json.enc", ageDays: 2 },
    { name: "booking-dashboard-004-old.json.enc", ageDays: 30 },
    { name: "notes.txt", ageDays: 90 },
  ];
  for (const file of files) {
    const filePath = path.join(directory, file.name);
    await writeFile(filePath, "DRILL_BACKUP_CONTENT_SHOULD_NOT_APPEAR", "utf8");
    const mtime = new Date(now.getTime() - file.ageDays * 24 * 60 * 60 * 1000);
    await utimes(filePath, mtime, mtime);
  }
}

export async function runBackupRetentionDrill({
  env = process.env,
  cwd = path.resolve("backend"),
  now = new Date(),
} = {}) {
  if (env.CONFIRM_BACKUP_RETENTION_DRILL !== "yes") {
    throw new Error("Set CONFIRM_BACKUP_RETENTION_DRILL=yes to run the backup retention drill");
  }

  const directory = await mkdtemp(path.join(os.tmpdir(), "booking-retention-drill-"));
  try {
    await seedBackupFiles(directory, now);
    const drillEnv = {
      BACKUP_DIR: directory,
      BACKUP_RETENTION_DAYS: env.BACKUP_RETENTION_DAYS || "14",
      BACKUP_RETENTION_COUNT: env.BACKUP_RETENTION_COUNT || "2",
    };

    const dryRun = await runCleanup({
      cwd,
      env: drillEnv,
      label: "retention-dry-run",
    });
    if (dryRun.summary.dryRun !== true) throw new Error("Retention dry-run did not run in dry-run mode");
    if (dryRun.summary.scanned !== 4) throw new Error(`Expected 4 backup files, saw ${dryRun.summary.scanned}`);
    if (dryRun.summary.candidates.length !== 2) throw new Error(`Expected 2 removal candidates, saw ${dryRun.summary.candidates.length}`);

    const confirmed = await runCleanup({
      cwd,
      env: { ...drillEnv, CONFIRM_BACKUP_CLEANUP: "yes" },
      label: "retention-confirmed-cleanup",
    });
    if (confirmed.summary.dryRun !== false) throw new Error("Confirmed cleanup did not leave dry-run mode");
    if (confirmed.summary.removed !== 2) throw new Error(`Expected 2 removals, saw ${confirmed.summary.removed}`);

    const finalDryRun = await runCleanup({
      cwd,
      env: drillEnv,
      label: "retention-final-dry-run",
    });
    const remaining = (await readdir(directory)).sort();
    const output = `${dryRun.stdout}\n${confirmed.stdout}\n${finalDryRun.stdout}`;
    if (output.includes("DRILL_BACKUP_CONTENT_SHOULD_NOT_APPEAR")) {
      throw new Error("Retention drill output exposed backup file contents");
    }

    return {
      ok: true,
      retentionDays: Number(drillEnv.BACKUP_RETENTION_DAYS),
      retentionCount: Number(drillEnv.BACKUP_RETENTION_COUNT),
      dryRun: {
        scanned: dryRun.summary.scanned,
        candidates: dryRun.summary.candidates.map(({ name, reason }) => ({ name, reason })),
      },
      confirmed: {
        scanned: confirmed.summary.scanned,
        removed: confirmed.summary.removed,
        candidates: confirmed.summary.candidates.map(({ name, reason }) => ({ name, reason })),
      },
      finalDryRun: {
        scanned: finalDryRun.summary.scanned,
        candidates: finalDryRun.summary.candidates.length,
      },
      remaining,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
