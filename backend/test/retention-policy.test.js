import assert from "node:assert/strict";
import test from "node:test";
import { applyRetentionPolicy } from "../src/retention-policy.js";

test("retention removes expired records and supports legacy upload timestamps", () => {
  const now = Date.parse("2026-08-03T00:00:00.000Z");
  const data = {
    sessions: [
      { id: "old", expiresAt: "2026-07-01T00:00:00.000Z" },
      { id: "live", expiresAt: "2026-08-04T00:00:00.000Z" },
    ],
    passwordResetTokens: [],
    activationTokens: [],
    emailOAuthStates: [],
    fileUploads: [
      { id: "legacy-old", uploadedAt: "2026-06-01T00:00:00.000Z" },
      { id: "legacy-live", uploadedAt: "2026-08-02T00:00:00.000Z" },
    ],
    auditLogs: [],
  };

  applyRetentionPolicy(data, now);

  assert.deepEqual(
    data.sessions.map((item) => item.id),
    ["live"],
  );
  assert.deepEqual(
    data.fileUploads.map((item) => item.id),
    ["legacy-live"],
  );
});
