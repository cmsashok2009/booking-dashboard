import {
  DELETE_ORDER,
  insertRows,
  json,
  normalize,
  nullableDate,
  requiredDate,
} from "./normalized-state-support.js";

export async function writeCoreState(connection, data) {
  await connection.query("UPDATE users SET reporting_manager_id = NULL");
  for (const table of DELETE_ORDER) {
    await connection.query(`DELETE FROM ${table}`);
  }

  const roles = data.roles || [];
  const roleIdByName = new Map(
    roles.map((item) => [normalize(item.name), item.id || item.code]),
  );
  await insertRows(
    connection,
    "roles",
    [
      "id",
      "name",
      "hierarchy_level",
      "status",
      "permissions_json",
      "entity_json",
    ],
    roles.map((item) => [
      item.id || item.code,
      item.name,
      Number(item.hierarchyLevel || 0),
      item.isActive === false ? "inactive" : "active",
      json(item.permissions || []),
      json(item),
    ]),
  );

  const regions = data.regions || [];
  const regionIdByName = new Map(
    regions.map((item) => [normalize(item.name), item.id]),
  );
  await insertRows(
    connection,
    "regions",
    [
      "id",
      "name",
      "normalized_name",
      "status",
      "version",
      "created_at",
      "updated_at",
      "entity_json",
    ],
    regions.map((item) => [
      item.id,
      item.name,
      normalize(item.name),
      item.status === "inactive" ? "inactive" : "active",
      Number(item.version || 1),
      requiredDate(item.createdAt),
      requiredDate(item.updatedAt || item.createdAt),
      json(item),
    ]),
  );

  const users = data.users || [];
  const userIdByEmail = new Map(
    users.map((item) => [normalize(item.email), item.id]),
  );
  const userIds = new Set(users.map((item) => item.id));
  await insertRows(
    connection,
    "users",
    [
      "id",
      "name",
      "email",
      "normalized_email",
      "phone",
      "role_id",
      "region_id",
      "reporting_manager_id",
      "status",
      "password_hash",
      "must_change_password",
      "failed_login_count",
      "locked_until",
      "version",
      "created_at",
      "updated_at",
      "entity_json",
    ],
    users.map((item) => [
      item.id,
      item.name,
      item.email,
      normalize(item.email),
      item.phone || "",
      roleIdByName.get(normalize(item.role)),
      regionIdByName.get(normalize(item.region)) || null,
      null,
      item.status || "inactive",
      item.passwordHash || null,
      item.mustChangePassword === true,
      Number(item.failedLoginCount || 0),
      nullableDate(item.lockedUntil),
      Number(item.version || 1),
      requiredDate(item.createdAt),
      requiredDate(item.updatedAt || item.createdAt),
      json(item),
    ]),
  );
  for (const item of users) {
    const managerId = userIdByEmail.get(normalize(item.reportingManagerEmail));
    if (managerId) {
      await connection.execute(
        "UPDATE users SET reporting_manager_id = ? WHERE id = ?",
        [managerId, item.id],
      );
    }
  }

  const dealerCodes = data.dealerCodes || [];
  const dealerIdByCode = new Map(
    dealerCodes.map((item) => [normalize(item.code), item.id]),
  );
  await insertRows(
    connection,
    "dealer_codes",
    [
      "id",
      "code",
      "normalized_code",
      "region_id",
      "status",
      "version",
      "created_at",
      "updated_at",
      "entity_json",
    ],
    dealerCodes.map((item) => [
      item.id,
      item.code,
      normalize(item.code),
      regionIdByName.get(normalize(item.region)),
      item.status === "inactive" ? "inactive" : "active",
      Number(item.version || 1),
      requiredDate(item.createdAt),
      requiredDate(item.updatedAt || item.createdAt),
      json(item),
    ]),
  );

  const assignments = data.dealerAssignments || [];
  await insertRows(
    connection,
    "dealer_assignments",
    [
      "id",
      "dealer_code_id",
      "area_manager_id",
      "regional_manager_id",
      "is_active",
      "version",
      "created_at",
      "updated_at",
      "entity_json",
    ],
    assignments.map((item) => [
      item.id,
      dealerIdByCode.get(normalize(item.dealerCode)),
      item.areaManagerUserId,
      item.regionalManagerUserId,
      item.isActive !== false,
      Number(item.version || 1),
      requiredDate(item.createdAt),
      requiredDate(item.updatedAt || item.createdAt),
      json(item),
    ]),
  );

  const lookupRows = [];
  for (const [fieldKey, options] of Object.entries(data.lookupOptions || {})) {
    for (const [index, item] of options.entries()) {
      lookupRows.push([
        item.id,
        fieldKey,
        item.label,
        normalize(item.label),
        item.status === "inactive" ? "inactive" : "active",
        Number(item.sortOrder ?? index),
        Number(item.version || 1),
        requiredDate(item.createdAt),
        requiredDate(item.updatedAt || item.createdAt),
        json(item),
      ]);
    }
  }
  await insertRows(
    connection,
    "lookup_options",
    [
      "id",
      "field_key",
      "value",
      "normalized_value",
      "status",
      "sort_order",
      "version",
      "created_at",
      "updated_at",
      "entity_json",
    ],
    lookupRows,
  );

  await insertRows(
    connection,
    "bookings",
    [
      "id",
      "sales_order_id",
      "dealer_code_id",
      "region_id",
      "assigned_area_manager_id",
      "assigned_regional_manager_id",
      "customer_name",
      "customer_phone",
      "model",
      "variant",
      "source_json",
      "area_inputs_json",
      "regional_inputs_json",
      "version",
      "imported_at",
      "updated_at",
      "entity_json",
    ],
    (data.bookings || []).map((item) => [
      item.id,
      item.salesOrderId,
      dealerIdByCode.get(normalize(item.dealerCode)),
      regionIdByName.get(normalize(item.region)),
      item.assignedAreaManagerId || null,
      item.assignedRegionalManagerId || null,
      [item.contactFirstName, item.contactLastName].filter(Boolean).join(" ") ||
        item.institutionName ||
        "Unknown",
      item.phoneNumber || "",
      item.model || "",
      item.variant || "",
      json(item),
      json(item.areaInputs || {}),
      json(item.regionalInputs || {}),
      Number(item.version || 1),
      requiredDate(item.importedAt || item.creationDate),
      requiredDate(item.updatedAt || item.importedAt || item.creationDate),
      json(item),
    ]),
  );

  await insertRows(
    connection,
    "sessions",
    [
      "id",
      "token_digest",
      "user_id",
      "expires_at",
      "revoked_at",
      "created_at",
      "entity_json",
    ],
    (data.sessions || []).map((item) => [
      item.id,
      item.tokenDigest,
      item.userId,
      requiredDate(item.expiresAt),
      nullableDate(item.revokedAt),
      requiredDate(item.createdAt),
      json(item),
    ]),
  );
  await insertRows(
    connection,
    "password_reset_tokens",
    [
      "id",
      "token_digest",
      "user_id",
      "expires_at",
      "used_at",
      "revoked_at",
      "created_at",
      "entity_json",
    ],
    (data.passwordResetTokens || []).map((item) => [
      item.id,
      item.tokenDigest,
      item.userId,
      requiredDate(item.expiresAt),
      nullableDate(item.usedAt),
      nullableDate(item.revokedAt),
      requiredDate(item.createdAt),
      json(item),
    ]),
  );

  await insertRows(
    connection,
    "onboarding_workflows",
    [
      "id",
      "owner_user_id",
      "status",
      "current_step",
      "selected_template_id",
      "campaign_id",
      "workflow_json",
      "version",
      "created_at",
      "updated_at",
      "entity_json",
    ],
    (data.onboardingWorkflows || []).map((item) => [
      item.id,
      item.ownerUserId,
      item.status,
      item.currentStep,
      item.selectedTemplateId || null,
      item.campaignId || null,
      json(item),
      Number(item.version || 1),
      requiredDate(item.createdAt),
      requiredDate(item.updatedAt || item.createdAt),
      json(item),
    ]),
  );

  await insertRows(
    connection,
    "email_template_samples",
    [
      "id",
      "name",
      "type",
      "status",
      "sample_json",
      "reviewed_at",
      "entity_json",
    ],
    (data.emailTemplateSamples || []).map((item) => [
      item.id,
      item.name,
      item.type,
      item.status === "inactive" ? "inactive" : "active",
      json(item),
      nullableDate(item.reviewedAt),
      json(item),
    ]),
  );

  return { users, userIds };
}
