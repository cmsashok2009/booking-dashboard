import assert from "node:assert/strict";
import test from "node:test";
import { runRecoveryDrill } from "../src/recovery-drill.js";

function fixedClock() {
  const dates = [
    new Date("2026-08-03T00:00:00.000Z"),
    new Date("2026-08-03T00:01:00.000Z"),
  ];
  return () => dates.shift() || dates.at(-1);
}

function timer(values) {
  const queue = [...values];
  return () => queue.shift() ?? values.at(-1);
}

test("recovery drill requires explicit confirmation", async () => {
  await assert.rejects(
    () =>
      runRecoveryDrill({
        env: { DATABASE_URL: "mysql://example" },
        runner: async () => ({ stdout: "{}" }),
      }),
    /CONFIRM_RECOVERY_DRILL=yes/,
  );
});

test("recovery drill orchestrates backup, check, restore, and smoke with safe summary", async () => {
  const calls = [];
  const summaries = [
    {
      backupPath: "D:/tmp/drill.enc",
      createdAt: "2026-08-03T00:00:30.000Z",
      tableCount: 2,
      rowCount: 4,
    },
    {
      createdAt: "2026-08-03T00:00:30.000Z",
      tableCount: 2,
      rowCount: 4,
    },
    {
      restored: true,
      tableCount: 2,
      rowCount: 4,
    },
    {
      requestCount: 42,
      failureCount: 0,
      latencyMs: { p95: 25 },
    },
  ];
  const result = await runRecoveryDrill({
    env: {
      CONFIRM_RECOVERY_DRILL: "yes",
      DATABASE_URL: "mysql://example",
      BACKUP_PATH: "D:/tmp/drill.enc",
      RECOVERY_DRILL_RPO_MINUTES: "15",
      RECOVERY_DRILL_RTO_MINUTES: "60",
    },
    now: fixedClock(),
    timer: timer([0, 0, 100, 100, 200, 200, 300, 300, 400, 60000]),
    runner: async (call) => {
      calls.push(call);
      return { stdout: JSON.stringify(summaries.shift()) };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.backupPath, "D:/tmp/drill.enc");
  assert.deepEqual(
    calls.map((call) => call.label),
    ["backup", "integrity-check", "restore", "post-restore-smoke"],
  );
  assert.equal(calls[2].env.CONFIRM_RESTORE, "yes");
  assert.equal(result.restored.tableCount, 2);
  assert.equal(result.smoke.requests, 42);
  assert.equal(result.smoke.failures, 0);
  assert.equal(result.smoke.p95Ms, 25);
  assert.equal(JSON.stringify(result).includes("mysql://example"), false);
});

test("recovery drill fails when RTO target is missed", async () => {
  await assert.rejects(
    () =>
      runRecoveryDrill({
        env: {
          CONFIRM_RECOVERY_DRILL: "yes",
          DATABASE_URL: "mysql://example",
          RECOVERY_DRILL_RTO_MINUTES: "0",
        },
        runner: async () => ({ stdout: "{}" }),
      }),
    /RECOVERY_DRILL_RTO_MINUTES must be a positive number/,
  );

  const summaries = [
    { backupPath: "x.enc", createdAt: "2026-08-03T00:00:00.000Z", tableCount: 1, rowCount: 1 },
    { createdAt: "2026-08-03T00:00:00.000Z", tableCount: 1, rowCount: 1 },
    { restored: true, tableCount: 1, rowCount: 1 },
  ];
  const result = await runRecoveryDrill({
    env: {
      CONFIRM_RECOVERY_DRILL: "yes",
      DATABASE_URL: "mysql://example",
      RECOVERY_DRILL_RTO_MINUTES: "0.001",
      RECOVERY_DRILL_SKIP_SMOKE: "yes",
    },
    now: fixedClock(),
    timer: timer([0, 0, 10, 10, 20, 20, 30, 1000]),
    runner: async () => ({ stdout: JSON.stringify(summaries.shift()) }),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.smoke, { skipped: true });
});
test("recovery subprocess failures redact sensitive output", async () => {
  await assert.rejects(
    async () => {
      await runRecoveryDrill({
        env: {
          CONFIRM_RECOVERY_DRILL: "yes",
          DATABASE_URL: "mysql://user:secret-password@127.0.0.1:3306/db",
          BACKUP_ENCRYPTION_KEY: "sensitive-backup-key",
        },
        runner: async () => {
          const error = new Error("backup failed with exit code 1");
          error.stdout = "";
          error.stderr = "failed mysql://user:secret-password@127.0.0.1:3306/db sensitive-backup-key";
          throw error;
        },
      });
    },
    (error) => {
      const serialized = JSON.stringify(error);
      assert.equal(serialized.includes("secret-password"), false);
      assert.equal(serialized.includes("sensitive-backup-key"), false);
      return true;
    },
  );
});
