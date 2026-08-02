"use client";

import { useEffect, useMemo } from "react";
import CloseButton from "./ui/CloseButton";

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

export default function NotificationDrawer({ open, notifications, onClose, onOpenNotification }) {
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

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="notification-drawer-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="notification-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-drawer-title"
      >
        <header className="notification-drawer-header">
          <div>
            <h2 id="notification-drawer-title">Notifications</h2>
            <p>
              {notifications.length
                ? `${notifications.length} unread update${notifications.length === 1 ? "" : "s"}`
                : "You are all caught up"}
            </p>
          </div>
          <CloseButton className="drawer-close-button" onClick={onClose} label="Close notifications" />
        </header>

        <div className="notification-drawer-content">
          {!groups.length ? (
            <div className="notification-empty">
              <span className="notification-empty-icon" aria-hidden="true">
                ✓
              </span>
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
                  {items.map((notification) => (
                    <button
                      className="notification-item"
                      type="button"
                      key={notification.id}
                      onClick={() => onOpenNotification(notification)}
                    >
                      <span className="notification-item-dot" aria-hidden="true" />
                      <span className="notification-item-body">
                        <span className="notification-item-title">
                          {notification.title || `${notification.actorName} updated ${notification.salesOrderId}`}
                        </span>
                        <span className="notification-item-meta">
                          {notification.changedFields.map((field) => field.label).join(", ")}
                        </span>
                        <span className="notification-item-footer">
                          <span>{formatTimestamp(notification.createdAt)}</span>
                          <span>
                            Open booking <span aria-hidden="true">-&gt;</span>
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
