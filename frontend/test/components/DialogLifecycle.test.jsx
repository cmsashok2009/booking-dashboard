import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ModalShell from "../../app/components/ui/ModalShell";
import SideDrawer from "../../app/components/ui/SideDrawer";

describe("dialog lifecycle", () => {
  it("moves focus into a modal, traps Tab, closes on Escape, and restores focus", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    trigger.textContent = "Trigger";
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <ModalShell onClose={onClose} ariaLabelledBy="modal-title">
        <h2 id="modal-title">Test modal</h2>
        <button data-dialog-focus>First</button>
        <button>Last</button>
      </ModalShell>
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "First" })).toHaveFocus());
    screen.getByRole("button", { name: "Last" }).focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    await waitFor(() => expect(trigger).toHaveFocus());
    trigger.remove();
  });

  it("applies equivalent dialog semantics to side drawers", () => {
    render(
      <SideDrawer labelledBy="drawer-title" onClose={() => {}}>
        <h2 id="drawer-title">Details</h2>
        <button>Close</button>
      </SideDrawer>
    );

    expect(screen.getByRole("dialog", { name: "Details" })).toHaveAttribute("aria-modal", "true");
  });
});
