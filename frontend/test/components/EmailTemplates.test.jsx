import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../app/utils/api", () => ({ request }));

import EmailTemplatesView from "../../app/components/EmailTemplatesView";
import { EditorEmailPreview, SampleTemplatePreview, TemplateEditor } from "../../app/components/EmailTemplateDialogs";

const sample = {
  id: "s1",
  name: "Starter",
  type: "activation",
  description: "Default invitation",
  subject: "Welcome {{user_name}}",
  bodyText: "Activate at {{activation_link}}",
  reviewedAt: "2026-08-01T10:00:00Z"
};
const template = {
  id: "t1",
  name: "Organization Activation",
  type: "activation",
  subject: "Welcome",
  bodyText: "Activate now",
  bodyHtml: "",
  status: "active",
  version: 2,
  updatedAt: "2026-08-01T10:00:00Z"
};

beforeEach(() => {
  vi.clearAllMocks();
  request.mockReset();
});

describe("email template management", () => {
  function props(overrides = {}) {
    return {
      user: { id: "u1" },
      samples: [sample],
      templates: [template],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNextPage: false },
      summary: { total: 1, active: 1, draft: 0 },
      filters: { search: "", status: "" },
      page: 1,
      setPage: vi.fn(),
      updateFilters: vi.fn(),
      reload: vi.fn(),
      onReload: vi.fn(),
      onReturnToOnboarding: vi.fn(),
      setNotice: vi.fn(),
      ...overrides
    };
  }

  it("previews and clones a starter template into the editor", async () => {
    const values = props({ returnWorkflowId: "w1" });
    request.mockResolvedValueOnce(template);
    render(<EmailTemplatesView {...values} />);
    expect(screen.getByText("Onboarding is paused at template selection")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Preview" })[0]);
    expect(screen.getByText("Welcome Ravi Kumar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Use this template" }));
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining("/clone"),
      expect.objectContaining({ method: "POST" })
    );
    expect(screen.getByRole("heading", { name: "Edit activation email" })).toBeInTheDocument();
    expect(values.onReload).toHaveBeenCalledOnce();
  });

  it("edits, previews, and saves an active organization template", async () => {
    const values = props({ returnWorkflowId: "w1" });
    request.mockResolvedValueOnce({ ...template, name: "Updated" });
    render(<EmailTemplatesView {...values} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.clear(screen.getByLabelText(/template name/i));
    await userEvent.type(screen.getByLabelText(/template name/i), "Updated");
    await userEvent.click(screen.getByRole("button", { name: "Preview email" }));
    expect(screen.getByRole("heading", { name: "Email preview" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to editor" }));
    await userEvent.click(screen.getByRole("button", { name: "Save template" }));
    expect(values.onReturnToOnboarding).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated" }));
  });

  it("shows server errors and empty library states", async () => {
    request.mockRejectedValueOnce({
      message: "Invalid",
      payload: { errors: [{ field: "subject", message: "Subject rejected" }] }
    });
    const { unmount } = render(<EmailTemplatesView {...props()} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Save template" }));
    expect(screen.getByText("Subject rejected")).toBeInTheDocument();
    unmount();
    render(<EmailTemplatesView {...props({ samples: [], templates: [] })} />);
    expect(screen.getByText("No starter templates available")).toBeInTheDocument();
    expect(screen.getByText("No organization templates yet")).toBeInTheDocument();
  });

  it("delegates server filters and renders controlled paging and recovery states", async () => {
    const values = props({
      templates: Array.from({ length: 10 }, (_, index) => ({
        ...template,
        id: `t${index}`,
        name: `Template ${index}`
      })),
      pagination: { page: 1, pageSize: 10, total: 12, totalPages: 2, hasNextPage: true },
      summary: { total: 12, active: 8, draft: 4 }
    });
    const view = render(<EmailTemplatesView {...values} />);
    expect(screen.getByText("8 active templates are available for user onboarding.")).toBeInTheDocument();
    expect(screen.getByText("1-10 of 12")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("Search name or subject"), "Welcome");
    expect(values.updateFilters).toHaveBeenCalledWith({ search: "W" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Status" }), "draft");
    expect(values.updateFilters).toHaveBeenLastCalledWith({ status: "draft" });
    await userEvent.click(screen.getByTitle("Next page"));
    expect(values.setPage).toHaveBeenCalledWith(2);

    view.rerender(<EmailTemplatesView {...props({ templates: [], loading: true })} />);
    expect(screen.getByRole("heading", { name: "Loading organization templates" })).toBeInTheDocument();
    const retry = vi.fn();
    view.rerender(<EmailTemplatesView {...props({ templates: [], error: "Dependency unavailable", reload: retry })} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it("normalizes clone errors and supports returning to onboarding", async () => {
    const values = props({ returnWorkflowId: "w1" });
    request.mockRejectedValueOnce(new Error("Clone failed"));
    render(<EmailTemplatesView {...values} />);
    await userEvent.click(screen.getByRole("button", { name: "Return to onboarding" }));
    expect(values.onReturnToOnboarding).toHaveBeenCalledWith();
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await userEvent.click(screen.getByRole("button", { name: "Use this template" }));
    expect(values.setNotice).toHaveBeenCalledWith({ type: "error", message: "Clone failed" });
  });
});

describe("email template dialog states", () => {
  it("supports explicit close actions and editor validation rendering", async () => {
    const onClose = vi.fn();
    const onClone = vi.fn();
    const { unmount } = render(
      <SampleTemplatePreview preview={sample} busy={false} onClose={onClose} onClone={onClone} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
    unmount();

    render(
      <TemplateEditor
        editor={template}
        setEditor={vi.fn()}
        busy={false}
        errors={[{ field: "name", message: "Required" }]}
        previewOpen={false}
        onPreview={vi.fn()}
        onClose={onClose}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });

  it("renders fallback content in a live editor preview", () => {
    render(<EditorEmailPreview editor={{ subject: "", bodyText: "" }} open onClose={vi.fn()} />);
    expect(screen.getByText("No subject entered")).toBeInTheDocument();
    expect(screen.getByText("No plain-text message entered.")).toBeInTheDocument();
  });
});
