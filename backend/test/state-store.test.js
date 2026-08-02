import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FileStateStore, PersistenceConflictError, createStateStore } from "../src/state-store.js";

test("file store detects stale concurrent writes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "booking-store-"));
  const store = new FileStateStore(path.join(directory, "state.json"));
  try {
    const initial = await store.initialize('{"value":1}');
    const firstVersion = await store.save('{"value":2}', initial.version);
    assert.notEqual(firstVersion, initial.version);
    await assert.rejects(store.save('{"value":3}', initial.version), PersistenceConflictError);
    assert.equal((await store.load()).payload, '{"value":2}');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("production defaults to MySQL and local development defaults to file", () => {
  const local = createStateStore({ environment: { NODE_ENV: "test" }, filePath: "local.json" });
  assert.equal(local.constructor.name, "FileStateStore");
  const production = createStateStore({ environment: { NODE_ENV: "production" }, filePath: "ignored.json" });
  assert.equal(production.constructor.name, "MySqlStateStore");
});
