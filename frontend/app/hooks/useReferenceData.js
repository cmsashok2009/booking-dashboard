"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../utils/api";

const PAGE_SIZE = 100;
const CORE_COLLECTIONS = ["regions", "dealerCodes", "dealerAssignments", "roles"];

async function loadCollection(collection, fieldCode, signal) {
  const items = [];
  let page = 1;
  let hasNextPage = true;
  while (hasNextPage) {
    const query = new URLSearchParams({ collection, page: String(page), pageSize: String(PAGE_SIZE) });
    if (fieldCode) query.set("fieldCode", fieldCode);
    const payload = await request(`/api/admin/reference-data?${query}`, { signal });
    items.push(...(payload.items || []));
    hasNextPage = Boolean(payload.pagination?.hasNextPage);
    page += 1;
    if (page > 10_000) throw new Error("Reference data exceeded the supported page limit.");
  }
  return items;
}

export function mergeReferenceData(seed, loaded) {
  if (!loaded) return seed;
  const lookupOptions = Object.fromEntries(
    Object.keys(seed?.lookupOptions || {}).map((fieldCode) => [fieldCode, loaded.lookupOptions[fieldCode] || []])
  );
  return {
    ...seed,
    roleDefinitions: loaded.roles,
    roles: loaded.roles.filter((item) => item.status === "active").map((item) => item.name),
    regionOptions: loaded.regions,
    regions: loaded.regions.filter((item) => item.status === "active").map((item) => item.name),
    dealerCodes: loaded.dealerCodes,
    dealerAssignments: loaded.dealerAssignments,
    lookupOptions,
    lookups: Object.fromEntries(
      Object.entries(lookupOptions).map(([fieldCode, options]) => [
        fieldCode,
        options.filter((item) => item.status === "active").map((item) => item.label)
      ])
    )
  };
}

export default function useReferenceData(user, enabled, seed) {
  const [state, setState] = useState({ data: null, loading: false, error: "" });
  const fieldCodes = useMemo(() => Object.keys(seed?.lookupOptions || {}).sort(), [seed?.lookupOptions]);
  const fieldCodeKey = fieldCodes.join("|");

  const load = useCallback(
    async ({ signal } = {}) => {
      if (!enabled || user?.role !== "Admin") return null;
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const [regions, dealerCodes, dealerAssignments, roles, ...lookupPages] = await Promise.all([
          ...CORE_COLLECTIONS.map((collection) => loadCollection(collection, "", signal)),
          ...fieldCodes.map((fieldCode) => loadCollection("lookupOptions", fieldCode, signal))
        ]);
        const loaded = {
          regions,
          dealerCodes,
          dealerAssignments,
          roles,
          lookupOptions: Object.fromEntries(fieldCodes.map((fieldCode, index) => [fieldCode, lookupPages[index]]))
        };
        const data = mergeReferenceData(seed, loaded);
        setState({ data, loading: false, error: "" });
        return data;
      } catch (error) {
        if (signal?.aborted) return null;
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message || "Reference data could not be loaded."
        }));
        return null;
      }
    },
    [enabled, fieldCodes, seed, user?.role]
  );

  useEffect(() => {
    if (!enabled || user?.role !== "Admin") return undefined;
    const controller = new AbortController();
    load({ signal: controller.signal });
    return () => controller.abort();
  }, [enabled, load, user?.role]);

  return { ...state, reload: () => load() };
}
