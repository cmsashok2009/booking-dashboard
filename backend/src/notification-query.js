import { unreadNotificationsForUser } from "./notifications.js";

const SORT_FIELDS = new Set(["createdAt", "actorRole", "eventType", "title", "salesOrderId"]);
const SORT_DIRECTIONS = new Set(["asc", "desc"]);

function queryError(message, code) {
  const error = new Error(message);
  error.status = 422;
  error.code = code;
  return error;
}

function positiveInteger(value, fallback, maximum, code, label) {
  const parsed = Number(value || fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw queryError(`${label} must be between 1 and ${maximum}.`, code);
  }
  return parsed;
}

export function notificationForResponse(notification) {
  return {
    id: notification.id,
    eventType: notification.eventType,
    bookingId: notification.bookingId,
    salesOrderId: notification.salesOrderId,
    dealerCode: notification.dealerCode,
    actorName: notification.actorName,
    actorRole: notification.actorRole,
    title: notification.title,
    message: notification.message,
    changedFields: notification.changedFields || [],
    createdAt: notification.createdAt
  };
}

export function queryUnreadNotifications(db, userId, query) {
  const page = positiveInteger(query.get("page"), 1, 1_000_000, "INVALID_PAGE", "Page");
  const pageSize = positiveInteger(query.get("pageSize"), 20, 100, "INVALID_PAGE_SIZE", "Page size");
  const search = String(query.get("search") || "")
    .trim()
    .toLowerCase();
  if (search.length > 200) {
    throw queryError("Search must not exceed 200 characters.", "INVALID_SEARCH");
  }
  const eventType = String(query.get("eventType") || "").trim();
  if (eventType.length > 100) {
    throw queryError("Event type must not exceed 100 characters.", "INVALID_EVENT_TYPE");
  }
  const sortKey = String(query.get("sortKey") || "createdAt");
  const sortDir = String(query.get("sortDir") || "desc").toLowerCase();
  if (!SORT_FIELDS.has(sortKey)) {
    throw queryError("Sort field is not supported.", "INVALID_SORT_FIELD");
  }
  if (!SORT_DIRECTIONS.has(sortDir)) {
    throw queryError("Sort direction must be asc or desc.", "INVALID_SORT_DIRECTION");
  }

  const unread = unreadNotificationsForUser(db, userId);
  const filtered = unread
    .filter((notification) => {
      const matchesSearch =
        !search ||
        [
          notification.title,
          notification.message,
          notification.actorName,
          notification.actorRole,
          notification.eventType,
          notification.salesOrderId,
          notification.dealerCode
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      return matchesSearch && (!eventType || notification.eventType === eventType);
    })
    .sort((left, right) => {
      const compared = String(left[sortKey] || "").localeCompare(String(right[sortKey] || ""), "en", {
        sensitivity: "base"
      });
      if (compared !== 0) return sortDir === "asc" ? compared : -compared;
      return String(left.id).localeCompare(String(right.id));
    });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    notifications: filtered.slice(start, start + pageSize).map(notificationForResponse),
    unreadCount: unread.length,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages
    }
  };
}