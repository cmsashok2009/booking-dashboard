import assert from "node:assert/strict";
import { test } from "vitest";

import { filterBookingSourceRows } from "../app/features/bookings/sourceFilters.js";

const rows = [
  { id: "1", salesOrderId: "SOB1", region: "North", areaInputs: { updatedAt: "2026-01-01" }, regionalInputs: {} },
  {
    id: "2",
    salesOrderId: "SOB2",
    region: "South",
    areaInputs: {},
    regionalInputs: { updatedAt: "2026-01-02", retailInput: "Ready" }
  }
];

test("booking source filters combine search, region, and workflow", () => {
  assert.deepEqual(
    filterBookingSourceRows(rows, { search: "sob1", region: "North", workflow: "area-updated" }).map(({ id }) => id),
    ["1"]
  );
  assert.deepEqual(
    filterBookingSourceRows(rows, { search: "ready", region: "", workflow: "regional-updated" }).map(({ id }) => id),
    ["2"]
  );
});

test("pending workflow includes records missing either manager update", () => {
  assert.deepEqual(
    filterBookingSourceRows(rows, { search: "", region: "", workflow: "pending" }).map(({ id }) => id),
    ["1", "2"]
  );
});
