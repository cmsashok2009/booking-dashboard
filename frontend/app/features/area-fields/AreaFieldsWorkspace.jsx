"use client";

import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import TextInput from "../../components/ui/TextInput";
import { lookupFieldLabels } from "../../constants/dashboard";
import { filterLookupOptions } from "./options";

export default function AreaFieldsWorkspace({
  selectedField,
  options,
  search,
  status,
  editingId,
  draft,
  onFieldChange,
  onSearchChange,
  onStatusChange,
  onStartEdit,
  onDraftChange,
  onCancelEdit,
  onUpdateOption,
  onOpenAdd
}) {
  const activeCount = options.filter((option) => option.status === "active").length;
  const filteredOptions = filterLookupOptions(options, search, status);
  const fieldLabel = lookupFieldLabels[selectedField];

  return (
    <>
      <section className="area-fields-workspace-bar">
        <div className="area-field-selector">
          <label htmlFor="area-field-select">Dropdown field</label>
          <Select id="area-field-select" value={selectedField} onChange={(event) => onFieldChange(event.target.value)}>
            {Object.entries(lookupFieldLabels).map(([fieldCode, label]) => (
              <option value={fieldCode} key={fieldCode}>
                {label}
              </option>
            ))}
          </Select>
          <span>
            {activeCount} active | {options.length - activeCount} inactive
          </span>
        </div>
        <Button className="action-with-icon" type="button" onClick={onOpenAdd}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17">
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add option
        </Button>
      </section>
      <section className="panel area-options-panel">
        <div className="section-heading-row">
          <div>
            <h2>{fieldLabel} Options</h2>
            <p>Active values are available for new booking updates. Inactive values remain in historical records.</p>
          </div>
          <small>
            {filteredOptions.length} of {options.length} options
          </small>
        </div>
        <div className="table-toolbar area-options-toolbar">
          <div className="search-control">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <TextInput
              aria-label="Search dropdown options"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search options"
            />
          </div>
          <Select
            aria-label="Filter options by status"
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Button
            variant="outline"
            type="button"
            disabled={!search && !status}
            onClick={() => {
              onSearchChange("");
              onStatusChange("");
            }}
          >
            Clear
          </Button>
        </div>
        <div className="table-wrap compact-table area-options-table">
          <table>
            <thead>
              <tr>
                <th>Option</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOptions.length ? (
                filteredOptions.map((option) => {
                  const isEditing = editingId === option.id;
                  return (
                    <tr key={option.id}>
                      <td>
                        {isEditing ? (
                          <div className="option-edit-field">
                            <TextInput
                              className="option-label-input"
                              value={draft}
                              onChange={(event) => onDraftChange(event.target.value)}
                              data-dialog-focus
                              aria-label={`Edit ${option.label}`}
                            />
                            {!draft.trim() ? <small className="field-error">Option value is required.</small> : null}
                          </div>
                        ) : (
                          <span className="option-value">{option.label}</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${option.status === "active" ? "active" : "inactive"}`}>
                          <span aria-hidden="true" />
                          {option.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="area-option-actions">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                disabled={!draft.trim()}
                                onClick={() =>
                                  onUpdateOption(option.id, { label: draft.trim() }, `${fieldLabel} option saved.`)
                                }
                              >
                                Save
                              </Button>
                              <Button variant="secondary" type="button" onClick={onCancelEdit}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="secondary" type="button" onClick={() => onStartEdit(option)}>
                                Edit
                              </Button>
                              <Button
                                variant={option.status === "active" ? "dangerQuiet" : "secondary"}
                                type="button"
                                onClick={() =>
                                  onUpdateOption(
                                    option.id,
                                    { label: option.label, status: option.status === "active" ? "inactive" : "active" },
                                    `${fieldLabel} option ${option.status === "active" ? "deactivated" : "reactivated"}.`
                                  )
                                }
                              >
                                {option.status === "active" ? "Deactivate" : "Reactivate"}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="empty-state" colSpan="3">
                    No options match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
