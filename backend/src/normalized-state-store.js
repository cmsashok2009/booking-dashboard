import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { decodeStoredData, encodeStoredData } from "./storage-crypto.js";
import { applyMigrations, discoverMigrations } from "./migrations.js";

const STATE_KEY = "booking-dashboard";
const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

export class NormalizedPersistenceConflictError extends Error {
  constructor() {
    super("Stored data changed while this request was being processed.");
    this.code = "PERSISTENCE_CONFLICT";
    this.status = 409;
  }
}

function poolOptions(environment) {
  const databaseUrl = environment.DATABASE_URL
    ? new URL(environment.DATABASE_URL)
    : null;
  return {
    host: databaseUrl?.hostname || environment.DB_HOST,
    port: Number(databaseUrl?.port || environment.DB_PORT || 3306),
    user: databaseUrl
      ? decodeURIComponent(databaseUrl.username)
      : environment.DB_USER,
    password: databaseUrl
      ? decodeURIComponent(databaseUrl.password)
      : environment.DB_PASSWORD,
    database: databaseUrl
      ? decodeURIComponent(databaseUrl.pathname.slice(1))
      : environment.DB_NAME,
    connectionLimit: Number(environment.DB_POOL_SIZE || 10),
    connectTimeout: Number(environment.DB_CONNECT_TIMEOUT_MS || 3000),
    waitForConnections: true,
    queueLimit: Number(environment.DB_QUEUE_LIMIT || 100),
    enableKeepAlive: true,
    multipleStatements: true,
    ssl:
      environment.DB_SSL === "true"
        ? {
            rejectUnauthorized:
              environment.DB_SSL_REJECT_UNAUTHORIZED !== "false",
          }
        : undefined,
  };
}

import { entity } from "./normalized-state-support.js";
import { replaceNormalizedState } from "./normalized-state-writer.js";

const LOAD_TABLES = [
  ["roles", "roles"],
  ["regions", "regions"],
  ["users", "users"],
  ["dealerCodes", "dealer_codes"],
  ["dealerAssignments", "dealer_assignments"],
  ["bookings", "bookings"],
  ["sessions", "sessions"],
  ["passwordResetTokens", "password_reset_tokens"],
  ["onboardingWorkflows", "onboarding_workflows"],
  ["emailTemplateSamples", "email_template_samples"],
  ["emailTemplates", "email_templates"],
  ["emailTemplateVersions", "email_template_versions"],
  ["emailCampaigns", "email_campaigns"],
  ["activationTokens", "activation_tokens"],
  ["emailDeliveryEvents", "email_delivery_events"],
  ["fileUploads", "file_uploads"],
  ["auditLogs", "audit_logs"],
  ["notifications", "notifications"],
  ["emailProviderConnections", "email_provider_connections"],
  ["emailOAuthStates", "email_oauth_states"],
];

async function readNormalizedState(connection) {
  const data = {};
  for (const [key, table] of LOAD_TABLES) {
    const [rows] = await connection.query(
      `SELECT entity_json FROM ${table} WHERE entity_json IS NOT NULL`,
    );
    data[key] = rows.map((row) => entity(row.entity_json));
  }
  const [lookupRows] = await connection.query(
    "SELECT field_key, entity_json FROM lookup_options WHERE entity_json IS NOT NULL ORDER BY field_key, sort_order, id",
  );
  data.lookupOptions = {};
  for (const row of lookupRows) {
    data.lookupOptions[row.field_key] ||= [];
    data.lookupOptions[row.field_key].push(entity(row.entity_json));
  }
  const [metadataRows] = await connection.query(
    "SELECT metadata_key, value_json FROM runtime_metadata",
  );
  for (const row of metadataRows) {
    data[row.metadata_key] = entity(row.value_json);
  }
  return data;
}

export class NormalizedMySqlStateStore {
  constructor(environment = process.env, pool = null) {
    this.environment = environment;
    this.pool = pool || mysql.createPool(poolOptions(environment));
  }

  async migrate() {
    const connection = await this.pool.getConnection();
    try {
      const migrations = await discoverMigrations(
        path.resolve(MIGRATIONS_DIRECTORY),
      );
      await applyMigrations(connection, migrations);
    } finally {
      connection.release();
    }
  }

  async load() {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT version FROM runtime_revision WHERE state_key = ?",
        [STATE_KEY],
      );
      if (!rows.length) {
        const error = new Error("Production database is not initialized");
        error.code = "STATE_NOT_INITIALIZED";
        throw error;
      }
      const data = await readNormalizedState(connection);
      return {
        payload: encodeStoredData(data, this.environment),
        version: Number(rows[0].version),
      };
    } finally {
      connection.release();
    }
  }

  async initialize(payload) {
    await this.migrate();
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT version FROM runtime_revision WHERE state_key = ? FOR UPDATE",
        [STATE_KEY],
      );
      if (!rows.length) {
        const data = decodeStoredData(payload, this.environment);
        await replaceNormalizedState(connection, data);
        await connection.execute(
          "INSERT INTO runtime_revision (state_key, version) VALUES (?, 1)",
          [STATE_KEY],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return this.load();
  }

  async save(payload, expectedVersion) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT version FROM runtime_revision WHERE state_key = ? FOR UPDATE",
        [STATE_KEY],
      );
      const currentVersion = rows.length ? Number(rows[0].version) : null;
      if (
        currentVersion === null ||
        currentVersion !== Number(expectedVersion)
      ) {
        throw new NormalizedPersistenceConflictError();
      }
      const data = decodeStoredData(payload, this.environment);
      await replaceNormalizedState(connection, data);
      await connection.execute(
        "UPDATE runtime_revision SET version = version + 1 WHERE state_key = ?",
        [STATE_KEY],
      );
      await connection.commit();
      return currentVersion + 1;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async readiness() {
    try {
      const [rows] = await this.pool.execute(
        "SELECT version FROM runtime_revision WHERE state_key = ?",
        [STATE_KEY],
      );
      return {
        ready: rows.length === 1,
        driver: "mysql-normalized",
        code: rows.length === 1 ? undefined : "STATE_NOT_INITIALIZED",
      };
    } catch (error) {
      return {
        ready: false,
        driver: "mysql-normalized",
        code: error.code || "DATABASE_UNAVAILABLE",
      };
    }
  }

  async close() {
    await this.pool.end();
  }
}
