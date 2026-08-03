import "dotenv/config";
import { runBackupKeyRecoveryDrill } from "../src/backup-key-recovery-drill.js";

const result = await runBackupKeyRecoveryDrill();
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
