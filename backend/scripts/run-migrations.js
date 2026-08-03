import "dotenv/config";
import path from "node:path";
import mysql from "mysql2/promise";
import { applyMigrations, discoverMigrations, rollbackMigration } from "../src/migrations.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const databaseUrl = new URL(process.env.DATABASE_URL);
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 1,
  multipleStatements: true,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined
});
const connection = await pool.getConnection();
const migrations = await discoverMigrations(path.resolve("migrations"));

try {
  const [[lock]] = await connection.query("SELECT GET_LOCK(?, 30) AS acquired", ["booking-dashboard-migrations"]);
  if (lock.acquired !== 1) throw new Error("Could not acquire the database migration lock");
  if (process.argv[2] === "rollback") {
    if (process.env.CONFIRM_MIGRATION_ROLLBACK !== "yes") throw new Error("Set CONFIRM_MIGRATION_ROLLBACK=yes to roll back");
    const version = await rollbackMigration(connection, migrations, process.argv[3]);
    console.log(JSON.stringify({ rolledBack: version }));
  } else {
    const versions = await applyMigrations(connection, migrations);
    console.log(JSON.stringify({ applied: versions }));
  }
} finally {
  await connection.query("SELECT RELEASE_LOCK(?)", ["booking-dashboard-migrations"]).catch(() => {});
  connection.release();
  await pool.end();
}

