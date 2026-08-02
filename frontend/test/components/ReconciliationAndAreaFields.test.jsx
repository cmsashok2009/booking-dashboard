import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { seedData } from "../../../backend/src/validators";
import ReconciliationDashboard from "../../app/components/ReconciliationDashboard";
import AreaFieldsWorkspace from "../../app/features/area-fields/AreaFieldsWorkspace";

describe("reconciliation dashboard", () => {
  it("renders admin charts, heatmap, insights, and actionable exceptions", async () => {
    const onOpenBooking = vi.fn();
    render(<ReconciliationDashboard bookings={seedData().bookings} onOpenBooking={onOpenBooking} viewerRole="Admin" />);
    expect(screen.getByRole("heading", { name: "Fulfillment overview" })).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: /booking counts/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Operational insights" })).toBeInTheDocument();
    const viewButtons = screen.getAllByRole("button", { name: "View booking" });
    await userEvent.click(viewButtons[0]);
    expect(onOpenBooking).toHaveBeenCalledOnce();
  });

  it("renders manager charts and role-owned exception actions", () => {
    render(
      <ReconciliationDashboard
        bookings={seedData().bookings}
        onOpenBooking={vi.fn()}
        mode="manager"
        viewerRole="Regional Manager"
      />
    );
    expect(screen.queryByRole("grid", { name: /booking counts/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backlog aging" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Review booking" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/your role/).length).toBeGreaterThan(0);
  });

  it("shows a clear status when no bookings are exceptional", () => {
    render(<ReconciliationDashboard bookings={[]} onOpenBooking={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "No critical exceptions" })).toBeInTheDocument();
    expect(screen.getByText("0 bookings in scope")).toBeInTheDocument();
  });
});

describe("Area Fields workspace", () => {
  const options = [
    { id: "o1", label: "Priority", status: "active" },
    { id: "o2", label: "Fleet", status: "inactive" }
  ];
  function props(overrides = {}) {
    return {
      selectedField: "bookingCategory",
      options,
      search: "",
      status: "",
      editingId: null,
      draft: "",
      onFieldChange: vi.fn(),
      onSearchChange: vi.fn(),
      onStatusChange: vi.fn(),
      onStartEdit: vi.fn(),
      onDraftChange: vi.fn(),
      onCancelEdit: vi.fn(),
      onUpdateOption: vi.fn(),
      onOpenAdd: vi.fn(),
      ...overrides
    };
  }

  it("shows built-in roles first as read-only access data", async () => {
    const roles = [
      { id: "AM", code: "AM", label: "Area Manager", status: "active" },
      { id: "RM", code: "RM", label: "Regional Manager", status: "active" },
      { id: "ALL_INDIA_I", code: "ALL_INDIA_I", label: "All India I", status: "active" },
      { id: "ALL_INDIA_II", code: "ALL_INDIA_II", label: "All India II", status: "active" },
      { id: "ALL_INDIA", code: "ALL_INDIA", label: "All India", status: "active" },
      { id: "ADMIN", code: "ADMIN", label: "Admin", status: "active" }
    ];
    render(<AreaFieldsWorkspace {...props({ selectedField: "roles", options: roles })} />);
    expect(screen.getByRole("tab", { name: "Roles" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tab")[2]).toHaveAccessibleName("Roles");
    expect(screen.getByText("Area Manager")).toBeInTheDocument();
    expect(screen.getByText("Application administration")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
  });
  it("changes field, filters, clears, opens add, edits, and deactivates", async () => {
    const values = props({ search: "pri" });
    render(<AreaFieldsWorkspace {...values} />);
    await userEvent.click(screen.getByRole("tab", { name: "Wholesales Feedback" }));
    await userEvent.type(screen.getByLabelText("Search Booking Category"), "x");
    await userEvent.selectOptions(screen.getByLabelText("Filter values by status"), "active");
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    await userEvent.click(screen.getByRole("button", { name: "Add option" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(values.onFieldChange).toHaveBeenCalledWith("wholesalesFeedback");
    expect(values.onOpenAdd).toHaveBeenCalledOnce();
    expect(values.onStartEdit).toHaveBeenCalledWith(options[0]);
    expect(values.onUpdateOption).toHaveBeenCalledWith(
      "o1",
      { label: "Priority", status: "inactive" },
      "Booking Category option deactivated."
    );
  });

  it("validates and saves edited labels or cancels", async () => {
    const empty = props({ editingId: "o1", draft: "" });
    const { unmount } = render(<AreaFieldsWorkspace {...empty} />);
    expect(screen.getByText("Option value is required.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    unmount();

    const values = props({ editingId: "o1", draft: "  Urgent  " });
    render(<AreaFieldsWorkspace {...values} />);
    await userEvent.type(screen.getByLabelText("Edit Priority"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(values.onDraftChange).toHaveBeenCalled();
    expect(values.onUpdateOption).toHaveBeenCalledWith("o1", { label: "Urgent" }, "Booking Category option saved.");
    expect(values.onCancelEdit).toHaveBeenCalledOnce();
  });

  it("shows filtered empty state and reactivates inactive options", async () => {
    const values = props({ search: "missing" });
    const { rerender } = render(<AreaFieldsWorkspace {...values} />);
    expect(screen.getByText("No options match the current filters.")).toBeInTheDocument();
    rerender(<AreaFieldsWorkspace {...props({ status: "inactive" })} />);
    await userEvent.click(screen.getByRole("button", { name: "Reactivate" }));
  });
});
