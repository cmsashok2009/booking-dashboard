import Button from "./ui/Button";
import CloseButton from "./ui/CloseButton";
import RichTextEditor from "./ui/RichTextEditor";
import SideDrawer from "./ui/SideDrawer";
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
  if (!preview) return null;

  return (
    <SideDrawer
      className="email-preview-drawer"
      backdropClassName="email-preview-drawer-backdrop"
      labelledBy="sample-preview-title"
      describedBy="sample-preview-description"
      closeDisabled={busy}
      onClose={onClose}
    >
      <div className="email-preview-drawer-layout">
        <header className="email-preview-drawer-header">
          <div>
            <span className="modal-eyebrow">Starter template preview</span>
            <h2 id="sample-preview-title">{preview.name}</h2>
            <p id="sample-preview-description">{preview.description}</p>
          </div>
          <CloseButton
            className="modal-close-button"
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Close preview"
          />
        </header>
        <div className="email-preview-drawer-body">
          <div className="sample-preview-meta">
            <span>
              <small>Type</small>
              <strong>{String(preview.type || "activation").replaceAll("_", " ")}</strong>
            </span>
            <span>
              <small>Reviewed</small>
              <strong>{new Date(preview.reviewedAt).toLocaleDateString()}</strong>
            </span>
          </div>
          <div className="email-message-preview">
            <div>
              <small>Subject</small>
              <strong>{renderSample(preview.subject)}</strong>
            </div>
            <pre>{renderSample(preview.bodyText)}</pre>
          </div>
          <p className="preview-safety-note">
            Sample recipient data is shown here. No activation link or email is created until an onboarding campaign
            is confirmed.
          </p>
        </div>
        <footer className="email-preview-drawer-footer">
          <Button variant="secondary" type="button" disabled={busy} onClick={onClose}>
            Close
          </Button>
          <Button type="button" disabled={busy} onClick={() => onClone(preview)}>
            {busy ? "Creating draft..." : "Use this template"}
          </Button>
        </footer>
      </div>
    </SideDrawer>
  );
}
export function TemplateEditor({ editor, setEditor, busy, errors, previewOpen, onPreview, onClose, onSave }) {
  if (!editor) return null;

  return (
    <SideDrawer
      className="template-editor-drawer"
      backdropClassName="template-editor-backdrop"
      labelledBy="template-editor-title"
      describedBy="template-editor-description"
      closeDisabled={busy}
      suspended={previewOpen}
      onClose={onClose}
    >
      <form className="template-editor-drawer-form" onSubmit={onSave}>
        <header className="template-editor-drawer-header">
          <div>
            <span className="modal-eyebrow">Organization template</span>
            <h2 id="template-editor-title">Edit activation email</h2>
            <p id="template-editor-description">
              Compose the reusable message and preview it with safe sample data before saving.
            </p>
          </div>
          <CloseButton
            className="modal-close-button"
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Close template editor"
          />
        </header>
        <div className="template-editor-drawer-body">
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
                value={editor.name || ""}
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
                value={editor.subject || ""}
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
                rows="8"
                value={editor.bodyText || ""}
                onChange={(event) => setEditor((current) => ({ ...current, bodyText: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="template-body-html">HTML message</label>
              <RichTextEditor
                id="template-body-html"
                ariaLabel="HTML message"
                value={editor.bodyHtml || ""}
                onChange={(bodyHtml) => setEditor((current) => ({ ...current, bodyHtml }))}
              />
              <input type="hidden" name="bodyHtml" value={editor.bodyHtml || ""} />
              <span className="field-hint">
                Format the email visually and add clickable links. Plain text remains the fallback.
              </span>
            </div>
            <div className="field template-status-field">
              <label htmlFor="template-status">Status</label>
              <Select
                id="template-status"
                name="status"
                value={editor.status || "draft"}
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
        <footer className="template-editor-drawer-footer">
          <Button variant="secondary" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <div>
            <Button variant="secondary" type="button" disabled={busy} onClick={onPreview}>
              Preview email
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save template"}
            </Button>
          </div>
        </footer>
      </form>
    </SideDrawer>
  );
}
export function EditorEmailPreview({ editor, open, onClose }) {
  if (!open) return null;

  return (
    <SideDrawer
      className="email-preview-drawer editor-email-preview-drawer"
      backdropClassName="email-preview-drawer-backdrop"
      labelledBy="editor-email-preview-title"
      describedBy="editor-email-preview-description"
      onClose={onClose}
    >
      <div className="email-preview-drawer-layout">
        <header className="email-preview-drawer-header">
          <div>
            <span className="modal-eyebrow">Live sample</span>
            <h2 id="editor-email-preview-title">Email preview</h2>
            <p id="editor-email-preview-description">
              Rendered with sample recipient data. Your unsaved template changes are shown here.
            </p>
          </div>
          <CloseButton
            className="modal-close-button"
            type="button"
            onClick={onClose}
            aria-label="Close email preview"
          />
        </header>
        <div className="email-preview-drawer-body">
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
        </div>
        <footer className="email-preview-drawer-footer">
          <Button type="button" onClick={onClose}>
            Back to editor
          </Button>
        </footer>
      </div>
    </SideDrawer>
  );
}
