"use client";

export default function Panel({ className = "", children, ...props }) {
  return (
    <section className={`app-panel ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}
