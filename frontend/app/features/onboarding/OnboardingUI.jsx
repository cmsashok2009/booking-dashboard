"use client";

import { useMemo, useState } from "react";
import { request } from "../../utils/api";
import { paginationItems } from "../../utils/pagination";
import Button from "../../components/ui/Button";
import CloseButton from "../../components/ui/CloseButton";
import SideDrawer from "../../components/ui/SideDrawer";
import RichTextEditor from "../../components/ui/RichTextEditor";
import TextArea from "../../components/ui/TextArea";
import TextInput from "../../components/ui/TextInput";
export const STEP_ORDER = ["validation", "template", "recipients", "delivery"];
export const WIZARD_PAGE_SIZE = 5;
export const OUTCOME_LABELS = {
  ready: "Ready",
  created: "Created",
  skipped_existing: "Existing user",
  duplicate_in_file: "Duplicate in file",
  dependency_error: "Dependency issue",
  invalid: "Invalid",
  failed: "Failed"
};

const TEMPLATE_FIELDS = ["name", "subject", "bodyText", "bodyHtml"];

export function TemplateQuickEditor({ template, user, onClose, onSaved, setNotice }) {
  const [draft, setDraft] = useState(() => ({ ...template }));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const initial = useMemo(
    () => JSON.stringify(Object.fromEntries(TEMPLATE_FIELDS.map((key) => [key, template?.[key] || ""]))),
    [template]
  );
  const current = JSON.stringify(Object.fromEntries(TEMPLATE_FIELDS.map((key) => [key, draft?.[key] || ""])));
  const dirty = current !== initial;

  async function saveAndClose() {
    if (saving) return;
    const nextErrors = [
      !String(draft.name || "").trim() && { field: "name", message: "Template name is required." },
      !String(draft.subject || "").trim() && { field: "subject", message: "Email subject is required." },
      !String(draft.bodyText || "").trim() && { field: "bodyText", message: "Plain-text message is required." }
    ].filter(Boolean);
    if (nextErrors.length) {
      setErrors(nextErrors);
      setNotice?.({ type: "error", message: "Complete the required template fields before closing." });
      return;
    }
    if (!dirty) return onClose();
    setSaving(true);
    setErrors([]);
    try {
      const saved = await request(`/api/admin/email-templates/${encodeURIComponent(template.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...Object.fromEntries(TEMPLATE_FIELDS.map((key) => [key, draft[key] || ""])),
          status: template.status,
          actorId: user.id
        })
      });
      await onSaved(saved);
      setNotice?.({ type: "success", message: "Template changes saved and preview updated." });
      onClose();
    } catch (error) {
      setErrors(error.payload?.errors || [{ field: "form", message: error.message }]);
      setNotice?.({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }


  return (
    <SideDrawer
      className="template-quick-editor-drawer"
      backdropClassName="template-quick-editor-backdrop"
      labelledBy="quick-template-editor-title"
      closeDisabled={saving}
      onClose={saveAndClose}
    >
        <header className="modal-header">
          <div>
            <span className="modal-eyebrow">Activation template</span>
            <h2 id="quick-template-editor-title">Edit selected template</h2>
            <p>Changes are validated, saved on close, and reflected in the preview automatically.</p>
          </div>
          <CloseButton
            className="modal-close-button"
            type="button"
            disabled={saving}
            onClick={saveAndClose}
            aria-label="Save and close template editor"
          />
        </header>
        <div className="template-quick-editor-body">
          <div className="template-editor-fields">
            <div className="field">
              <label htmlFor="quick-template-name">
                Template name <span className="required-marker">*</span>
              </label>
              <TextInput
                id="quick-template-name"
                value={draft.name || ""}
                onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="quick-template-subject">
                Email subject <span className="required-marker">*</span>
              </label>
              <TextInput
                id="quick-template-subject"
                value={draft.subject || ""}
                onChange={(event) => setDraft((value) => ({ ...value, subject: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="quick-template-text">
                Plain-text message <span className="required-marker">*</span>
              </label>
              <TextArea
                id="quick-template-text"
                rows="9"
                value={draft.bodyText || ""}
                onChange={(event) => setDraft((value) => ({ ...value, bodyText: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="quick-template-html">HTML message</label>
              <RichTextEditor
                id="quick-template-html"
                ariaLabel="HTML message"
                value={draft.bodyHtml || ""}
                onChange={(bodyHtml) => setDraft((value) => ({ ...value, bodyHtml }))}
              />
              <span className="field-hint">Use the visual editor for formatting and clickable links. Plain text remains the fallback for email clients that cannot display HTML.</span>
            </div>
            {errors.length ? (
              <div className="template-errors" role="alert">
                <strong>Review the template</strong>
                <ul>
                  {errors.map((error, index) => (
                    <li key={`${error.field}-${index}`}>{error.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
        <footer className="modal-form-actions template-quick-editor-footer">
          <span>{dirty ? "Unsaved changes" : "No changes"}</span>
          <Button type="button" disabled={saving} onClick={saveAndClose}>
            {saving ? "Saving..." : "Done"}
          </Button>
        </footer>
          </SideDrawer>
  );
}

export function Summary({ summary = {} }) {
  const items = [
    ["Total rows", summary.total || 0, "neutral"],
    [summary.created ? "Created" : "Ready to create", summary.created || summary.ready || 0, "success"],
    ["Existing skipped", summary.skippedExisting || 0, "info"],
    ["Need correction", (summary.invalid || 0) + (summary.duplicateInFile || 0) + (summary.failed || 0), "warning"]
  ];
  return (
    <div className="onboarding-summary">
      {items.map(([label, value, tone]) => (
        <div className={`onboarding-stat ${tone}`} key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function Stepper({ current }) {
  const currentIndex = Math.max(0, STEP_ORDER.indexOf(current));
  const labels = ["Validate", "Import & template", "Recipients", "Delivery"];
  return (
    <ol className="onboarding-stepper" aria-label="Onboarding progress">
      {labels.map((label, index) => (
        <li className={index < currentIndex ? "complete" : index === currentIndex ? "current" : ""} key={label}>
          <span>{index + 1}</span>
          <strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}

export function WizardPagination({ page, totalRows, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalRows / WIZARD_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = totalRows ? (currentPage - 1) * WIZARD_PAGE_SIZE + 1 : 0;
  const end = Math.min(currentPage * WIZARD_PAGE_SIZE, totalRows);
  if (totalRows <= WIZARD_PAGE_SIZE) return null;
  return (
    <div className="pagination onboarding-pagination">
      <span>
        {start}-{end} of {totalRows}
      </span>
      <div className="pagination-actions">
        <Button
          variant="secondary"
          className="icon-page"
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="First page"
        >
          {"<<"}
        </Button>
        <Button
          variant="secondary"
          className="icon-page"
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous page"
        >
          {"<"}
        </Button>
        {paginationItems(currentPage, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span className="page-ellipsis" key={`wizard-ellipsis-${index}`}>
              ...
            </span>
          ) : (
            <Button
              className={`secondary page-number ${item === currentPage ? "active" : ""}`}
              type="button"
              disabled={item === currentPage}
              onClick={() => onPageChange(item)}
              key={item}
            >
              {item}
            </Button>
          )
        )}
        <Button
          variant="secondary"
          className="icon-page"
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next page"
        >
          {">"}
        </Button>
        <Button
          variant="secondary"
          className="icon-page"
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Last page"
        >
          {">>"}
        </Button>
      </div>
    </div>
  );
}
