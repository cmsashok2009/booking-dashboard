import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import AddLookupOptionModal from "../../app/features/bookings/AddLookupOptionModal";

describe("AddLookupOptionModal", () => {
  it("submits a trimmed option without owning the mutation", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AddLookupOptionModal
        open
        fieldLabel="Booking Category"
        error=""
        onClearError={() => {}}
        onClose={() => {}}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText(/Option value/), "  Priority  ");
    await user.click(screen.getByRole("button", { name: "Add option" }));

    expect(onSubmit).toHaveBeenCalledWith("Priority");
  });

  it("uses the shared close contract", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AddLookupOptionModal
        open
        fieldLabel="WS Planning"
        error=""
        onClearError={() => {}}
        onClose={onClose}
        onSubmit={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
