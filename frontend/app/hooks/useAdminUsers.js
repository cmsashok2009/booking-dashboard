"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "../utils/api";
import { PAGE_SIZE } from "../utils/pagination";

function queryFor(filters, page, pageSize = PAGE_SIZE) {
  return new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    search: filters.search || "",
    role: filters.role || "",
    status: filters.status || "",
    region: filters.region || "",
    sortKey: filters.sortKey || "name",
    sortDir: filters.sortDir || "asc"
  });
}

export default function useAdminUsers(user, filters, page, setPage) {
  const [state, setState] = useState({ users: [], pagination: { total: 0, totalPages: 1 }, loading: false, error: "" });

  const load = useCallback(
    async ({ signal, targetPage = page } = {}) => {
      if (user?.role !== "Admin") {
        setState({ users: [], pagination: { total: 0, totalPages: 1 }, loading: false, error: "" });
        return null;
      }
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const payload = await request(`/api/admin/users?${queryFor(filters, targetPage)}`, { signal });
        if (payload.pagination.page > payload.pagination.totalPages) {
          setPage(payload.pagination.totalPages);
          return payload;
        }
        setState({ users: payload.users || [], pagination: payload.pagination, loading: false, error: "" });
        return payload;
      } catch (error) {
        if (signal?.aborted) return null;
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message || "Users could not be loaded. Try again."
        }));
        return null;
      }
    },
    [filters, page, setPage, user?.role]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => load({ signal: controller.signal }), filters.search ? 250 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load, filters.search]);

  const updateUser = useCallback((updatedUser) => {
    setState((current) => ({
      ...current,
      users: current.users.map((item) => (item.id === updatedUser.id ? updatedUser : item))
    }));
  }, []);

  const loadAll = useCallback(async () => {
    const collected = [];
    let targetPage = 1;
    while (true) {
      const payload = await request(`/api/admin/users?${queryFor(filters, targetPage, 100)}`);
      collected.push(...(payload.users || []));
      if (!payload.pagination.hasNextPage) return collected;
      targetPage += 1;
    }
  }, [filters]);

  return { ...state, reload: () => load({ targetPage: page }), updateUser, loadAll };
}
