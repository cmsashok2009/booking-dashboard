import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import {
  backupSummary,
  createBackupPayload,
  encryptBackup,
} from "../src/mysql-backup.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const outputPath = path.resolve(
  process.env.BACKUP_PATH ||
    `backups/booking-dashboard-${new Date().toISOString().replace(/[:.]/g, "-")}.json.enc`,
);
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 1,
  multipleStatements: true,
  ssl:
    process.env.DB_SSL === "true"
      ? {
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
        }
      : undefined,
});
const connection = await pool.getConnection();
try {
  const payload = await createBackupPayload(connection, { source: "mysql" });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, encryptBackup(payload), {
    encoding: "utf8",
    mode: 0o600,
  });
  console.log(
    JSON.stringify({ backupPath: outputPath, ...backupSummary(payload) }),
  );
} finally {
  connection.release();
  await pool.end();
}
