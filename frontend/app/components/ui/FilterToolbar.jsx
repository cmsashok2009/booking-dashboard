"use client";

export default function FilterToolbar({ label = "Filters", className = "", children }) {
  return (
    <div className={`filter-toolbar ${className}`.trim()} role="search" aria-label={label}>
      {children}
    </div>
  );
}
