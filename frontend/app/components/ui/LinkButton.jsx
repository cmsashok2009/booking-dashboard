"use client";

export default function LinkButton({ className = "", children, variant = "", ...props }) {
  return (
    <a className={`button-link ${variant === "secondary" ? "secondary-link" : ""} ${className}`.trim()} {...props}>
      {children}
    </a>
  );
}
