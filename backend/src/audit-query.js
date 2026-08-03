const SORT_FIELDS = new Set(["createdAt", "action", "entityType"]);
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

export function auditEventForResponse(event) {
  return {
    id: event.id,
    action: event.action,
    entityType: event.entityType || String(event.action || "event").split("_")[0],
    entityId: event.entityId || "",
    actorUserId: event.actorUserId || event.userId || "",
    requestId: event.requestId || "",
    createdAt: event.createdAt
  };
}

export function queryAuditEvents(events, query) {
  const page = positiveInteger(query.get("page"), 1, 1_000_000, "INVALID_PAGE", "Page");
  const pageSize = positiveInteger(query.get("pageSize"), 20, 100, "INVALID_PAGE_SIZE", "Page size");
  const search = String(query.get("search") || "").trim().toLowerCase();
  if (search.length > 200) throw queryError("Search must not exceed 200 characters.", "INVALID_SEARCH");
  const action = String(query.get("action") || "");
  const entityType = String(query.get("entityType") || "");
  const sortKey = String(query.get("sortKey") || "createdAt");
  const sortDir = String(query.get("sortDir") || "desc").toLowerCase();
  if (!SORT_FIELDS.has(sortKey)) throw queryError("Sort field is not supported.", "INVALID_SORT_FIELD");
  if (!SORT_DIRECTIONS.has(sortDir)) throw queryError("Sort direction must be asc or desc.", "INVALID_SORT_DIRECTION");

  const filtered = events.filter((event) => {
    const resolvedType = event.entityType || String(event.action || "event").split("_")[0];
    const matchesSearch = !search || [event.action, resolvedType, event.entityId, event.requestId]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
    return matchesSearch && (!action || event.action === action) && (!entityType || resolvedType === entityType);
  }).sort((left, right) => {
    const leftValue = sortKey === "entityType" ? left.entityType || String(left.action || "event").split("_")[0] : left[sortKey];
    const rightValue = sortKey === "entityType" ? right.entityType || String(right.action || "event").split("_")[0] : right[sortKey];
    const compared = String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "en", { sensitivity: "base" });
    if (compared !== 0) return sortDir === "asc" ? compared : -compared;
    return String(left.id).localeCompare(String(right.id));
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    events: filtered.slice(start, start + pageSize).map(auditEventForResponse),
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}
