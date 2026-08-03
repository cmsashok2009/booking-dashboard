import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const BACKUP_FORMAT = "booking-dashboard-mysql-backup-v1";

export function backupEncryptionKey(environment = process.env) {
  const value = String(
    environment.BACKUP_ENCRYPTION_KEY || environment.DATA_ENCRYPTION_KEY || "",
  ).trim();
  if (!value)
    throw new Error(
      "BACKUP_ENCRYPTION_KEY is required to create or read encrypted backups",
    );
  const key = /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  if (key.length !== 32)
    throw new Error("BACKUP_ENCRYPTION_KEY must encode exactly 32 bytes");
  return key;
}

function normalizeForJson(value) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value))
    return { type: "Buffer", base64: value.toString("base64") };
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeForJson(value[key])]),
    );
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(normalizeForJson(value));
}

export function tableChecksum(rows) {
  return createHash("sha256").update(stableJson(rows)).digest("hex");
}

export function encryptBackup(payload, environment = process.env) {
  const key = backupEncryptionKey(environment);
  const iv = randomBytes(12);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(BACKUP_FORMAT));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      algorithm: "aes-256-gcm",
      createdAt: payload.createdAt,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    },
    null,
    2,
  );
}

export function decryptBackup(raw, environment = process.env) {
  const parsed = JSON.parse(raw);
  if (parsed?.format !== BACKUP_FORMAT)
    throw new Error("Unsupported backup format");
  if (parsed.algorithm !== "aes-256-gcm")
    throw new Error("Unsupported backup algorithm");
  const key = backupEncryptionKey(environment);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(parsed.iv, "base64"),
  );
  decipher.setAAD(Buffer.from(BACKUP_FORMAT));
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parsed.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}

function quoteIdentifier(identifier) {
  return `\`${String(identifier).replaceAll("`", "``")}\``;
}
function sqlValue(value) {
  if (
    value &&
    typeof value === "object" &&
    value.type === "Buffer" &&
    typeof value.base64 === "string"
  ) {
    return Buffer.from(value.base64, "base64");
  }
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return value.replace("T", " ").replace("Z", "000");
  }
  if (
    value &&
    typeof value === "object" &&
    !(value instanceof Date) &&
    !Buffer.isBuffer(value)
  ) {
    return JSON.stringify(value);
  }
  return value;
}

export async function listApplicationTables(connection) {
  const [rows] = await connection.query(
    `SELECT table_name AS tableName
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  return rows.map((row) => row.tableName);
}

export async function createBackupPayload(
  connection,
  { source = "mysql" } = {},
) {
  const tables = [];
  for (const tableName of await listApplicationTables(connection)) {
    const [rows] = await connection.query(
      `SELECT * FROM ${quoteIdentifier(tableName)}`,
    );
    tables.push({
      name: tableName,
      rowCount: rows.length,
      checksum: tableChecksum(rows),
      rows,
    });
  }
  return {
    format: BACKUP_FORMAT,
    source,
    createdAt: new Date().toISOString(),
    tables,
  };
}

export function backupSummary(payload) {
  return {
    format: payload.format,
    source: payload.source,
    createdAt: payload.createdAt,
    tableCount: payload.tables.length,
    rowCount: payload.tables.reduce(
      (total, table) => total + table.rowCount,
      0,
    ),
    tables: payload.tables.map(({ name, rowCount, checksum }) => ({
      name,
      rowCount,
      checksum,
    })),
  };
}

export function verifyBackupPayload(payload) {
  if (payload?.format !== BACKUP_FORMAT)
    throw new Error("Unsupported backup payload format");
  if (!Array.isArray(payload.tables))
    throw new Error("Backup payload is missing tables");
  for (const table of payload.tables) {
    if (!table.name || !Array.isArray(table.rows))
      throw new Error("Backup table entry is malformed");
    if (table.rowCount !== table.rows.length)
      throw new Error(`Backup row count mismatch for ${table.name}`);
    const checksum = tableChecksum(table.rows);
    if (checksum !== table.checksum)
      throw new Error(`Backup checksum mismatch for ${table.name}`);
  }
  return backupSummary(payload);
}

export function backupRetentionPlan(
  entries,
  { now = new Date(), retentionDays = 30, retentionCount = 14 } = {},
) {
  const maxAgeMs = Number(retentionDays) * 24 * 60 * 60 * 1000;
  const keepCount = Number(retentionCount);
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0)
    throw new Error("BACKUP_RETENTION_DAYS must be zero or greater");
  if (!Number.isInteger(keepCount) || keepCount < 1)
    throw new Error("BACKUP_RETENTION_COUNT must be at least 1");

  const cutoffMs = new Date(now).getTime() - maxAgeMs;
  const ordered = entries
    .map((entry) => ({
      ...entry,
      mtimeMs: new Date(entry.mtime).getTime(),
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name));

  return ordered.map((entry, index) => ({
    name: entry.name,
    path: entry.path,
    mtime: new Date(entry.mtimeMs).toISOString(),
    remove: index >= keepCount || entry.mtimeMs < cutoffMs,
    reason:
      index >= keepCount
        ? "retention_count"
        : entry.mtimeMs < cutoffMs
          ? "retention_days"
          : "retained",
  }));
}
export async function restoreBackupPayload(connection, payload) {
  verifyBackupPayload(payload);
  const tableNames = payload.tables.map((table) => table.name);
  await connection.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const tableName of [...tableNames].reverse()) {
      await connection.query(`DELETE FROM ${quoteIdentifier(tableName)}`);
    }
    for (const table of payload.tables) {
      for (const row of table.rows) {
        const columns = Object.keys(row);
        if (!columns.length) continue;
        const placeholders = columns.map(() => "?").join(", ");
        const columnSql = columns.map(quoteIdentifier).join(", ");
        await connection.execute(
          `INSERT INTO ${quoteIdentifier(table.name)} (${columnSql}) VALUES (${placeholders})`,
          columns.map((column) => sqlValue(row[column])),
        );
      }
    }
  } finally {
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  }
  return backupSummary(payload);
}
