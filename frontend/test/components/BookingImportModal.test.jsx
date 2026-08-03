import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import BookingImportModal from "../../app/features/bookings/BookingImportModal";

const preview = {
  fileName: "bookings.csv",
  headers: ["Sales Order ID", "Region"],
  rows: [["SOB1001", "North"]]
};

function renderModal(overrides = {}) {
  const props = {
    open: true,
    preview,
    pendingUpload: { fileName: "bookings.csv", content: "data" },
    onChooseFile: vi.fn(),
    onClose: vi.fn(),
    onLoadSample: vi.fn(),
    onRemoveFile: vi.fn(),
    onUpload: vi.fn(),
    ...overrides
  };
  const view = render(<BookingImportModal {...props} />);
  return { ...props, ...view };
}

describe("BookingImportModal", () => {
  it("renders the parsed preview without changing its values", () => {
    renderModal();
    expect(screen.getByRole("heading", { name: "Upload bookings" })).toBeInTheDocument();
    expect(screen.getByText("Booking CSV ready")).toBeInTheDocument();
    expect(screen.getByText("bookings.csv - validated before import")).toBeInTheDocument();
    expect(screen.getByText("Replace file")).toBeInTheDocument();
    expect(screen.getByText("SOB1001")).toBeInTheDocument();
    expect(screen.getByText("North")).toHaveAttribute("title", "North");
    expect(document.querySelector(".booking-preview-empty-overlay")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload 1 preview rows" })).toBeInTheDocument();
  });

  it("expands columns from sampled content within safe bounds", () => {
    const { container } = renderModal({
      preview: {
        fileName: "bookings.csv",
        headers: ["AM", "Retail Input"],
        rows: [["ashok", "Retail follow-up planned for North region."]]
      }
    });
    const table = container.querySelector(".booking-preview-table table");
    const columns = container.querySelectorAll(".booking-preview-table col");
    const columnWidths = [...columns].map((column) => Number.parseInt(column.style.width, 10));

    expect(columnWidths[0]).toBeLessThan(columnWidths[1]);
    expect(columnWidths[1]).toBeGreaterThanOrEqual(280);
    expect(columnWidths[1]).toBeLessThanOrEqual(340);
    expect(Number.parseInt(table.style.width, 10)).toBe(columnWidths.reduce((total, width) => total + width, 0));
  });

  it("shows the booking table structure before a file is selected", () => {
    renderModal({ preview: null, pendingUpload: null });

    expect(screen.getByRole("columnheader", { name: "Dealer Code" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "COMB1" })).toBeInTheDocument();
    expect(screen.getByText("No data found")).toBeInTheDocument();
    expect(screen.getByText("No data found").closest(".booking-preview-empty-overlay")).toBeInTheDocument();
    expect(screen.getByText("Choose a CSV or use sample data to preview bookings.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Upload .* preview rows/ })).not.toBeInTheDocument();
  });

  it("delegates sample, remove, upload, and close actions", async () => {
    const user = userEvent.setup();
    const props = renderModal();
    await user.click(screen.getByRole("button", { name: "Use sample data" }));
    await user.click(screen.getByRole("button", { name: "Remove file" }));
    await user.click(screen.getByRole("button", { name: "Upload 1 preview rows" }));
    await user.click(screen.getByRole("button", { name: "Close booking upload" }));
    expect(props.onLoadSample).toHaveBeenCalledOnce();
    expect(props.onRemoveFile).toHaveBeenCalledOnce();
    expect(props.onUpload).toHaveBeenCalledOnce();
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
