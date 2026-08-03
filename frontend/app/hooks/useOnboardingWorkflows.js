"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "../utils/api";

const PAGE_SIZE = 20;
const EMPTY_PAGINATION = { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false };

export default function useOnboardingWorkflows(user, enabled, seed = []) {
  const [state, setState] = useState({
    workflows: seed.slice(0, PAGE_SIZE),
    pagination: { ...EMPTY_PAGINATION, total: seed.length, hasNextPage: seed.length > PAGE_SIZE },
    loading: false,
    loadingMore: false,
    error: ""
  });

  const load = useCallback(
    async ({ page = 1, append = false, signal } = {}) => {
      if (!enabled || user?.role !== "Admin") return null;
      setState((current) => ({ ...current, [append ? "loadingMore" : "loading"]: true, error: "" }));
      try {
        const query = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sortKey: "updatedAt",
          sortDir: "desc"
        });
        const payload = await request(`/api/admin/onboarding?${query}`, { signal });
        setState((current) => {
          const rows = append ? [...current.workflows, ...(payload.workflows || [])] : payload.workflows || [];
          return {
            workflows: [...new Map(rows.map((workflow) => [workflow.id, workflow])).values()],
            pagination: payload.pagination || EMPTY_PAGINATION,
            loading: false,
            loadingMore: false,
            error: ""
          };
        });
        return payload;
      } catch (error) {
        if (signal?.aborted) return null;
        setState((current) => ({
          ...current,
          loading: false,
          loadingMore: false,
          error: error.message || "Onboarding workflows could not be loaded."
        }));
        return null;
      }
    },
    [enabled, user?.role]
  );

  useEffect(() => {
    if (!enabled || user?.role !== "Admin") return undefined;
    const controller = new AbortController();
    load({ signal: controller.signal });
    return () => controller.abort();
  }, [enabled, load, user?.role]);

  return {
    ...state,
    reload: () => load(),
    loadMore: () => load({ page: state.pagination.page + 1, append: true })
  };
}
