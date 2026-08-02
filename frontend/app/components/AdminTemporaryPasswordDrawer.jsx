"use client";

import { useEffect, useState } from "react";
import Button from "./ui/Button";
import CloseButton from "./ui/CloseButton";
import SideDrawer from "./ui/SideDrawer";
import PasswordFields, { isStrongPassword } from "./PasswordFields";
import { request } from "../utils/api";

export default function AdminTemporaryPasswordDrawer({ user, onClose }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setSaving(false);
    setError("");
    setSaved(false);
  }, [user?.id]);

  if (!user) return null;

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!isStrongPassword(password)) {
      setError("Password does not meet all security requirements.");
      return;
    }
    setSaving(true);
    try {
      await request(`/api/admin/users/${encodeURIComponent(user.id)}/temporary-password`, {
        method: "POST",
        body: JSON.stringify({ password, confirmPassword })
      });
      setPassword("");
      setConfirmPassword("");
      setSaved(true);
    } catch (requestError) {
      setError(requestError.payload?.errors?.join(". ") || requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SideDrawer
      className="admin-temporary-password-drawer"
      labelledBy="admin-temporary-password-title"
      describedBy="admin-temporary-password-description"
      closeDisabled={saving}
      onClose={onClose}
    >
      <header className="modal-header admin-temporary-password-header">
        <div>
          <span className="modal-eyebrow">Account security</span>
          <h2 id="admin-temporary-password-title">Set temporary password</h2>
          <p id="admin-temporary-password-description">Create a temporary sign-in password for this user.</p>
        </div>
        <CloseButton className="modal-close-button" onClick={onClose} disabled={saving} autoFocus />
      </header>
      {saved ? (
        <div className="admin-temporary-password-complete">
          <div role="status">
            <h3>Temporary password updated</h3>
            <p>Existing sessions and password reset links have been revoked. Share the password through an approved secure channel.</p>
          </div>
          <footer className="admin-temporary-password-footer">
            <Button type="button" onClick={onClose}>Done</Button>
          </footer>
        </div>
      ) : (
        <form className="admin-temporary-password-form" onSubmit={submit} noValidate>
          <div className="admin-temporary-password-body">
            <dl className="admin-temporary-password-user">
              <div><dt>User</dt><dd>{user.name}</dd></div>
              <div><dt>Email</dt><dd>{user.email}</dd></div>
              <div><dt>Status</dt><dd>{user.status}</dd></div>
            </dl>
            <PasswordFields
              password={password}
              confirmPassword={confirmPassword}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              showPassword={showPassword}
              onVisibilityChange={setShowPassword}
              prefix="admin-temporary-password"
            />
            <p className="field-hint">The password is never displayed again or included in logs.</p>
            {user.status !== "active" ? <div className="activation-error" role="alert">Activate this user before setting a temporary password.</div> : null}
            {error ? <div className="activation-error" role="alert">{error}</div> : null}
          </div>
          <footer className="admin-temporary-password-footer">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" busy={saving} busyLabel="Setting password..." disabled={user.status !== "active"}>Set temporary password</Button>
          </footer>
        </form>
      )}
    </SideDrawer>
  );
}
