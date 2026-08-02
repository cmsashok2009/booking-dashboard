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
  render(<BookingImportModal {...props} />);
  return props;
}

describe("BookingImportModal", () => {
  it("renders the parsed preview without changing its values", () => {
    renderModal();
    expect(screen.getByRole("heading", { name: "Upload bookings" })).toBeInTheDocument();
    expect(screen.getByText("SOB1001")).toBeInTheDocument();
    expect(screen.getByText("North")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload 1 preview rows" })).toBeInTheDocument();
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
