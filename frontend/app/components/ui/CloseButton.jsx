"use client";

import { forwardRef } from "react";
import Button from "./Button";

const CloseButton = forwardRef(function CloseButton({ label = "Close", title, className = "", ...props }, ref) {
  return (
    <Button
      ref={ref}
      className={`app-close-button ${className}`.trim()}
      variant="ghost"
      type="button"
      aria-label={label}
      title={title || label}
      {...props}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </Button>
  );
});

export default CloseButton;
