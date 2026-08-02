---
name: booking-dashboard-api
description: Audit Booking Dashboard API contracts, authentication, authorization, validation, batch semantics, activation security, email delivery, persistence, observability, Swagger, and failures. Use for every backend, integration, persistence, or API change and report applicable API IDs with evidence.
---

# Booking Dashboard API Audit

Identify changed contracts and side effects first. Validate success and failure paths with automated tests and direct checks. Record applicable IDs in `docs/quality-reports/<feature>.md`; unresolved Critical/High failures block completion.

## Checks

- `API-001` Protected endpoints derive identity from authenticated context.
- `API-002` Server enforces least-privilege authorization.
- `API-003` All inputs use explicit schemas.
- `API-004` Roles use active database definitions and hierarchy.
- `API-005` Comparable values normalize consistently.
- `API-006` Errors expose stable code, safe message, details, correlation ID, and correct status.
- `API-007` Bulk results report per-row outcomes.
- `API-008` Side-effect operations are idempotent.
- `API-009` Related writes are transactional or document partial boundaries.
- `API-010` Races and workflow version conflicts are explicit.
- `API-011` Lists use bounded pagination and validated filters/sorts.
- `API-012` Sensitive and expensive endpoints are rate-limited.
- `API-013` Activation tokens are random, digest-only, expiring, single-use, and revocable.
- `API-014` Passwords are securely hashed and never logged/returned.
- `API-015` Secrets use secure configuration and redaction.
- `API-016` Uploads enforce file, size, row, parsing, formula, and retention safety.
- `API-017` Merge fields are allowlisted and rendered content is sanitized.
- `API-018` Email delivery is queued, retryable, deduplicated, and recorded.
- `API-019` Webhooks verify signature, freshness, replay, and idempotency.
- `API-020` Audit events include actor, action, entity, outcome, time, and correlation.
- `API-021` Logs, metrics, correlation, queue depth, failures, and latency are observable.
- `API-022` Responses, exports, logs, and retention minimize personal data.
- `API-023` Campaigns reference immutable template versions.
- `API-024` Workflow checkpoints are durable, versioned, and revalidated.
- `API-025` Swagger documents schemas, examples, errors, authorization, and idempotency.
- `API-026` Tests cover authorization, race, retry, expiry, malformed input, and failures.
- `API-027` Operations have documented performance bounds.
- `API-028` External dependencies use testable adapters.
- `API-029` Contract changes are additive/versioned with migration handling.
- `API-030` Health/readiness distinguishes process health from dependencies.

Never infer API security from frontend restrictions.
