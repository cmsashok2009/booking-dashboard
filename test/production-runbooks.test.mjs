import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateProductionRunbooks } from "../scripts/validate-production-runbooks.mjs";

const backendScripts = {
  "backup:mysql": "node scripts/mysql-backup.js",
  "check-backup:mysql": "node scripts/mysql-backup-check.js",
  "restore:mysql": "node scripts/mysql-restore.js",
  "recovery:drill": "node scripts/recovery-drill.js",
  "migration:rollback-drill": "node scripts/migration-rollback-drill.js",
  "backup:retention-drill": "node scripts/backup-retention-drill.js",
  "backup:key-recovery-drill": "node scripts/backup-key-recovery-drill.js",
  "deployment:rollback-drill": "node scripts/deployment-rollback-drill.js",
  "cleanup-backups:mysql": "node scripts/mysql-backup-cleanup.js",
  "load:smoke:local": "node scripts/load-smoke.js",
};

test("production recovery runbooks satisfy executable safety contract", async () => {
  const result = await validateProductionRunbooks();
  assert.deepEqual(result.failures, []);
  assert.equal(result.ok, true);
  assert.equal(result.checked.requiredHeadings, 13);
  assert.equal(result.checked.requiredSnippets, 26);
  assert.equal(result.checked.requiredBackendScripts, 10);
});

test("production recovery runbook validator reports missing safety gates", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "booking-runbook-test-"));
  await mkdir(path.join(rootDir, "docs", "operations"), { recursive: true });
  await mkdir(path.join(rootDir, "backend"), { recursive: true });

  await writeFile(
    path.join(rootDir, "docs", "operations", "production-recovery-runbook.md"),
    "# Recovery\n\n## Backup\n\nnpm --prefix backend run backup:mysql\n",
  );
  await writeFile(
    path.join(rootDir, "docs", "operations", "backend-production-runbook.md"),
    "# Backend Runbook\n",
  );
  await writeFile(
    path.join(rootDir, "backend", "package.json"),
    JSON.stringify({ scripts: { ...backendScripts, "restore:mysql": undefined } }),
  );

  const result = await validateProductionRunbooks({ rootDir });
  assert.equal(result.ok, false);
  assert.match(result.failures.join("\n"), /Second-Operator Checklist/);
  assert.match(result.failures.join("\n"), /production-recovery-runbook\.md/);
  assert.match(result.failures.join("\n"), /restore:mysql/);
});

