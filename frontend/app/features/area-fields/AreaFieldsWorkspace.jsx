"use client";

import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import TabbedWorkspace from "../../components/ui/TabbedWorkspace";
import TextInput from "../../components/ui/TextInput";
import TableEmptyState from "../../components/ui/TableEmptyState";
import { lookupFieldLabels } from "../../constants/dashboard";
import { filterLookupOptions } from "./options";

const ACCESS_FIELDS = ["roles", "regions", "dealerCodes"];
const WORKFLOW_FIELDS = ["bookingCategory", "wholesalesFeedback", "wsPlanning", "cancellationReason"];

const BUSINESS_SETTING_GROUPS = [
  {
    id: "access",
    label: "Access Data",
    items: ACCESS_FIELDS.map((value) => ({ value, label: lookupFieldLabels[value] }))
  },
  {
    id: "workflow",
    label: "Booking Workflow",
    items: WORKFLOW_FIELDS.map((value) => ({ value, label: lookupFieldLabels[value] }))
  }
];

const ROLE_SCOPES = {
  AM: "Assigned booking updates",
  RM: "Regional booking review",
  ALL_INDIA_I: "National booking oversight",
  ALL_INDIA_II: "National booking oversight",
  ALL_INDIA: "National booking oversight",
  ADMIN: "Application administration"
};

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
  const filteredOptions = filterLookupOptions(options, search, status);
  const fieldLabel = lookupFieldLabels[selectedField];
  const isRoles = selectedField === "roles";
  const isDealerCodes = selectedField === "dealerCodes";

  return (
    <TabbedWorkspace
      label="Business Settings"
      groups={BUSINESS_SETTING_GROUPS}
      value={selectedField}
      onChange={onFieldChange}
      idPrefix="business-settings"
      className="business-settings-workspace"
      canvasClassName="area-options-panel"
    >
      <section className="business-settings-content">
        <div className="section-heading-row">
          <div>
            <span className="reference-data-kicker">
              {ACCESS_FIELDS.includes(selectedField) ? "Access data" : "Booking workflow"}
            </span>
            <h2>{fieldLabel}</h2>
            <p>
              {isRoles
                ? "Built-in roles are defined by the application and are used consistently across User Management."
                : "Active values are available for new booking updates. Inactive values remain in historical records."}
            </p>
          </div>
          <div className="reference-data-actions">
            <small>
              {filteredOptions.length} of {options.length} options
            </small>
            {!isRoles ? (
              <Button className="action-with-icon" type="button" onClick={onOpenAdd}>
                <span aria-hidden="true">+</span>
                {selectedField === "regions"
                  ? "Add region"
                  : selectedField === "dealerCodes"
                    ? "Add dealer code"
                    : "Add option"}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="table-toolbar area-options-toolbar">
          <div className="search-control">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <TextInput
              aria-label={"Search " + fieldLabel}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={"Search " + fieldLabel.toLowerCase()}
            />
          </div>
          <Select
            aria-label="Filter values by status"
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
                <th>{isRoles ? "Role" : "Option"}</th>
                {isRoles ? <th>Access scope</th> : null}
                <th>Status</th>
                {!isRoles ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredOptions.length ? (
                filteredOptions.map((option) => {
                  const isEditing = editingId === option.id;
                  return (
                    <tr key={option.id}>
                      <td>
                        {isEditing && !isRoles ? (
                          <div className="option-edit-field">
                            <TextInput
                              className="option-label-input"
                              value={draft}
                              onChange={(event) => onDraftChange(event.target.value)}
                              data-dialog-focus
                              aria-label={"Edit " + option.label}
                            />
                            {!draft.trim() ? <small className="field-error">Option value is required.</small> : null}
                          </div>
                        ) : (
                          <span className="option-value">{option.label}</span>
                        )}
                      </td>
                      {isRoles ? <td>{ROLE_SCOPES[option.code] || "No booking access assigned"}</td> : null}
                      <td>
                        <span className={"status-pill " + (option.status === "active" ? "active" : "inactive")}>
                          <span aria-hidden="true" />
                          {option.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {!isRoles ? (
                        <td>
                          <div className="area-option-actions">
                            {isEditing ? (
                              <>
                                <Button
                                  type="button"
                                  disabled={!draft.trim()}
                                  onClick={() =>
                                    onUpdateOption(option.id, { label: draft.trim() }, fieldLabel + " option saved.")
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
                                      {
                                        label: option.label,
                                        status: option.status === "active" ? "inactive" : "active"
                                      },
                                      fieldLabel +
                                        " option " +
                                        (option.status === "active" ? "deactivated." : "reactivated.")
                                    )
                                  }
                                >
                                  {option.status === "active" ? "Deactivate" : "Reactivate"}
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="empty-state" colSpan={isRoles ? "3" : "3"}>
                    No options match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </TabbedWorkspace>
  );
}
