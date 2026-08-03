import {
  BOOKING_REQUIRED_COLUMNS,
  createBookingTemplate,
  exportBookingsAsExcelHtml,
  parseCsv,
  upsertBookings,
} from "../validators.js";
import {
  isBookingAssignedToAreaManager,
  scopeBookingsForUser,
} from "../access.js";
import {
  changedNotificationFields,
  createBookingImportNotifications,
  createBookingUpdateNotification,
  markNotificationRead,
  unreadNotificationsForUser,
} from "../notifications.js";
import { queryUnreadNotifications } from "../notification-query.js";

const MAX_EXPORT_ROWS = 10_000;

export function assertExportRowLimit(rows) {
  if (rows.length <= MAX_EXPORT_ROWS) return;
  const error = new Error(
    `Export is limited to ${MAX_EXPORT_ROWS} bookings. Narrow the filters and try again.`,
  );
  error.status = 422;
  error.code = "EXPORT_TOO_LARGE";
  throw error;
}

function paginationFromQuery(
  query,
  { defaultPageSize = 500, maxPageSize = 500 } = {},
) {
  const page = Number(query.get("page") || 1);
  const pageSize = Number(
    query.get("pageSize") || query.get("limit") || defaultPageSize,
  );
  if (!Number.isInteger(page) || page < 1) {
    const error = new Error("Page must be a positive integer.");
    error.status = 422;
    error.code = "INVALID_PAGE";
    throw error;
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize) {
    const error = new Error(`Page size must be between 1 and ${maxPageSize}.`);
    error.status = 422;
    error.code = "INVALID_PAGE_SIZE";
    throw error;
  }
  return { page, pageSize };
}

function paginateRows(rows, query, options) {
  const { page, pageSize } = paginationFromQuery(query, options);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    },
  };
}

function applyBookingFilters(bookings, query, users = []) {
  let rows = [...bookings];
  const search = (query.get("search") || "").trim().toLowerCase();
  const userId = query.get("userId") || "";
  const region = query.get("region") || "";
  const wholesaleInput = query.get("wholesaleInput") || "";
  const retailInput = query.get("retailInput") || "";
  if (search) {
    rows = rows.filter((booking) =>
      [
        booking.dealerCode,
        booking.contactFirstName,
        booking.contactLastName,
        booking.phoneNumber,
        booking.salesOrderId,
        booking.region,
        booking.model,
        booking.variant,
        booking.areaInputs?.bookingCategory,
        booking.areaInputs?.wsPlanning,
        booking.regionalInputs?.wholesaleInput,
        booking.regionalInputs?.retailInput,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  }
  if (region) rows = rows.filter((booking) => booking.region === region);
  if (wholesaleInput === "filled")
    rows = rows.filter((booking) =>
      Boolean(booking.regionalInputs?.wholesaleInput),
    );
  if (wholesaleInput === "missing")
    rows = rows.filter((booking) => !booking.regionalInputs?.wholesaleInput);
  if (retailInput === "filled")
    rows = rows.filter((booking) =>
      Boolean(booking.regionalInputs?.retailInput),
    );
  if (retailInput === "missing")
    rows = rows.filter((booking) => !booking.regionalInputs?.retailInput);
  const actor = users.find(
    (item) => item.id === userId && item.status === "active",
  );
  return scopeBookingsForUser(rows, actor);
}
export async function handleBookingRoutes(context) {
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
    broadcastNotification,
    notificationStreams,
    writeSse,
  } = context;

  if (req.method === "GET" && pathname === "/api/bookings") {
    const viewer = authenticatedUser(req, db);
    if (!viewer)
      return sendJson(res, 401, { error: "Authentication is required" });
    url.searchParams.set("userId", viewer.id);
    const rows = applyBookingFilters(db.bookings, url.searchParams, db.users);
    const page = paginateRows(rows, url.searchParams);
    return sendJson(res, 200, {
      rows: page.rows,
      total: page.pagination.total,
      pagination: page.pagination,
    });
  }

  if (req.method === "GET" && pathname.match(/^\/api\/bookings\/[^/]+$/)) {
    const viewer = authenticatedUser(req, db);
    if (!viewer)
      return sendJson(res, 401, { error: "Authentication is required" });
    const bookingId = decodeURIComponent(pathname.split("/")[3]);
    const booking = db.bookings.find((item) => item.id === bookingId);
    if (!booking) return sendJson(res, 404, { error: "Booking not found" });
    url.searchParams.set("userId", viewer.id);
    const rows = applyBookingFilters([booking], url.searchParams, db.users);
    if (!rows.length)
      return sendJson(res, 403, {
        error: "You do not have access to this booking",
      });
    return sendJson(res, 200, { booking: rows[0] });
  }

  if (req.method === "GET" && pathname === "/api/notifications") {
    const viewer = authenticatedUser(req, db);
    if (!viewer)
      return sendJson(res, 401, { error: "Authentication is required" });
    return sendJson(
      res,
      200,
      queryUnreadNotifications(db, viewer.id, url.searchParams),
    );
  }

  if (req.method === "GET" && pathname === "/api/notifications/stream") {
    const viewer = authenticatedUser(req, db);
    if (!viewer)
      return sendJson(res, 401, { error: "Authentication is required" });
    const userId = viewer.id;
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.write(": connected\n\n");
    if (!notificationStreams.has(userId))
      notificationStreams.set(userId, new Set());
    notificationStreams.get(userId).add(res);
    writeSse(res, {
      type: "snapshot",
      ...queryUnreadNotifications(
        db,
        userId,
        new URLSearchParams({ pageSize: "20" }),
      ),
    });
    const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 20_000);
    req.on("close", () => {
      clearInterval(keepAlive);
      notificationStreams.get(userId)?.delete(res);
      if (!notificationStreams.get(userId)?.size)
        notificationStreams.delete(userId);
    });
    return undefined;
  }

  if (
    req.method === "PATCH" &&
    pathname.match(/^\/api\/notifications\/[^/]+\/read$/)
  ) {
    const notificationId = decodeURIComponent(pathname.split("/")[3]);
    const viewer = authenticatedUser(req, db);
    if (!viewer)
      return sendJson(res, 401, { error: "Authentication is required" });
    const notification = markNotificationRead(db, notificationId, viewer.id);
    if (!notification)
      return sendJson(res, 404, { error: "Notification not found" });
    await saveDb(db);
    return sendJson(res, 200, {
      notificationId,
      unreadCount: unreadNotificationsForUser(db, viewer.id).length,
    });
  }

  const areaMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/area-inputs$/);
  if (req.method === "PATCH" && areaMatch) {
    const bookingId = areaMatch[1];
    const body = await readBody(req);
    const booking = db.bookings.find((item) => item.id === bookingId);
    if (!booking) return sendJson(res, 404, { error: "Booking not found" });
    const actor = authenticatedUser(req, db);
    if (!actor || actor.status !== "active" || actor.role !== "Area Manager") {
      return sendJson(res, 403, {
        error: "Only an active Area Manager can update Area Manager inputs",
      });
    }
    if (!isBookingAssignedToAreaManager(booking, actor)) {
      return sendJson(res, 403, {
        error: "Area Managers can update only their assigned bookings",
      });
    }
    const nextInputs = {
      bookingCategory: body.bookingCategory || "",
      wholesalesFeedback: body.wholesalesFeedback || "",
      wsPlanning: body.wsPlanning || "",
      expectedRetailDate: body.expectedRetailDate || "",
      cancellationReason: body.cancellationReason || "",
      updatedBy: actor.id,
      updatedAt: new Date().toISOString(),
    };
    const changedFields = changedNotificationFields(
      booking.areaInputs || {},
      nextInputs,
      [
        "bookingCategory",
        "wholesalesFeedback",
        "wsPlanning",
        "expectedRetailDate",
        "cancellationReason",
      ],
    );
    booking.areaInputs = nextInputs;
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: "area_inputs_updated",
      entityId: bookingId,
      userId: actor.id,
      createdAt: new Date().toISOString(),
    });
    const notification = createBookingUpdateNotification(db, {
      booking,
      actor,
      changedFields,
    });
    await saveDb(db);
    if (notification) broadcastNotification(notification);
    return sendJson(res, 200, { booking });
  }

  const regionalMatch = pathname.match(
    /^\/api\/bookings\/([^/]+)\/regional-inputs$/,
  );
  if (req.method === "PATCH" && regionalMatch) {
    const bookingId = regionalMatch[1];
    const body = await readBody(req);
    const booking = db.bookings.find((item) => item.id === bookingId);
    if (!booking) return sendJson(res, 404, { error: "Booking not found" });
    const actor = authenticatedUser(req, db);
    if (
      !actor ||
      actor.status !== "active" ||
      actor.role !== "Regional Manager"
    ) {
      return sendJson(res, 403, {
        error:
          "Only an active Regional Manager can update Regional Manager inputs",
      });
    }
    if (booking.assignedRegionalManagerId !== actor.id) {
      return sendJson(res, 403, {
        error: "Regional Managers can update only their assigned bookings",
      });
    }
    const nextInputs = {
      wholesaleInput: body.wholesaleInput || "",
      retailInput: body.retailInput || "",
      updatedBy: actor.id,
      updatedAt: new Date().toISOString(),
    };
    const changedFields = changedNotificationFields(
      booking.regionalInputs || {},
      nextInputs,
      ["wholesaleInput", "retailInput"],
    );
    booking.regionalInputs = nextInputs;
    db.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      action: "regional_inputs_updated",
      entityId: bookingId,
      userId: actor.id,
      createdAt: new Date().toISOString(),
    });
    const notification = createBookingUpdateNotification(db, {
      booking,
      actor,
      changedFields,
    });
    await saveDb(db);
    if (notification) broadcastNotification(notification);
    return sendJson(res, 200, { booking });
  }

  if (req.method === "GET" && pathname === "/api/admin/bookings/template") {
    return sendText(
      res,
      200,
      createBookingTemplate(),
      "text/csv; charset=utf-8",
      {
        "content-disposition":
          'attachment; filename="booking-upload-template.csv"',
      },
    );
  }

  if (req.method === "POST" && pathname === "/api/admin/bookings/import") {
    const admin = authenticatedAdmin(req, db);
    const body = await readBody(req);
    const parsed = parseCsv(body.content || "");
    const beforeBookings = db.bookings.map((booking) => ({ ...booking }));
    const result = upsertBookings(db, parsed.rows, {
      fileName: body.fileName || "booking-upload.csv",
      requiredColumns: BOOKING_REQUIRED_COLUMNS,
    });
    const importNotifications = result.failedRows
      ? []
      : createBookingImportNotifications(db, {
          beforeBookings,
          importedSalesOrderIds: parsed.rows.map(
            (row) => row["Sales Order Id"],
          ),
          actor: admin,
        });
    await saveDb(db);
    importNotifications.forEach(broadcastNotification);
    return sendJson(res, result.failedRows ? 422 : 200, {
      ...result,
      notificationsCreated: importNotifications.length,
    });
  }

  if (req.method === "GET" && pathname === "/api/admin/bookings/export") {
    const rows = applyBookingFilters(db.bookings, url.searchParams, db.users);
    assertExportRowLimit(rows);
    return sendText(
      res,
      200,
      exportBookingsAsExcelHtml(rows),
      "application/vnd.ms-excel; charset=utf-8",
      {
        "content-disposition": `attachment; filename="booking-dashboard-export-${new Date().toISOString().slice(0, 10)}.xls"`,
      },
    );
  }

  return null;
}
