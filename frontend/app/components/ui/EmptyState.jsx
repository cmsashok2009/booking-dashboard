"use client";

export default function EmptyState({ title, description, action = null, className = "" }) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      {title ? <h3>{title}</h3> : null}
      {description ? <p>{description}</p> : null}
      {action ? action : null}
    </div>
  );
}
