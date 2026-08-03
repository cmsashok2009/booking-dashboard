"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "../utils/api";

const PAGE_SIZE = 20;
const EMPTY_PAGINATION = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasNextPage: false
};

function mergeNotifications(current, incoming, append) {
  if (!append) return incoming;
  const seen = new Set(current.map((notification) => notification.id));
  return [...current, ...incoming.filter((notification) => !seen.has(notification.id))];
}

export default function useNotificationStream(userId, setNotifications, setUnreadCount) {
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const knownIds = useRef(new Set());
  const requestVersion = useRef(0);

  const loadPage = useCallback(
    async (page = 1) => {
      if (!userId) return;
      const append = page > 1;
      const version = ++requestVersion.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sortKey: "createdAt",
          sortDir: "desc"
        });
        const payload = await request(`/api/notifications?${query}`);
        if (version !== requestVersion.current) return;
        setNotifications((current) => {
          const merged = mergeNotifications(current, payload.notifications || [], append);
          knownIds.current = new Set(merged.map((notification) => notification.id));
          return merged;
        });
        setUnreadCount(Number(payload.unreadCount || 0));
        setPagination(payload.pagination || EMPTY_PAGINATION);
      } catch (loadError) {
        if (version === requestVersion.current) {
          setError(loadError.message || "Notifications could not be loaded.");
        }
      } finally {
        if (version === requestVersion.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [setNotifications, setUnreadCount, userId]
  );

  useEffect(() => {
    if (!userId) {
      requestVersion.current += 1;
      knownIds.current = new Set();
      setNotifications([]);
      setUnreadCount(0);
      setPagination(EMPTY_PAGINATION);
      setError("");
      setLoading(false);
      setLoadingMore(false);
      return undefined;
    }

    let cancelled = false;
    loadPage(1);
    if (typeof EventSource === "undefined") {
      return () => {
        cancelled = true;
        requestVersion.current += 1;
      };
    }

    const stream = new EventSource("/api/notifications/stream");
    stream.onmessage = (event) => {
      if (cancelled) return;
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "snapshot") {
          const snapshot = payload.notifications || [];
          knownIds.current = new Set(snapshot.map((notification) => notification.id));
          setNotifications(snapshot);
          setUnreadCount(Number(payload.unreadCount || 0));
          setPagination(payload.pagination || EMPTY_PAGINATION);
          setError("");
        } else if (payload.type === "notification" && payload.notification) {
          if (knownIds.current.has(payload.notification.id)) return;
          knownIds.current.add(payload.notification.id);
          setNotifications((current) => [payload.notification, ...current]);
          setUnreadCount((current) => current + 1);
          setPagination((current) => {
            const total = current.total + 1;
            return {
              ...current,
              total,
              totalPages: Math.max(1, Math.ceil(total / current.pageSize)),
              hasNextPage: current.page < Math.max(1, Math.ceil(total / current.pageSize))
            };
          });
        }
      } catch {
        // Retain current state when a stream event is malformed.
      }
    };

    return () => {
      cancelled = true;
      requestVersion.current += 1;
      stream.close();
    };
  }, [loadPage, setNotifications, setUnreadCount, userId]);

  return {
    pagination,
    loading,
    loadingMore,
    error,
    retry: () => loadPage(1),
    loadMore: () => pagination.hasNextPage && loadPage(pagination.page + 1)
  };
}
