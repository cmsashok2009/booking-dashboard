"use client";

import { useEffect, useRef, useState } from "react";
import UserAvatar from "./UserAvatar";
import Button from "./ui/Button";

export default function ProfileMenu({ user, onEditProfile, onChangePassword, onLogout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === "Escape" || (event.type === "pointerdown" && !rootRef.current?.contains(event.target)))
        setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  const select = (callback) => {
    setOpen(false);
    callback();
  };
  return (
    <div className="profile-menu" ref={rootRef}>
      <Button
        className="profile-trigger"
        variant="ghost"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Open account menu for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UserAvatar user={user} />
        <span className="profile-signature">
          <strong>{user.name}</strong>
          <small>
            <span>{user.role}</span>
            {user.region ? <span className="profile-scope-region">{user.region}</span> : null}
          </small>
        </span>
        <svg className="profile-chevron" aria-hidden="true" viewBox="0 0 20 20">
          <path d="m6 8 4 4 4-4" />
        </svg>
      </Button>
      {open ? (
        <div className="profile-menu-popover">
          <div className="profile-menu-account">
            <UserAvatar user={user} size="lg" />
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
              <span className="profile-menu-scope">
                {user.role}
                {user.region ? ` - ${user.region}` : ""}
              </span>
            </span>
          </div>
          <div className="profile-menu-actions" role="menu" aria-label="Account actions">
            <Button
              className="profile-menu-item"
              variant="ghost"
              type="button"
              role="menuitem"
              onClick={() => select(onEditProfile)}
            >
              Edit profile photo
            </Button>
            <Button
              className="profile-menu-item"
              variant="ghost"
              type="button"
              role="menuitem"
              onClick={() => select(onChangePassword)}
            >
              Change password
            </Button>
            <div className="profile-menu-divider" />
            <Button
              className="profile-menu-item profile-menu-logout"
              variant="ghost"
              type="button"
              role="menuitem"
              onClick={() => select(onLogout)}
            >
              Log out
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
