"use client";

import GroupedTabs from "./GroupedTabs";

export default function TabbedWorkspace({
  label,
  groups,
  value,
  onChange,
  idPrefix,
  className = "",
  canvasClassName = "",
  children
}) {
  const panelId = `${idPrefix}-panel`;

  return (
    <section className={`tabbed-workspace ${className}`.trim()} aria-label={label}>
      <GroupedTabs
        label={label}
        groups={groups}
        value={value}
        onChange={onChange}
        controls={panelId}
        idPrefix={idPrefix}
        className="tabbed-workspace-tabs"
      />
      <div
        id={panelId}
        className={`tabbed-workspace-canvas ${canvasClassName}`.trim()}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-tab-${value}`}
      >
        {children}
      </div>
    </section>
  );
}
