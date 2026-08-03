export function buildUserCollectionModel(bootstrap, onboardingWorkflows) {
  return {
    roles: (bootstrap?.roleDefinitions || []).map((role) => role.name),
    regions: bootstrap?.regions || [],
    dealerCodes: bootstrap?.dealerCodes || [],
    workflows: onboardingWorkflows.workflows,
    workflowsLoading: onboardingWorkflows.loading,
    workflowsLoadingMore: onboardingWorkflows.loadingMore,
    workflowsError: onboardingWorkflows.error,
    workflowPagination: onboardingWorkflows.pagination,
    onRetryWorkflows: onboardingWorkflows.reload,
    onLoadMoreWorkflows: onboardingWorkflows.loadMore
  };
}
