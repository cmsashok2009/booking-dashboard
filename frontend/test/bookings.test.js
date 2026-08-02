import { test } from "vitest";
import assert from "node:assert/strict";
import { applyDetailFilter, isWorkflowPending } from "../app/utils/bookings.js";

const rows = [
  { id: "complete", areaInputs: { updatedAt: "2026-01-01" }, regionalInputs: { updatedAt: "2026-01-02" } },
  { id: "area-only", areaInputs: { updatedAt: "2026-01-01" }, regionalInputs: { updatedAt: "" } },
  { id: "regional-only", areaInputs: { updatedAt: "" }, regionalInputs: { updatedAt: "2026-01-02" } },
  { id: "not-started", areaInputs: { updatedAt: "" }, regionalInputs: { updatedAt: "" } }
];

test("pending workflow is a unique booking missing either required stage", () => {
  assert.equal(isWorkflowPending(rows[0]), false);
  assert.equal(isWorkflowPending(rows[1]), true);
  assert.equal(isWorkflowPending(rows[2]), true);
  assert.equal(isWorkflowPending(rows[3]), true);
});

test("complete and needs-attention filters form a full non-overlapping partition", () => {
  const completed = applyDetailFilter(rows, "fully-complete");
  const needsAttention = applyDetailFilter(rows, "needs-attention");
  assert.deepEqual(
    completed.map((row) => row.id),
    ["complete"]
  );
  assert.deepEqual(
    needsAttention.map((row) => row.id),
    ["area-only", "regional-only", "not-started"]
  );
  assert.equal(completed.length + needsAttention.length, rows.length);
});
