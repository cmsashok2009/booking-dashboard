"use client";

export default function Table({ className = "", children, "aria-label": ariaLabel, ...props }) {
  return (
    <div
      className={`app-table-wrap ${className}`.trim()}
      role="region"
      aria-label={ariaLabel || "Scrollable data table"}
      tabIndex={0}
    >
      <table className="app-table" aria-label={ariaLabel} {...props}>
        {children}
      </table>
    </div>
  );
}
