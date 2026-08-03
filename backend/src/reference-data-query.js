const COLLECTIONS = new Set(["regions", "dealerCodes", "dealerAssignments", "roles", "lookupOptions"]);
const SORT_DIRECTIONS = new Set(["asc", "desc"]);
const SORT_FIELDS = new Set(["label", "status", "updatedAt", "hierarchyLevel"]);

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

function sourceFor(db, collection, fieldCode) {
  if (!COLLECTIONS.has(collection)) throw queryError("Reference collection is not supported.", "INVALID_COLLECTION");
  if (collection === "lookupOptions") {
    if (!fieldCode || !Array.isArray(db.lookupOptions?.[fieldCode])) {
      throw queryError("Lookup field is not supported.", "INVALID_FIELD_CODE");
    }
    return db.lookupOptions[fieldCode];
  }
  return Array.isArray(db[collection]) ? db[collection] : [];
}

function project(item, collection) {
  if (collection === "regions") return { id: item.id, label: item.name, name: item.name, status: item.status, updatedAt: item.updatedAt || item.createdAt };
  if (collection === "dealerCodes") return { id: item.id, label: item.code, code: item.code, region: item.region, status: item.status, updatedAt: item.updatedAt || item.createdAt };
  if (collection === "dealerAssignments") return { id: item.id || item.dealerCode, label: item.dealerCode, dealerCode: item.dealerCode, areaManagerUserId: item.areaManagerUserId || "", regionalManagerUserId: item.regionalManagerUserId || "", updatedAt: item.updatedAt || item.createdAt };
  if (collection === "roles") return { id: item.code, label: item.name, code: item.code, name: item.name, hierarchyLevel: item.hierarchyLevel, managerRoleCode: item.managerRoleCode, isActive: item.isActive, isSystem: item.isSystem, status: item.isActive ? "active" : "inactive" };
  return { id: item.id, label: item.label, status: item.status, updatedAt: item.updatedAt || item.createdAt };
}

export function queryReferenceData(db, query) {
  const collection = String(query.get("collection") || "");
  const fieldCode = String(query.get("fieldCode") || "");
  const page = positiveInteger(query.get("page"), 1, 1_000_000, "INVALID_PAGE", "Page");
  const pageSize = positiveInteger(query.get("pageSize"), 100, 100, "INVALID_PAGE_SIZE", "Page size");
  const search = String(query.get("search") || "").trim().toLowerCase();
  if (search.length > 200) throw queryError("Search must not exceed 200 characters.", "INVALID_SEARCH");
  const status = String(query.get("status") || "");
  const sortKey = String(query.get("sortKey") || "label");
  const sortDir = String(query.get("sortDir") || "asc").toLowerCase();
  if (!SORT_FIELDS.has(sortKey)) throw queryError("Sort field is not supported.", "INVALID_SORT_FIELD");
  if (!SORT_DIRECTIONS.has(sortDir)) throw queryError("Sort direction must be asc or desc.", "INVALID_SORT_DIRECTION");

  const filtered = sourceFor(db, collection, fieldCode).map((item) => project(item, collection)).filter((item) => {
    const matchesSearch = !search || [item.label, item.region, item.status].filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
    return matchesSearch && (!status || item.status === status);
  }).sort((left, right) => {
    const compared = sortKey === "hierarchyLevel"
      ? Number(left[sortKey] || 0) - Number(right[sortKey] || 0)
      : String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""), "en", { sensitivity: "base" });
    if (compared !== 0) return sortDir === "asc" ? compared : -compared;
    return String(left.id).localeCompare(String(right.id));
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    collection,
    fieldCode: collection === "lookupOptions" ? fieldCode : undefined,
    items: filtered.slice(start, start + pageSize),
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages }
  };
}
