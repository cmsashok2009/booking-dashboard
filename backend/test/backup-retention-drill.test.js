import assert from "node:assert/strict";
import test from "node:test";
import { runBackupRetentionDrill } from "../src/backup-retention-drill.js";

test("backup retention drill requires explicit confirmation", async () => {
  await assert.rejects(
    () => runBackupRetentionDrill({ env: {} }),
    /CONFIRM_BACKUP_RETENTION_DRILL=yes/,
  );
});

test("backup retention drill proves dry-run before confirmed cleanup", async () => {
  const result = await runBackupRetentionDrill({
    env: { CONFIRM_BACKUP_RETENTION_DRILL: "yes" },
    cwd: process.cwd(),
    now: new Date("2026-08-03T00:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun.scanned, 4);
  assert.equal(result.dryRun.candidates.length, 2);
  assert.equal(result.confirmed.removed, 2);
  assert.equal(result.finalDryRun.candidates, 0);
  assert.deepEqual(result.remaining.sort(), [
    "booking-dashboard-001-newest.json.enc",
    "booking-dashboard-002-recent.json.enc",
    "notes.txt",
  ]);
  assert.equal(JSON.stringify(result).includes("DRILL_BACKUP_CONTENT_SHOULD_NOT_APPEAR"), false);
});
