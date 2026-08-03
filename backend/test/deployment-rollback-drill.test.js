import assert from "node:assert/strict";
import test from "node:test";
import { runDeploymentRollbackDrill } from "../src/deployment-rollback-drill.js";

const previous = "booking-dashboard/backend@sha256:" + "a".repeat(64);
const failed = "booking-dashboard/backend@sha256:" + "b".repeat(64);

test("deployment rollback drill requires explicit confirmation", async () => {
  await assert.rejects(
    () => runDeploymentRollbackDrill({ env: { ROLLBACK_PREVIOUS_IMAGE: previous, ROLLBACK_FAILED_IMAGE: failed } }),
    /CONFIRM_DEPLOYMENT_ROLLBACK_DRILL=yes/,
  );
});

test("deployment rollback drill requires immutable image digests", async () => {
  await assert.rejects(
    () =>
      runDeploymentRollbackDrill({
        env: {
          CONFIRM_DEPLOYMENT_ROLLBACK_DRILL: "yes",
          ROLLBACK_PREVIOUS_IMAGE: "booking-dashboard/backend:latest",
          ROLLBACK_FAILED_IMAGE: failed,
        },
      }),
    /immutable image digest/,
  );
});

test("deployment rollback drill rejects failed or missing previous-image gates", async () => {
  await assert.rejects(
    () =>
      runDeploymentRollbackDrill({
        env: {
          CONFIRM_DEPLOYMENT_ROLLBACK_DRILL: "yes",
          ROLLBACK_PREVIOUS_IMAGE: previous,
          ROLLBACK_FAILED_IMAGE: failed,
          ROLLBACK_PREVIOUS_IMAGE_GATES: "security:pass,backend:pass,frontend:fail,compose:pass,runbook:pass,smoke:pass",
        },
      }),
    /frontend/,
  );
});

test("deployment rollback drill returns only safe rollback evidence", async () => {
  const result = await runDeploymentRollbackDrill({
    env: {
      CONFIRM_DEPLOYMENT_ROLLBACK_DRILL: "yes",
      ROLLBACK_PREVIOUS_IMAGE: previous,
      ROLLBACK_FAILED_IMAGE: failed,
    },
    now: new Date("2026-08-03T00:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  assert.equal(result.immutableDigestVerified, true);
  assert.equal(result.previousImage.includes("a".repeat(64)), false);
  assert.equal(result.failedImage.includes("b".repeat(64)), false);
  assert.deepEqual(result.healthChecks, ["/api/health", "/api/ready"]);
  assert.equal(result.smokeCommand, "npm --prefix backend run load:smoke:local");
  assert.equal(result.trafficRestoreRequiresOperatorApproval, true);
  assert.equal(result.safeSummaryOnly, true);
});
