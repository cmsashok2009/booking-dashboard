import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { decryptBackup, verifyBackupPayload } from "../src/mysql-backup.js";

const backupPath = process.argv[2] || process.env.BACKUP_PATH;
if (!backupPath)
  throw new Error("Provide a backup path as an argument or BACKUP_PATH");
const payload = decryptBackup(await readFile(path.resolve(backupPath), "utf8"));
console.log(JSON.stringify(verifyBackupPayload(payload)));
