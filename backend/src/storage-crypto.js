import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey(environment = process.env) {
  const value = String(environment.DATA_ENCRYPTION_KEY || "").trim();
  if (!value) return null;
  const key = /^[a-f0-9]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must encode exactly 32 bytes");
  return key;
}

export function encodeStoredData(data, environment = process.env) {
  const key = encryptionKey(environment);
  if (!key) {
    if (environment.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY is required in production");
    return JSON.stringify(data, null, 2);
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return JSON.stringify({
    format: "booking-dashboard-encrypted-v1",
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64")
  });
}

export function decodeStoredData(raw, environment = process.env) {
  const parsed = JSON.parse(raw);
  if (parsed?.format !== "booking-dashboard-encrypted-v1") {
    if (environment.NODE_ENV === "production") throw new Error("Production data must be encrypted at rest");
    return parsed;
  }
  const key = encryptionKey(environment);
  if (!key) throw new Error("DATA_ENCRYPTION_KEY is required to decrypt stored data");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parsed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(parsed.ciphertext, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}
