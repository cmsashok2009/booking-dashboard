"use client";

import { Children, cloneElement, isValidElement, useRef } from "react";

export function TabList({ id, label, className = "", children }) {
  const listRef = useRef(null);
  function handleKeyDown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...listRef.current.querySelectorAll('[role="tab"]:not(:disabled)')];
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex < 0) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  }
  return (
    <div
      id={id}
      ref={listRef}
      className={`app-tab-list ${className}`.trim()}
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      {Children.map(children, (child) =>
        isValidElement(child) ? cloneElement(child, { tabIndex: child.props.selected ? 0 : -1 }) : child
      )}
    </div>
  );
}
export function Tab({ selected = false, controls, id, children, className = "", ...props }) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      className={`app-tab ${selected ? "active" : ""} ${className}`.trim()}
      aria-selected={selected}
      aria-controls={controls}
      {...props}
    >
      {children}
    </button>
  );
}
