"use client";

import Button from "./Button";

export default function IconButton({ label, title, className = "", children, ...props }) {
  if (!label) throw new Error("IconButton requires an accessible label.");
  return (
    <Button
      className={`icon-button ${className}`.trim()}
      variant="secondary"
      aria-label={label}
      title={title || label}
      {...props}
    >
      {children}
    </Button>
  );
}
