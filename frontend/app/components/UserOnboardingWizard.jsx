"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { request } from "../utils/api";
import ConfirmationModal from "./ConfirmationModal";
import { OnboardingCampaignSteps } from "../features/onboarding/OnboardingCampaignSteps";
import { OnboardingInitialSteps } from "../features/onboarding/OnboardingInitialSteps";
import { Stepper, TemplateQuickEditor, WIZARD_PAGE_SIZE } from "../features/onboarding/OnboardingUI";
import CloseButton from "./ui/CloseButton";

export default function UserOnboardingWizard({
  open,
  workflowId,
  preferredTemplateId = "",
  user,
  templates = [],
  onClose,
  onUpdated,
  onCreateTemplate,
  setNotice
}) {
  const [workflow, setWorkflow] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [preview, setPreview] = useState(null);
  const [excluded, setExcluded] = useState([]);
  const [confirmSend, setConfirmSend] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [recordPage, setRecordPage] = useState(1);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (!workflowId) {
      setWorkflow(null);
      setFileName("");
      setPreview(null);
      setExcluded([]);
      return;
    }
    setBusy(true);
    request(`/api/admin/onboarding/${encodeURIComponent(workflowId)}?userId=${encodeURIComponent(user.id)}`)
      .then(async (result) => {
        setWorkflow(result);
        const templateId = result.selectedTemplateId || preferredTemplateId || "";
        setSelectedTemplateId(templateId);
        setExcluded(result.excludedRecipientIds || []);
        if (templateId && result.currentStep === "template") {
          setPreview(
            await request(
              `/api/admin/onboarding/${result.id}/preview?templateId=${encodeURIComponent(templateId)}&userId=${encodeURIComponent(user.id)}`
            )
          );
        }
      })
      .catch((nextError) => setError(nextError.message))
      .finally(() => setBusy(false));
  }, [open, preferredTemplateId, user.id, workflowId]);

  useEffect(() => {
    if (!open) return undefined;
    const returnFocus = document.activeElement;
    const close = (event) => {
      if (editingTemplate || confirmSend) return;
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", close);
    window.requestAnimationFrame(() => dialogRef.current?.querySelector("[data-dialog-focus]")?.focus());
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", close);
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
    };
  }, [confirmSend, editingTemplate, open, onClose]);

  const activeTemplates = useMemo(
    () => templates.filter((template) => template.status === "active" && template.type === "user_activation"),
    [templates]
  );
  const recipients = workflow?.recipients || workflow?.createdUserIds?.map((id) => ({ id })) || [];
  const pageRows = (rows = []) => rows.slice((recordPage - 1) * WIZARD_PAGE_SIZE, recordPage * WIZARD_PAGE_SIZE);

  useEffect(() => setRecordPage(1), [workflow?.currentStep, workflow?.id]);

  async function validateUpload(formData) {
    setBusy(true);
    setError("");
    formData.set("actorId", user.id);
    try {
      const payload = await request("/api/ui/users/import", { method: "POST", body: formData });
      setWorkflow(payload);
      onUpdated?.(payload);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  async function runAction(path, body = {}) {
    setBusy(true);
    setError("");
    try {
      await request(`/api/admin/onboarding/${workflow.id}/${path}`, {
        method: "POST",
        body: JSON.stringify({ ...body, actorId: user.id })
      });
      const refreshed = await request(`/api/admin/onboarding/${workflow.id}?userId=${encodeURIComponent(user.id)}`);
      setWorkflow(refreshed);
      onUpdated?.(refreshed);
      return refreshed;
    } catch (nextError) {
      setError(nextError.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function closeBatch() {
    setBusy(true);
    setError("");
    try {
      await request(`/api/admin/onboarding/${workflow.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ actorId: user.id })
      });
      await onUpdated?.();
      onClose();
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  async function previewTemplate(templateId) {
    setSelectedTemplateId(templateId);
    setBusy(true);
    setError("");
    try {
      setPreview(
        await request(
          `/api/admin/onboarding/${workflow.id}/preview?templateId=${encodeURIComponent(templateId)}&userId=${encodeURIComponent(user.id)}`
        )
      );
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTemplateSaved(saved) {
    await onUpdated?.();
    setSelectedTemplateId(saved.id);
    setPreview(
      await request(
        `/api/admin/onboarding/${workflow.id}/preview?templateId=${encodeURIComponent(saved.id)}&userId=${encodeURIComponent(user.id)}`
      )
    );
  }

  if (!open) return null;
  const step = workflow?.currentStep || "upload";

  return (
    <div
      className="modal-backdrop onboarding-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className="modal onboarding-modal"
        role="dialog"
        aria-modal={!editingTemplate && !confirmSend}
        aria-hidden={editingTemplate || confirmSend || undefined}
        inert={editingTemplate || confirmSend ? true : undefined}
        aria-labelledby="onboarding-title"
      >
        <header className="modal-header onboarding-header">
          <div>
            <span className="modal-eyebrow">Access management</span>
            <h2 id="onboarding-title">Bulk user onboarding</h2>
            <p>
              {workflow
                ? `${workflow.fileName} - progress is saved automatically.`
                : "Validate users, create accounts, and send secure activation links."}
            </p>
          </div>
          <CloseButton
            data-dialog-focus
            className="modal-close-button"
            type="button"
            onClick={onClose}
            aria-label="Close user onboarding"
          />
        </header>
        {step === "delivery" || workflow?.campaign ? (
          <div className="delivery-complete onboarding-header-status">
            <span aria-hidden="true">&#10003;</span>
            <div>
              <h3>Invitation campaign completed</h3>
              <p>
                {workflow.campaign?.sent || 0} activation emails were sent successfully.{" "}
                {workflow.campaign?.failed || 0} failed. Delivery details remain available in Delivery Logs.
              </p>
            </div>
          </div>
        ) : null}
        {workflow ? <Stepper current={step} /> : null}
        <div className="onboarding-body">
          <OnboardingInitialSteps
            step={step}
            error={error}
            workflow={workflow}
            fileName={fileName}
            setFileName={setFileName}
            setError={setError}
            validateUpload={validateUpload}
            busy={busy}
            pageRows={pageRows}
            recordPage={recordPage}
            setRecordPage={setRecordPage}
            onClose={onClose}
            runAction={runAction}
            closeBatch={closeBatch}
          />
          <OnboardingCampaignSteps
            step={step}
            workflow={workflow}
            activeTemplates={activeTemplates}
            selectedTemplateId={selectedTemplateId}
            busy={busy}
            previewTemplate={previewTemplate}
            setEditingTemplate={setEditingTemplate}
            preview={preview}
            onCreateTemplate={onCreateTemplate}
            onClose={onClose}
            runAction={runAction}
            recipients={recipients}
            excluded={excluded}
            setExcluded={setExcluded}
            confirmSend={confirmSend}
            setConfirmSend={setConfirmSend}
            pageRows={pageRows}
            recordPage={recordPage}
            setRecordPage={setRecordPage}
          />{" "}
        </div>
      </section>
      {editingTemplate ? (
        <TemplateQuickEditor
          template={editingTemplate}
          user={user}
          setNotice={setNotice}
          onSaved={handleTemplateSaved}
          onClose={() => setEditingTemplate(null)}
        />
      ) : null}
      <ConfirmationModal
        open={confirmSend}
        eyebrow="Email delivery"
        title="Send activation emails now?"
        description="Single-use activation links will be created and sent immediately. This campaign cannot be recalled after submission."
        detailLabel="Recipients"
        detailValue={`${recipients.length - excluded.length} selected users`}
        confirmLabel="Confirm and send"
        cancelLabel="Review recipients"
        busy={busy}
        onClose={() => setConfirmSend(false)}
        onConfirm={async () => {
          const saved = await runAction("recipients", { excludedRecipientIds: excluded });
          if (saved) await runAction("send", { appUrl: window.location.origin });
          setConfirmSend(false);
        }}
      />
    </div>
  );
}
