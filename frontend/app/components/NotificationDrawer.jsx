"use client";

import { CheckCircle2, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Button, CloseButton, ErrorState, LoadingState, SideDrawer } from "./ui";

const ROLE_ORDER = ["Area Manager", "Regional Manager"];

function formatTimestamp(value) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function NotificationDrawer({
  open,
  notifications,
  unreadCount = notifications.length,
  pagination = { hasNextPage: false },
  loading = false,
  loadingMore = false,
  error = "",
  onRetry,
  onLoadMore,
  onClose,
  onOpenNotification
}) {
  const groups = useMemo(() => {
    const grouped = new Map();
    notifications.forEach((notification) => {
      const role = notification.actorRole || "Other updates";
      if (!grouped.has(role)) grouped.set(role, []);
      grouped.get(role).push(notification);
    });
    return [...grouped.entries()].sort(([left], [right]) => {
      const leftIndex = ROLE_ORDER.indexOf(left);
      const rightIndex = ROLE_ORDER.indexOf(right);
      return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
    });
  }, [notifications]);

  if (!open) return null;

  return (
    <SideDrawer
      className="notification-drawer"
      backdropClassName="notification-drawer-backdrop"
      labelledBy="notification-drawer-title"
      onClose={onClose}
    >
      <header className="notification-drawer-header">
        <div>
          <h2 id="notification-drawer-title">Notifications</h2>
          <p aria-live="polite">
            {unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You are all caught up"}
          </p>
        </div>
        <CloseButton className="drawer-close-button" onClick={onClose} label="Close notifications" />
      </header>

      <div className="notification-drawer-content" aria-busy={loading || loadingMore}>
        {error && notifications.length ? (
          <div className="inline-status error notification-stale-status" role="alert">
            <span>{error} Loaded updates remain available.</span>
            <Button type="button" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : null}
        {loading && !notifications.length ? (
          <LoadingState
            className="notification-loading-state"
            title="Loading notifications"
            description="Retrieving your latest unread updates."
          />
        ) : error && !notifications.length ? (
          <ErrorState
            className="notification-error-state"
            title="Notifications unavailable"
            description={error}
            onRetry={onRetry}
            showHome={false}
          />
        ) : !groups.length ? (
          <div className="notification-empty">
            <CheckCircle2 className="notification-empty-icon" aria-hidden="true" />
            <h3>No unread updates</h3>
            <p>Booking updates and new Excel allocations will appear here.</p>
          </div>
        ) : (
          groups.map(([role, items]) => (
            <details className="notification-group" key={role} open>
              <summary>
                <span>{role}</span>
                <span className="notification-group-count">{items.length}</span>
              </summary>
              <div className="notification-list">
                {items.map((notification) => {
                  const title =
                    notification.title || `${notification.actorName} updated ${notification.salesOrderId}`;
                  const eventLabel =
                    (notification.changedFields || []).map((field) => field.label).join(", ") || "Booking update";
                  return (
                    <button
                      className="notification-item"
                      type="button"
                      key={notification.id}
                      aria-label={`Unread notification: ${title}. Open booking`}
                      onClick={() => onOpenNotification(notification)}
                    >
                      <span className="notification-item-dot" aria-hidden="true" />
                      <span className="notification-item-body">
                        <span className="notification-item-title">{title}</span>
                        <span className="notification-item-meta">{eventLabel}</span>
                        <time className="notification-item-time" dateTime={notification.createdAt || undefined}>
                          {formatTimestamp(notification.createdAt)}
                        </time>
                      </span>
                      <span className="notification-item-action" aria-hidden="true">
                        <ChevronRight />
                      </span>
                    </button>
                  );
                })}
              </div>
            </details>
          ))
        )}
      </div>

      {notifications.length ? (
        <footer className="notification-drawer-footer">
          <span>
            Showing {notifications.length} of {unreadCount}
          </span>
          {pagination.hasNextPage ? (
            <Button type="button" variant="secondary" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? "Loading..." : "Load more"}
            </Button>
          ) : null}
        </footer>
      ) : null}
    </SideDrawer>
  );
}
