import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { decryptBackup, restoreBackupPayload } from "../src/mysql-backup.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (process.env.CONFIRM_RESTORE !== "yes")
  throw new Error("Set CONFIRM_RESTORE=yes to restore a backup");
const backupPath = process.argv[2] || process.env.BACKUP_PATH;
if (!backupPath)
  throw new Error("Provide a backup path as an argument or BACKUP_PATH");
const payload = decryptBackup(await readFile(path.resolve(backupPath), "utf8"));
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
  await connection.beginTransaction();
  const summary = await restoreBackupPayload(connection, payload);
  await connection.commit();
  console.log(JSON.stringify({ restored: true, ...summary }));
} catch (error) {
  await connection.rollback().catch(() => {});
  throw error;
} finally {
  connection.release();
  await pool.end();
}
