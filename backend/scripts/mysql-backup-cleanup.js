import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { backupRetentionPlan } from "../src/mysql-backup.js";

const backupDir =
  process.env.BACKUP_DIR || path.resolve(process.cwd(), "backups");
const retentionDays = process.env.BACKUP_RETENTION_DAYS || 30;
const retentionCount = process.env.BACKUP_RETENTION_COUNT || 14;
const dryRun = process.env.CONFIRM_BACKUP_CLEANUP !== "yes";

const names = await readdir(backupDir).catch((error) => {
  if (error.code === "ENOENT") return [];
  throw error;
});

const entries = [];
for (const name of names) {
  if (!/^booking-dashboard-.+\.json\.enc$/.test(name)) continue;
  const filePath = path.join(backupDir, name);
  const info = await stat(filePath);
  if (info.isFile()) entries.push({ name, path: filePath, mtime: info.mtime });
}

const plan = backupRetentionPlan(entries, { retentionDays, retentionCount });
const removals = plan.filter((entry) => entry.remove);

if (!dryRun) {
  for (const entry of removals) {
    await unlink(entry.path);
  }
}

console.log(
  JSON.stringify({
    backupDir,
    dryRun,
    retentionDays: Number(retentionDays),
    retentionCount: Number(retentionCount),
    scanned: plan.length,
    removed: dryRun ? 0 : removals.length,
    candidates: removals.map(({ name, reason, mtime }) => ({
      name,
      reason,
      mtime,
    })),
  }),
);
