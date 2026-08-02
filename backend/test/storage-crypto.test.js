import assert from "node:assert/strict";
import test from "node:test";
import { decodeStoredData, encodeStoredData } from "../src/storage-crypto.js";

const key = Buffer.alloc(32, 7).toString("base64");

test("encrypted storage round-trips without exposing personal data", () => {
  const data = { users: [{ email: "private@example.com" }], sessions: [{ tokenDigest: "digest" }] };
  const encoded = encodeStoredData(data, { NODE_ENV: "production", DATA_ENCRYPTION_KEY: key });
  assert.doesNotMatch(encoded, /private@example\.com|tokenDigest/);
  assert.deepEqual(decodeStoredData(encoded, { NODE_ENV: "production", DATA_ENCRYPTION_KEY: key }), data);
});

test("production refuses plaintext persistence or a missing key", () => {
  assert.throws(() => encodeStoredData({}, { NODE_ENV: "production" }), /DATA_ENCRYPTION_KEY/);
  assert.throws(() => decodeStoredData('{"users":[]}', { NODE_ENV: "production", DATA_ENCRYPTION_KEY: key }), /encrypted at rest/);
});

test("tampering is rejected by authenticated encryption", () => {
  const encoded = JSON.parse(encodeStoredData({ users: [] }, { NODE_ENV: "production", DATA_ENCRYPTION_KEY: key }));
  encoded.ciphertext = `${encoded.ciphertext.slice(0, -2)}AA`;
  assert.throws(() => decodeStoredData(JSON.stringify(encoded), { NODE_ENV: "production", DATA_ENCRYPTION_KEY: key }));
});
