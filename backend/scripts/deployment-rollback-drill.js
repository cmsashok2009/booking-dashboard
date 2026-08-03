import "dotenv/config";
import { runDeploymentRollbackDrill } from "../src/deployment-rollback-drill.js";

const result = await runDeploymentRollbackDrill();
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
