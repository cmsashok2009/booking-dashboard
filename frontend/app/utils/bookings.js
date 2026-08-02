import { NOT_AVAILABLE } from "../constants/dashboard.js";

export function displayValue(value) {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  if (typeof value === "string" && !value.trim()) return NOT_AVAILABLE;
  return value;
}

export function readPath(row, key) {
  return key.split(".").reduce((value, part) => value?.[part], row) ?? "";
}

export function isWorkflowPending(booking) {
  return !booking.areaInputs?.updatedAt || !booking.regionalInputs?.updatedAt;
}

export function applyDetailFilter(rows, detailFilter) {
  if (detailFilter === "area-updated") return rows.filter((booking) => booking.areaInputs?.updatedAt);
  if (detailFilter === "regional-updated") return rows.filter((booking) => booking.regionalInputs?.updatedAt);
  if (detailFilter === "fully-complete")
    return rows.filter((booking) => booking.areaInputs?.updatedAt && booking.regionalInputs?.updatedAt);
  if (detailFilter === "needs-attention") return rows.filter(isWorkflowPending);
  if (detailFilter === "pending") return rows.filter(isWorkflowPending);
  return rows;
}

export function detailTitle(detailFilter) {
  return (
    {
      all: "All Bookings",
      "area-updated": "Area Updated Bookings",
      "regional-updated": "Regional Updated Bookings",
      "fully-complete": "Fully Completed Bookings",
      "needs-attention": "Bookings Needing Attention",
      pending: "Bookings Needing Attention"
    }[detailFilter] || "All Bookings"
  );
}

export function buildDistribution(rows, valueSelector, limit = 5) {
  const counts = rows.reduce((result, row) => {
    const value = String(valueSelector(row) || "Not updated").trim() || "Not updated";
    result.set(value, (result.get(value) || 0) + 1);
    return result;
  }, new Map());

  const sorted = [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));

  if (sorted.length <= limit) return sorted;
  const visible = sorted.slice(0, limit - 1);
  const otherValue = sorted.slice(limit - 1).reduce((total, item) => total + item.value, 0);
  return [...visible, { label: "Other", value: otherValue }];
}
