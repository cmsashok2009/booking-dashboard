import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import BookingWorkflowPanel from "../../app/features/bookings/BookingWorkflowPanel";

const booking = {
  id: "1",
  salesOrderId: "SOB1001",
  dealerCode: "DLR01",
  contactFirstName: "Ravi",
  contactLastName: "Kumar",
  phoneNumber: "9000000000",
  region: "North",
  model: "DUSTER",
  variant: "Adventure",
  avlStatus: "Available",
  areaInputs: {},
  regionalInputs: {}
};

function renderPanel(overrides = {}) {
  const props = {
    detailFilter: "all",
    bookings: [booking],
    page: 1,
    search: "",
    filters: { region: "", wholesaleInput: "", retailInput: "" },
    regions: ["North", "South"],
    hideRegionFilter: false,
    onSearchChange: vi.fn(),
    onFilterChange: vi.fn(),
    onClear: vi.fn(),
    onRefresh: vi.fn(),
    onOpenBooking: vi.fn(),
    onPageChange: vi.fn(),
    ...overrides
  };
  render(<BookingWorkflowPanel {...props} />);
  return props;
}

describe("BookingWorkflowPanel", () => {
  it("renders booking data and delegates opening the selected record", async () => {
    const user = userEvent.setup();
    const props = renderPanel();
    expect(screen.getByText("SOB1001")).toBeInTheDocument();
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(props.onOpenBooking).toHaveBeenCalledWith(booking);
  });

  it("delegates search and filter changes and enables clear for active input", async () => {
    const user = userEvent.setup();
    const props = renderPanel({ search: "SOB" });
    await user.type(screen.getByLabelText("Search bookings"), "1");
    await user.selectOptions(screen.getByLabelText("Filter bookings by region"), "North");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(props.onSearchChange).toHaveBeenLastCalledWith("SOB1");
    expect(props.onFilterChange).toHaveBeenCalledWith({ region: "North" });
    expect(props.onClear).toHaveBeenCalledOnce();
  });
});
