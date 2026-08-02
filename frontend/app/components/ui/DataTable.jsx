"use client";

export default function DataTable({ className = "", tableClassName = "", children, ...props }) {
  return (
    <div className={`table-wrap app-data-table ${className}`.trim()}>
      <table className={tableClassName} {...props}>
        {children}
      </table>
    </div>
  );
}
