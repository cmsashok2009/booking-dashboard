const SORT_FIELDS = new Set(["createdAt", "status", "sent", "failed", "total"]);
const SORT_DIRECTIONS = new Set(["asc", "desc"]);
const STATUS_FILTERS = new Set([
  "all",
  "successful",
  "failed",
  "pending",
  "completed",
]);

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

function campaignMatchesSearch(campaign, search) {
  if (!search) return true;
  const campaignValues = [campaign.id, campaign.status, campaign.createdAt];
  const recipientValues = (campaign.recipients || []).flatMap((recipient) => [
    recipient.name,
    recipient.email,
    recipient.provider,
    recipient.status,
  ]);
  return [...campaignValues, ...recipientValues]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}

function campaignMatchesStatus(campaign, status) {
  if (status === "all") return true;
  if (status === "successful") return Number(campaign.failed || 0) === 0;
  if (status === "failed") return Number(campaign.failed || 0) > 0;
  return campaign.status === status;
}

export function queryEmailCampaigns(campaigns, query) {
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
  const status = String(query.get("status") || "all").toLowerCase();
  if (!STATUS_FILTERS.has(status))
    throw queryError("Status filter is not supported.", "INVALID_STATUS");
  const sortKey = String(query.get("sortKey") || "createdAt");
  const sortDir = String(query.get("sortDir") || "desc").toLowerCase();
  if (!SORT_FIELDS.has(sortKey))
    throw queryError("Sort field is not supported.", "INVALID_SORT_FIELD");
  if (!SORT_DIRECTIONS.has(sortDir))
    throw queryError(
      "Sort direction must be asc or desc.",
      "INVALID_SORT_DIRECTION",
    );

  const summary = campaigns.reduce(
    (totals, campaign) => ({
      campaigns: totals.campaigns + 1,
      sent: totals.sent + Number(campaign.sent || 0),
      failed: totals.failed + Number(campaign.failed || 0),
    }),
    { campaigns: 0, sent: 0, failed: 0 },
  );
  const filtered = campaigns
    .filter(
      (campaign) =>
        campaignMatchesSearch(campaign, search) &&
        campaignMatchesStatus(campaign, status),
    )
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
    campaigns: filtered.slice(start, start + pageSize),
    summary,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    },
  };
}
