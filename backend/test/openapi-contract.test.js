import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("OpenAPI documents booking pagination contract", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  const bookingList = spec.paths["/api/bookings"].get;
  const parameters = Object.fromEntries(
    bookingList.parameters.map((parameter) => [parameter.name, parameter]),
  );

  assert.equal(parameters.page.schema.minimum, 1);
  assert.equal(parameters.pageSize.schema.maximum, 500);
  assert.equal(parameters.limit.schema.maximum, 500);
  assert.deepEqual(
    bookingList.responses["200"].content["application/json"].schema,
    {
      $ref: "#/components/schemas/BookingListResponse",
    },
  );
  assert.equal(
    bookingList.responses["422"].content["application/json"].examples
      .invalidPageSize.value.code,
    "INVALID_PAGE_SIZE",
  );

  const response = spec.components.schemas.BookingListResponse;
  assert.deepEqual(response.required, ["rows", "total", "pagination"]);
  assert.deepEqual(response.properties.rows.items, {
    $ref: "#/components/schemas/Booking",
  });
  assert.deepEqual(response.properties.pagination, {
    $ref: "#/components/schemas/BookingPagination",
  });
  assert.deepEqual(spec.components.schemas.BookingPagination.required, [
    "page",
    "pageSize",
    "total",
    "totalPages",
    "hasNextPage",
  ]);
});
test("OpenAPI documents bounded Admin user filtering and pagination", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  const operation = spec.paths["/api/admin/users"].get;
  const parameters = Object.fromEntries(
    operation.parameters.map((parameter) => [parameter.name, parameter]),
  );
  assert.equal(parameters.page.schema.minimum, 1);
  assert.equal(parameters.pageSize.schema.maximum, 100);
  assert.equal(parameters.search.schema.maxLength, 200);
  assert.deepEqual(parameters.sortDir.schema.enum, ["asc", "desc"]);
  assert.equal(parameters.sortKey.schema.enum.includes("passwordHash"), false);
  assert.deepEqual(
    operation.responses["200"].content["application/json"].schema,
    { $ref: "#/components/schemas/UserListResponse" },
  );
  assert.deepEqual(spec.components.schemas.UserListResponse.required, [
    "users",
    "pagination",
  ]);
  assert.equal(
    spec.components.schemas.UserPagination.properties.pageSize.maximum,
    100,
  );
  assert.equal(
    spec.components.schemas.BootstrapResponse.properties.users.maxItems,
    100,
  );
  assert.deepEqual(
    spec.components.schemas.BootstrapResponse.properties.collectionPagination
      .properties.users,
    { $ref: "#/components/schemas/UserPagination" },
  );
});
test("OpenAPI documents the authoritative bootstrap session identity", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  const bootstrap = spec.components.schemas.BootstrapResponse;

  assert.equal(bootstrap.required.includes("currentUser"), true);
  assert.deepEqual(bootstrap.properties.currentUser, {
    $ref: "#/components/schemas/User",
    description: "Authoritative user for the current HttpOnly session.",
  });
});
test("OpenAPI documents the 10-digit user phone contract", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  const phone = spec.components.schemas.UserUploadRow.properties.Phone;
  assert.equal(phone.pattern, "^[0-9]{10}$");
  assert.equal(phone.minLength, 10);
  assert.equal(phone.maxLength, 10);
});
test("OpenAPI documents standard error code and correlation ID", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  const schema = spec.components.schemas.ErrorResponse;
  assert.equal(schema.properties.error.type, "string");
  assert.equal(schema.properties.code.type, "string");
  assert.equal(schema.properties.correlationId.type, "string");
  assert.deepEqual(
    spec.components.responses.Error.content["application/json"].schema,
    {
      $ref: "#/components/schemas/ErrorResponse",
    },
  );
});
test("OpenAPI documents bounded email campaign filtering and pagination", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  const operation = spec.paths["/api/admin/email-campaigns"].get;
  const parameters = Object.fromEntries(
    operation.parameters.map((parameter) => [parameter.name, parameter]),
  );
  assert.equal(parameters.userId, undefined);
  assert.equal(parameters.page.schema.minimum, 1);
  assert.equal(parameters.pageSize.schema.maximum, 100);
  assert.equal(parameters.search.schema.maxLength, 200);
  assert.deepEqual(parameters.status.schema.enum, [
    "all",
    "successful",
    "failed",
    "pending",
    "completed",
  ]);
  assert.deepEqual(parameters.sortDir.schema.enum, ["asc", "desc"]);
  assert.deepEqual(
    operation.responses["200"].content["application/json"].schema,
    {
      $ref: "#/components/schemas/EmailCampaignListResponse",
    },
  );
  assert.deepEqual(spec.components.schemas.EmailCampaignListResponse.required, [
    "campaigns",
    "pagination",
    "summary",
    "events",
    "eventPagination",
  ]);
  assert.equal(
    spec.components.schemas.EmailCampaignPagination.properties.pageSize.maximum,
    100,
  );
  assert.deepEqual(spec.components.schemas.EmailCampaignSummary.required, [
    "campaigns",
    "sent",
    "failed",
  ]);
  assert.equal(
    spec.components.schemas.EmailCampaignListResponse.properties.events
      .maxItems,
    100,
  );
  assert.equal(
    spec.components.schemas.BootstrapResponse.properties.emailCampaigns
      .maxItems,
    100,
  );
  assert.deepEqual(
    spec.components.schemas.BootstrapResponse.properties.collectionPagination
      .properties.emailCampaigns,
    { $ref: "#/components/schemas/EmailCampaignPagination" },
  );
});
test("OpenAPI documents bounded email template filtering and pagination", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  const operation = spec.paths["/api/admin/email-templates"].get;
  const parameters = Object.fromEntries(
    operation.parameters.map((parameter) => [parameter.name, parameter]),
  );
  assert.equal(parameters.userId, undefined);
  assert.equal(parameters.page.schema.minimum, 1);
  assert.equal(parameters.pageSize.schema.maximum, 100);
  assert.equal(parameters.search.schema.maxLength, 200);
  assert.equal(parameters.sortKey.schema.enum.includes("bodyHtml"), false);
  assert.deepEqual(parameters.sortDir.schema.enum, ["asc", "desc"]);
  assert.deepEqual(
    operation.responses["200"].content["application/json"].schema,
    {
      $ref: "#/components/schemas/EmailTemplateListResponse",
    },
  );
  assert.deepEqual(spec.components.schemas.EmailTemplateListResponse.required, [
    "samples",
    "samplePagination",
    "templates",
    "pagination",
    "summary",
  ]);
  assert.equal(
    spec.components.schemas.EmailTemplateListResponse.properties.samples
      .maxItems,
    100,
  );
  assert.equal(
    spec.components.schemas.EmailTemplatePagination.properties.pageSize.maximum,
    100,
  );
  assert.deepEqual(spec.components.schemas.EmailTemplateSummary.required, [
    "total",
    "active",
    "draft",
  ]);
  assert.equal(
    spec.components.schemas.BootstrapResponse.properties.emailTemplates
      .maxItems,
    100,
  );
  assert.equal(
    spec.components.schemas.BootstrapResponse.properties.emailTemplateSamples
      .maxItems,
    100,
  );
  assert.deepEqual(
    spec.components.schemas.BootstrapResponse.properties.collectionCaps
      .properties.emailTemplateSamples,
    { $ref: "#/components/schemas/CollectionCap" },
  );
});

test("OpenAPI documents bounded authenticated notification pages", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  const operation = spec.paths["/api/notifications"].get;
  const parameters = Object.fromEntries(
    operation.parameters.map((parameter) => [parameter.name, parameter]),
  );
  assert.equal(parameters.userId, undefined);
  assert.equal(parameters.page.schema.minimum, 1);
  assert.equal(parameters.pageSize.schema.maximum, 100);
  assert.equal(parameters.search.schema.maxLength, 200);
  assert.equal(parameters.eventType.schema.maxLength, 100);
  assert.equal(
    parameters.sortKey.schema.enum.includes("recipientUserIds"),
    false,
  );
  assert.deepEqual(parameters.sortDir.schema.enum, ["asc", "desc"]);
  assert.deepEqual(
    operation.responses["200"].content["application/json"].schema,
    { $ref: "#/components/schemas/NotificationListResponse" },
  );
  assert.deepEqual(spec.components.schemas.NotificationListResponse.required, [
    "notifications",
    "unreadCount",
    "pagination",
  ]);
  assert.equal(
    spec.components.schemas.NotificationPagination.properties.pageSize.maximum,
    100,
  );
  assert.equal(
    "recipientUserIds" in spec.components.schemas.Notification.properties,
    false,
  );
  assert.equal(
    "readByUserIds" in spec.components.schemas.Notification.properties,
    false,
  );
  assert.equal(
    spec.paths["/api/notifications/stream"].get.parameters,
    undefined,
  );
  assert.equal(
    spec.paths["/api/notifications/{notificationId}/read"].patch.requestBody,
    undefined,
  );
});
test("OpenAPI documents bounded owner-scoped onboarding workflows", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  const operation = spec.paths["/api/admin/onboarding"].get;
  const parameters = Object.fromEntries(
    operation.parameters.map((parameter) => [parameter.name, parameter]),
  );
  assert.equal(parameters.userId, undefined);
  assert.equal(parameters.page.schema.minimum, 1);
  assert.equal(parameters.pageSize.schema.maximum, 100);
  assert.equal(parameters.search.schema.maxLength, 200);
  assert.equal(parameters.sortKey.schema.enum.includes("rows"), false);
  assert.deepEqual(parameters.sortDir.schema.enum, ["asc", "desc"]);
  assert.deepEqual(
    operation.responses["200"].content["application/json"].schema,
    { $ref: "#/components/schemas/OnboardingWorkflowListResponse" },
  );
  assert.equal(
    spec.components.schemas.OnboardingWorkflowListResponse.properties.workflows
      .maxItems,
    100,
  );
  assert.equal(
    "rows" in spec.components.schemas.OnboardingWorkflowListItem.properties,
    false,
  );
  assert.equal(
    spec.paths["/api/admin/onboarding/{workflowId}"].get.parameters.some(
      (parameter) => parameter.name === "userId",
    ),
    false,
  );
  assert.deepEqual(
    spec.paths["/api/admin/onboarding/validate"].post.requestBody.content[
      "application/json"
    ].schema,
    { $ref: "#/components/schemas/ImportRequest" },
  );
});
test("OpenAPI documents credential-free bounded upload history", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  const operation = spec.paths["/api/admin/uploads"].get;
  const parameters = Object.fromEntries(
    operation.parameters.map((parameter) => [parameter.name, parameter]),
  );
  assert.equal(parameters.page.schema.minimum, 1);
  assert.equal(parameters.pageSize.schema.maximum, 100);
  assert.equal(parameters.search.schema.maxLength, 200);
  assert.equal(parameters.sortKey.schema.enum.includes("errors"), false);
  assert.deepEqual(
    operation.responses["200"].content["application/json"].schema,
    { $ref: "#/components/schemas/UploadListResponse" },
  );
  assert.equal(
    spec.components.schemas.UploadListResponse.properties.uploads.maxItems,
    100,
  );
  assert.equal(
    "errors" in spec.components.schemas.UploadListItem.properties,
    false,
  );
  assert.equal(
    "credentials" in spec.components.schemas.UploadListItem.properties,
    false,
  );
  assert.equal(
    Object.values(spec.components.schemas).some(
      (schema) =>
        schema?.properties &&
        ("credentials" in schema.properties ||
          "Temporary Password" in schema.properties),
    ),
    false,
  );
});
test("OpenAPI documents safe bounded audit and delivery-event pages", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  for (const [path, responseSchema] of [
    ["/api/admin/audit-events", "AuditEventListResponse"],
    ["/api/admin/email-delivery-events", "EmailDeliveryEventListResponse"],
  ]) {
    const operation = spec.paths[path].get;
    const parameters = Object.fromEntries(
      operation.parameters.map((parameter) => [parameter.name, parameter]),
    );
    assert.equal(parameters.page.schema.minimum, 1);
    assert.equal(parameters.pageSize.schema.maximum, 100);
    assert.equal(parameters.search.schema.maxLength, 200);
    assert.deepEqual(
      operation.responses["200"].content["application/json"].schema,
      { $ref: "#/components/schemas/" + responseSchema },
    );
  }
  assert.equal(
    "details" in spec.components.schemas.AuditEventListItem.properties,
    false,
  );
  assert.equal(
    "outcome" in spec.components.schemas.AuditEventListItem.properties,
    false,
  );
  assert.equal(
    "userId" in spec.components.schemas.EmailDeliveryEvent.properties,
    false,
  );
  assert.equal(
    "providerReference" in
      spec.components.schemas.EmailDeliveryEvent.properties,
    false,
  );
  assert.equal(
    spec.components.schemas.EmailDeliveryEventListResponse.properties.events
      .maxItems,
    100,
  );
});

test("OpenAPI documents coupled Region and Dealer Code user updates", async () => {
  const spec = JSON.parse(
    await readFile(new URL("../openapi.json", import.meta.url), "utf8"),
  );
  const schema =
    spec.paths["/api/admin/users/{userId}"].patch.requestBody.content[
      "application/json"
    ].schema;
  assert.equal(schema.properties.region.type, "string");
  assert.equal(schema.properties.dealerCode.type, "string");
  assert.match(schema.properties.dealerCode.description, /empty string/i);
});
