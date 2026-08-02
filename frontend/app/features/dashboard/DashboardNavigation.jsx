"use client";

import NavigationItem from "../../components/ui/NavigationItem";

const ADMIN_ITEMS = [
  ["area-fields", "Workflow Options"],
  ["users", "Access Management"],
  ["email-templates", "Message Templates"],
  ["email-delivery", "Delivery Logs"],
  ["email-settings", "Email Configuration"]
];

export default function DashboardNavigation({ activeView, canAdmin, onNavigate }) {
  const items = [["dashboard", "Overview"], ["bookings", "Booking Management"], ...(canAdmin ? ADMIN_ITEMS : [])];

  return (
    <nav className="nav" aria-label="Primary">
      {items.map(([view, label]) => (
        <NavigationItem active={activeView === view} onClick={() => onNavigate(view)} key={view}>
          {label}
        </NavigationItem>
      ))}
    </nav>
  );
}
