import { test } from "vitest";
import assert from "node:assert/strict";
import { seedData } from "../../backend/src/validators.js";
import { analyzeReconciliation, hasSupplyPath } from "../app/utils/reconciliation.js";
import { isWorkflowPending } from "../app/utils/bookings.js";

test("reconciliation metrics remain consistent for the 100-row booking sample", () => {
  const bookings = seedData().bookings;
  const analysis = analyzeReconciliation(bookings);

  assert.equal(analysis.total, 100);
  assert.equal(analysis.supplyPathCount, 75);
  assert.equal(analysis.fullyMatchedCount, 33);
  assert.equal(analysis.retailCommittedCount, 66);
  assert.equal(analysis.noSupplyCount, 25);
  const completed = bookings.filter((booking) => booking.areaInputs?.updatedAt && booking.regionalInputs?.updatedAt);
  const needsAttention = bookings.filter(isWorkflowPending);
  assert.equal(completed.length, 50);
  assert.equal(needsAttention.length, 50);
  assert.equal(completed.length + needsAttention.length, bookings.length);
  assert.deepEqual(
    analysis.funnel.map((stage) => stage.value),
    [100, 75, 33, 66]
  );
});

test("commitment signals read their respective source fields", () => {
  const analysis = analyzeReconciliation(seedData().bookings);
  assert.deepEqual(
    analysis.signals.map((signal) => signal.value),
    [66, 33, 33, 34]
  );
});

test("all unsupported sample bookings are New DUSTER", () => {
  const unsupported = seedData().bookings.filter((booking) => !hasSupplyPath(booking));
  assert.equal(unsupported.length, 25);
  assert.deepEqual([...new Set(unsupported.map((booking) => booking.model))], ["New DUSTER"]);
});
