import path from "node:path";
import { performance } from "node:perf_hooks";
import mysql from "mysql2/promise";
import { applyMigrations, discoverMigrations, rollbackMigration } from "./migrations.js";

function mysqlPool(environment) {
  if (!environment.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return mysql.createPool({
    uri: environment.DATABASE_URL,
    connectionLimit: 1,
    multipleStatements: true,
    ssl:
      environment.DB_SSL === "true"
        ? { rejectUnauthorized: environment.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
        : undefined,
  });
}

async function appliedVersions(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
  ) ENGINE=InnoDB`);
  const [rows] = await connection.query("SELECT version FROM schema_migrations ORDER BY version");
  return rows.map((row) => row.version);
}

async function timedStep(name, action, timer) {
  const started = timer();
  const result = await action();
  return {
    name,
    durationMs: Math.round(Math.max(0, timer() - started)),
    ...result,
  };
}

export async function runMigrationRollbackDrill({
  env = process.env,
  migrationsDir = path.resolve("migrations"),
  timer = () => performance.now(),
} = {}) {
  if (env.CONFIRM_MIGRATION_ROLLBACK_DRILL !== "yes") {
    throw new Error("Set CONFIRM_MIGRATION_ROLLBACK_DRILL=yes to run the migration rollback drill");
  }

  const migrations = await discoverMigrations(migrationsDir);
  if (!migrations.length) throw new Error("No migrations discovered");
  const expectedVersion = env.MIGRATION_ROLLBACK_DRILL_VERSION || migrations.at(-1).version;
  if (!migrations.some((migration) => migration.version === expectedVersion)) {
    throw new Error(`MIGRATION_ROLLBACK_DRILL_VERSION is not available: ${expectedVersion}`);
  }

  const pool = mysqlPool(env);
  const connection = await pool.getConnection();
  const startedAt = new Date();
  const startedMs = timer();
  const steps = [];
  try {
    steps.push(
      await timedStep(
        "apply-before-rollback",
        async () => ({ applied: await applyMigrations(connection, migrations) }),
        timer,
      ),
    );
    const beforeRollback = await appliedVersions(connection);
    if (beforeRollback.at(-1) !== expectedVersion) {
      throw new Error(`Latest migration is ${beforeRollback.at(-1) || "none"}, not ${expectedVersion}`);
    }

    steps.push(
      await timedStep(
        "rollback-latest",
        async () => ({ rolledBack: await rollbackMigration(connection, migrations, expectedVersion) }),
        timer,
      ),
    );
    const afterRollback = await appliedVersions(connection);
    if (afterRollback.includes(expectedVersion)) {
      throw new Error(`Rollback did not remove ${expectedVersion}`);
    }

    steps.push(
      await timedStep(
        "reapply-after-rollback",
        async () => ({ applied: await applyMigrations(connection, migrations) }),
        timer,
      ),
    );
    const afterReapply = await appliedVersions(connection);
    if (afterReapply.at(-1) !== expectedVersion) {
      throw new Error(`Reapply did not restore ${expectedVersion}`);
    }

    const elapsedMs = Math.round(Math.max(0, timer() - startedMs));
    return {
      ok: true,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      expectedVersion,
      migrationCount: migrations.length,
      beforeRollback,
      afterRollback,
      afterReapply,
      elapsedMs,
      steps,
    };
  } finally {
    connection.release();
    await pool.end();
  }
}
