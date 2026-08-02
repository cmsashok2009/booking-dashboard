"use client";

export default function Field({ label, htmlFor, required = false, hint, error, className = "", children }) {
  return (
    <div className={`app-field field ${className}`.trim()}>
      <label htmlFor={htmlFor}>
        {label} {required ? <span className="required-marker">*</span> : null}
      </label>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
