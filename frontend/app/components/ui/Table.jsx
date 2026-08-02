"use client";

export default function Table({ className = "", children, ...props }) {
  return (
    <div className={`app-table-wrap ${className}`.trim()}>
      <table className="app-table" {...props}>
        {children}
      </table>
    </div>
  );
}
