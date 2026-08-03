import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), "..");

const requiredHeadings = [
  "Prerequisites",
  "Backup",
  "Integrity Check",
  "Restore",
  "Retention Cleanup",
  "Timed RPO/RTO Drill",
  "Post-Restore Smoke",
  "Failed Deployment Rollback",
  "Failed Migration Rollback",
  "Image Rollback",
  "Key Recovery",
  "Incident Triage",
  "Second-Operator Checklist",
];

const requiredSnippets = [
  "Do not paste secrets",
  "row contents",
  "BACKUP_ENCRYPTION_KEY",
  "DATA_ENCRYPTION_KEY",
  "CONFIRM_RESTORE=yes",
  "CONFIRM_BACKUP_CLEANUP=yes",
  "CONFIRM_BACKUP_RETENTION_DRILL=yes",
  "CONFIRM_BACKUP_KEY_RECOVERY_DRILL=yes",
  "CONFIRM_DEPLOYMENT_ROLLBACK_DRILL=yes",
  "CONFIRM_MIGRATION_ROLLBACK=yes",
  "CONFIRM_MIGRATION_ROLLBACK_DRILL=yes",
  "CONFIRM_RECOVERY_DRILL=yes",
  "CONFIRM_RECOVERY_DRILL=yes npm --prefix backend run recovery:drill",
  "npm --prefix backend run backup:mysql",
  "npm --prefix backend run check-backup:mysql",
  "CONFIRM_RESTORE=yes npm --prefix backend run restore:mysql",
  "CONFIRM_BACKUP_CLEANUP=yes npm --prefix backend run cleanup-backups:mysql",
  "CONFIRM_BACKUP_RETENTION_DRILL=yes npm --prefix backend run backup:retention-drill",
  "CONFIRM_BACKUP_KEY_RECOVERY_DRILL=yes npm --prefix backend run backup:key-recovery-drill",
  "CONFIRM_DEPLOYMENT_ROLLBACK_DRILL=yes npm --prefix backend run deployment:rollback-drill",
  "npm --prefix backend run load:smoke:local",
  "docker compose config --quiet",
  "docker compose up -d",
  "node backend/scripts/run-migrations.js",
  "CONFIRM_MIGRATION_ROLLBACK=yes node backend/scripts/run-migrations.js rollback",
  "CONFIRM_MIGRATION_ROLLBACK_DRILL=yes npm --prefix backend run migration:rollback-drill",
];

const requiredBackendScripts = [
  "backup:mysql",
  "check-backup:mysql",
  "restore:mysql",
  "recovery:drill",
  "migration:rollback-drill",
  "backup:retention-drill",
  "backup:key-recovery-drill",
  "deployment:rollback-drill",
  "cleanup-backups:mysql",
  "load:smoke:local",
];

export async function validateProductionRunbooks({ rootDir = defaultRoot } = {}) {
  const failures = [];
  const recoveryPath = path.join(rootDir, "docs", "operations", "production-recovery-runbook.md");
  const backendRunbookPath = path.join(rootDir, "docs", "operations", "backend-production-runbook.md");
  const backendPackagePath = path.join(rootDir, "backend", "package.json");

  let recovery = "";
  let backendRunbook = "";
  let backendPackage;

  try {
    recovery = await readFile(recoveryPath, "utf8");
  } catch (error) {
    failures.push(`Missing recovery runbook: ${error.message}`);
  }

  try {
    backendRunbook = await readFile(backendRunbookPath, "utf8");
  } catch (error) {
    failures.push(`Missing backend production runbook: ${error.message}`);
  }

  try {
    backendPackage = JSON.parse(await readFile(backendPackagePath, "utf8"));
  } catch (error) {
    failures.push(`Missing or invalid backend package.json: ${error.message}`);
  }

  for (const heading of requiredHeadings) {
    if (!recovery.includes(`## ${heading}`)) {
      failures.push(`Recovery runbook is missing heading: ${heading}`);
    }
  }

  for (const snippet of requiredSnippets) {
    if (!recovery.includes(snippet)) {
      failures.push(`Recovery runbook is missing required command or safety text: ${snippet}`);
    }
  }

  if (backendRunbook && !backendRunbook.includes("production-recovery-runbook.md")) {
    failures.push("Backend production runbook must link to production-recovery-runbook.md");
  }

  const scripts = backendPackage?.scripts || {};
  for (const scriptName of requiredBackendScripts) {
    if (!scripts[scriptName]) {
      failures.push(`backend/package.json is missing script: ${scriptName}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    checked: {
      recoveryRunbook: recoveryPath,
      backendRunbook: backendRunbookPath,
      backendPackage: backendPackagePath,
      requiredHeadings: requiredHeadings.length,
      requiredSnippets: requiredSnippets.length,
      requiredBackendScripts: requiredBackendScripts.length,
    },
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await validateProductionRunbooks();
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

