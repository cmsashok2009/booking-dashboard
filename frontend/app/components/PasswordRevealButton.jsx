"use client";

import Button from "./ui/Button";

export default function PasswordRevealButton({ onVisibilityChange }) {
  function reveal(event) {
    event.preventDefault();
    onVisibilityChange(true);
  }

  function conceal() {
    onVisibilityChange(false);
  }

  function keyDown(event) {
    if (["Enter", " "].includes(event.key)) reveal(event);
  }

  function keyUp(event) {
    if (["Enter", " "].includes(event.key)) conceal();
  }

  return (
    <Button
      variant="ghost"
      type="button"
      className="password-reveal-button"
      aria-label="Hold to show password"
      title="Hold to show password"
      onPointerDown={reveal}
      onPointerUp={conceal}
      onPointerLeave={conceal}
      onPointerCancel={conceal}
      onBlur={conceal}
      onKeyDown={keyDown}
      onKeyUp={keyUp}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.75" />
      </svg>
    </Button>
  );
}
