"use client";

import { useState } from "react";
import Button from "./ui/Button";
import CloseButton from "./ui/CloseButton";
import Field from "./ui/Field";
import SideDrawer from "./ui/SideDrawer";
import TextInput from "./ui/TextInput";
import PasswordFields, { isStrongPassword } from "./PasswordFields";
import { request } from "../utils/api";

export default function ChangePasswordModal({ open, onClose, onComplete }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!isStrongPassword(newPassword) || newPassword !== confirmPassword) {
      setError(
        newPassword !== confirmPassword
          ? "Passwords do not match."
          : "Password does not meet all security requirements."
      );
      return;
    }

    setSaving(true);
    try {
      await request("/api/auth/password/change", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onComplete();
    } catch (requestError) {
      setError(requestError.payload?.errors?.join(". ") || requestError.message);
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <SideDrawer
      onClose={onClose}
      className="change-password-drawer"
      labelledBy="change-password-title"
      closeDisabled={saving}
    >
      <header className="modal-header change-password-header">
        <div>
          <span className="modal-eyebrow">Account security</span>
          <h2 id="change-password-title">Change password</h2>
          <p>Enter your current password before choosing a new one.</p>
        </div>
        <CloseButton className="modal-close-button" onClick={onClose} disabled={saving} autoFocus />
      </header>
      <form className="change-password-form" onSubmit={submit} noValidate>
        <div className="change-password-body">
          <Field label="Current password" htmlFor="current-password" required>
            <TextInput
              id="current-password"
              type={showPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          <PasswordFields
            password={newPassword}
            confirmPassword={confirmPassword}
            onPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            showPassword={showPassword}
            onVisibilityChange={setShowPassword}
            prefix="change-password"
          />
          {error ? (
            <div className="activation-error" role="alert">
              {error}
            </div>
          ) : null}
        </div>
        <footer className="change-password-footer">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" busy={saving} busyLabel="Changing password...">
            Change password
          </Button>
        </footer>
      </form>
    </SideDrawer>
  );
}
