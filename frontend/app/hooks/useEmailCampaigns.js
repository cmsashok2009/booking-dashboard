"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "../utils/api";

const PAGE_SIZE = 5;
const EMPTY_PAGINATION = { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false };
const EMPTY_SUMMARY = { campaigns: 0, sent: 0, failed: 0 };

function queryFor(filters, page) {
  return new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
    search: filters.search,
    status: filters.status,
    sortKey: "createdAt",
    sortDir: "desc"
  });
}

export default function useEmailCampaigns(user, enabled) {
  const [filters, setFilters] = useState({ search: "", status: "all" });
  const [page, setPage] = useState(1);
  const [state, setState] = useState({
    campaigns: [],
    pagination: EMPTY_PAGINATION,
    summary: EMPTY_SUMMARY,
    loading: false,
    error: ""
  });

  const load = useCallback(
    async ({ signal, targetPage = page } = {}) => {
      if (!enabled || user?.role !== "Admin") return null;
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const payload = await request(`/api/admin/email-campaigns?${queryFor(filters, targetPage)}`, { signal });
        if (payload.pagination.page > payload.pagination.totalPages) {
          setPage(payload.pagination.totalPages);
          return payload;
        }
        setState({
          campaigns: payload.campaigns || [],
          pagination: payload.pagination || EMPTY_PAGINATION,
          summary: payload.summary || EMPTY_SUMMARY,
          loading: false,
          error: ""
        });
        return payload;
      } catch (error) {
        if (signal?.aborted) return null;
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message || "Delivery campaigns could not be loaded. Try again."
        }));
        return null;
      }
    },
    [enabled, filters, page, user?.role]
  );

  useEffect(() => {
    if (!enabled || user?.role !== "Admin") return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => load({ signal: controller.signal }), filters.search ? 250 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, filters.search, load, user?.role]);

  const updateFilters = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  return {
    ...state,
    filters,
    page,
    setPage,
    updateFilters,
    reload: () => load({ targetPage: page })
  };
}
