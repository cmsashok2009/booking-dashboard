export const EMPTY_NOTIFICATION_COLLECTION = {
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1, hasNextPage: false },
  loading: false,
  loadingMore: false,
  error: "",
  retry: () => {},
  loadMore: () => {}
};
