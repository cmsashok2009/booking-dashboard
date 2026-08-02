"use client";

import { useState } from "react";
import Button from "../../components/ui/Button";
import FilterToolbar from "../../components/ui/FilterToolbar";
import Select from "../../components/ui/Select";
import TextInput from "../../components/ui/TextInput";
import TabbedWorkspace from "../../components/ui/TabbedWorkspace";
import FeatureErrorBoundary from "../../components/FeatureErrorBoundary";
import EditableUsersTable from "../../components/EditableUsersTable";
import Pagination from "../../components/Pagination";
import UserOnboardingWizard from "../../components/UserOnboardingWizard";
import { paged } from "../../utils/pagination";

function uniqueValues(users, key) {
  return [...new Set(users.map((item) => item[key]).filter(Boolean))].sort();
}

const USER_STATUSES = ["active", "pending_invitation", "invited", "inactive", "locked"];

function catalogValues(catalog, users, key) {
  return [...new Set([...(catalog || []), ...uniqueValues(users, key)])].filter(Boolean);
}

function statusLabel(value) {
  return String(value)
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}
export default function UsersWorkspace({
  activeView,
  user,
  users,
  filteredUsers,
  filters,
  page,
  roles,
  regions,
  workflows,
  onboarding,
  onAddSingle,
  onAddBulk,
  onAbortWorkflow,
  onContinueWorkflow,
  onDownload,
  onFilterChange,
  onSort,
  onUserUpdated,
  onPageChange
}) {
  const [section, setSection] = useState("current");
  const visibleUsers = paged(filteredUsers, page);
  const activeWorkflows = workflows.filter((workflow) => !["completed", "cancelled"].includes(workflow.status));

  const groups = [
    {
      id: "users",
      label: "User administration",
      items: [
        { value: "current", label: "Current Users" },
        { value: "add", label: "Add Users" }
      ]
    }
  ];

  return (
    <TabbedWorkspace
      label="User Management"
      groups={groups}
      value={section}
      onChange={setSection}
      idPrefix="user-management"
      className="user-management-workspace"
      canvasClassName="user-management-canvas"
    >
      {section === "add" ? (
        <div className="user-management-add-view">
          <section className="panel user-entry-panel">
            <div className="section-heading-row">
              <div>
                <h2>Add Users</h2>
                <p>Choose how you want to create dashboard users.</p>
              </div>
              <div className="user-entry-actions">
                <Button type="button" onClick={onAddSingle}>
                  Add Single User
                </Button>
                <Button type="button" variant="secondary" onClick={onAddBulk}>
                  Bulk Upload
                </Button>
              </div>
            </div>
          </section>
          {activeWorkflows.length ? (
            <section className="panel onboarding-resume-panel" aria-labelledby="onboarding-resume-title">
              <div className="section-heading-row">
                <div>
                  <h2 id="onboarding-resume-title">Onboarding in progress</h2>
                  <p>Continue a validated batch without repeating completed steps.</p>
                </div>
              </div>
              <div className="onboarding-resume-list">
                {activeWorkflows.map((workflow) => (
                  <div key={workflow.id}>
                    <span>
                      <strong>{workflow.fileName || "User upload"}</strong>
                      <small>Paused at {String(workflow.currentStep || "validation").replaceAll("_", " ")}</small>
                    </span>
                    <div className="onboarding-resume-actions">
                      <Button variant="dangerQuiet" type="button" onClick={() => onAbortWorkflow(workflow)}>
                        Abort
                      </Button>
                      <Button variant="secondary" type="button" onClick={() => onContinueWorkflow(workflow)}>
                        Continue
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <section className="panel user-management-current-view">
          <div className="section-heading-row">
            <div>
              <h2>Current Users</h2>
              <p>{filteredUsers.length} users match the current view.</p>
            </div>
            <Button variant="secondary" type="button" onClick={onDownload}>
              Download Users
            </Button>
          </div>
          <FilterToolbar label="Filter users" className="user-filter-toolbar">
            <TextInput
              aria-label="Search users"
              value={filters.search}
              onChange={(event) => onFilterChange({ search: event.target.value })}
              placeholder="Search name, email, or role"
            />
            <Select
              aria-label="Filter users by role"
              value={filters.role}
              onChange={(event) => onFilterChange({ role: event.target.value })}
            >
              <option value="">All roles</option>
              {catalogValues(roles, users, "role").map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Select
              aria-label="Filter users by status"
              value={filters.status}
              onChange={(event) => onFilterChange({ status: event.target.value })}
            >
              <option value="">All statuses</option>
              {catalogValues(USER_STATUSES, users, "status").map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter users by region"
              value={filters.region}
              onChange={(event) => onFilterChange({ region: event.target.value })}
            >
              <option value="">All regions</option>
              {catalogValues(regions, users, "region").map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Button
              variant="outline"
              type="button"
              onClick={() => onFilterChange({ search: "", role: "", status: "", region: "" })}
            >
              Clear
            </Button>
          </FilterToolbar>
          <FeatureErrorBoundary name="User table" resetKey={activeView}>
            <EditableUsersTable
              users={visibleUsers}
              roles={roles}
              regions={regions}
              updatedBy={user.id}
              sortState={{ key: filters.sortKey, direction: filters.sortDir }}
              onSort={onSort}
              onUserUpdated={onUserUpdated}
            />
          </FeatureErrorBoundary>
          <Pagination page={page} totalRows={filteredUsers.length} onPageChange={onPageChange} />
        </section>
      )}
      {onboarding.open ? (
        <FeatureErrorBoundary name="User onboarding" resetKey={onboarding.workflowId}>
          <UserOnboardingWizard {...onboarding} user={user} roles={roles} />
        </FeatureErrorBoundary>
      ) : null}
    </TabbedWorkspace>
  );
}
