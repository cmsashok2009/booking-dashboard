import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const UP_PATTERN = /^(\d{3,})-([a-z0-9-]+)\.up\.sql$/;

export function migrationChecksum(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

export async function discoverMigrations(directory) {
  const names = await readdir(directory);
  const migrations = [];
  for (const name of names.sort()) {
    const match = UP_PATTERN.exec(name);
    if (!match) continue;
    const version = `${match[1]}-${match[2]}`;
    const upPath = path.join(directory, name);
    const downPath = path.join(directory, `${version}.down.sql`);
    const [up, down] = await Promise.all([readFile(upPath, "utf8"), readFile(downPath, "utf8")]);
    migrations.push({ version, up, down, checksum: migrationChecksum(up) });
  }
  return migrations;
}

export async function ensureMigrationTable(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
  ) ENGINE=InnoDB`);
}

export async function applyMigrations(connection, migrations) {
  await ensureMigrationTable(connection);
  const [rows] = await connection.query("SELECT version, checksum FROM schema_migrations ORDER BY version");
  const applied = new Map(rows.map((row) => [row.version, row.checksum]));
  const completed = [];
  for (const migration of migrations) {
    const existingChecksum = applied.get(migration.version);
    if (existingChecksum && existingChecksum !== migration.checksum) {
      throw new Error(`Applied migration checksum changed: ${migration.version}`);
    }
    if (existingChecksum) continue;
    await connection.query(migration.up);
    await connection.execute("INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)", [migration.version, migration.checksum]);
    completed.push(migration.version);
  }
  return completed;
}

export async function rollbackMigration(connection, migrations, expectedVersion) {
  await ensureMigrationTable(connection);
  const [rows] = await connection.query("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1");
  if (!rows.length) return null;
  const version = rows[0].version;
  if (expectedVersion && expectedVersion !== version) throw new Error(`Latest migration is ${version}, not ${expectedVersion}`);
  const migration = migrations.find((item) => item.version === version);
  if (!migration) throw new Error(`Rollback file is unavailable for applied migration: ${version}`);
  await connection.query(migration.down);
  await connection.execute("DELETE FROM schema_migrations WHERE version = ?", [version]);
  return version;
}

