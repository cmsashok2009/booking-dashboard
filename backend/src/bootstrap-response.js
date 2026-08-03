import { activeRoleNames, normalizeRoleDefinitions } from "./validators.js";
import { googleEmailStatus } from "./google-email-provider.js";
import { publicCampaign } from "./onboarding.js";
import { queryAdminUsers } from "./user-query.js";
import { queryEmailCampaigns } from "./email-campaign-query.js";
import { queryEmailTemplates } from "./email-template-query.js";
import { queryOnboardingWorkflows } from "./onboarding-workflow-query.js";

const COMPATIBILITY_LIMIT = 100;

function activeLookups(lookupOptions = {}) {
  return Object.fromEntries(
    Object.entries(lookupOptions).map(([fieldCode, options]) => [
      fieldCode,
      options
        .filter((option) => option.status === "active")
        .map((option) => option.label),
    ]),
  );
}

function emptyPagination(total = 0, pageSize = COMPATIBILITY_LIMIT) {
  return {
    page: 1,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasNextPage: total > pageSize,
  };
}

export function buildBootstrapResponse(db, viewer) {
  const isAdmin = viewer.role === "Admin";
  const { passwordHash: _passwordHash, ...publicViewer } = viewer;
  const users = isAdmin
    ? queryAdminUsers(
        db.users,
        new URLSearchParams({ page: "1", pageSize: "100" }),
      )
    : { users: [publicViewer], pagination: emptyPagination(1, 1) };
  const campaigns = isAdmin
    ? queryEmailCampaigns(
        db.emailCampaigns.map(publicCampaign),
        new URLSearchParams({ page: "1", pageSize: "100" }),
      )
    : { campaigns: [], pagination: emptyPagination() };
  const templates = isAdmin
    ? queryEmailTemplates(
        db.emailTemplates,
        new URLSearchParams({ page: "1", pageSize: "100" }),
      )
    : {
        templates: [],
        pagination: emptyPagination(),
        summary: { total: 0, active: 0, draft: 0 },
      };
  const workflows = isAdmin
    ? queryOnboardingWorkflows(
        db.onboardingWorkflows,
        viewer.id,
        new URLSearchParams({ page: "1", pageSize: "100" }),
      )
    : { workflows: [], pagination: emptyPagination() };
  const boundedLookupOptions = Object.fromEntries(
    Object.entries(db.lookupOptions).map(([fieldCode, options]) => [
      fieldCode,
      options.slice(0, COMPATIBILITY_LIMIT),
    ]),
  );

  return {
    currentUser: publicViewer,
    roles: activeRoleNames(db).slice(0, COMPATIBILITY_LIMIT),
    roleDefinitions: normalizeRoleDefinitions(db.roles)
      .filter((role) => role.isActive)
      .slice(0, COMPATIBILITY_LIMIT),
    onboardingWorkflows: workflows.workflows,
    emailTemplateSamples: isAdmin
      ? db.emailTemplateSamples.slice(0, COMPATIBILITY_LIMIT)
      : [],
    emailTemplates: templates.templates,
    emailCampaigns: campaigns.campaigns,
    emailProvider: isAdmin ? googleEmailStatus(db) : null,
    users: users.users,
    collectionPagination: {
      users: users.pagination,
      emailCampaigns: campaigns.pagination,
      emailTemplates: templates.pagination,
      onboardingWorkflows: workflows.pagination,
    },
    referenceDataPagination: {
      regions: {
        limit: COMPATIBILITY_LIMIT,
        total: db.regions.length,
        hasMore: db.regions.length > COMPATIBILITY_LIMIT,
      },
      dealerCodes: {
        limit: COMPATIBILITY_LIMIT,
        total: db.dealerCodes.length,
        hasMore: db.dealerCodes.length > COMPATIBILITY_LIMIT,
      },
      dealerAssignments: {
        limit: COMPATIBILITY_LIMIT,
        total: db.dealerAssignments.length,
        hasMore: db.dealerAssignments.length > COMPATIBILITY_LIMIT,
      },
      lookupOptions: Object.fromEntries(
        Object.entries(db.lookupOptions).map(([fieldCode, options]) => [
          fieldCode,
          {
            limit: COMPATIBILITY_LIMIT,
            total: options.length,
            hasMore: options.length > COMPATIBILITY_LIMIT,
          },
        ]),
      ),
    },
    collectionLinks: {
      users: "/api/admin/users",
      emailCampaigns: "/api/admin/email-campaigns",
      emailTemplates: "/api/admin/email-templates",
      onboardingWorkflows: "/api/admin/onboarding",
      referenceData: "/api/admin/reference-data",
    },
    collectionCaps: {
      emailTemplateSamples: {
        limit: COMPATIBILITY_LIMIT,
        total: isAdmin ? db.emailTemplateSamples.length : 0,
        hasMore:
          isAdmin && db.emailTemplateSamples.length > COMPATIBILITY_LIMIT,
      },
    },
    dealerAssignments: isAdmin
      ? db.dealerAssignments.slice(0, COMPATIBILITY_LIMIT)
      : [],
    dealerCodes: isAdmin ? db.dealerCodes.slice(0, COMPATIBILITY_LIMIT) : [],
    regionOptions: isAdmin ? db.regions.slice(0, COMPATIBILITY_LIMIT) : [],
    lookups: activeLookups(boundedLookupOptions),
    lookupOptions: boundedLookupOptions,
    regions: db.regions
      .filter((item) => item.status === "active")
      .slice(0, COMPATIBILITY_LIMIT)
      .map((item) => item.name),
  };
}
