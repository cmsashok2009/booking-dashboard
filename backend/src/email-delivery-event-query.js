const SORT_FIELDS = new Set(["createdAt", "eventType", "provider", "attempt"]);
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

export function deliveryEventForResponse(event) {
  return {
    id: event.id,
    campaignId: event.campaignId,
    recipientId: event.recipientId,
    eventType: event.eventType,
    provider: event.provider || "",
    failureReason: event.failureReason || "",
    attempt: Number(event.attempt || 0),
    delayMs: Number(event.delayMs || 0),
    createdAt: event.createdAt
  };
}

export function queryEmailDeliveryEvents(events, query) {
  const page = positiveInteger(query.get("page"), 1, 1_000_000, "INVALID_PAGE", "Page");
  const pageSize = positiveInteger(query.get("pageSize"), 20, 100, "INVALID_PAGE_SIZE", "Page size");
  const search = String(query.get("search") || "").trim().toLowerCase();
  if (search.length > 200) throw queryError("Search must not exceed 200 characters.", "INVALID_SEARCH");
  const campaignId = String(query.get("campaignId") || "");
  const eventType = String(query.get("eventType") || "");
  const provider = String(query.get("provider") || "");
  const sortKey = String(query.get("sortKey") || "createdAt");
  const sortDir = String(query.get("sortDir") || "desc").toLowerCase();
  if (!SORT_FIELDS.has(sortKey)) throw queryError("Sort field is not supported.", "INVALID_SORT_FIELD");
  if (!SORT_DIRECTIONS.has(sortDir)) throw queryError("Sort direction must be asc or desc.", "INVALID_SORT_DIRECTION");

  const filtered = events.filter((event) => {
    const matchesSearch = !search || [event.campaignId, event.recipientId, event.eventType, event.provider, event.failureReason]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
    return matchesSearch && (!campaignId || event.campaignId === campaignId) && (!eventType || event.eventType === eventType) && (!provider || event.provider === provider);
  }).sort((left, right) => {
    const leftValue = left[sortKey];
    const rightValue = right[sortKey];
    const compared = sortKey === "attempt"
      ? Number(leftValue || 0) - Number(rightValue || 0)
      : String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "en", { sensitivity: "base" });
    if (compared !== 0) return sortDir === "asc" ? compared : -compared;
    return String(left.id).localeCompare(String(right.id));
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    events: filtered.slice(start, start + pageSize).map(deliveryEventForResponse),
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}
