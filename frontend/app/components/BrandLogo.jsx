export default function BrandLogo({ compact = false, inverse = false, className = "" }) {
  return (
    <div
      className={`brand-logo${compact ? " brand-logo-compact" : ""}${inverse ? " brand-logo-inverse" : ""}${className ? ` ${className}` : ""}`}
      aria-label="Booking Dashboard"
    >
      <span className="brand-logo-mark" aria-hidden="true">
        BD
      </span>
      <span className="brand-logo-name">Booking Dashboard</span>
    </div>
  );
}
