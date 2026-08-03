"use client";

import "../styles/06-email-templates.css";

import { useState } from "react";
import { request } from "../utils/api";
import Pagination from "./Pagination";
import { Button, ErrorState, FilterToolbar, LoadingState, Select, Table, TextInput } from "./ui";
import { EditorEmailPreview, SampleTemplatePreview, TemplateEditor } from "./EmailTemplateDialogs";

export default function EmailTemplatesView({
  user,
  samples = [],
  templates = [],
  pagination = { total: 0 },
  summary = { active: 0 },
  filters = { search: "", status: "" },
  page = 1,
  loading = false,
  error = "",
  setPage,
  updateFilters,
  reload,
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
            {samples.length} {samples.length === 1 ? "sample" : "samples"}
          </span>
        </div>
        {samples.length ? (
          <Table className="table-wrap template-table-wrap starter-template-table" aria-label="Starter templates">
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
          </Table>
        ) : (
          <div className="empty-state template-empty">
            <h3>No starter templates available</h3>
            <p>Add a reviewed sample before creating an organization template.</p>
          </div>
        )}
      </section>
      <section className="email-content-section organization-templates" aria-busy={loading}>
        <div className="section-heading-row">
          <div>
            <h2>Organization Templates</h2>
            <p>{summary.active} active templates are available for user onboarding.</p>
          </div>
        </div>
        <FilterToolbar label="Filter organization templates" className="template-filter-toolbar">
          <label>
            <span className="visually-hidden">Search templates</span>
            <TextInput
              type="search"
              value={filters.search}
              onChange={(event) => updateFilters({ search: event.target.value })}
              placeholder="Search name or subject"
            />
          </label>
          <label>
            <span>Status</span>
            <Select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value })}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
            </Select>
          </label>
          <span className="template-result-count" aria-live="polite">
            {pagination.total} {pagination.total === 1 ? "template" : "templates"}
          </span>
        </FilterToolbar>
        {error && templates.length ? (
          <div className="inline-status error" role="alert">
            <span>{error} Existing results remain visible.</span>
            <Button type="button" variant="secondary" onClick={reload}>
              Retry
            </Button>
          </div>
        ) : null}
        {loading && !templates.length ? (
          <LoadingState
            title="Loading organization templates"
            description="Retrieving the latest editable templates."
          />
        ) : error && !templates.length ? (
          <ErrorState
            title="Organization templates unavailable"
            description={error}
            onRetry={reload}
            showHome={false}
          />
        ) : templates.length ? (
          <Table className="table-wrap organization-template-table" aria-label="Organization templates">
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
          </Table>
        ) : (
          <div className="empty-state template-empty">
            <h3>{filters.search || filters.status ? "No matching templates" : "No organization templates yet"}</h3>
            <p>Choose a supplied starter template to create your first editable draft.</p>
          </div>
        )}
        {pagination.total > 10 ? (
          <Pagination page={page} pageSize={10} totalRows={pagination.total} onPageChange={setPage} />
        ) : null}
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
