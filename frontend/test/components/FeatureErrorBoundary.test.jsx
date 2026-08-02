import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FeatureErrorBoundary from "../../app/components/FeatureErrorBoundary";

function BrokenFeature({ broken }) {
  if (broken) throw new Error("Synthetic failure");
  return <p>Recovered content</p>;
}

describe("FeatureErrorBoundary", () => {
  it("isolates a render failure and retries the section", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    let broken = true;

    const { rerender } = render(
      <FeatureErrorBoundary name="Bookings">
        <BrokenFeature broken={broken} />
      </FeatureErrorBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Bookings is temporarily unavailable");
    broken = false;
    rerender(
      <FeatureErrorBoundary name="Bookings">
        <BrokenFeature broken={broken} />
      </FeatureErrorBoundary>
    );
    await user.click(screen.getByRole("button", { name: "Retry section" }));
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
