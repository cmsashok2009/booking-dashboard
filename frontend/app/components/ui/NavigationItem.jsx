"use client";

export default function NavigationItem({ active = false, children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`app-navigation-item ${active ? "active" : ""} ${className}`.trim()}
      aria-current={active ? "page" : undefined}
      {...props}
    >
      {children}
    </button>
  );
}
