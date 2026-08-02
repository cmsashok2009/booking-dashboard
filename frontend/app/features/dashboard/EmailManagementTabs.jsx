"use client";

import TabbedWorkspace from "../../components/ui/TabbedWorkspace";

export const EMAIL_MANAGEMENT_VIEWS = ["email-settings", "email-templates", "email-delivery"];

const EMAIL_GROUPS = [
  {
    id: "setup",
    label: "Email Setup",
    items: [{ value: "email-settings", label: "Email Configuration" }]
  },
  {
    id: "operations",
    label: "Email Operations",
    items: [
      { value: "email-templates", label: "Message Templates" },
      { value: "email-delivery", label: "Delivery Logs" }
    ]
  }
];

export default function EmailManagementTabs({ activeView, onNavigate, children }) {
  return (
    <TabbedWorkspace
      label="Email Management"
      groups={EMAIL_GROUPS}
      value={activeView}
      onChange={onNavigate}
      idPrefix="email-management"
      className="email-management-workspace"
      canvasClassName="email-management-canvas"
    >
      {children}
    </TabbedWorkspace>
  );
}
