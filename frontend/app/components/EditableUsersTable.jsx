"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "./ui/Button";
import Select from "./ui/Select";
import TextInput from "./ui/TextInput";
import TableEmptyState from "./ui/TableEmptyState";
import NotificationToast from "./NotificationToast";
import AdminTemporaryPasswordDrawer from "./AdminTemporaryPasswordDrawer";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { displayValue } from "../utils/bookings";
import { request } from "../utils/api";
import {
  editableUserRegionChange,
  editableUserServerErrors,
  editableUserValues,
  validateEditableUser
} from "../features/users/editableUser";
import EditableUserRegionField from "../features/users/EditableUserRegionField";
import { editableUserField } from "../features/users/editableUserField";

export default function EditableUsersTable({
  users,
  roles,
  regions,
  dealerCodes = [],
  sortState,
  onSort,
  onUserUpdated
}) {
  const [rows, setRows] = useState(users);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const rowRef = useRef(null);
  const stayButtonRef = useRef(null);
  const discardButtonRef = useRef(null);

  useEffect(() => setRows(users), [users]);

  const original = useMemo(() => rows.find((row) => row.id === editingId), [editingId, rows]);
  const dirty = Boolean(
    original && draft && Object.keys(draft).some((key) => draft[key] !== editableUserValues(original)[key])
  );

  useEffect(() => {
    if (!editingId) return undefined;
    const handleOutsideInteraction = (event) => {
      if (event.target.closest?.(".confirm-dialog") || rowRef.current?.contains(event.target)) return;
      if (!dirty) {
        setEditingId(null);
        setDraft(null);
        setErrors({});
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (event.type === "pointerdown") setConfirmOpen(true);
    };
    document.addEventListener("pointerdown", handleOutsideInteraction, true);
    document.addEventListener("click", handleOutsideInteraction, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideInteraction, true);
      document.removeEventListener("click", handleOutsideInteraction, true);
    };
  }, [dirty, editingId]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!confirmOpen) return undefined;
    stayButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmOpen(false);
      }
      if (event.key === "Tab") {
        const first = stayButtonRef.current;
        const last = discardButtonRef.current;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmOpen]);

  function beginEdit(user) {
    if (editingId === user.id) return;
    setEditingId(user.id);
    setDraft(editableUserValues(user));
    setErrors({});
  }

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function updateRegion(value) {
    setDraft((current) => editableUserRegionChange(current, value, dealerCodes));
    setErrors((current) => ({ ...current, region: undefined, dealerCode: undefined }));
  }

  function discardChanges() {
    setConfirmOpen(false);
    setEditingId(null);
    setDraft(null);
    setErrors({});
  }

  async function saveUser() {
    const nextErrors = validateEditableUser(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setNotice({ type: "warning", message: "Complete the highlighted required fields before saving." });
      return;
    }

    setSaving(true);
    try {
      const payload = await request("/api/ui/users/update", {
        method: "PATCH",
        body: JSON.stringify({ userId: editingId, ...draft })
      });
      setRows((current) => current.map((row) => (row.id === editingId ? payload.user : row)));
      setEditingId(null);
      setDraft(null);
      setErrors({});
      setNotice({ type: "success", message: `${payload.user.name} was updated successfully.` });
      onUserUpdated?.(payload.user);
    } catch (error) {
      const serverErrors = error.payload?.errors || [];
      setErrors(editableUserServerErrors(serverErrors));
      setNotice({ type: "error", message: serverErrors[0]?.errorMessage || error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <NotificationToast notice={notice} onClose={() => setNotice(null)} />
      <div className="table-wrap">
        <table className="users-table editable-users-table">
          <thead>
            <tr>
              {[
                ["name", "Name"],
                ["email", "Email"],
                ["role", "Role"],
                ["region", "Region"],
                ["status", "Status"]
              ].map(([key, label]) => (
                <th key={key}>
                  <button className="sort-link" type="button" onClick={() => onSort(key)}>
                    {label}
                    <span>
                      {sortState.key === key ? (sortState.direction === "asc" ? "\u25B2" : "\u25BC") : "\u2195"}
                    </span>
                  </button>
                </th>
              ))}
              <th className="user-action-column">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((user) => {
                const editing = editingId === user.id;
                const emailLocked = user.status === "invited" || Boolean(user.invitedAt || user.activatedAt);
                const lifecycleStatus = ["pending_invitation", "invited"].includes(user.status);
                return (
                  <tr className={editing ? "editing-row" : ""} key={user.id} ref={editing ? rowRef : null}>
                    <td>
                      {editing
                        ? editableUserField(
                            errors,
                            "name",
                            <TextInput
                              aria-label={`Name for ${user.email}`}
                              className={errors.name ? "input-error" : ""}
                              value={draft.name}
                              onChange={(event) => updateField("name", event.target.value)}
                            />
                          )
                        : displayValue(user.name)}
                    </td>
                    <td>
                      {editing
                        ? editableUserField(
                            errors,
                            "email",
                            <>
                              <TextInput
                                aria-label={`Email for ${user.name}`}
                                className={`${errors.email ? "input-error" : ""} ${emailLocked ? "locked-user-email" : ""}`}
                                type="email"
                                value={draft.email}
                                readOnly={emailLocked}
                                aria-describedby={emailLocked ? `email-lock-${user.id}` : undefined}
                                onChange={(event) => updateField("email", event.target.value)}
                              />
                              {emailLocked ? (
                                <span className="field-hint email-lock-hint" id={`email-lock-${user.id}`}>
                                  Locked after invitation. A verified email-change flow is required.
                                </span>
                              ) : null}
                            </>
                          )
                        : displayValue(user.email)}
                    </td>
                    <td>
                      {editing
                        ? editableUserField(
                            errors,
                            "role",
                            <Select
                              aria-label={`Role for ${user.name}`}
                              className={errors.role ? "input-error" : ""}
                              value={draft.role}
                              onChange={(event) => updateField("role", event.target.value)}
                            >
                              <option value="">Select role</option>
                              {roles.map((role) => (
                                <option key={role}>{role}</option>
                              ))}
                            </Select>
                          )
                        : displayValue(user.role)}
                    </td>
                    <td>
                      {editing
                        ? editableUserField(
                            errors,
                            "region",
                            <EditableUserRegionField
                              userName={user.name}
                              region={draft.region}
                              dealerCode={draft.dealerCode}
                              regions={regions}
                              dealerCodes={dealerCodes}
                              errors={errors}
                              onRegionChange={updateRegion}
                              onDealerCodeChange={(value) => updateField("dealerCode", value)}
                            />
                          )
                        : displayValue(user.region)}
                    </td>
                    <td>
                      {editing ? (
                        lifecycleStatus ? (
                          <div className="lifecycle-status-readonly">
                            <span className={`status-dot ${user.status}`}>{displayValue(user.status)}</span>
                            <span className="field-hint">Managed by activation workflow</span>
                          </div>
                        ) : (
                          editableUserField(
                            errors,
                            "status",
                            <Select
                              aria-label={`Status for ${user.name}`}
                              className={errors.status ? "input-error" : ""}
                              value={draft.status}
                              onChange={(event) => updateField("status", event.target.value)}
                            >
                              <option value="">Select status</option>
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                              <option value="locked">Locked</option>
                            </Select>
                          )
                        )
                      ) : (
                        <span className={`status-dot ${user.status}`}>{displayValue(user.status)}</span>
                      )}
                    </td>
                    <td className="user-action-column">
                      <div className="user-row-actions">
                        <Button
                          className={editing ? "save-user-button" : "edit-user-button"}
                          variant={editing ? "primary" : "secondary"}
                          type="button"
                          busy={saving && editing}
                          busyLabel="Saving..."
                          onClick={() => (editing ? saveUser() : beginEdit(user))}
                        >
                          {editing ? "Save" : "Edit"}
                        </Button>
                        {!editing ? (
                          <Button type="button" variant="outline" onClick={() => setPasswordUser(user)}>
                            Set password
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="empty-state" colSpan="6">
                  No users match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminTemporaryPasswordDrawer
        user={passwordUser}
        onClose={() => setPasswordUser(null)}
        onUserUpdated={(updatedUser) => {
          setRows((current) => current.map((row) => (row.id === updatedUser.id ? updatedUser : row)));
          setPasswordUser(updatedUser);
          onUserUpdated?.(updatedUser);
        }}
      />

      <UnsavedChangesDialog
        open={confirmOpen}
        stayButtonRef={stayButtonRef}
        discardButtonRef={discardButtonRef}
        onStay={() => setConfirmOpen(false)}
        onDiscard={discardChanges}
      />
    </>
  );
}
