import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrationRollbackDrill } from "../src/migration-rollback-drill.js";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await runMigrationRollbackDrill({
  migrationsDir: path.join(backendDir, "migrations"),
});
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
