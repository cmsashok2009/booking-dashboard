const SORT_FIELDS = new Set([
  "name",
  "subject",
  "status",
  "type",
  "version",
  "createdAt",
  "updatedAt",
]);
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

export function queryEmailTemplates(templates, query) {
  const page = positiveInteger(
    query.get("page"),
    1,
    1_000_000,
    "INVALID_PAGE",
    "Page",
  );
  const pageSize = positiveInteger(
    query.get("pageSize"),
    10,
    100,
    "INVALID_PAGE_SIZE",
    "Page size",
  );
  const search = String(query.get("search") || "")
    .trim()
    .toLowerCase();
  if (search.length > 200)
    throw queryError(
      "Search must not exceed 200 characters.",
      "INVALID_SEARCH",
    );
  const status = String(query.get("status") || "");
  const type = String(query.get("type") || "");
  const sortKey = String(query.get("sortKey") || "updatedAt");
  const sortDir = String(query.get("sortDir") || "desc").toLowerCase();
  if (!SORT_FIELDS.has(sortKey))
    throw queryError("Sort field is not supported.", "INVALID_SORT_FIELD");
  if (!SORT_DIRECTIONS.has(sortDir))
    throw queryError(
      "Sort direction must be asc or desc.",
      "INVALID_SORT_DIRECTION",
    );

  const summary = templates.reduce(
    (totals, template) => ({
      total: totals.total + 1,
      active: totals.active + (template.status === "active" ? 1 : 0),
      draft: totals.draft + (template.status === "draft" ? 1 : 0),
    }),
    { total: 0, active: 0, draft: 0 },
  );
  const filtered = templates
    .filter((template) => {
      const matchesSearch =
        !search ||
        [template.name, template.subject, template.type, template.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      return (
        matchesSearch &&
        (!status || template.status === status) &&
        (!type || template.type === type)
      );
    })
    .sort((left, right) => {
      const leftValue = left[sortKey] ?? "";
      const rightValue = right[sortKey] ?? "";
      const compared =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), "en", {
              sensitivity: "base",
            });
      if (compared !== 0) return sortDir === "asc" ? compared : -compared;
      return String(left.id).localeCompare(String(right.id));
    });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    templates: filtered.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    },
    summary,
  };
}
