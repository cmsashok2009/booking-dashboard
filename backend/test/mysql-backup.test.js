import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_FORMAT,
  backupRetentionPlan,
  backupSummary,
  decryptBackup,
  encryptBackup,
  restoreBackupPayload,
  tableChecksum,
  verifyBackupPayload,
} from "../src/mysql-backup.js";

const key = Buffer.alloc(32, 7).toString("base64");

function samplePayload() {
  const userRows = [{ id: "u1", email: "admin@example.com", version: 1 }];
  const roleRows = [{ id: "admin", name: "Admin" }];
  return {
    format: BACKUP_FORMAT,
    source: "test",
    createdAt: "2026-08-03T00:00:00.000Z",
    tables: [
      {
        name: "roles",
        rowCount: roleRows.length,
        checksum: tableChecksum(roleRows),
        rows: roleRows,
      },
      {
        name: "users",
        rowCount: userRows.length,
        checksum: tableChecksum(userRows),
        rows: userRows,
      },
    ],
  };
}

test("encrypted backup round-trips without plaintext personal data", () => {
  const payload = samplePayload();
  const encrypted = encryptBackup(payload, { BACKUP_ENCRYPTION_KEY: key });
  assert.match(encrypted, /booking-dashboard-mysql-backup-v1/);
  assert.equal(encrypted.includes("admin@example.com"), false);
  assert.deepEqual(
    decryptBackup(encrypted, { BACKUP_ENCRYPTION_KEY: key }),
    payload,
  );
});

test("backup verification detects row-count and checksum tampering", () => {
  const payload = samplePayload();
  assert.equal(verifyBackupPayload(payload).rowCount, 2);
  assert.throws(
    () =>
      verifyBackupPayload({
        ...payload,
        tables: [{ ...payload.tables[0], rowCount: 99 }],
      }),
    /row count mismatch/,
  );
  assert.throws(
    () =>
      verifyBackupPayload({
        ...payload,
        tables: [{ ...payload.tables[0], checksum: "0".repeat(64) }],
      }),
    /checksum mismatch/,
  );
});

test("restore deletes existing rows and inserts backup rows with foreign keys disabled", async () => {
  const calls = [];
  const connection = {
    async query(sql) {
      calls.push(["query", sql]);
      return [[]];
    },
    async execute(sql, params) {
      calls.push(["execute", sql, params]);
      return [{}];
    },
  };
  const summary = await restoreBackupPayload(connection, samplePayload());
  assert.equal(summary.tableCount, 2);
  assert.deepEqual(
    calls.slice(0, 4).map((call) => call[1]),
    [
      "SET FOREIGN_KEY_CHECKS = 0",
      "DELETE FROM `users`",
      "DELETE FROM `roles`",
      "INSERT INTO `roles` (`id`, `name`) VALUES (?, ?)",
    ],
  );
  assert.equal(calls.at(-1)[1], "SET FOREIGN_KEY_CHECKS = 1");
});

test("backup summary excludes row contents", () => {
  const summary = backupSummary(samplePayload());
  assert.equal(JSON.stringify(summary).includes("admin@example.com"), false);
  assert.deepEqual(Object.keys(summary.tables[0]).sort(), [
    "checksum",
    "name",
    "rowCount",
  ]);
});
test("backup retention plan removes old files and keeps newest count", () => {
  const plan = backupRetentionPlan(
    [
      {
        name: "booking-dashboard-a.json.enc",
        path: "/backups/a",
        mtime: "2026-08-03T00:00:00.000Z",
      },
      {
        name: "booking-dashboard-b.json.enc",
        path: "/backups/b",
        mtime: "2026-08-02T00:00:00.000Z",
      },
      {
        name: "booking-dashboard-c.json.enc",
        path: "/backups/c",
        mtime: "2026-07-01T00:00:00.000Z",
      },
    ],
    {
      now: new Date("2026-08-03T12:00:00.000Z"),
      retentionDays: 14,
      retentionCount: 2,
    },
  );

  assert.deepEqual(
    plan.map(({ name, remove, reason }) => ({ name, remove, reason })),
    [
      {
        name: "booking-dashboard-a.json.enc",
        remove: false,
        reason: "retained",
      },
      {
        name: "booking-dashboard-b.json.enc",
        remove: false,
        reason: "retained",
      },
      {
        name: "booking-dashboard-c.json.enc",
        remove: true,
        reason: "retention_count",
      },
    ],
  );
});
