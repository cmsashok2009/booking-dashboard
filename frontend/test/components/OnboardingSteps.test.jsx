import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OnboardingInitialSteps } from "../../app/features/onboarding/OnboardingInitialSteps";
import { OnboardingCampaignSteps } from "../../app/features/onboarding/OnboardingCampaignSteps";

const pageRows = (rows) => rows;
const noop = vi.fn();

function initialProps(overrides = {}) {
  return {
    step: "upload",
    error: "",
    workflow: null,
    fileName: "",
    setFileName: vi.fn(),
    setError: vi.fn(),
    validateUpload: vi.fn(),
    busy: false,
    pageRows,
    recordPage: 1,
    setRecordPage: vi.fn(),
    onClose: vi.fn(),
    runAction: vi.fn(),
    closeBatch: vi.fn(),
    ...overrides
  };
}

function campaignProps(overrides = {}) {
  return {
    step: "template",
    workflow: { id: "w1", summary: { created: 2 }, campaign: null },
    activeTemplates: [{ id: "t1", name: "Activation", version: 1, subject: "Welcome" }],
    selectedTemplateId: "t1",
    busy: false,
    previewTemplate: vi.fn(),
    setEditingTemplate: vi.fn(),
    preview: { rendered: { subject: "Welcome Ravi", bodyText: "Activate now" } },
    onCreateTemplate: vi.fn(),
    onClose: vi.fn(),
    runAction: vi.fn(),
    recipients: [{ id: "u1", name: "Ravi", email: "ravi@example.com", role: "Dealer", region: "North" }],
    excluded: [],
    setExcluded: vi.fn(),
    confirmSend: false,
    setConfirmSend: vi.fn(),
    pageRows,
    recordPage: 1,
    setRecordPage: vi.fn(),
    ...overrides
  };
}

describe("onboarding initial steps", () => {
  it("validates a selected upload and reports missing files", async () => {
    const props = initialProps({ error: "Upload failed" });
    const { container } = render(<OnboardingInitialSteps {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Upload failed");
    await userEvent.click(screen.getByRole("button", { name: "Validate users" }));
    expect(props.setError).toHaveBeenCalledWith("Choose an Excel or CSV file.");
    const input = container.querySelector('input[type="file"]');
    const file = new File(["Name,Email"], "users.csv", { type: "text/csv" });
    await userEvent.upload(input, file);
    const formData = vi.spyOn(globalThis, "FormData").mockImplementation(function MockFormData() {
      return { get: () => ({ name: "users.csv" }) };
    });
    await userEvent.click(screen.getByRole("button", { name: "Validate users" }));
    expect(props.validateUpload).toHaveBeenCalled();
    formData.mockRestore();
    formData.mockRestore();
  });

  it("renders validation outcomes and creates ready users", async () => {
    const workflow = {
      summary: { total: 2, ready: 1, invalid: 1 },
      rows: [
        {
          id: "r1",
          rowNumber: 1,
          name: "Ravi",
          email: "ravi@example.com",
          role: "Dealer",
          outcome: "ready",
          errors: []
        },
        {
          id: "r2",
          rowNumber: 2,
          name: "",
          email: "",
          role: "",
          outcome: "invalid",
          errors: [{ errorMessage: "Email required" }]
        }
      ]
    };
    const props = initialProps({ step: "validation", workflow });
    render(<OnboardingInitialSteps {...props} />);
    expect(screen.getByText("Email required")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create 1 valid users" }));
    expect(props.runAction).toHaveBeenCalledWith("import");
  });

  it("supports keeping or closing a zero-result batch", async () => {
    const props = initialProps({ step: "validation", workflow: { summary: { total: 1, ready: 0 }, rows: [] } });
    render(<OnboardingInitialSteps {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Keep for later" }));
    await userEvent.click(screen.getByRole("button", { name: "Close batch" }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.closeBatch).toHaveBeenCalledOnce();
  });
});

describe("onboarding campaign steps", () => {
  it("selects, edits, previews, and continues with an activation template", async () => {
    const props = campaignProps();
    render(<OnboardingCampaignSteps {...props} />);
    expect(screen.getByText("Welcome Ravi")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /activation template/i }), "t1");
    await userEvent.click(screen.getByRole("button", { name: "Edit selected activation template" }));
    await userEvent.click(screen.getByRole("button", { name: "Continue to recipients" }));
    expect(props.previewTemplate).toHaveBeenCalledWith("t1");
    expect(props.setEditingTemplate).toHaveBeenCalledWith(props.activeTemplates[0]);
    expect(props.runAction).toHaveBeenCalledWith("template", { templateId: "t1" });
  });

  it("routes missing-template workflows to template creation", async () => {
    const props = campaignProps({ activeTemplates: [], selectedTemplateId: "", preview: null });
    render(<OnboardingCampaignSteps {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Create activation template" }));
    expect(props.onCreateTemplate).toHaveBeenCalledWith("w1");
    expect(screen.getByRole("button", { name: "Continue to recipients" })).toBeDisabled();
  });

  it("includes and excludes recipients and opens send confirmation", async () => {
    const props = campaignProps({ step: "recipients" });
    render(<OnboardingCampaignSteps {...props} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Include Ravi" }));
    await userEvent.click(screen.getByRole("button", { name: "Back to template" }));
    await userEvent.click(screen.getByRole("button", { name: "Send 1 activation emails" }));
    expect(props.setExcluded).toHaveBeenCalled();
    expect(props.runAction).toHaveBeenCalledWith("back");
    expect(props.setConfirmSend).toHaveBeenCalledWith(true);
  });

  it("renders delivery outcomes and closes completed campaigns", async () => {
    const props = campaignProps({
      step: "delivery",
      workflow: {
        summary: { created: 1 },
        campaign: {
          recipients: [
            { id: "u1", name: "Ravi", email: "ravi@example.com", status: "sent", sentAt: "2026-08-01T10:00:00Z" },
            { id: "u2", name: "Asha", email: "asha@example.com", status: "failed", sentAt: null }
          ]
        }
      }
    });
    render(<OnboardingCampaignSteps {...props} />);
    expect(screen.getByText("sent")).toHaveClass("created");
    expect(screen.getByText("failed")).toHaveClass("failed");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
