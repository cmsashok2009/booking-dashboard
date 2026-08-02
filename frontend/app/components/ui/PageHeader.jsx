"use client";

export default function PageHeader({ title, subtitle, badge = null, actions = null, className = "" }) {
  return (
    <div className={`section-heading-row ${className}`.trim()}>
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {badge ? badge : null}
      {actions ? <div className="section-heading-actions">{actions}</div> : null}
    </div>
  );
}
