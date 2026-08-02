"use client";

import { useMemo, useState } from "react";
import { request } from "../utils/api";
import Button from "./ui/Button";
import { EditorEmailPreview, SampleTemplatePreview, TemplateEditor } from "./EmailTemplateDialogs";

export default function EmailTemplatesView({
  user,
  samples = [],
  templates = [],
  returnWorkflowId,
  onReload,
  onReturnToOnboarding,
  setNotice
}) {
  const [editor, setEditor] = useState(null);
  const [preview, setPreview] = useState(null);
  const [editorPreviewOpen, setEditorPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const activeCount = useMemo(() => templates.filter((item) => item.status === "active").length, [templates]);

  async function clone(sample) {
    setBusy(true);
    try {
      const template = await request(`/api/admin/email-templates/samples/${encodeURIComponent(sample.id)}/clone`, {
        method: "POST",
        body: JSON.stringify({ actorId: user.id })
      });
      setEditor(template);
      setEditorPreviewOpen(false);
      setPreview(null);
      await onReload?.();
      setNotice?.({ type: "success", message: "Editable template draft created from the sample." });
    } catch (error) {
      setNotice?.({ type: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setErrors([]);
    try {
      const saved = await request(`/api/admin/email-templates/${encodeURIComponent(editor.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...data, actorId: user.id })
      });
      setEditor(saved);
      await onReload?.();
      setNotice?.({
        type: "success",
        message: saved.status === "active" ? "Template activated and ready for onboarding." : "Template draft saved."
      });
      if (saved.status === "active" && returnWorkflowId) onReturnToOnboarding(saved);
    } catch (error) {
      setErrors(error.payload?.errors || [{ field: "form", message: error.message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="template-management">
      {returnWorkflowId ? (
        <div className="return-context">
          <div>
            <strong>Onboarding is paused at template selection</strong>
            <p>Create and activate a template, then return without losing the imported-user batch.</p>
          </div>
          <Button variant="secondary" type="button" onClick={() => onReturnToOnboarding()}>
            Return to onboarding
          </Button>
        </div>
      ) : null}
      <section className="email-content-section template-library">
        <div className="section-heading-row">
          <div>
            <h2>Starter Templates</h2>
            <p>Preview a supplied sample, then create an editable organization draft.</p>
          </div>
          <span className="status-pill active">
            <span />
            {samples.length} samples
          </span>
        </div>
        {samples.length ? (
          <div className="table-wrap template-table-wrap starter-template-table">
            <table>
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Description</th>
                  <th>Subject</th>
                  <th>Reviewed</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((sample) => (
                  <tr key={sample.id}>
                    <td>
                      <strong>{sample.name}</strong>
                      <small>{String(sample.type || "activation").replaceAll("_", " ")}</small>
                    </td>
                    <td>{sample.description}</td>
                    <td>{sample.subject}</td>
                    <td>{new Date(sample.reviewedAt).toLocaleDateString()}</td>
                    <td>
                      <Button variant="secondary" type="button" onClick={() => setPreview(sample)}>
                        Preview
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state template-empty">
            <h3>No starter templates available</h3>
            <p>Add a reviewed sample before creating an organization template.</p>
          </div>
        )}
      </section>
      <section className="email-content-section organization-templates">
        <div className="section-heading-row">
          <div>
            <h2>Organization Templates</h2>
            <p>{activeCount} active templates are available for user onboarding.</p>
          </div>
        </div>
        {templates.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>
                      <strong>{template.name}</strong>
                      <small>{template.type}</small>
                    </td>
                    <td>{template.subject}</td>
                    <td>
                      <span className={`status-pill ${template.status === "active" ? "active" : "inactive"}`}>
                        <span />
                        {template.status}
                      </span>
                    </td>
                    <td>{template.version}</td>
                    <td>{new Date(template.updatedAt).toLocaleString()}</td>
                    <td>
                      <Button variant="secondary" type="button" onClick={() => setEditor(template)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state template-empty">
            <h3>No organization templates yet</h3>
            <p>Choose a supplied starter template to create your first editable draft.</p>
          </div>
        )}
      </section>

      <SampleTemplatePreview preview={preview} busy={busy} onClose={() => setPreview(null)} onClone={clone} />
      <TemplateEditor
        editor={editor}
        setEditor={setEditor}
        busy={busy}
        errors={errors}
        previewOpen={editorPreviewOpen}
        onPreview={() => setEditorPreviewOpen(true)}
        onClose={() => setEditor(null)}
        onSave={save}
      />
      <EditorEmailPreview
        editor={editor}
        open={Boolean(editor && editorPreviewOpen)}
        onClose={() => setEditorPreviewOpen(false)}
      />
    </div>
  );
}
