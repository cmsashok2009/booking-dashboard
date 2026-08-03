const SORT_FIELDS = new Set(["updatedAt", "createdAt", "status", "currentStep", "fileName"]);
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

export function workflowForList(workflow) {
  return {
    id: workflow.id,
    fileName: workflow.fileName,
    ownerUserId: workflow.ownerUserId,
    status: workflow.status,
    currentStep: workflow.currentStep,
    version: workflow.version,
    summary: workflow.summary,
    selectedTemplateId: workflow.selectedTemplateId,
    selectedTemplateVersion: workflow.selectedTemplateVersion,
    campaignId: workflow.campaignId,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
  };
}

export function queryOnboardingWorkflows(workflows, actorId, query) {
  const page = positiveInteger(query.get("page"), 1, 1_000_000, "INVALID_PAGE", "Page");
  const pageSize = positiveInteger(query.get("pageSize"), 20, 100, "INVALID_PAGE_SIZE", "Page size");
  const search = String(query.get("search") || "").trim().toLowerCase();
  if (search.length > 200) throw queryError("Search must not exceed 200 characters.", "INVALID_SEARCH");
  const status = String(query.get("status") || "");
  const sortKey = String(query.get("sortKey") || "updatedAt");
  const sortDir = String(query.get("sortDir") || "desc").toLowerCase();
  if (!SORT_FIELDS.has(sortKey)) throw queryError("Sort field is not supported.", "INVALID_SORT_FIELD");
  if (!SORT_DIRECTIONS.has(sortDir)) throw queryError("Sort direction must be asc or desc.", "INVALID_SORT_DIRECTION");

  const filtered = workflows.filter((workflow) => workflow.ownerUserId === actorId).filter((workflow) => {
    const matchesSearch = !search || [workflow.fileName, workflow.status, workflow.currentStep]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(search));
    return matchesSearch && (!status || workflow.status === status);
  }).sort((left, right) => {
    const compared = String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? ""), "en", { sensitivity: "base" });
    if (compared !== 0) return sortDir === "asc" ? compared : -compared;
    return String(left.id).localeCompare(String(right.id));
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    workflows: filtered.slice(start, start + pageSize).map(workflowForList),
    pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages },
  };
}
