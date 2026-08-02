import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

export class PersistenceConflictError extends Error {
  constructor() {
    super("Stored data changed while this request was being processed.");
    this.code = "PERSISTENCE_CONFLICT";
    this.status = 409;
  }
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

export class FileStateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async load() {
    const payload = await readFile(this.filePath, "utf8");
    return { payload, version: digest(payload) };
  }

  async initialize(payload) {
    try {
      return await this.load();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await this.#persist(payload);
    return { payload, version: digest(payload) };
  }

  async save(payload, expectedVersion) {
    const operation = this.queue.then(async () => {
      const current = await this.load();
      if (expectedVersion && current.version !== expectedVersion) throw new PersistenceConflictError();
      await this.#persist(payload);
      return digest(payload);
    });
    this.queue = operation.catch(() => {});
    return operation;
  }

  async #persist(payload) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const suffix = `${process.pid}.${Date.now()}`;
    const temporaryPath = `${this.filePath}.${suffix}.tmp`;
    const backupPath = `${this.filePath}.${suffix}.bak`;
    let previousMoved = false;
    await writeFile(temporaryPath, payload, { encoding: "utf8", mode: 0o600 });
    try {
      try {
        await rename(this.filePath, backupPath);
        previousMoved = true;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await rename(temporaryPath, this.filePath);
      if (previousMoved) await rm(backupPath, { force: true });
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => {});
      if (previousMoved) await rename(backupPath, this.filePath).catch(() => {});
      throw error;
    }
  }

  async readiness() {
    try {
      await this.load();
      return { ready: true, driver: "file" };
    } catch (error) {
      return { ready: false, driver: "file", code: error.code || "FILE_UNAVAILABLE" };
    }
  }

  async close() {}
}

export class MySqlStateStore {
  constructor(environment = process.env) {
    const databaseUrl = environment.DATABASE_URL ? new URL(environment.DATABASE_URL) : null;
    this.pool = mysql.createPool({
      host: databaseUrl?.hostname || environment.DB_HOST,
      port: Number(databaseUrl?.port || environment.DB_PORT || 3306),
      user: databaseUrl ? decodeURIComponent(databaseUrl.username) : environment.DB_USER,
      password: databaseUrl ? decodeURIComponent(databaseUrl.password) : environment.DB_PASSWORD,
      database: databaseUrl ? decodeURIComponent(databaseUrl.pathname.slice(1)) : environment.DB_NAME,
      connectionLimit: Number(environment.DB_POOL_SIZE || 10),
      connectTimeout: Number(environment.DB_CONNECT_TIMEOUT_MS || 3000),
      waitForConnections: true,
      queueLimit: Number(environment.DB_QUEUE_LIMIT || 100),
      enableKeepAlive: true,
      ssl: environment.DB_SSL === "true" ? { rejectUnauthorized: environment.DB_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined
    });
  }

  async migrate() {
    await this.pool.execute(`CREATE TABLE IF NOT EXISTS application_state (
      state_key VARCHAR(100) PRIMARY KEY,
      version BIGINT UNSIGNED NOT NULL,
      payload LONGTEXT NOT NULL,
      updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB`);
  }

  async load() {
    const [rows] = await this.pool.execute("SELECT version, payload FROM application_state WHERE state_key = ?", ["booking-dashboard"]);
    if (!rows.length) {
      const error = new Error("Production database is not initialized");
      error.code = "STATE_NOT_INITIALIZED";
      throw error;
    }
    return { payload: rows[0].payload, version: Number(rows[0].version) };
  }

  async initialize(payload) {
    await this.migrate();
    await this.pool.execute("INSERT IGNORE INTO application_state (state_key, version, payload) VALUES (?, 1, ?)", ["booking-dashboard", payload]);
    return this.load();
  }

  async save(payload, expectedVersion) {
    const [result] = await this.pool.execute(
      "UPDATE application_state SET payload = ?, version = version + 1 WHERE state_key = ? AND version = ?",
      [payload, "booking-dashboard", expectedVersion]
    );
    if (result.affectedRows !== 1) throw new PersistenceConflictError();
    return Number(expectedVersion) + 1;
  }

  async readiness() {
    try {
      await this.pool.query("SELECT 1");
      return { ready: true, driver: "mysql" };
    } catch (error) {
      return { ready: false, driver: "mysql", code: error.code || "DATABASE_UNAVAILABLE" };
    }
  }

  async close() {
    await this.pool.end();
  }
}

export function createStateStore({ environment = process.env, filePath }) {
  const driver = String(environment.PERSISTENCE_DRIVER || (environment.NODE_ENV === "production" ? "mysql" : "file")).toLowerCase();
  if (driver === "file") return new FileStateStore(filePath);
  if (driver === "mysql") return new MySqlStateStore(environment);
  throw new Error(`Unsupported PERSISTENCE_DRIVER: ${driver}`);
}


