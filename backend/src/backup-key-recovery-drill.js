import { randomBytes } from "node:crypto";
import {
  BACKUP_FORMAT,
  backupEncryptionKey,
  decryptBackup,
  encryptBackup,
  tableChecksum,
  verifyBackupPayload,
} from "./mysql-backup.js";

const DRILL_SENTINEL = "DRILL_ROW_CONTENT_SHOULD_NOT_APPEAR";

function createDrillPayload(now) {
  const rows = [
    {
      id: "drill-key-recovery",
      status: "synthetic",
      marker: DRILL_SENTINEL,
    },
  ];
  return {
    format: BACKUP_FORMAT,
    source: "key-recovery-drill",
    createdAt: new Date(now).toISOString(),
    tables: [
      {
        name: "key_recovery_drill",
        rowCount: rows.length,
        checksum: tableChecksum(rows),
        rows,
      },
    ],
  };
}

function generateWrongKey(correctKey) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const wrongKey = randomBytes(32);
    if (!wrongKey.equals(correctKey)) return wrongKey.toString("base64");
  }
  throw new Error("Unable to generate a distinct wrong backup key");
}

export async function runBackupKeyRecoveryDrill({
  env = process.env,
  now = new Date(),
} = {}) {
  if (env.CONFIRM_BACKUP_KEY_RECOVERY_DRILL !== "yes") {
    throw new Error(
      "Set CONFIRM_BACKUP_KEY_RECOVERY_DRILL=yes to run the backup key recovery drill",
    );
  }

  const correctKey = backupEncryptionKey(env);
  const payload = createDrillPayload(now);
  const encrypted = encryptBackup(payload, env);
  if (encrypted.includes(DRILL_SENTINEL)) {
    throw new Error("Encrypted backup exposed drill row contents");
  }

  const decrypted = decryptBackup(encrypted, env);
  const verified = verifyBackupPayload(decrypted);
  let wrongKeyRejected = false;
  try {
    decryptBackup(encrypted, {
      BACKUP_ENCRYPTION_KEY: generateWrongKey(correctKey),
    });
  } catch {
    wrongKeyRejected = true;
  }
  if (!wrongKeyRejected) {
    throw new Error("Backup decrypted with a wrong key");
  }

  const summary = {
    ok: true,
    format: BACKUP_FORMAT,
    algorithm: "aes-256-gcm",
    source: verified.source,
    createdAt: verified.createdAt,
    tableCount: verified.tableCount,
    rowCount: verified.rowCount,
    correctKeyVerified: true,
    wrongKeyRejected,
    encryptedBytes: Buffer.byteLength(encrypted, "utf8"),
    safeSummaryOnly: true,
  };
  const output = JSON.stringify(summary);
  const configuredSecrets = [env.BACKUP_ENCRYPTION_KEY, env.DATA_ENCRYPTION_KEY]
    .map((value) => String(value || ""))
    .filter(Boolean);
  if (
    output.includes(DRILL_SENTINEL) ||
    configuredSecrets.some((value) => output.includes(value))
  ) {
    throw new Error("Backup key recovery drill summary exposed sensitive data");
  }
  return summary;
}

