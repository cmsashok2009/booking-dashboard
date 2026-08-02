"use client";

const VARIANTS = {
  success: "active",
  warning: "",
  danger: "inactive",
  info: ""
};

export default function StatusBadge({ variant = "info", children, className = "" }) {
  const variantClass = VARIANTS[variant] || "";
  return (
    <span className={`status-pill ${variantClass} ${className}`.trim()}>
      <span />
      {children}
    </span>
  );
}
