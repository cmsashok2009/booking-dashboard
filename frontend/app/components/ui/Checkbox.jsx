"use client";

export default function Checkbox({ label, hint, error, className = "", ...props }) {
  return (
    <label className={`checkbox-field ${className}`.trim()}>
      <span className="checkbox-control">
        <input type="checkbox" {...props} />
        <span>{label}</span>
      </span>
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
