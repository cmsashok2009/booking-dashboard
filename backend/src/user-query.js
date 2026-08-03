const SORT_FIELDS = new Set(["name", "email", "role", "region", "status", "createdAt", "updatedAt"]);
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

function publicUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export function queryAdminUsers(users, query) {
  const page = positiveInteger(query.get("page"), 1, 1_000_000, "INVALID_PAGE", "Page");
  const pageSize = positiveInteger(query.get("pageSize"), 10, 100, "INVALID_PAGE_SIZE", "Page size");
  const search = String(query.get("search") || "").trim().toLowerCase();
  if (search.length > 200) throw queryError("Search must not exceed 200 characters.", "INVALID_SEARCH");
  const role = String(query.get("role") || "");
  const region = String(query.get("region") || "");
  const status = String(query.get("status") || "");
  const sortKey = String(query.get("sortKey") || "name");
  const sortDir = String(query.get("sortDir") || "asc").toLowerCase();
  if (!SORT_FIELDS.has(sortKey)) throw queryError("Sort field is not supported.", "INVALID_SORT_FIELD");
  if (!SORT_DIRECTIONS.has(sortDir)) throw queryError("Sort direction must be asc or desc.", "INVALID_SORT_DIRECTION");

  const filtered = users
    .filter((user) => {
      const matchesSearch = !search || [
        user.name,
        user.email,
        user.phone,
        user.role,
        user.region,
        user.reportingManagerEmail,
        user.status
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
      return matchesSearch && (!role || user.role === role) && (!region || user.region === region) && (!status || user.status === status);
    })
    .sort((left, right) => {
      const compared = String(left[sortKey] || "").localeCompare(String(right[sortKey] || ""), "en", { sensitivity: "base" });
      if (compared !== 0) return sortDir === "asc" ? compared : -compared;
      return String(left.id).localeCompare(String(right.id));
    });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    users: filtered.slice(start, start + pageSize).map(publicUser),
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}
