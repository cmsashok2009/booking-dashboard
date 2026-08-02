import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BookingDetailsDrawer from "../../app/features/bookings/BookingDetailsDrawer";
import BookingSourcePanel from "../../app/features/bookings/BookingSourcePanel";
import BookingWorkspace from "../../app/features/bookings/BookingWorkspace";

const booking = {
  id: "b1",
  dealerCode: "DLR017",
  contactFirstName: "Suresh",
  contactLastName: "Rao",
  phoneNumber: "9876000017",
  salesOrderId: "SOB10017",
  creationDate: "2026-06-18",
  dealerGroup: "GRP05",
  amNameFromFile: "AM North",
  region: "North",
  category: "priority",
  model: "New DUSTER",
  variant: "Adventure",
  colorMapped: "MRED",
  cat: "NEW",
  vinYear: "VIN26",
  matchedStatus: "MATCHED",
  avlStatus: "Available",
  rposOrderStatus: "Open",
  rpassBkg: "Yes",
  comb1: "Ready",
  areaInputs: {
    bookingCategory: "Confirmed",
    wholesalesFeedback: "Allocated",
    wsPlanning: "Week 2",
    expectedRetailDate: "2026-08-15",
    cancellationReason: ""
  },
  regionalInputs: { wholesaleInput: "Proceed", retailInput: "Customer ready" }
};

const filters = { search: "", region: "", workflow: "" };

describe("booking workspace", () => {
  it("delegates admin view and file actions", async () => {
    const onViewChange = vi.fn();
    const onDownload = vi.fn();
    const onOpenUpload = vi.fn();
    render(
      <BookingWorkspace
        view="workflow"
        canAdmin
        workflow={{ bookings: [], page: 1, search: "", filters: {}, regions: [] }}
        source={{ bookings: [], filters, page: 1, regions: [], onFilterChange: vi.fn(), onPageChange: vi.fn() }}
        onViewChange={onViewChange}
        onDownload={onDownload}
        onOpenUpload={onOpenUpload}
      />
    );
    await userEvent.click(screen.getByRole("tab", { name: "Excel source view" }));
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(screen.getByRole("button", { name: "Upload bookings" }));
    expect(onViewChange).toHaveBeenCalledWith("excel");
    expect(onDownload).toHaveBeenCalledOnce();
    expect(onOpenUpload).toHaveBeenCalledOnce();
  });

  it("keeps source controls hidden from non-admin users", () => {
    render(
      <BookingWorkspace
        view="excel"
        canAdmin={false}
        workflow={{ bookings: [], page: 1, search: "", filters: {}, regions: [] }}
        source={{}}
        onViewChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("tab", { name: "Excel source view" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export" })).not.toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "booking-workflow-panel");
  });
});

describe("booking source panel", () => {
  it("emits filter changes and clears active filters", async () => {
    const onFilterChange = vi.fn();
    render(
      <BookingSourcePanel
        bookings={[booking]}
        filters={{ search: "SOB", region: "North", workflow: "" }}
        page={1}
        regions={["North", "South"]}
        onFilterChange={onFilterChange}
        onPageChange={vi.fn()}
      />
    );
    expect(screen.getByText("SOB10017")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search Excel content"), "1");
    await userEvent.selectOptions(screen.getByLabelText("Filter Excel content by region"), "South");
    await userEvent.selectOptions(screen.getByLabelText("Filter Excel content by workflow"), "pending");
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onFilterChange).toHaveBeenCalledWith({ search: "SOB1" });
    expect(onFilterChange).toHaveBeenCalledWith({ region: "South" });
    expect(onFilterChange).toHaveBeenCalledWith({ workflow: "pending" });
    expect(onFilterChange).toHaveBeenLastCalledWith({ search: "", region: "", workflow: "" });
  });

  it("shows the empty state and disables a redundant clear", () => {
    render(
      <BookingSourcePanel
        bookings={[booking]}
        filters={{ ...filters, search: "missing" }}
        page={99}
        regions={["North"]}
        onFilterChange={vi.fn()}
        onPageChange={vi.fn()}
      />
    );
    expect(screen.getByText("No records match the current Excel filters.")).toBeInTheDocument();
    expect(screen.getByText("0 of 1 records")).toBeInTheDocument();
  });
});

describe("booking details drawer", () => {
  it("returns nothing without a selected booking", () => {
    const { container } = render(<BookingDetailsDrawer booking={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("supports Area Manager edits while hiding regional inputs", async () => {
    const onClose = vi.fn();
    const onSaveArea = vi.fn((event) => event.preventDefault());
    render(
      <BookingDetailsDrawer
        booking={booking}
        lookups={{ bookingCategory: ["Confirmed"], wholesalesFeedback: ["Allocated"], wsPlanning: ["Week 2"] }}
        role="Area Manager"
        canEditArea
        canEditRegional={false}
        onClose={onClose}
        onSaveArea={onSaveArea}
      />
    );
    expect(screen.getByRole("heading", { name: "Booking Details" })).toBeInTheDocument();
    expect(screen.getByLabelText("Booking Category")).toHaveValue("Confirmed");
    expect(screen.queryByText("Regional Manager Inputs")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save Area Inputs" }));
    await userEvent.click(screen.getByRole("button", { name: "Close booking details" }));
    expect(onSaveArea).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows admin data as readonly", () => {
    render(
      <BookingDetailsDrawer
        booking={booking}
        role="Admin"
        canEditArea={false}
        canEditRegional={false}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Area Manager Inputs")).toBeInTheDocument();
    expect(screen.getByText("Regional Manager Inputs")).toBeInTheDocument();
    expect(screen.getByText("Proceed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
  });

  it("submits Regional Manager inputs", async () => {
    const onSaveRegional = vi.fn((event) => event.preventDefault());
    render(
      <BookingDetailsDrawer
        booking={booking}
        role="Regional Manager"
        canEditArea={false}
        canEditRegional
        onClose={vi.fn()}
        onSaveRegional={onSaveRegional}
      />
    );
    expect(screen.getByLabelText("Wholesale Input")).toHaveValue("Proceed");
    await userEvent.click(screen.getByRole("button", { name: "Save Regional Inputs" }));
    expect(onSaveRegional).toHaveBeenCalledOnce();
  });
});
