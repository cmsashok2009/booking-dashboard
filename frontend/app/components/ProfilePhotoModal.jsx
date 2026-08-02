"use client";

import { useEffect, useRef, useState } from "react";
import Button from "./ui/Button";
import CloseButton from "./ui/CloseButton";
import FileInput from "./ui/FileInput";
import SideDrawer from "./ui/SideDrawer";
import UserAvatar from "./UserAvatar";
import { request } from "../utils/api";

const MAX_BYTES = 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function ProfilePhotoModal({ open, user, onClose, onSaved }) {
  const [preview, setPreview] = useState(user?.avatarUrl || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPreview(user?.avatarUrl || "");
      setError("");
    }
  }, [open, user?.avatarUrl]);

  function choose(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!TYPES.has(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Choose an image smaller than 1 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(String(reader.result));
      setError("");
    };
    reader.onerror = () => setError("The image could not be read. Try another file.");
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const result = await request("/api/profile", { method: "PATCH", body: JSON.stringify({ avatarUrl: preview }) });
      onSaved(result.user);
    } catch (requestError) {
      setError(requestError.message || "Profile photo could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const previewUser = { ...user, avatarUrl: preview };

  return (
    <SideDrawer
      onClose={onClose}
      className="profile-photo-drawer"
      labelledBy="profile-photo-title"
      closeDisabled={saving}
    >
      <header className="modal-header profile-photo-header">
        <div>
          <span className="modal-eyebrow">Your profile</span>
          <h2 id="profile-photo-title">Profile photo</h2>
          <p>Choose the image shown with your account.</p>
        </div>
        <CloseButton className="modal-close-button" disabled={saving} onClick={onClose} autoFocus />
      </header>
      <div className="profile-photo-body">
        <div className="profile-photo-content">
          <UserAvatar user={previewUser} size="xl" />
          <div>
            <strong>{user.name}</strong>
            <p>Use a clear square image for the best result.</p>
          </div>
        </div>
        <div className="profile-photo-actions">
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            Choose image
          </Button>
          {preview ? (
            <Button type="button" variant="ghost" onClick={() => setPreview("")}>
              Remove photo
            </Button>
          ) : null}
        </div>
        <small className="profile-photo-requirements">JPEG, PNG, or WebP. Maximum 1 MB.</small>
        <FileInput
          ref={inputRef}
          className="visually-hidden"
          accept="image/jpeg,image/png,image/webp"
          onChange={choose}
        />
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <footer className="profile-photo-footer">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          busy={saving}
          disabled={saving || preview === (user.avatarUrl || "")}
          busyLabel="Saving..."
          onClick={save}
        >
          Save photo
        </Button>
      </footer>
    </SideDrawer>
  );
}
