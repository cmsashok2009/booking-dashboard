import assert from "node:assert/strict";
import test from "node:test";
import { runBackupKeyRecoveryDrill } from "../src/backup-key-recovery-drill.js";

const key = Buffer.alloc(32, 11).toString("base64");

test("backup key recovery drill requires explicit confirmation", async () => {
  await assert.rejects(
    () =>
      runBackupKeyRecoveryDrill({
        env: { BACKUP_ENCRYPTION_KEY: key },
      }),
    /CONFIRM_BACKUP_KEY_RECOVERY_DRILL=yes/,
  );
});

test("backup key recovery drill verifies correct key and rejects wrong key", async () => {
  const result = await runBackupKeyRecoveryDrill({
    env: {
      CONFIRM_BACKUP_KEY_RECOVERY_DRILL: "yes",
      BACKUP_ENCRYPTION_KEY: key,
    },
    now: new Date("2026-08-03T00:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  assert.equal(result.algorithm, "aes-256-gcm");
  assert.equal(result.tableCount, 1);
  assert.equal(result.rowCount, 1);
  assert.equal(result.correctKeyVerified, true);
  assert.equal(result.wrongKeyRejected, true);
  assert.equal(result.safeSummaryOnly, true);
});

test("backup key recovery drill summary excludes key material and row contents", async () => {
  const result = await runBackupKeyRecoveryDrill({
    env: {
      CONFIRM_BACKUP_KEY_RECOVERY_DRILL: "yes",
      BACKUP_ENCRYPTION_KEY: key,
    },
  });
  const output = JSON.stringify(result);

  assert.equal(output.includes(key), false);
  assert.equal(output.includes("DRILL_ROW_CONTENT_SHOULD_NOT_APPEAR"), false);
  assert.equal(output.includes("drill-key-recovery"), false);
});

test("backup key recovery drill fails when backup key is absent", async () => {
  await assert.rejects(
    () =>
      runBackupKeyRecoveryDrill({
        env: { CONFIRM_BACKUP_KEY_RECOVERY_DRILL: "yes" },
      }),
    /BACKUP_ENCRYPTION_KEY is required/,
  );
});
