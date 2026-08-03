"use client";

import { Tab, TabList } from "./Tabs";

export default function GroupedTabs({ label, groups, value, onChange, controls, idPrefix, className = "" }) {
  const activeGroup = groups.find((group) => group.items.some((item) => item.value === value)) || groups[0];
  const hasParentNavigation = groups.length > 1;

  return (
    <section className={`grouped-page-tabs ${className}`.trim()} aria-label={label}>
      {hasParentNavigation ? (
        <TabList label={`${label} categories`} className="grouped-tabs-parents">
          {groups.map((group) => {
            const selected = group.id === activeGroup.id;
            return (
              <Tab
                key={group.id}
                selected={selected}
                id={`${idPrefix}-parent-${group.id}`}
                controls={`${idPrefix}-children`}
                onClick={() => onChange(group.items[0].value)}
              >
                {group.label}
              </Tab>
            );
          })}
        </TabList>
      ) : null}
      <TabList id={`${idPrefix}-children`} label={`${activeGroup.label} sections`} className="grouped-tabs-children">
        {activeGroup.items.map((item) => (
          <Tab
            key={item.value}
            selected={item.value === value}
            id={`${idPrefix}-tab-${item.value}`}
            controls={controls}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </Tab>
        ))}
      </TabList>
    </section>
  );
}
