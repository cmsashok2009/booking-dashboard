import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../app/utils/api", () => ({ request }));

import { Stepper, Summary, TemplateQuickEditor, WizardPagination } from "../../app/features/onboarding/OnboardingUI";

beforeEach(() => vi.clearAllMocks());

describe("onboarding shared UI", () => {
  it("renders summary values and step progress", () => {
    render(
      <>
        <Summary summary={{ total: 5, created: 2, skippedExisting: 1, invalid: 1, failed: 1 }} />
        <Stepper current="recipients" />
      </>
    );
    expect(screen.getByText("Total rows").nextSibling).toHaveTextContent("5");
    expect(screen.getByText("Created").nextSibling).toHaveTextContent("2");
    expect(screen.getByText("Recipients").closest("li")).toHaveClass("current");
    expect(screen.getByText("Validate").closest("li")).toHaveClass("complete");
  });

  it("paginates with first, previous, numbered, next, and last actions", async () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<WizardPagination page={3} totalRows={40} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByTitle("First page"));
    await userEvent.click(screen.getByTitle("Previous page"));
    await userEvent.click(screen.getByTitle("Next page"));
    await userEvent.click(screen.getByTitle("Last page"));
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    expect(onPageChange.mock.calls.map(([page]) => page)).toEqual([1, 2, 4, 8, 2]);
    rerender(<WizardPagination page={1} totalRows={3} onPageChange={onPageChange} />);
    expect(screen.queryByTitle("Next page")).not.toBeInTheDocument();
  });
});

describe("template quick editor", () => {
  const template = {
    id: "t1",
    name: "Activation",
    subject: "Welcome",
    bodyText: "Activate",
    bodyHtml: "",
    status: "active"
  };
  const props = (overrides = {}) => ({
    template,
    user: { id: "u1" },
    onClose: vi.fn(),
    onSaved: vi.fn(),
    setNotice: vi.fn(),
    ...overrides
  });

  it("closes without a request when unchanged", async () => {
    const values = props();
    render(<TemplateQuickEditor {...values} />);
    expect(screen.getByText("No changes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(request).not.toHaveBeenCalled();
    expect(values.onClose).toHaveBeenCalledOnce();
  });

  it("validates required fields before closing", async () => {
    const values = props();
    render(<TemplateQuickEditor {...values} />);
    await userEvent.clear(screen.getByLabelText(/template name/i));
    await userEvent.clear(screen.getByLabelText(/email subject/i));
    await userEvent.clear(screen.getByLabelText(/plain-text message/i));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(values.setNotice).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });

  it("saves dirty content and reports server validation errors", async () => {
    const values = props();
    request.mockResolvedValueOnce({ ...template, name: "Updated" });
    const { unmount } = render(<TemplateQuickEditor {...values} />);
    await userEvent.clear(screen.getByLabelText(/template name/i));
    await userEvent.type(screen.getByLabelText(/template name/i), "Updated");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(values.onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated" }));
    unmount();

    const failed = props();
    request.mockRejectedValueOnce({
      message: "Invalid",
      payload: { errors: [{ field: "subject", message: "Bad subject" }] }
    });
    render(<TemplateQuickEditor {...failed} />);
    await userEvent.type(screen.getByLabelText(/template name/i), " changed");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("Bad subject")).toBeInTheDocument();
    expect(failed.setNotice).toHaveBeenCalledWith({ type: "error", message: "Invalid" });
  });
});
