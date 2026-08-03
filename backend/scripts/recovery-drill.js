import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSubprocessRunner, runRecoveryDrill } from "../src/recovery-drill.js";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await runRecoveryDrill({
  runner: createSubprocessRunner({ cwd: backendDir }),
});
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
