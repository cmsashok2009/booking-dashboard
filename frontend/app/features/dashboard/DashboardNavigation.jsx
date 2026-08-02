"use client";

import NavigationItem from "../../components/ui/NavigationItem";

const ADMIN_ITEMS = [
  ["users", "User Management"],
  ["area-fields", "Business Settings"],
  ["email-settings", "Email Management"]
];

export default function DashboardNavigation({ activeView, canAdmin, onNavigate }) {
  const items = [["dashboard", "Overview"], ["bookings", "Booking Management"], ...(canAdmin ? ADMIN_ITEMS : [])];

  return (
    <nav className="nav" aria-label="Primary">
      {items.map(([view, label]) => (
        <NavigationItem active={activeView === view || (view === "email-settings" && ["email-templates", "email-delivery"].includes(activeView))} onClick={() => onNavigate(view)} key={view}>
          {label}
        </NavigationItem>
      ))}
    </nav>
  );
}
