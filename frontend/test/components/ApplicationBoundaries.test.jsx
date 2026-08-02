import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AppErrorBoundary from "../../app/components/AppErrorBoundary";
import ConfirmationModal from "../../app/components/ConfirmationModal";
import GlobalApiActivity from "../../app/components/GlobalApiActivity";
import InsightBarChart from "../../app/components/InsightBarChart";
import Pagination from "../../app/components/Pagination";
import ErrorPage from "../../app/error";
import GlobalError from "../../app/global-error";
import Loading from "../../app/loading";

describe("application boundaries", () => {
  it("renders route loading and delegates route error retries", async () => {
    const reset = vi.fn();
    const view = render(<Loading />);
    expect(screen.getByRole("heading", { name: "Loading Booking Dashboard" })).toBeInTheDocument();
    view.rerender(<ErrorPage reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
    view.rerender(<GlobalError reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it("recovers a crashed application subtree", async () => {
    let shouldThrow = true;
    function Child() {
      if (shouldThrow) throw new Error("boom");
      return <div>Recovered child</div>;
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <AppErrorBoundary>
        <Child />
      </AppErrorBoundary>
    );
    expect(screen.getByText(/could not be displayed/i)).toBeInTheDocument();
    shouldThrow = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Recovered child")).toBeInTheDocument();
  });

  it("tracks concurrent global API activity without going negative", () => {
    render(<GlobalApiActivity />);
    expect(screen.queryByText("Updating information")).not.toBeInTheDocument();
    fireEvent(window, new CustomEvent("booking-api-start"));
    fireEvent(window, new CustomEvent("booking-api-start"));
    expect(screen.getByText("Updating information")).toBeInTheDocument();
    fireEvent(window, new CustomEvent("booking-api-end"));
    expect(screen.getByText("Updating information")).toBeInTheDocument();
    fireEvent(window, new CustomEvent("booking-api-end"));
    fireEvent(window, new CustomEvent("booking-api-end"));
    expect(screen.queryByText("Updating information")).not.toBeInTheDocument();
  });
});

describe("shared workflow components", () => {
  it("delegates confirmation actions and disables them while busy", async () => {
    const close = vi.fn(),
      confirm = vi.fn();
    const { rerender } = render(
      <ConfirmationModal
        open
        title="Delete record?"
        description="Permanent"
        detailLabel="Record"
        detailValue="SO1"
        tone="danger"
        onClose={close}
        onConfirm={confirm}
      />
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent("SO1");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(close).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledOnce();
    rerender(<ConfirmationModal open busy title="Working" description="Wait" onClose={close} onConfirm={confirm} />);
    expect(screen.getByRole("button", { name: /Processing/ })).toBeDisabled();
  });

  it("navigates every pagination control and renders ellipses", async () => {
    const change = vi.fn();
    render(<Pagination page={5} totalRows={100} onPageChange={change} />);
    expect(screen.getByText("41-50 of 100")).toBeInTheDocument();
    expect(screen.getAllByText("...").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByTitle("First page"));
    await userEvent.click(screen.getByTitle("Previous page"));
    await userEvent.click(screen.getByTitle("Next page"));
    await userEvent.click(screen.getByTitle("Last page"));
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(change.mock.calls.map(([value]) => value)).toEqual([1, 4, 6, 10, 3]);
  });

  it("renders calculated, explicit, and empty insight charts", () => {
    const { rerender } = render(
      <InsightBarChart
        title="Regions"
        subtitle="Mix"
        total={4}
        items={[
          { label: "North", value: 1 },
          { label: "South", value: 3, percentage: 80, displayValue: "Three", tone: "green" }
        ]}
      />
    );
    expect(screen.getByRole("img", { name: "North: 1, 25%" })).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
    rerender(<InsightBarChart title="Regions" subtitle="Mix" total={0} items={[]} />);
    expect(screen.getByText("No booking data available.")).toBeInTheDocument();
  });
});
