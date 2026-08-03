import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("../../app/utils/api", () => ({ request }));
vi.mock("../../app/features/onboarding/OnboardingInitialSteps", () => ({
  OnboardingInitialSteps: (props) => (
    <div>
      <span data-testid="step">{props.step}</span>
      <span>{props.error}</span>
      <button onClick={() => props.validateUpload(new FormData())}>Validate mock</button>
      <button onClick={() => props.runAction("create")}>Run mock</button>
      <button onClick={props.closeBatch}>Close batch</button>
    </div>
  )
}));
vi.mock("../../app/features/onboarding/OnboardingCampaignSteps", () => ({
  OnboardingCampaignSteps: (props) => (
    <div>
      <button onClick={() => props.previewTemplate("t1")}>Preview mock</button>
      <button onClick={() => props.setEditingTemplate({ id: "t1", name: "Activation" })}>Edit mock</button>
      <button onClick={() => props.setConfirmSend(true)}>Confirm mock</button>
    </div>
  )
}));
vi.mock("../../app/features/onboarding/OnboardingUI", () => ({
  WIZARD_PAGE_SIZE: 10,
  Stepper: ({ current }) => <div>Stepper {current}</div>,
  TemplateQuickEditor: ({ onSaved, onClose }) => (
    <div role="dialog" aria-label="Quick editor">
      <button onClick={() => onSaved({ id: "t2" })}>Save template mock</button>
      <button onClick={onClose}>Close editor mock</button>
    </div>
  )
}));
import UserOnboardingWizard from "../../app/components/UserOnboardingWizard";

const user = { id: "admin", name: "Admin" };
const workflow = {
  id: "w1",
  fileName: "users.csv",
  currentStep: "template",
  selectedTemplateId: "t1",
  recipients: [{ id: "r1" }],
  excludedRecipientIds: []
};
beforeEach(() => {
  vi.clearAllMocks();
  request.mockReset();
});

describe("onboarding orchestration", () => {
  it("does not render or request data while closed", () => {
    const { container } = render(<UserOnboardingWizard open={false} user={user} />);
    expect(container).toBeEmptyDOMElement();
    expect(request).not.toHaveBeenCalled();
  });

  it("loads a workflow, previews its template, and closes with Escape", async () => {
    const close = vi.fn();
    request.mockResolvedValueOnce(workflow).mockResolvedValueOnce({ subject: "Welcome" });
    render(<UserOnboardingWizard open workflowId="w1" user={user} templates={[]} onClose={close} />);
    expect(await screen.findByText("Stepper template")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("/api/admin/onboarding/w1");
    expect(request).toHaveBeenCalledWith(expect.stringContaining("/preview?templateId=t1"));
    await userEvent.keyboard("{Escape}");
    expect(close).toHaveBeenCalled();
  });

  it("orchestrates validation, workflow actions, preview, template save, and cancellation", async () => {
    const updated = vi.fn(),
      close = vi.fn();
    request.mockImplementation((url) => {
      if (url === "/api/ui/users/import") return Promise.resolve({ ...workflow, currentStep: "review" });
      if (url.endsWith("/create")) return Promise.resolve({});
      if (url.endsWith("/cancel")) return Promise.resolve({});
      if (url.includes("/preview?templateId=")) return Promise.resolve({ subject: "Preview" });
      if (url === "/api/admin/onboarding/w1") return Promise.resolve(workflow);
      return Promise.reject(new Error("Unexpected " + url));
    });
    render(
      <UserOnboardingWizard open workflowId="w1" user={user} templates={[]} onClose={close} onUpdated={updated} />
    );
    await screen.findByText("Stepper template");
    await userEvent.click(screen.getByRole("button", { name: "Validate mock" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("/api/ui/users/import", expect.objectContaining({ method: "POST" }))
    );
    await userEvent.click(screen.getByRole("button", { name: "Run mock" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringContaining("/create"), expect.anything()));
    await userEvent.click(screen.getByRole("button", { name: "Preview mock" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringContaining("templateId=t1")));
    await userEvent.click(screen.getByRole("button", { name: "Edit mock" }));
    await userEvent.click(screen.getByRole("button", { name: "Save template mock" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringContaining("templateId=t2")));
    await userEvent.click(screen.getByRole("button", { name: "Close batch" }));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(updated).toHaveBeenCalled();
  });

  it("confirms recipients and sends the activation campaign", async () => {
    request.mockImplementation((url) => {
      if (url === "/api/admin/onboarding/w1") return Promise.resolve(workflow);
      if (url.includes("/preview?")) return Promise.resolve({ subject: "Preview" });
      if (url.endsWith("/recipients") || url.endsWith("/send")) return Promise.resolve({});
      return Promise.resolve(workflow);
    });
    render(<UserOnboardingWizard open workflowId="w1" user={user} templates={[]} onClose={vi.fn()} />);
    await screen.findByText("Stepper template");
    await userEvent.click(screen.getByRole("button", { name: "Confirm mock" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm and send" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.stringContaining("/send"), expect.anything()));
  });

  it("shows load errors and opens a fresh upload workflow", async () => {
    request.mockRejectedValueOnce(new Error("Workflow unavailable"));
    const view = render(<UserOnboardingWizard open workflowId="bad" user={user} onClose={vi.fn()} />);
    expect(await screen.findByText("Workflow unavailable")).toBeInTheDocument();
    view.rerender(<UserOnboardingWizard open workflowId="" user={user} onClose={vi.fn()} />);
    expect(await screen.findByTestId("step")).toHaveTextContent("upload");
  });
});
