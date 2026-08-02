import Button from "./ui/Button";
import ModalShell from "./ui/ModalShell";
import Select from "./ui/Select";
import TextArea from "./ui/TextArea";
import TextInput from "./ui/TextInput";

export const SAMPLE_VALUES = {
  user_name: "Ravi Kumar",
  login_email: "ravi.kumar@example.com",
  activation_link: "https://example.com/activate/sample-link",
  activation_expiry: "30 July 2026, 5:00 PM",
  login_url: "https://example.com/login",
  role: "Area Manager",
  region: "West",
  reporting_manager: "Regional Manager West",
  support_email: "support@example.com"
};

function renderSample(text) {
  return String(text || "").replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key) => SAMPLE_VALUES[key] || "NA");
}

export function SampleTemplatePreview({ preview, busy, onClose, onClone }) {
  return (
    <ModalShell
      open={Boolean(preview)}
      onClose={onClose}
      closeDisabled={busy}
      className="email-preview-modal"
      ariaLabelledBy="sample-preview-title"
    >
      <header className="modal-header">
        <div>
          <span className="modal-eyebrow">Starter template preview</span>
          <h2 id="sample-preview-title">{preview?.name}</h2>
          <p>{preview?.description}</p>
        </div>
        <Button
          className="modal-close-button"
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="Close preview"
        >
          <span aria-hidden="true">&times;</span>
        </Button>
      </header>
      <div className="sample-preview-meta">
        <span>
          <small>Type</small>
          <strong>{String(preview?.type || "activation").replaceAll("_", " ")}</strong>
        </span>
        <span>
          <small>Reviewed</small>
          <strong>{preview ? new Date(preview.reviewedAt).toLocaleDateString() : ""}</strong>
        </span>
      </div>
      <div className="email-message-preview">
        <div>
          <small>Subject</small>
          <strong>{renderSample(preview?.subject)}</strong>
        </div>
        <pre>{renderSample(preview?.bodyText)}</pre>
      </div>
      <p className="preview-safety-note">
        Sample recipient data is shown here. No activation link or email is created until an onboarding campaign is
        confirmed.
      </p>
      <div className="modal-form-actions">
        <Button variant="secondary" type="button" disabled={busy} onClick={onClose}>
          Close
        </Button>
        <Button type="button" disabled={busy} onClick={() => onClone(preview)}>
          {busy ? "Creating draft..." : "Use this template"}
        </Button>
      </div>
    </ModalShell>
  );
}

export function TemplateEditor({ editor, setEditor, busy, errors, previewOpen, onPreview, onClose, onSave }) {
  return (
    <ModalShell
      open={Boolean(editor)}
      onClose={onClose}
      suspended={previewOpen}
      className="template-editor-modal"
      ariaLabelledBy="template-editor-title"
    >
      <header className="modal-header template-editor-header">
        <div>
          <span className="modal-eyebrow">Organization template</span>
          <h2 id="template-editor-title">Edit activation email</h2>
          <p>Compose the reusable message and preview it with safe sample data before saving.</p>
        </div>
        <Button className="modal-close-button" type="button" onClick={onClose} aria-label="Close template editor">
          <span aria-hidden="true">&times;</span>
        </Button>
      </header>
      <form onSubmit={onSave}>
        <div className="template-editor-layout">
          <aside className="merge-field-panel merge-field-toolbar" aria-label="Approved merge fields">
            <div>
              <h3>Approved merge fields</h3>
              <p>Use these tokens exactly as shown. Values are replaced separately for each recipient.</p>
            </div>
            <div className="merge-field-list">
              {Object.keys(SAMPLE_VALUES).map((key) => (
                <code key={key}>{`{{${key}}}`}</code>
              ))}
            </div>
          </aside>
          <div className="template-editor-fields">
            <div className="field">
              <label htmlFor="template-name">
                Template name <span className="required-marker">*</span>
              </label>
              <TextInput
                id="template-name"
                name="name"
                required
                value={editor?.name || ""}
                onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="template-subject">
                Email subject <span className="required-marker">*</span>
              </label>
              <TextInput
                id="template-subject"
                name="subject"
                required
                value={editor?.subject || ""}
                onChange={(event) => setEditor((current) => ({ ...current, subject: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="template-body-text">
                Plain-text message <span className="required-marker">*</span>
              </label>
              <TextArea
                id="template-body-text"
                name="bodyText"
                required
                rows="10"
                value={editor?.bodyText || ""}
                onChange={(event) => setEditor((current) => ({ ...current, bodyText: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="template-body-html">HTML message</label>
              <TextArea
                id="template-body-html"
                name="bodyHtml"
                rows="7"
                value={editor?.bodyHtml || ""}
                onChange={(event) => setEditor((current) => ({ ...current, bodyHtml: event.target.value }))}
              />
              <span className="field-hint">
                Optional. Plain text remains the fallback for clients that do not display HTML.
              </span>
            </div>
            <div className="field template-status-field">
              <label htmlFor="template-status">Status</label>
              <Select
                id="template-status"
                name="status"
                value={editor?.status || "draft"}
                onChange={(event) => setEditor((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
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
        <div className="modal-form-actions template-editor-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <div>
            <Button variant="secondary" type="button" onClick={onPreview}>
              Preview email
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save template"}
            </Button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

export function EditorEmailPreview({ editor, open, onClose }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      nested
      className="editor-email-preview-modal"
      ariaLabelledBy="editor-email-preview-title"
    >
      <header className="modal-header">
        <div>
          <span className="modal-eyebrow">Live sample</span>
          <h2 id="editor-email-preview-title">Email preview</h2>
          <p>Rendered with sample recipient data. Your unsaved template changes are shown here.</p>
        </div>
        <Button className="modal-close-button" type="button" onClick={onClose} aria-label="Close email preview">
          <span aria-hidden="true">&times;</span>
        </Button>
      </header>
      <div className="email-preview-recipient">
        <span>
          <small>To</small>
          <strong>{SAMPLE_VALUES.user_name}</strong>
          <em>{SAMPLE_VALUES.login_email}</em>
        </span>
        <span>
          <small>Role and region</small>
          <strong>{SAMPLE_VALUES.role}</strong>
          <em>{SAMPLE_VALUES.region}</em>
        </span>
      </div>
      <article className="email-preview-canvas">
        <header>
          <strong className="email-preview-section-label">Subject</strong>
          <h3>{renderSample(editor?.subject) || "No subject entered"}</h3>
        </header>
        <section className="email-preview-content">
          <strong className="email-preview-section-label">Email content</strong>
          <pre>{renderSample(editor?.bodyText) || "No plain-text message entered."}</pre>
        </section>
      </article>
      <p className="preview-safety-note">
        This is a visual preview only. No activation link is created and no email is sent.
      </p>
      <div className="modal-form-actions">
        <Button type="button" onClick={onClose}>
          Back to editor
        </Button>
      </div>
    </ModalShell>
  );
}
