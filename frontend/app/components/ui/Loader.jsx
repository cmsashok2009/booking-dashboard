"use client";

export default function Loader({ label = "Loading", size = "md", inline = false, className = "" }) {
  return (
    <span
      className={`app-loader app-loader-${size}${inline ? " app-loader-inline" : ""} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className="app-loader-spinner" aria-hidden="true" />
      <span className={inline ? "app-loader-label" : "visually-hidden"}>{label}</span>
    </span>
  );
}
