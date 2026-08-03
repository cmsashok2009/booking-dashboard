const SORT_FIELDS = new Set(["createdAt", "originalFileName", "uploadCategory", "status", "totalRows"]);
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

export function uploadForResponse(upload) {
  return {
    id: upload.id,
    uploadCategory: upload.uploadCategory,
    originalFileName: upload.originalFileName,
    status: upload.status,
    totalRows: Number(upload.totalRows || 0),
    insertedRows: Number(upload.insertedRows || 0),
    updatedRows: Number(upload.updatedRows || 0),
    failedRows: Number(upload.failedRows || 0),
    uploadedBy: upload.uploadedBy || "",
    createdAt: upload.createdAt || upload.uploadedAt
  };
}

export function queryUploads(uploads, query) {
  const page = positiveInteger(query.get("page"), 1, 1_000_000, "INVALID_PAGE", "Page");
  const pageSize = positiveInteger(query.get("pageSize"), 20, 100, "INVALID_PAGE_SIZE", "Page size");
  const search = String(query.get("search") || "").trim().toLowerCase();
  if (search.length > 200) throw queryError("Search must not exceed 200 characters.", "INVALID_SEARCH");
  const category = String(query.get("category") || "");
  const status = String(query.get("status") || "");
  const sortKey = String(query.get("sortKey") || "createdAt");
  const sortDir = String(query.get("sortDir") || "desc").toLowerCase();
  if (!SORT_FIELDS.has(sortKey)) throw queryError("Sort field is not supported.", "INVALID_SORT_FIELD");
  if (!SORT_DIRECTIONS.has(sortDir)) throw queryError("Sort direction must be asc or desc.", "INVALID_SORT_DIRECTION");

  const filtered = uploads.filter((upload) => {
    const matchesSearch = !search || [upload.originalFileName, upload.uploadCategory, upload.status]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
    return matchesSearch && (!category || upload.uploadCategory === category) && (!status || upload.status === status);
  }).sort((left, right) => {
    const leftValue = sortKey === "createdAt" ? left.createdAt || left.uploadedAt : left[sortKey];
    const rightValue = sortKey === "createdAt" ? right.createdAt || right.uploadedAt : right[sortKey];
    const compared = sortKey === "totalRows"
      ? Number(leftValue || 0) - Number(rightValue || 0)
      : String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "en", { sensitivity: "base" });
    if (compared !== 0) return sortDir === "asc" ? compared : -compared;
    return String(left.id).localeCompare(String(right.id));
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    uploads: filtered.slice(start, start + pageSize).map(uploadForResponse),
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}
