import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const controller = vi.hoisted(() => ({ current: {} }));
vi.mock("../../app/hooks/useDashboardController", () => ({ default: () => controller.current }));
vi.mock("../../app/features/dashboard/DashboardShell", () => ({
  default: ({ state, overlays }) => (
    <div data-testid="shell">
      {state.user.name}
      {overlays}
    </div>
  )
}));
vi.mock("../../app/features/dashboard/DashboardOverlays", () => ({
  default: ({ state }) => <div data-testid="overlays">{state.user.name}</div>
}));
import BookingDashboard from "../../app/booking-dashboard";
import DashboardMetrics from "../../app/features/dashboard/DashboardMetrics";
import DashboardNavigation from "../../app/features/dashboard/DashboardNavigation";
import DashboardShell from "../../app/features/dashboard/DashboardShell";

const user = { name: "Admin", role: "Admin", email: "admin@example.com" };

describe("dashboard entry", () => {
  beforeEach(() => {
    controller.current = { sessionReady: true, sessionError: "", user: null, notice: null, login: vi.fn() };
  });
  it("routes loading, error, login, and authenticated states", async () => {
    controller.current = { sessionReady: false };
    const view = render(<BookingDashboard />);
    expect(screen.getByRole("heading", { name: "Restoring your session" })).toBeInTheDocument();
    controller.current = { sessionReady: true, sessionError: "Offline" };
    view.rerender(<BookingDashboard />);
    expect(screen.getByText("Dashboard connection unavailable")).toBeInTheDocument();
    controller.current = { sessionReady: true, sessionError: "", user: null, notice: null, login: vi.fn() };
    view.rerender(<BookingDashboard />);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    controller.current = {
      sessionReady: true,
      sessionError: "",
      user,
      shellState: { user },
      shellActions: {},
      models: {},
      overlayState: { user },
      overlayActions: {}
    };
    view.rerender(<BookingDashboard />);
    expect(screen.getByTestId("shell")).toHaveTextContent("Admin");
    expect(screen.getByTestId("overlays")).toHaveTextContent("Admin");
  });
});

describe("dashboard composition", () => {
  it("delegates metric selection", async () => {
    const select = vi.fn();
    render(
      <DashboardMetrics
        metrics={[{ filter: "pending", tone: "warn", label: "Pending", value: 4, helper: "Need action" }]}
        onSelect={select}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Pending/ }));
    expect(select).toHaveBeenCalledWith("pending");
  });

  it("gates admin navigation and delegates route selection", async () => {
    const navigate = vi.fn();
    const { rerender } = render(<DashboardNavigation activeView="dashboard" canAdmin={false} onNavigate={navigate} />);
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Booking Management"));
    expect(navigate).toHaveBeenCalledWith("bookings");
    rerender(<DashboardNavigation activeView="users" canAdmin onNavigate={navigate} />);
    expect(screen.getByText("User Management")).toBeInTheDocument();
    expect(screen.getByText("User Management").closest("button")).toHaveClass("active");
  });
});
