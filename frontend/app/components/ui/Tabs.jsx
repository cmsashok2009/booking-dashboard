"use client";

export function TabList({ label, className = "", children }) {
  return (
    <div className={`app-tab-list ${className}`.trim()} role="tablist" aria-label={label}>
      {children}
    </div>
  );
}

export function Tab({ selected = false, controls, children, className = "", ...props }) {
  return (
    <button
      type="button"
      role="tab"
      className={`app-tab ${selected ? "active" : ""} ${className}`.trim()}
      aria-selected={selected}
      aria-controls={controls}
      {...props}
    >
      {children}
    </button>
  );
}
