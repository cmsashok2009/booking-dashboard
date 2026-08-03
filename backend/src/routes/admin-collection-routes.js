import {
  USER_REQUIRED_COLUMNS,
  createUserTemplate,
  parseCsv,
  upsertUsers,
  validateSingleUser,
  validateUserUpdate,
} from "../validators.js";
import {
  cloneTemplateSample,
  publicCampaign,
  saveEmailTemplate,
} from "../onboarding.js";
import { adminSetTemporaryPassword } from "../passwords.js";
import { queryAdminUsers } from "../user-query.js";
import { queryEmailCampaigns } from "../email-campaign-query.js";
import { queryEmailTemplates } from "../email-template-query.js";
import { queryUploads } from "../upload-query.js";
import { queryAuditEvents } from "../audit-query.js";
import {
  deliveryEventForResponse,
  queryEmailDeliveryEvents,
} from "../email-delivery-event-query.js";
import { queryReferenceData } from "../reference-data-query.js";

export async function handleAdminCollectionRoutes(context) {
  const {
    req,
    res,
    url,
    pathname,
    db,
    sendJson,
    sendText,
    readBody,
    saveDb,
    authenticatedAdmin,
    rateLimiter,
  } = context;

  if (req.method === "GET" && pathname === "/api/admin/email-templates") {
    if (!authenticatedAdmin(req, db))
      return sendJson(res, 403, { error: "Admin access is required" });
    const result = queryEmailTemplates(db.emailTemplates, url.searchParams);
    const sampleLimit = 100;
    return sendJson(res, 200, {
      ...result,
      samples: db.emailTemplateSamples.slice(0, sampleLimit),
      samplePagination: {
        limit: sampleLimit,
        total: db.emailTemplateSamples.length,
        hasMore: db.emailTemplateSamples.length > sampleLimit,
      },
    });
  }

  const cloneSampleMatch = pathname.match(
    /^\/api\/admin\/email-templates\/samples\/([^/]+)\/clone$/,
  );
  if (req.method === "POST" && cloneSampleMatch) {
    const body = await readBody(req);
    const admin = authenticatedAdmin(req, db);
    if (!admin)
      return sendJson(res, 403, { error: "Admin access is required" });
    const result = cloneTemplateSample(
      db,
      decodeURIComponent(cloneSampleMatch[1]),
      admin.id,
    );
    if (!result.error) await saveDb(db);
    return sendJson(res, result.error ? result.status : 201, result);
  }

  const templateMatch = pathname.match(
    /^\/api\/admin\/email-templates\/([^/]+)$/,
  );
  if (req.method === "PATCH" && templateMatch) {
    const body = await readBody(req);
    const admin = authenticatedAdmin(req, db);
    if (!admin)
      return sendJson(res, 403, { error: "Admin access is required" });
    const result = saveEmailTemplate(
      db,
      decodeURIComponent(templateMatch[1]),
      body,
      admin.id,
    );
    if (!result.error) await saveDb(db);
    return sendJson(res, result.error ? result.status : 200, result);
  }

  if (req.method === "GET" && pathname === "/api/admin/email-campaigns") {
    if (!authenticatedAdmin(req, db))
      return sendJson(res, 403, { error: "Admin access is required" });
    const result = queryEmailCampaigns(
      db.emailCampaigns.map(publicCampaign),
      url.searchParams,
    );
    const eventLimit = 100;
    return sendJson(res, 200, {
      ...result,
      events: db.emailDeliveryEvents
        .slice(0, eventLimit)
        .map(deliveryEventForResponse),
      eventPagination: {
        limit: eventLimit,
        total: db.emailDeliveryEvents.length,
        hasMore: db.emailDeliveryEvents.length > eventLimit,
      },
    });
  }

  if (req.method === "GET" && pathname === "/api/admin/uploads") {
    return sendJson(res, 200, queryUploads(db.fileUploads, url.searchParams));
  }
  if (req.method === "GET" && pathname === "/api/admin/audit-events") {
    return sendJson(res, 200, queryAuditEvents(db.auditLogs, url.searchParams));
  }
  if (req.method === "GET" && pathname === "/api/admin/email-delivery-events") {
    return sendJson(
      res,
      200,
      queryEmailDeliveryEvents(db.emailDeliveryEvents, url.searchParams),
    );
  }
  if (req.method === "GET" && pathname === "/api/admin/reference-data") {
    return sendJson(res, 200, queryReferenceData(db, url.searchParams));
  }
  if (req.method === "GET" && pathname === "/api/admin/users/template") {
    return sendText(res, 200, createUserTemplate(), "text/csv; charset=utf-8", {
      "content-disposition": 'attachment; filename="user-upload-template.csv"',
    });
  }
  if (req.method === "GET" && pathname === "/api/admin/users") {
    return sendJson(res, 200, queryAdminUsers(db.users, url.searchParams));
  }

  if (req.method === "POST" && pathname === "/api/admin/users") {
    const body = await readBody(req);
    const validation = validateSingleUser(body, db);
    if (!validation.valid) return sendJson(res, 422, validation);
    const result = upsertUsers(db, [body], {
      fileName: "single-user-form",
      requiredColumns: USER_REQUIRED_COLUMNS,
      uploadedBy: authenticatedAdmin(req, db).id,
    });
    await saveDb(db);
    return sendJson(res, 200, result);
  }

  if (req.method === "POST" && pathname === "/api/admin/users/import") {
    const body = await readBody(req);
    const parsed = parseCsv(body.content || "");
    const result = upsertUsers(db, parsed.rows, {
      fileName: body.fileName || "user-upload.csv",
      requiredColumns: USER_REQUIRED_COLUMNS,
      uploadedBy: authenticatedAdmin(req, db).id,
    });
    await saveDb(db);
    return sendJson(res, result.failedRows ? 422 : 200, result);
  }

  if (
    req.method === "POST" &&
    pathname.match(/^\/api\/admin\/users\/[^/]+\/temporary-password$/)
  ) {
    const admin = authenticatedAdmin(req, db);
    const limitResult = await rateLimiter.check(
      "admin-temporary-password",
      admin.id,
      {
        limit: 10,
        windowMs: 60 * 60 * 1000,
      },
    );
    if (!limitResult.allowed) {
      return sendJson(
        res,
        429,
        {
          error: "Too many temporary-password requests. Try again later.",
          code: "RATE_LIMITED",
        },
        { "retry-after": limitResult.retryAfterSeconds },
      );
    }
    const userId = decodeURIComponent(pathname.split("/")[4]);
    const body = await readBody(req);
    if (body.password !== body.confirmPassword)
      return sendJson(res, 422, { error: "Passwords do not match." });
    const result = adminSetTemporaryPassword(
      db,
      userId,
      admin.id,
      String(body.password || ""),
      {
        activatePending: body.activatePending === true,
      },
    );
    if (result.valid) await saveDb(db);
    const updatedUser = db.users.find((item) => item.id === userId);
    const { passwordHash: _passwordHash, ...safeUser } = updatedUser || {};
    return sendJson(
      res,
      result.valid ? 200 : result.status || 422,
      result.valid
        ? {
            updated: true,
            activated: result.activated,
            mustChangePassword: true,
            user: safeUser,
          }
        : { error: result.error, errors: result.errors || [] },
    );
  }

  if (
    req.method === "PATCH" &&
    pathname.match(/^\/api\/admin\/users\/[^/]+$/)
  ) {
    const userId = decodeURIComponent(pathname.split("/")[4]);
    const body = await readBody(req);
    const validation = validateUserUpdate(body, db, userId);
    if (!validation.valid) {
      const status = validation.errors.some(
        (error) => error.errorMessage === "User not found",
      )
        ? 404
        : 422;
      return sendJson(res, status, validation);
    }
    const user = db.users.find((item) => item.id === userId);
    user.name = validation.value.Name;
    user.email = validation.value.Email;
    user.role = validation.value.Role;
    user.region = validation.value.Region;
    user.dealerCode = validation.value["Dealer Code"];
    user.status = validation.value.Status;
    user.updatedAt = new Date().toISOString();
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: "user_updated",
      entityId: userId,
      userId: authenticatedAdmin(req, db).id,
      createdAt: user.updatedAt,
    });
    await saveDb(db);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return sendJson(res, 200, { user: safeUser });
  }

  return null;
}
