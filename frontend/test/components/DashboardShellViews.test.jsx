import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("../../app/components/BrandLogo", () => ({ default: () => <div>Brand</div> }));
vi.mock("../../app/components/Topbar", () => ({ default: ({ title }) => <h1>{title}</h1> }));
vi.mock("../../app/components/FeatureErrorBoundary", () => ({ default: ({ children }) => <>{children}</> }));
vi.mock("../../app/components/InsightBarChart", () => ({ default: ({ title }) => <div>Chart {title}</div> }));
vi.mock("../../app/components/ReconciliationDashboard", () => ({
  default: ({ mode }) => <div>Reconciliation {mode}</div>
}));
vi.mock("../../app/components/EmailTemplatesView", () => ({ default: () => <div>Templates view</div> }));
vi.mock("../../app/components/EmailDeliveryView", () => ({ default: () => <div>Delivery view</div> }));
vi.mock("../../app/components/EmailSettingsView", () => ({ default: () => <div>Settings view</div> }));
vi.mock("../../app/features/area-fields", () => ({ AreaFieldsWorkspace: () => <div>Area fields view</div> }));
vi.mock("../../app/features/bookings", () => ({
  BookingWorkspace: () => <div>Bookings view</div>,
  BookingDetailsDrawer: () => <div>Booking drawer</div>,
  BookingImportModal: () => <div>Import modal</div>
}));
vi.mock("../../app/features/users", () => ({
  UsersWorkspace: () => <div>Users view</div>,
  SingleUserModal: () => <div>Single user modal</div>
}));
vi.mock("../../app/features/bookings/AddLookupOptionModal", () => ({ default: () => <div>Lookup modal</div> }));
vi.mock("../../app/components/ChangePasswordModal", () => ({ default: () => <div>Password modal</div> }));
vi.mock("../../app/components/ConfirmationModal", () => ({ default: () => <div>Confirmation modal</div> }));
vi.mock("../../app/components/NotificationDrawer", () => ({ default: () => <div>Notification drawer</div> }));
vi.mock("../../app/components/ProfilePhotoModal", () => ({ default: () => <div>Photo modal</div> }));

import DashboardOverlays from "../../app/features/dashboard/DashboardOverlays";
import DashboardShell from "../../app/features/dashboard/DashboardShell";

const actions = new Proxy({}, { get: () => vi.fn() });
const baseState = {
  user: { id: "a1", name: "Admin", role: "Admin" },
  canAdmin: true,
  notice: null,
  notifications: [],
  notificationDrawerOpen: false
};
const models = {
  dashboard: { metrics: [], insights: [{ title: "Regions", items: [] }] },
  bookings: { rows: [], detailFilter: "all", workspace: {} },
  areaFields: {},
  users: {},
  email: { templates: {}, campaigns: [], settings: {} }
};

describe("dashboard shell view routing", () => {
  for (const [view, expected] of [
    ["dashboard", "Reconciliation admin"],
    ["bookings", "Bookings view"],
    ["area-fields", "Area fields view"],
    ["users", "Users view"],
    ["email-templates", "Templates view"],
    ["email-delivery", "Delivery view"],
    ["email-settings", "Settings view"]
  ]) {
    it("renders " + view, async () => {
      render(
        <DashboardShell
          state={{ ...baseState, activeView: view }}
          actions={actions}
          models={models}
          overlays={<div>Overlays</div>}
        />
      );
      expect(await screen.findByText(expected)).toBeInTheDocument();
      expect(screen.getByText("Overlays")).toBeInTheDocument();
    });
  }

  it("orders Email Management tabs from setup to delivery", () => {
    render(<DashboardShell state={{ ...baseState, activeView: "email-settings" }} actions={actions} models={models} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Email Setup", "Email Operations", "Email Configuration"]);
    expect(screen.getByRole("tab", { name: "Email Setup" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Email Configuration" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Delivery Logs" })).not.toBeInTheDocument();
  });
  it("uses manager dashboard copy and hides admin insights/navigation", async () => {
    render(
      <DashboardShell
        state={{
          ...baseState,
          activeView: "dashboard",
          canAdmin: false,
          user: { id: "m1", name: "Manager", role: "Area Manager" }
        }}
        actions={actions}
        models={models}
      />
    );
    expect(await screen.findByText("Reconciliation manager")).toBeInTheDocument();
    expect(screen.queryByText("Chart Regions")).not.toBeInTheDocument();
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
  });
});

describe("dashboard overlays", () => {
  it("composes all modal and drawer boundaries with complete defaults", () => {
    const state = {
      user: baseState.user,
      changePasswordOpen: false,
      profilePhotoOpen: false,
      singleUserModalOpen: false,
      bootstrap: null,
      singleUserRole: "",
      singleUserErrors: {},
      selectedBooking: null,
      canAreaEdit: false,
      canRegionalEdit: false,
      addOptionModalOpen: false,
      selectedAreaField: "bookingCategory",
      addOptionError: "",
      bookingUploadModalOpen: false,
      uploadPreview: null,
      pendingBookingUpload: null,
      notificationDrawerOpen: false,
      notifications: [],
      abortWorkflow: null,
      abortingWorkflow: false
    };
    render(<DashboardOverlays state={state} actions={actions} />);
    for (const label of [
      "Password modal",
      "Photo modal",
      "Single user modal",
      "Booking drawer",
      "Lookup modal",
      "Import modal",
      "Notification drawer",
      "Confirmation modal"
    ])
      expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("passes populated bootstrap and workflow state", () => {
    const state = {
      user: baseState.user,
      changePasswordOpen: true,
      profilePhotoOpen: true,
      singleUserModalOpen: true,
      bootstrap: { roles: ["Admin"], regions: ["North"], roleDefinitions: [], lookups: {} },
      singleUserRole: "Admin",
      singleUserErrors: {},
      selectedBooking: { id: "b1" },
      canAreaEdit: true,
      canRegionalEdit: true,
      addOptionModalOpen: true,
      selectedAreaField: "bookingCategory",
      addOptionError: "",
      bookingUploadModalOpen: true,
      uploadPreview: {},
      pendingBookingUpload: {},
      notificationDrawerOpen: true,
      notifications: [{}],
      abortWorkflow: { fileName: "users.csv" },
      abortingWorkflow: true
    };
    render(<DashboardOverlays state={state} actions={actions} />);
    expect(screen.getByText("Confirmation modal")).toBeInTheDocument();
  });
});
