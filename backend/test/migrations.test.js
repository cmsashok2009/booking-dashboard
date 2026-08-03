import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { discoverMigrations, migrationChecksum } from "../src/migrations.js";

test("migration discovery is ordered and requires reversible pairs", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "booking-migrations-"));
  await Promise.all([
    writeFile(path.join(directory, "010-second.up.sql"), "SELECT 2;"),
    writeFile(path.join(directory, "010-second.down.sql"), "SELECT -2;"),
    writeFile(path.join(directory, "002-first.up.sql"), "SELECT 1;"),
    writeFile(path.join(directory, "002-first.down.sql"), "SELECT -1;"),
    writeFile(path.join(directory, "README.md"), "ignored")
  ]);
  const migrations = await discoverMigrations(directory);
  assert.deepEqual(migrations.map((item) => item.version), ["002-first", "010-second"]);
  assert.equal(migrations[0].checksum, migrationChecksum("SELECT 1;"));
  assert.equal(migrations[0].down, "SELECT -1;");
});

test("migration discovery fails when rollback SQL is missing", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "booking-migrations-missing-"));
  await writeFile(path.join(directory, "002-one-way.up.sql"), "SELECT 1;");
  await assert.rejects(discoverMigrations(directory), /002-one-way\.down\.sql/);
});
test("repository migrations are versioned, ordered, and reversible", async () => {
  const migrations = await discoverMigrations(path.resolve("migrations"));
  assert.deepEqual(
    migrations.map((item) => item.version),
    ["001-application-state", "002-normalized-domain", "003-normalized-runtime"]
  );
  for (const migration of migrations) {
    assert.match(migration.up, /\S/);
    assert.match(migration.down, /\S/);
    assert.match(migration.checksum, /^[a-f0-9]{64}$/);
  }
});
