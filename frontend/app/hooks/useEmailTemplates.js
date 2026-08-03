"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "../utils/api";

const PAGE_SIZE = 10;
const EMPTY_PAGINATION = { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false };
const EMPTY_SUMMARY = { total: 0, active: 0, draft: 0 };

function queryFor(filters, page, pageSize = PAGE_SIZE) {
  return new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search: filters.search || "",
    status: filters.status || "",
    type: filters.type || "",
    sortKey: filters.sortKey || "updatedAt",
    sortDir: filters.sortDir || "desc"
  });
}

export default function useEmailTemplates(user, enabled, seedTemplates = [], optionsEnabled = enabled) {
  const [filters, setFilters] = useState({ search: "", status: "", type: "", sortKey: "updatedAt", sortDir: "desc" });
  const [page, setPage] = useState(1);
  const [state, setState] = useState({
    samples: [],
    templates: [],
    pagination: EMPTY_PAGINATION,
    summary: EMPTY_SUMMARY,
    loading: false,
    error: ""
  });
  const [activeTemplates, setActiveTemplates] = useState(() =>
    seedTemplates.filter((item) => item.status === "active")
  );
  const [activeError, setActiveError] = useState("");

  const load = useCallback(
    async ({ signal, targetPage = page } = {}) => {
      if (!enabled || user?.role !== "Admin") return null;
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const payload = await request(`/api/admin/email-templates?${queryFor(filters, targetPage)}`, { signal });
        if (payload.pagination.page > payload.pagination.totalPages) {
          setPage(payload.pagination.totalPages);
          return payload;
        }
        setState({
          samples: payload.samples || [],
          templates: payload.templates || [],
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
          error: error.message || "Email templates could not be loaded. Try again."
        }));
        return null;
      }
    },
    [enabled, filters, page, user?.role]
  );

  const loadActive = useCallback(async () => {
    if (user?.role !== "Admin") {
      setActiveTemplates([]);
      setActiveError("");
      return [];
    }
    try {
      const collected = [];
      let targetPage = 1;
      while (true) {
        const payload = await request(
          `/api/admin/email-templates?${queryFor({ status: "active", type: "user_activation" }, targetPage, 100)}`
        );
        collected.push(...(payload.templates || []));
        if (!payload.pagination.hasNextPage) break;
        targetPage += 1;
      }
      setActiveTemplates(collected);
      setActiveError("");
      return collected;
    } catch (error) {
      setActiveError(error.message || "Active onboarding templates could not be refreshed.");
      return null;
    }
  }, [user?.role]);

  useEffect(() => {
    if (!enabled || user?.role !== "Admin") return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => load({ signal: controller.signal }), filters.search ? 250 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, filters.search, load, user?.role]);

  useEffect(() => {
    if (optionsEnabled) void loadActive();
  }, [loadActive, optionsEnabled]);

  const updateFilters = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  const reloadAll = useCallback(async () => {
    const [pageResult] = await Promise.all([load({ targetPage: page }), loadActive()]);
    return pageResult;
  }, [load, loadActive, page]);

  return {
    ...state,
    filters,
    page,
    setPage,
    updateFilters,
    reload: () => load({ targetPage: page }),
    reloadAll,
    activeTemplates,
    activeError,
    reloadActive: loadActive
  };
}
