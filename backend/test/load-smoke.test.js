import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateThresholds,
  percentile,
  summarizeSamples,
} from "../src/load-smoke.js";

test("percentile uses nearest-rank ordering", () => {
  assert.equal(percentile([40, 10, 30, 20], 50), 20);
  assert.equal(percentile([40, 10, 30, 20], 95), 40);
  assert.equal(percentile([], 95), 0);
});

test("load smoke summary aggregates safe route metrics", () => {
  const summary = summarizeSamples([
    { route: "GET /api/health", status: 200, durationMs: 10 },
    { route: "GET /api/health", status: 200, durationMs: 20 },
    { route: "GET /api/bookings", status: 503, durationMs: 50 },
  ]);

  assert.equal(summary.requestCount, 3);
  assert.equal(summary.failureCount, 1);
  assert.equal(summary.byRoute["GET /api/health"].count, 2);
  assert.equal(summary.byRoute["GET /api/bookings"].failures, 1);
  assert.equal(JSON.stringify(summary).includes("example.com"), false);
});

test("load smoke threshold evaluation reports capacity failures", () => {
  const failures = evaluateThresholds(
    {
      requestCount: 10,
      errorRate: 0.2,
      latencyMs: { p95: 900 },
    },
    { minRequests: 30, maxErrorRate: 0.01, maxP95Ms: 750 },
  );

  assert.deepEqual(failures, [
    "requestCount 10 below 30",
    "errorRate 0.2000 above 0.01",
    "p95 900.0ms above 750ms",
  ]);
});
