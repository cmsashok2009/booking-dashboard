import {
  MODELED_KEYS,
  insertRows,
  json,
  nullableDate,
  requiredDate,
} from "./normalized-state-support.js";

export async function writeCommunicationState(connection, data, context) {
  const { users, userIds } = context;
  const templates = data.emailTemplates || [];
  const fallbackAdminId =
    users.find((item) => item.role === "Admin")?.id || users[0]?.id;
  await insertRows(
    connection,
    "email_templates",
    [
      "id",
      "name",
      "type",
      "status",
      "current_version",
      "created_by",
      "created_at",
      "updated_at",
      "entity_json",
    ],
    templates.map((item) => [
      item.id,
      item.name,
      item.type,
      ["draft", "active", "inactive", "archived"].includes(item.status)
        ? item.status
        : "draft",
      Number(item.version || 1),
      item.createdBy || fallbackAdminId,
      requiredDate(item.createdAt),
      requiredDate(item.updatedAt || item.createdAt),
      json(item),
    ]),
  );
  const templateIds = new Set(templates.map((item) => item.id));
  const templateVersionsByKey = new Map();
  for (const item of [
    ...(data.emailTemplateVersions || []),
    ...templates.map((template) => ({ ...template, templateId: template.id })),
  ]) {
    const templateId = item.templateId || item.id;
    if (!templateIds.has(templateId)) continue;
    templateVersionsByKey.set(
      `${templateId}:${Number(item.version || 1)}`,
      item,
    );
  }
  const templateVersions = [...templateVersionsByKey.values()];
  await insertRows(
    connection,
    "email_template_versions",
    [
      "template_id",
      "version",
      "subject",
      "body_text",
      "body_html",
      "content_json",
      "created_by",
      "created_at",
      "entity_json",
    ],
    templateVersions.map((item) => [
      item.templateId || item.id,
      Number(item.version || 1),
      item.subject || "",
      item.bodyText || "",
      item.bodyHtml || null,
      json(item),
      item.updatedBy || item.createdBy || fallbackAdminId,
      requiredDate(item.updatedAt || item.createdAt),
      json(item),
    ]),
  );

  const campaigns = data.emailCampaigns || [];
  await insertRows(
    connection,
    "email_campaigns",
    [
      "id",
      "workflow_id",
      "template_id",
      "template_version",
      "idempotency_key",
      "status",
      "created_by",
      "campaign_json",
      "created_at",
      "updated_at",
      "entity_json",
    ],
    campaigns.map((item) => [
      item.id,
      item.workflowId || null,
      item.templateId,
      Number(item.templateVersion || 1),
      item.idempotencyKey || `campaign:${item.id}`,
      item.status,
      item.createdBy || fallbackAdminId,
      json(item),
      requiredDate(item.createdAt),
      requiredDate(item.completedAt || item.updatedAt || item.createdAt),
      json(item),
    ]),
  );

  const recipients = campaigns.flatMap((campaign) =>
    (campaign.recipients || []).map((item) => ({ campaign, item })),
  );
  const recipientIds = new Set(recipients.map(({ item }) => item.id));
  await insertRows(
    connection,
    "email_recipients",
    [
      "id",
      "campaign_id",
      "user_id",
      "idempotency_key",
      "status",
      "attempt_count",
      "next_attempt_at",
      "last_error_code",
      "submitted_at",
      "delivered_at",
      "updated_at",
      "entity_json",
    ],
    recipients.map(({ campaign, item }) => [
      item.id,
      campaign.id,
      item.userId,
      item.idempotencyKey || `recipient:${campaign.id}:${item.userId}`,
      item.status,
      Number(item.attemptCount || (item.attemptedAt ? 1 : 0)),
      nullableDate(item.nextAttemptAt),
      item.failureReason || item.lastErrorCode || null,
      nullableDate(item.sentAt || item.submittedAt),
      nullableDate(item.deliveredAt),
      requiredDate(
        item.deliveredAt ||
          item.sentAt ||
          item.attemptedAt ||
          campaign.createdAt,
      ),
      json(item),
    ]),
  );

  await insertRows(
    connection,
    "activation_tokens",
    [
      "id",
      "token_digest",
      "user_id",
      "recipient_id",
      "expires_at",
      "used_at",
      "revoked_at",
      "created_at",
      "entity_json",
    ],
    (data.activationTokens || []).map((item) => [
      item.id,
      item.tokenDigest,
      item.userId,
      recipientIds.has(item.recipientId) ? item.recipientId : null,
      requiredDate(item.expiresAt),
      nullableDate(item.usedAt),
      nullableDate(item.revokedAt),
      requiredDate(item.createdAt),
      json(item),
    ]),
  );

  await insertRows(
    connection,
    "email_delivery_events",
    [
      "id",
      "recipient_id",
      "event_type",
      "provider_event_id",
      "event_json",
      "occurred_at",
      "entity_json",
    ],
    (data.emailDeliveryEvents || [])
      .filter((item) => recipientIds.has(item.recipientId))
      .map((item) => [
        item.id,
        item.recipientId,
        item.eventType,
        item.providerReference || item.providerEventId || null,
        json(item),
        requiredDate(item.occurredAt || item.createdAt),
        json(item),
      ]),
  );

  await insertRows(
    connection,
    "file_uploads",
    [
      "id",
      "upload_category",
      "original_file_name",
      "status",
      "uploaded_by",
      "total_rows",
      "inserted_rows",
      "updated_rows",
      "failed_rows",
      "result_json",
      "created_at",
      "entity_json",
    ],
    (data.fileUploads || []).map((item) => [
      item.id,
      item.uploadCategory || item.category || "unknown",
      item.originalFileName || item.fileName || "upload",
      item.status || "completed",
      item.uploadedBy || fallbackAdminId,
      Number(item.totalRows || 0),
      Number(item.insertedRows || 0),
      Number(item.updatedRows || 0),
      Number(item.failedRows || 0),
      json(item),
      requiredDate(item.createdAt),
      json(item),
    ]),
  );

  await insertRows(
    connection,
    "audit_logs",
    [
      "id",
      "action",
      "entity_type",
      "entity_id",
      "actor_user_id",
      "request_id",
      "outcome",
      "details_json",
      "created_at",
      "entity_json",
    ],
    (data.auditLogs || []).map((item) => [
      item.id,
      item.action,
      item.entityType || String(item.action || "event").split("_")[0],
      item.entityId || null,
      userIds.has(item.userId || item.actorUserId)
        ? item.userId || item.actorUserId
        : null,
      item.requestId || null,
      typeof item.outcome === "string" ? item.outcome : "recorded",
      json(item.outcome || {}),
      requiredDate(item.createdAt),
      json(item),
    ]),
  );

  await insertRows(
    connection,
    "notifications",
    [
      "id",
      "user_id",
      "type",
      "title",
      "message",
      "entity_id",
      "read_at",
      "created_at",
      "entity_json",
    ],
    (data.notifications || []).map((item) => [
      item.id,
      userIds.has(item.recipientUserIds?.[0]) ? item.recipientUserIds[0] : null,
      item.eventType || item.type || "notification",
      item.title,
      item.message,
      item.bookingId || item.entityId || null,
      null,
      requiredDate(item.createdAt),
      json(item),
    ]),
  );

  await insertRows(
    connection,
    "email_provider_connections",
    [
      "id",
      "provider",
      "sender_email",
      "encrypted_refresh_token",
      "status",
      "connected_by",
      "created_at",
      "updated_at",
      "entity_json",
    ],
    (data.emailProviderConnections || []).map((item) => [
      item.id,
      item.provider,
      item.accountEmail,
      item.encryptedRefreshToken || "",
      ["active", "inactive", "replaced", "disconnected"].includes(item.status)
        ? item.status
        : "inactive",
      item.connectedBy || fallbackAdminId,
      requiredDate(item.connectedAt || item.createdAt),
      requiredDate(item.lastVerifiedAt || item.connectedAt || item.createdAt),
      json(item),
    ]),
  );

  await insertRows(
    connection,
    "email_oauth_states",
    [
      "id",
      "state_digest",
      "admin_user_id",
      "expires_at",
      "used_at",
      "created_at",
      "entity_json",
    ],
    (data.emailOAuthStates || []).map((item) => [
      item.id,
      item.stateDigest,
      item.adminId,
      requiredDate(item.expiresAt),
      nullableDate(item.usedAt),
      requiredDate(item.createdAt),
      json(item),
    ]),
  );

  const metadata = Object.entries(data)
    .filter(([key]) => !MODELED_KEYS.has(key))
    .map(([key, value]) => [key, json(value)]);
  await insertRows(
    connection,
    "runtime_metadata",
    ["metadata_key", "value_json"],
    metadata,
  );
}
