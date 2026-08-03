import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import mysql from "mysql2/promise";
import { applyMigrations, discoverMigrations, rollbackMigration } from "../src/migrations.js";
import { MySqlStateStore, PersistenceConflictError } from "../src/state-store.js";
import { RedisRateLimiter } from "../src/rate-limiter.js";
import { ensureAccessMasterData } from "../src/access-master-data.js";
import { ensureOnboardingData } from "../src/onboarding.js";
import { encodeStoredData } from "../src/storage-crypto.js";
import { seedData } from "../src/validators.js";

test("MySQL store commits one concurrent writer and rejects the stale writer", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const store = new MySqlStateStore({ DATABASE_URL: process.env.TEST_DATABASE_URL, DB_POOL_SIZE: "4" });
  try {
    await store.migrate();
    const fixture = seedData();
    ensureOnboardingData(fixture);
    ensureAccessMasterData(fixture);
    const initial = await store.initialize(
      encodeStoredData(fixture, { NODE_ENV: "test" }),
    );
    const writerA = structuredClone(fixture);
    const writerB = structuredClone(fixture);
    writerA.auditLogs.push({
      id: "audit-writer-a",
      action: "concurrency_writer_a",
      createdAt: new Date().toISOString(),
    });
    writerB.auditLogs.push({
      id: "audit-writer-b",
      action: "concurrency_writer_b",
      createdAt: new Date().toISOString(),
    });
    const results = await Promise.allSettled([
      store.save(
        encodeStoredData(writerA, { NODE_ENV: "test" }),
        initial.version,
      ),
      store.save(
        encodeStoredData(writerB, { NODE_ENV: "test" }),
        initial.version,
      ),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejection = results.find((result) => result.status === "rejected");
    assert.ok(rejection.reason instanceof PersistenceConflictError);
    const persisted = JSON.parse((await store.load()).payload);
    assert.equal(
      persisted.auditLogs.filter((item) =>
        ["concurrency_writer_a", "concurrency_writer_b"].includes(item.action),
      ).length,
      1,
    );
    assert.equal((await store.readiness()).ready, true);
  } finally {
    await store.close();
  }
});

test("MySQL store round-trips representative domain entities without document-state writes", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const store = new MySqlStateStore({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    DB_POOL_SIZE: "2",
  });
  const now = new Date().toISOString();
  try {
    const snapshot = await store.load();
    const data = JSON.parse(snapshot.payload);
    const admin = data.users.find((user) => user.role === "Admin");
    const recipient = data.users.find((user) => user.role === "Area Manager");
    data.sessions = [{
      id: "session-normalized",
      tokenDigest: "1".repeat(64),
      userId: admin.id,
      createdAt: now,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      revokedAt: "",
    }];
    data.passwordResetTokens = [{
      id: "reset-normalized",
      tokenDigest: "2".repeat(64),
      userId: recipient.id,
      createdAt: now,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      usedAt: "",
      revokedAt: "",
    }];
    data.emailTemplates = [{
      id: "template-normalized",
      name: "Normalized activation",
      type: "user_activation",
      status: "active",
      version: 1,
      subject: "Activate {{user_name}}",
      bodyText: "{{activation_link}} {{activation_expiry}} {{support_email}}",
      bodyHtml: "<p>{{activation_link}}</p>",
      createdBy: admin.id,
      createdAt: now,
      updatedAt: now,
    }];
    data.onboardingWorkflows = [{
      id: "workflow-normalized",
      ownerUserId: admin.id,
      status: "completed",
      currentStep: "delivery",
      selectedTemplateId: "template-normalized",
      selectedTemplateVersion: 1,
      campaignId: "campaign-normalized",
      version: 3,
      rows: [],
      summary: { total: 1, created: 1 },
      createdUserIds: [recipient.id],
      excludedRecipientIds: [],
      createdAt: now,
      updatedAt: now,
    }];
    data.emailCampaigns = [{
      id: "campaign-normalized",
      workflowId: "workflow-normalized",
      templateId: "template-normalized",
      templateVersion: 1,
      status: "completed",
      total: 1,
      sent: 1,
      failed: 0,
      createdBy: admin.id,
      createdAt: now,
      completedAt: now,
      recipients: [{
        id: "recipient-normalized",
        userId: recipient.id,
        email: recipient.email,
        name: recipient.name,
        status: "sent",
        attemptedAt: now,
        sentAt: now,
      }],
    }];
    data.activationTokens = [{
      id: "activation-normalized",
      tokenDigest: "3".repeat(64),
      userId: recipient.id,
      recipientId: "recipient-normalized",
      createdAt: now,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      usedAt: "",
      revokedAt: "",
    }];
    data.emailDeliveryEvents = [{
      id: "delivery-normalized",
      recipientId: "recipient-normalized",
      eventType: "sent",
      providerEventId: "provider-normalized",
      createdAt: now,
    }];
    data.fileUploads = [{
      id: "upload-normalized",
      uploadCategory: "users",
      originalFileName: "synthetic.csv",
      status: "completed",
      uploadedBy: admin.id,
      totalRows: 1,
      insertedRows: 1,
      updatedRows: 0,
      failedRows: 0,
      createdAt: now,
    }];
    data.notifications = [{
      id: "notification-normalized",
      eventType: "booking_allocated",
      title: "Synthetic notification",
      message: "Synthetic normalized persistence evidence.",
      recipientUserIds: [admin.id],
      readByUserIds: [],
      createdAt: now,
    }];
    data.emailProviderConnections = [{
      id: "provider-normalized",
      provider: "gmail_api",
      accountEmail: "synthetic-sender@example.com",
      encryptedRefreshToken: "encrypted-test-fixture",
      status: "active",
      connectedBy: admin.id,
      connectedAt: now,
      lastVerifiedAt: now,
    }];
    data.emailOAuthStates = [{
      id: "oauth-normalized",
      stateDigest: "4".repeat(64),
      adminId: admin.id,
      createdAt: now,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      usedAt: "",
    }];
    data.syntheticMetadata = { verified: true };

    const nextVersion = await store.save(JSON.stringify(data), snapshot.version);
    const reloaded = JSON.parse((await store.load()).payload);
    assert.equal(nextVersion, snapshot.version + 1);
    assert.equal(reloaded.sessions[0].id, "session-normalized");
    assert.equal(reloaded.passwordResetTokens[0].id, "reset-normalized");
    assert.equal(reloaded.onboardingWorkflows[0].id, "workflow-normalized");
    assert.equal(reloaded.emailTemplates[0].id, "template-normalized");
    assert.equal(reloaded.emailCampaigns[0].recipients[0].id, "recipient-normalized");
    assert.equal(reloaded.activationTokens[0].id, "activation-normalized");
    assert.equal(reloaded.emailDeliveryEvents[0].id, "delivery-normalized");
    assert.equal(reloaded.fileUploads[0].id, "upload-normalized");
    assert.equal(reloaded.notifications[0].id, "notification-normalized");
    assert.equal(reloaded.emailProviderConnections[0].id, "provider-normalized");
    assert.equal(reloaded.emailOAuthStates[0].id, "oauth-normalized");
    assert.deepEqual(reloaded.syntheticMetadata, { verified: true });

    const verificationPool = mysql.createPool({
      uri: process.env.TEST_DATABASE_URL,
      connectionLimit: 1,
    });
    try {
      const [[documentCount]] = await verificationPool.query(
        "SELECT COUNT(*) AS count FROM application_state",
      );
      const [[revision]] = await verificationPool.query(
        "SELECT version FROM runtime_revision WHERE state_key = 'booking-dashboard'",
      );
      assert.equal(Number(documentCount.count), 0);
      assert.equal(Number(revision.version), nextVersion);
    } finally {
      await verificationPool.end();
    }
  } finally {
    await store.close();
  }
});
test("Redis limiter shares a budget between independent instances", { skip: !process.env.TEST_REDIS_URL }, async () => {
  const first = new RedisRateLimiter(process.env.TEST_REDIS_URL);
  const second = new RedisRateLimiter(process.env.TEST_REDIS_URL);
  const identity = `integration-${Date.now()}`;
  try {
    assert.equal((await first.check("login", identity, { limit: 2, windowMs: 30000 })).allowed, true);
    assert.equal((await second.check("login", identity, { limit: 2, windowMs: 30000 })).allowed, true);
    assert.equal((await first.check("login", identity, { limit: 2, windowMs: 30000 })).allowed, false);
    assert.equal((await second.readiness()).ready, true);
  } finally {
    await Promise.all([first.close(), second.close()]);
  }
});

test("MySQL migrations apply normalized schema and roll back the latest phase", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = mysql.createPool({
    uri: process.env.TEST_DATABASE_URL,
    connectionLimit: 1,
    multipleStatements: true
  });
  const connection = await pool.getConnection();
  try {
    const migrations = await discoverMigrations(path.resolve("migrations"));
    await applyMigrations(connection, migrations);
    const [tables] = await connection.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name IN ('application_state', 'users', 'bookings', 'email_campaigns', 'audit_logs')
       ORDER BY table_name`
    );
    assert.deepEqual(
      tables.map((row) => row.TABLE_NAME || row.table_name),
      ["application_state", "audit_logs", "bookings", "email_campaigns", "users"]
    );
    const [constraints] = await connection.query(
      `SELECT constraint_name
       FROM information_schema.referential_constraints
       WHERE constraint_schema = DATABASE()
         AND constraint_name IN ('fk_users_role', 'fk_bookings_dealer', 'fk_campaign_template_version')`
    );
    assert.equal(constraints.length, 3);
    assert.equal(await rollbackMigration(connection, migrations, "003-normalized-runtime"), "003-normalized-runtime");
    const [rolledBack] = await connection.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name IN ('application_state', 'runtime_revision', 'users')`
    );
    assert.deepEqual(
      rolledBack.map((row) => row.TABLE_NAME || row.table_name).sort(),
      ["application_state", "users"]
    );
    assert.deepEqual(await applyMigrations(connection, migrations), ["003-normalized-runtime"]);
  } finally {
    connection.release();
    await pool.end();
  }
});
