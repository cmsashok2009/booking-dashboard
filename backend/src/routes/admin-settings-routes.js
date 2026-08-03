import {
  createDealerCode,
  createRegion,
  updateDealerCode,
  updateRegion,
} from "../access-master-data.js";
import {
  beginGoogleAuthorization,
  completeGoogleAuthorization,
  disconnectGoogleAccount,
  sendGoogleTestEmail,
} from "../google-email-provider.js";
import { buildBootstrapResponse } from "../bootstrap-response.js";
import {
  LOOKUP_FIELDS,
  makeOptionId,
  normalizeOptionLabel,
  syncActiveLookups,
} from "../lookup-options.js";

const MAX_LOOKUP_REPLACEMENT = 1_000;

export async function handleAdminSettingsRoutes(context) {
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
    authenticatedUser,
    authenticatedAdmin,
    oauthCallbackPage,
    publicMetricsSnapshot,
  } = context;

  if (req.method === "POST" && pathname === "/api/admin/regions") {
    const admin = authenticatedAdmin(req, db);
    if (!admin)
      return sendJson(res, 403, {
        error: "Admin access is required",
        code: "ADMIN_REQUIRED",
      });
    const result = createRegion(db, await readBody(req), admin.id);
    if (!result.error) await saveDb(db);
    return sendJson(
      res,
      result.error ? result.status : 201,
      result.error
        ? result
        : {
            ...result,
            collectionUrl: "/api/admin/reference-data?collection=regions",
          },
    );
  }

  if (req.method === "POST" && pathname === "/api/admin/dealer-codes") {
    const admin = authenticatedAdmin(req, db);
    if (!admin)
      return sendJson(res, 403, {
        error: "Admin access is required",
        code: "ADMIN_REQUIRED",
      });
    const result = createDealerCode(db, await readBody(req), admin.id);
    if (!result.error) await saveDb(db);
    return sendJson(
      res,
      result.error ? result.status : 201,
      result.error
        ? result
        : {
            ...result,
            collectionUrl: "/api/admin/reference-data?collection=dealerCodes",
          },
    );
  }

  const regionMatch = pathname.match(/^\/api\/admin\/regions\/([^/]+)$/);
  if (req.method === "PATCH" && regionMatch) {
    const admin = authenticatedAdmin(req, db);
    if (!admin)
      return sendJson(res, 403, {
        error: "Admin access is required",
        code: "ADMIN_REQUIRED",
      });
    const result = updateRegion(
      db,
      decodeURIComponent(regionMatch[1]),
      await readBody(req),
      admin.id,
    );
    if (!result.error) await saveDb(db);
    return sendJson(
      res,
      result.error ? result.status : 200,
      result.error
        ? result
        : {
            ...result,
            collectionUrl: "/api/admin/reference-data?collection=regions",
          },
    );
  }

  const dealerMatch = pathname.match(/^\/api\/admin\/dealer-codes\/([^/]+)$/);
  if (req.method === "PATCH" && dealerMatch) {
    const admin = authenticatedAdmin(req, db);
    if (!admin)
      return sendJson(res, 403, {
        error: "Admin access is required",
        code: "ADMIN_REQUIRED",
      });
    const result = updateDealerCode(
      db,
      decodeURIComponent(dealerMatch[1]),
      await readBody(req),
      admin.id,
    );
    if (!result.error) await saveDb(db);
    return sendJson(
      res,
      result.error ? result.status : 200,
      result.error
        ? result
        : {
            ...result,
            collectionUrl: "/api/admin/reference-data?collection=dealerCodes",
          },
    );
  }

  if (
    req.method === "GET" &&
    pathname === "/api/admin/email-provider/google/callback"
  ) {
    const result = await completeGoogleAuthorization(db, {
      code: url.searchParams.get("code") || "",
      state: url.searchParams.get("state") || "",
    });
    await saveDb(db);
    const payload = result.error
      ? { ok: false, message: result.error }
      : {
          ok: true,
          message: `Google sender ${result.accountEmail} connected.`,
        };
    return sendText(
      res,
      result.error ? result.status || 400 : 200,
      oauthCallbackPage(payload),
      "text/html; charset=utf-8",
      { "cache-control": "no-store" },
    );
  }

  if (pathname.startsWith("/api/admin/") && !authenticatedAdmin(req, db)) {
    return sendJson(res, 403, { error: "Admin access is required" });
  }

  if (req.method === "GET" && pathname === "/api/metrics") {
    const admin = authenticatedAdmin(req, db);
    if (!admin)
      return sendJson(res, 403, {
        error: "Admin access is required",
        code: "ADMIN_REQUIRED",
      });
    return sendJson(res, 200, publicMetricsSnapshot());
  }

  if (req.method === "GET" && pathname === "/api/bootstrap") {
    const viewer = authenticatedUser(req, db);
    if (!viewer)
      return sendJson(res, 401, { error: "Authentication is required" });
    return sendJson(res, 200, buildBootstrapResponse(db, viewer));
  }

  if (
    req.method === "POST" &&
    pathname === "/api/admin/email-provider/google/start"
  ) {
    const admin = authenticatedAdmin(req, db);
    try {
      const result = beginGoogleAuthorization(db, admin.id);
      await saveDb(db);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 503, {
        error: "Email provider configuration is unavailable.",
        code: error.code || "EMAIL_CONFIG",
      });
    }
  }

  if (
    req.method === "POST" &&
    pathname === "/api/admin/email-provider/google/test"
  ) {
    const admin = authenticatedAdmin(req, db);
    const body = await readBody(req);
    const recipientEmail = String(body.recipientEmail || "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return sendJson(res, 422, {
        error: "Enter a valid test recipient email",
      });
    }
    try {
      const result = await sendGoogleTestEmail(db, admin.id, recipientEmail);
      await saveDb(db);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, error.status || 502, {
        error: "The test email could not be delivered.",
        code: error.code || "EMAIL_DELIVERY",
      });
    }
  }

  if (
    req.method === "POST" &&
    pathname === "/api/admin/email-provider/google/disconnect"
  ) {
    const admin = authenticatedAdmin(req, db);
    const result = await disconnectGoogleAccount(db, admin.id);
    if (result.error) return sendJson(res, result.status || 409, result);
    await saveDb(db);
    return sendJson(res, 200, result);
  }

  if (req.method === "PATCH" && pathname === "/api/admin/lookups") {
    const body = await readBody(req);
    const fieldCode = String(body.fieldCode || "");
    if (!LOOKUP_FIELDS.includes(fieldCode)) {
      return sendJson(res, 422, {
        error: "Lookup field is not editable or does not exist.",
      });
    }
    const options = Array.isArray(body.options)
      ? body.options.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const uniqueOptions = [...new Set(options)];
    if (!uniqueOptions.length)
      return sendJson(res, 422, {
        error: "At least one dropdown value is required.",
      });
    if (uniqueOptions.length > MAX_LOOKUP_REPLACEMENT) {
      return sendJson(res, 422, {
        error: `At most ${MAX_LOOKUP_REPLACEMENT} dropdown values can be replaced at once.`,
        code: "LOOKUP_OPTIONS_LIMIT",
      });
    }
    const now = new Date().toISOString();
    db.lookupOptions[fieldCode] = uniqueOptions.map((label, index) => ({
      id: makeOptionId(fieldCode, label, index),
      label,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }));
    syncActiveLookups(db);
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: "lookup_values_updated",
      entityId: fieldCode,
      userId: authenticatedAdmin(req, db).id,
      createdAt: now,
    });
    await saveDb(db);
    return sendJson(res, 200, {
      fieldCode,
      updatedCount: uniqueOptions.length,
      collectionUrl: `/api/admin/reference-data?collection=lookupOptions&fieldCode=${encodeURIComponent(fieldCode)}`,
    });
  }

  const optionCollectionMatch = pathname.match(
    /^\/api\/admin\/lookups\/([^/]+)\/options$/,
  );
  if (req.method === "POST" && optionCollectionMatch) {
    const fieldCode = optionCollectionMatch[1];
    if (!LOOKUP_FIELDS.includes(fieldCode)) {
      return sendJson(res, 422, {
        error: "Lookup field is not editable or does not exist.",
      });
    }
    const label = normalizeOptionLabel((await readBody(req)).label);
    if (!label)
      return sendJson(res, 422, { error: "Option label is required." });
    db.lookupOptions[fieldCode] ||= [];
    if (
      db.lookupOptions[fieldCode].some(
        (option) => option.label.toLowerCase() === label.toLowerCase(),
      )
    ) {
      return sendJson(res, 422, {
        error: "This option already exists for the selected field.",
      });
    }
    const now = new Date().toISOString();
    const option = {
      id: makeOptionId(fieldCode, label, Date.now()),
      label,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    db.lookupOptions[fieldCode].push(option);
    syncActiveLookups(db);
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: "lookup_option_added",
      entityId: option.id,
      userId: authenticatedAdmin(req, db).id,
      createdAt: now,
    });
    await saveDb(db);
    return sendJson(res, 200, {
      option,
      collectionUrl: `/api/admin/reference-data?collection=lookupOptions&fieldCode=${encodeURIComponent(fieldCode)}`,
    });
  }

  const optionMatch = pathname.match(
    /^\/api\/admin\/lookups\/([^/]+)\/options\/([^/]+)$/,
  );
  if (req.method === "PATCH" && optionMatch) {
    const fieldCode = optionMatch[1];
    const optionId = decodeURIComponent(optionMatch[2]);
    if (!LOOKUP_FIELDS.includes(fieldCode)) {
      return sendJson(res, 422, {
        error: "Lookup field is not editable or does not exist.",
      });
    }
    const body = await readBody(req);
    const option = (db.lookupOptions[fieldCode] || []).find(
      (item) => item.id === optionId,
    );
    if (!option) return sendJson(res, 404, { error: "Option not found." });
    const nextLabel =
      body.label === undefined
        ? option.label
        : normalizeOptionLabel(body.label);
    const nextStatus =
      body.status === undefined ? option.status : String(body.status);
    if (!nextLabel)
      return sendJson(res, 422, { error: "Option label is required." });
    if (!["active", "inactive"].includes(nextStatus)) {
      return sendJson(res, 422, {
        error: "Option status must be active or inactive.",
      });
    }
    const duplicate = (db.lookupOptions[fieldCode] || []).some(
      (item) =>
        item.id !== optionId &&
        item.label.toLowerCase() === nextLabel.toLowerCase(),
    );
    if (duplicate)
      return sendJson(res, 422, {
        error: "This option already exists for the selected field.",
      });
    option.label = nextLabel;
    option.status = nextStatus;
    option.updatedAt = new Date().toISOString();
    syncActiveLookups(db);
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action:
        nextStatus === "inactive"
          ? "lookup_option_deactivated"
          : "lookup_option_updated",
      entityId: option.id,
      userId: authenticatedAdmin(req, db).id,
      createdAt: new Date().toISOString(),
    });
    await saveDb(db);
    return sendJson(res, 200, {
      option,
      collectionUrl: `/api/admin/reference-data?collection=lookupOptions&fieldCode=${encodeURIComponent(fieldCode)}`,
    });
  }

  return null;
}
