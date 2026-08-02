import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ErrorState from "../../app/components/ui/ErrorState";

describe("ErrorState", () => {
  it("can render an in-place recovery without a dashboard link", () => {
    render(<ErrorState title="Feature unavailable" onRetry={() => {}} showHome={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Feature unavailable");
    expect(screen.queryByRole("link", { name: /return to dashboard/i })).not.toBeInTheDocument();
  });
});
