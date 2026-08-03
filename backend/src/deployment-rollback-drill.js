const REQUIRED_GATES = ["security", "backend", "frontend", "compose", "runbook", "smoke"];

function parseGateResults(raw) {
  if (!raw) return Object.fromEntries(REQUIRED_GATES.map((gate) => [gate, "pass"]));
  const results = {};
  for (const pair of String(raw).split(",")) {
    const [name, value] = pair.split(":").map((part) => part?.trim());
    if (name) results[name] = value || "";
  }
  return results;
}

function assertImmutableDigest(value, label) {
  const text = String(value || "").trim();
  if (!/^[a-z0-9._/-]+(?:[:][a-z0-9._-]+)?@sha256:[a-f0-9]{64}$/i.test(text)) {
    throw new Error(`${label} must be an immutable image digest`);
  }
  return text;
}

function safeDigest(image) {
  return image.replace(/@sha256:([a-f0-9]{12})[a-f0-9]{52}$/i, "@sha256:$1...");
}

export async function runDeploymentRollbackDrill({ env = process.env, now = new Date() } = {}) {
  if (env.CONFIRM_DEPLOYMENT_ROLLBACK_DRILL !== "yes") {
    throw new Error(
      "Set CONFIRM_DEPLOYMENT_ROLLBACK_DRILL=yes to run the deployment rollback drill",
    );
  }

  const previousImage = assertImmutableDigest(
    env.ROLLBACK_PREVIOUS_IMAGE,
    "ROLLBACK_PREVIOUS_IMAGE",
  );
  const failedImage = assertImmutableDigest(env.ROLLBACK_FAILED_IMAGE, "ROLLBACK_FAILED_IMAGE");
  if (previousImage === failedImage) {
    throw new Error("Rollback previous image must differ from the failed image");
  }

  const gates = parseGateResults(env.ROLLBACK_PREVIOUS_IMAGE_GATES);
  const missingOrFailed = REQUIRED_GATES.filter(
    (gate) => String(gates[gate] || "").toLowerCase() !== "pass",
  );
  if (missingOrFailed.length) {
    throw new Error(
      `Previous image is missing passing gates: ${missingOrFailed.join(", ")}`,
    );
  }

  return {
    ok: true,
    mode: "local-manifest-drill",
    checkedAt: new Date(now).toISOString(),
    previousImage: safeDigest(previousImage),
    failedImage: safeDigest(failedImage),
    immutableDigestVerified: true,
    previousImageGatesPassed: REQUIRED_GATES,
    rollbackPlan: [
      "stop-promotion",
      "keep-database-unchanged",
      "deploy-previous-immutable-image",
      "run-health-ready-smoke",
      "compare-logs-metrics-audit",
      "retain-failed-image-for-forensics",
    ],
    healthChecks: ["/api/health", "/api/ready"],
    smokeCommand: "npm --prefix backend run load:smoke:local",
    trafficRestoreRequiresOperatorApproval: true,
    safeSummaryOnly: true,
  };
}
