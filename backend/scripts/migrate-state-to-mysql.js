import "dotenv/config";
import path from "node:path";
import { FileStateStore, MySqlStateStore } from "../src/state-store.js";
import { decodeStoredData, encodeStoredData } from "../src/storage-crypto.js";
import { prepareLegacyState, reconcileStates, stateChecksum, stateInventory } from "../src/state-migration.js";

function safeError(error) {
  const databaseCodes = new Set(["ER_BAD_NULL_ERROR", "ER_DUP_ENTRY", "ER_NO_REFERENCED_ROW_2", "ER_ROW_IS_REFERENCED_2", "ER_CHECK_CONSTRAINT_VIOLATED", "WARN_DATA_TRUNCATED"]);
  if (databaseCodes.has(error?.code)) return { code: error.code, message: `Database rejected normalized migration data${error.persistenceTable ? ` in ${error.persistenceTable}` : ""}` };
  return { code: error?.code || "STATE_MIGRATION_FAILED", message: String(error?.message || "State migration failed").slice(0, 240) };
}

async function main() {
  const mode = String(process.env.STATE_MIGRATION_MODE || "dry-run").trim().toLowerCase();
  if (!["dry-run", "migrate", "verify", "cleanup"].includes(mode)) throw new Error("STATE_MIGRATION_MODE must be dry-run, migrate, verify, or cleanup");
  if (mode !== "dry-run" && !process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (mode === "migrate" && process.env.CONFIRM_STATE_MIGRATION !== "yes") throw new Error("Set CONFIRM_STATE_MIGRATION=yes to migrate state");
  if (mode === "cleanup" && process.env.CONFIRM_STATE_CLEANUP !== "yes") throw new Error("Set CONFIRM_STATE_CLEANUP=yes to remove legacy document rows");

  const sourcePath = path.resolve(process.env.SOURCE_STATE_PATH || "data/mock-db.json");
  const sourceSnapshot = await new FileStateStore(sourcePath).load();
  const sourceData = prepareLegacyState(decodeStoredData(sourceSnapshot.payload, process.env));
  const sourceSummary = { checksum: stateChecksum(sourceData), inventory: stateInventory(sourceData) };
  if (mode === "dry-run") return { mode, valid: true, source: sourceSummary };

  const destination = new MySqlStateStore(process.env);
  try {
    if (mode === "migrate") await destination.initialize(encodeStoredData(sourceData, process.env));
    const destinationSnapshot = await destination.load();
    const destinationData = decodeStoredData(destinationSnapshot.payload, process.env);
    const reconciliation = reconcileStates(sourceData, destinationData);
    if (!reconciliation.matches) {
      const error = new Error(`State migration reconciliation failed for: ${reconciliation.differingKeys.join(", ")}`);
      error.code = "STATE_RECONCILIATION_FAILED";
      throw error;
    }
    let removedLegacyRows = 0;
    if (mode === "cleanup") {
      const [result] = await destination.pool.execute("DELETE FROM application_state WHERE state_key = ?", ["booking-dashboard"]);
      removedLegacyRows = result.affectedRows;
    }
    return { mode, reconciled: true, version: destinationSnapshot.version, checksum: reconciliation.sourceChecksum, inventory: reconciliation.sourceInventory, removedLegacyRows };
  } finally {
    await destination.close();
  }
}

try {
  console.log(JSON.stringify(await main()));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: safeError(error) }));
  process.exitCode = 1;
}