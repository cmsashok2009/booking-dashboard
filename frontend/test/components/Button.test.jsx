import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Button from "../../app/components/ui/Button";

describe("Button", () => {
  it("uses the requested variant and invokes its action", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="outline" onClick={onClick}>
        Clear
      </Button>
    );

    const button = screen.getByRole("button", { name: "Clear" });
    expect(button).toHaveClass("app-button", "outline");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("prevents interaction while busy", () => {
    render(
      <Button busy busyLabel="Saving">
        Save
      </Button>
    );
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });
});
