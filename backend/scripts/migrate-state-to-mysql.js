import "dotenv/config";
import path from "node:path";
import { FileStateStore, MySqlStateStore } from "../src/state-store.js";
import { decodeStoredData, encodeStoredData } from "../src/storage-crypto.js";

if (process.env.CONFIRM_STATE_MIGRATION !== "yes") throw new Error("Set CONFIRM_STATE_MIGRATION=yes to run this one-way migration");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sourcePath = path.resolve(process.env.SOURCE_STATE_PATH || "data/mock-db.json");
const source = new FileStateStore(sourcePath);
const destination = new MySqlStateStore(process.env);

try {
  const snapshot = await source.load();
  const data = decodeStoredData(snapshot.payload);
  const result = await destination.initialize(encodeStoredData(data));
  console.log(JSON.stringify({ migrated: true, destination: "mysql", version: result.version }));
} finally {
  await destination.close();
}
