# Rollback Runbook

## Trigger

Rollback for a release-caused outage, authentication failure, data-integrity risk, critical security regression, or sustained breach of the agreed error/latency objective.

## Procedure

1. Declare the incident and assign incident lead, communications owner, and technical owner.
2. Freeze further deployments and record the failing release identifier.
3. Repoint traffic to the last verified immutable frontend release using the deployment platform.
4. Confirm backend compatibility before rollback if the release changed an API contract.
5. Run public-entry and authenticated smoke tests against the restored release.
6. Verify error rate, API latency, and critical workflow recovery.
7. Record start/end times, evidence, customer impact, and follow-up owners.

## Validation

A drill passes only when another engineer can execute it, the agreed recovery-time objective is met, critical workflows recover, and monitoring confirms stability. This repository does not contain evidence of a completed drill.
