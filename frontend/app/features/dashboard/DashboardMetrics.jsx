"use client";

export default function DashboardMetrics({ metrics, onSelect }) {
  return (
    <div className="grid metrics" aria-label="Booking metrics">
      {metrics.map((metric) => (
        <button
          className={`card metric-link metric-${metric.tone}`}
          key={metric.filter}
          onClick={() => onSelect(metric.filter)}
          title={`Open ${metric.label} details`}
          type="button"
        >
          <span className="label">{metric.label}</span>
          <strong className="metric-value">{metric.value}</strong>
          <small>{metric.helper}</small>
        </button>
      ))}
    </div>
  );
}
