import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runMigrationRollbackDrill } from "../src/migration-rollback-drill.js";

async function fixtureMigrations() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "booking-rollback-drill-"));
  await writeFile(path.join(directory, "001-one.up.sql"), "CREATE TABLE one (id INT PRIMARY KEY);");
  await writeFile(path.join(directory, "001-one.down.sql"), "DROP TABLE one;");
  await writeFile(path.join(directory, "002-two.up.sql"), "CREATE TABLE two (id INT PRIMARY KEY);");
  await writeFile(path.join(directory, "002-two.down.sql"), "DROP TABLE two;");
  return directory;
}

test("migration rollback drill requires explicit confirmation", async () => {
  await assert.rejects(
    () => runMigrationRollbackDrill({ env: { DATABASE_URL: "mysql://example" } }),
    /CONFIRM_MIGRATION_ROLLBACK_DRILL=yes/,
  );
});

test("migration rollback drill rejects unavailable expected version before connecting", async () => {
  const migrationsDir = await fixtureMigrations();
  await assert.rejects(
    () =>
      runMigrationRollbackDrill({
        migrationsDir,
        env: {
          CONFIRM_MIGRATION_ROLLBACK_DRILL: "yes",
          DATABASE_URL: "mysql://example",
          MIGRATION_ROLLBACK_DRILL_VERSION: "999-missing",
        },
      }),
    /not available: 999-missing/,
  );
});
