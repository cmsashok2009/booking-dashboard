"use client";

export default function InsightBarChart({ title, subtitle, items, total }) {
  return (
    <section className="insight-chart" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>
      <div className="insight-bars">
        {items.length ? (
          items.map((item) => {
            const percentage = item.percentage ?? (total ? Math.round((item.value / total) * 100) : 0);
            const displayedValue = item.displayValue ?? item.value;
            return (
              <div className="insight-bar-row" key={item.label}>
                <div className="insight-bar-label">
                  <span>{item.label}</span>
                  <strong>
                    {displayedValue} <small>{percentage}%</small>
                  </strong>
                </div>
                <div
                  className="insight-bar-track"
                  role="img"
                  aria-label={`${item.label}: ${item.value}, ${percentage}%`}
                >
                  <span
                    className={`insight-bar-fill insight-${item.tone || "blue"}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="insight-empty">No booking data available.</p>
        )}
      </div>
    </section>
  );
}
