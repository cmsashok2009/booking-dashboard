"use client";

export default function MetricCard({ label, value, helper, tone = "", className = "", ...props }) {
  return (
    <div className={`card metric-card ${tone ? `metric-${tone}` : ""} ${className}`.trim()} {...props}>
      <div className="label">{label}</div>
      <div className="metric-value">{value}</div>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}
