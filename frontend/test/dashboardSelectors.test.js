import assert from "node:assert/strict";
import { test } from "vitest";

import { buildDashboardInsights, buildDashboardMetrics } from "../app/features/dashboard/selectors.js";
import { filterAndSortUsers } from "../app/features/users/selectors.js";

const bookings = [
  {
    id: "1",
    region: "North",
    amNameFromFile: "AM North",
    avlStatus: "Ready",
    areaInputs: { updatedAt: "a", bookingCategory: "Priority" },
    regionalInputs: { updatedAt: "r" }
  },
  { id: "2", region: "South", avlStatus: "Pending", areaInputs: {}, regionalInputs: {} }
];

test("dashboard metrics retain workflow counts and sequence helpers", () => {
  const metrics = buildDashboardMetrics(bookings);
  assert.deepEqual(
    metrics.map(({ value }) => value),
    [2, 1, 1, 1, 1]
  );
  assert.equal(metrics.at(-1).helper, "1 not started | 0 sequence gaps");
});

test("dashboard insights preserve admin and assigned-user views", () => {
  assert.deepEqual(
    buildDashboardInsights(bookings, true).map(({ title }) => title),
    ["Bookings by area", "Pending workflow by area", "Completion rate by area"]
  );
  assert.deepEqual(
    buildDashboardInsights(bookings, false).map(({ title }) => title),
    ["Workflow completion", "Booking categories", "Availability status"]
  );
});

test("user selector includes admins and combines search, filters, and sorting", () => {
  const users = [
    { name: "Zed", role: "Dealer", region: "North", status: "active" },
    { name: "Amy", role: "Dealer", region: "South", status: "active" },
    { name: "Root", role: "Admin", region: "All", status: "active" }
  ];
  const result = filterAndSortUsers(users, {
    search: "",
    role: "Dealer",
    region: "",
    status: "active",
    sortKey: "name",
    sortDir: "asc"
  });
  assert.deepEqual(
    result.map(({ name }) => name),
    ["Amy", "Zed"]
  );

  const admins = filterAndSortUsers(users, {
    search: "root",
    role: "Admin",
    region: "",
    status: "active",
    sortKey: "name",
    sortDir: "asc"
  });
  assert.deepEqual(
    admins.map(({ name }) => name),
    ["Root"]
  );
});
