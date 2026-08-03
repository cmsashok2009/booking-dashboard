# Production Readiness Local Implementation and Audit Plan

## Objective

Raise the single-organization Booking Dashboard from the verified `6.6/10` production-readiness baseline to an evidence-backed local target of `8.8-9.1/10`. This plan covers work that can be implemented and verified with this repository, Docker, and GitHub Actions. Hosted staging, managed monitoring, an independent penetration test, and live operational evidence remain external final gates.

## Completion Policy

- A phase is complete only after implementation, tests, rollback notes, audit results, and its quality report are complete.
- Critical and High failures block completion; production-relevant tests cannot be skipped.
- Backend phases report applicable `API-001-030` controls.
- User-facing phases report applicable `UI-001-025` and `UX-001-025` controls with browser evidence.
- Evidence must not contain passwords, tokens, provider secrets, or real personal data.
- Every completed phase updates this tracker and `plan.md` Verification Notes.

## Phase 0: Baseline and Decisions

**Goal:** Define measurable targets before architectural work.

- Approve browsers, users, bookings, concurrency, import size, email volume, retention, availability, `RPO`, and `RTO`.
- Inventory data, secrets, integrations, trust boundaries, APIs, workflows, and persistence.
- Threat-model authentication, administration, uploads, exports, email, persistence, and recovery.
- Define development, test, staging, and production configuration matrices.
- Capture current tests, performance, bundles, Docker behavior, and screenshots.

**Gate:** Requirements, threat model, data inventory, and API inventory are approved. Evidence: `docs/quality-reports/production-readiness-phase-0-baseline.md`.

## Phase 1: Normalized MySQL Persistence

**Goal:** Remove the single-record JSON persistence bottleneck without data loss.

- Select a versioned migration tool and establish immutable migration history.
- Normalize users, roles, sessions, regions, dealers, bookings, options, onboarding, templates, campaigns, deliveries, notifications, uploads, and audit events.
- Add foreign keys, unique/status constraints, checks, timestamps, and query-driven indexes.
- Add repositories, transactions, idempotency, and row-level or optimistic concurrency.
- Build legacy dry-run, migration, checksum, reconciliation, rollback, and cleanup commands.
- Test empty, representative, malformed, duplicate, concurrent, interrupted, and rollback scenarios.

**Gate:** Normal behavior no longer uses the whole-application document; unrelated concurrent updates cannot overwrite each other; migration and rollback pass twice on production-sized synthetic data; MySQL integration tests pass without skips. Evidence: `docs/quality-reports/production-readiness-phase-1-persistence.md`.

## Phase 2: Configuration, Security, and Privacy

**Goal:** Make unsafe production startup impossible.

- Create validated development, test, staging, and production configuration schemas.
- Require HTTPS origins, secure cookies, trusted proxies, safe callbacks, MySQL TLS, and Redis TLS in production.
- Reject missing, default, weak, or conflicting production secrets and settings.
- Centralize authentication and authorization and audit every endpoint.
- Add distributed rate limits, login throttling, temporary lockout, session rotation, expiry, and revocation.
- Standardize safe errors and redact secrets, credentials, tokens, and personal information from logs.
- Harden headers, uploads, exports, spreadsheet formula handling, and caches.
- Add dependency, secret, static, and container scans with blocking severity thresholds.

**Gate:** Production fails closed under unsafe configuration tests; endpoint permission and negative authorization tests pass; no unresolved Critical or High security finding remains. Evidence: `docs/quality-reports/production-readiness-phase-2-security.md`.

## Phase 3: API Reliability and Backend Modularity

**Goal:** Make backend behavior bounded, maintainable, and resilient.

- Split oversized bootstrap, validation, onboarding, persistence, and integration modules into routes, services, repositories, and adapters.
- Standardize validation, errors, pagination, filtering, sorting, timeouts, structured logs, and correlation IDs.
- Complete OpenAPI authorization, request, response, error, pagination, and idempotency contracts.
- Add liveness, readiness, and dependency health endpoints with degraded-state tests.
- Add bounded email timeout and retry with jitter, terminal failures, and recipient idempotency.
- Add bulk-import transactions, idempotency, partial-failure reporting, restart recovery, and race tests.
- Exercise MySQL loss, Redis loss, email-provider failure, and graceful shutdown.

**Gate:** Unit, contract, MySQL, Redis, concurrency, and dependency-failure tests pass without relevant skips; retries cannot duplicate email or import effects. Evidence: `docs/quality-reports/production-readiness-phase-3-api-reliability.md`.

## Phase 4: Frontend, Accessibility, and Performance

**Goal:** Certify critical workflows across supported browsers and viewports.

- Add Playwright journeys for login, bookings, users, onboarding, settings, email, activation, and recovery.
- Add automated accessibility plus manual keyboard, focus, zoom, and responsive checks.
- Verify loading, empty, partial-success, failure, retry, disabled, and completed states.
- Test desktop, tablet, mobile, long text, large tables, and slow/failing networks.
- Profile and split the remaining large lazy-loaded editor or vendor bundle.
- Enforce initial and lazy bundle budgets in CI.

**Gate:** All `UI-001-025` and `UX-001-025` results pass or have approved `N/A`; no console error, overlap, clipping, keyboard trap, focus defect, or WCAG 2.2 AA blocker remains; desktop/mobile screenshots are recorded. Evidence: `docs/quality-reports/production-readiness-phase-4-frontend.md`.

## Phase 5: CI/CD and Supply Chain

**Goal:** Prevent unverified artifacts from being promoted.

- Run frontend quality, backend tests, MySQL, Redis, OpenAPI, and Playwright in GitHub Actions.
- Add accessibility, migration, rollback, dependency, secret, and image scanning jobs.
- Add k6 smoke and threshold jobs with retained summaries.
- Build immutable versioned images, generate an SBOM, scan images, and pin bases.
- Add staging migration, smoke, approval, rollback, and release-checklist stages.
- Protect the main branch and separate environment credentials.

**Gate:** A clean checkout passes every job; deliberately failing tests, migrations, scans, and smoke checks block promotion. Evidence: `docs/quality-reports/production-readiness-phase-5-cicd.md`.

## Phase 6: Observability and Auditability

**Goal:** Make failures traceable without exposing sensitive information.

- Emit structured redacted logs with request/correlation IDs, route, status, duration, and safe classification.
- Persist audit events for authentication, administration, imports, bookings, settings, templates, email, and privileged actions.
- Define metrics for availability, latency, errors, conflicts, rate limits, imports, email, and dependency health.
- Provide local dashboards and alert definitions ready for hosted monitoring.
- Create incident triage and escalation runbooks.

**Gate:** A staged failure traces from UI correlation ID to log, metric, and audit event; automated redaction tests prove prohibited values are absent. Evidence: `docs/quality-reports/production-readiness-phase-6-observability.md`.

## Phase 7: Load, Capacity, and Resilience

**Goal:** Establish safe capacity and failure boundaries.

- Create production-sized synthetic data and k6 scenarios for login, lists, updates, imports, exports, onboarding, and campaign creation.
- Measure p50/p95/p99, throughput, errors, memory, CPU, queue depth, and database contention.
- Test concurrent writes, slow dependencies, Redis loss, database restart, email failure, process restart, and retry storms.
- Verify pagination, indexes, timeouts, backpressure, retry bounds, graceful shutdown, and degradation.

**Gate:** Thresholds pass repeatedly with no data loss, duplicate effect, resource leak, or uncontrolled retry. Evidence: `docs/quality-reports/production-readiness-phase-7-performance.md`.

## Phase 8: Backup, Restore, Deployment, and Runbooks

**Goal:** Demonstrate local operational recovery.

- Add validated backup, restore, integrity-check, retention, and cleanup scripts.
- Encrypt backups and document independent key recovery.
- Create deployment, migration, rollback, restoration, incident, staging smoke, and release runbooks.
- Rebuild an empty Docker environment, restore data, verify integrity, and run smoke tests.
- Rehearse failed deployment, failed migration, image rollback, and database restoration.

**Gate:** Timed restore and rollback drills meet local `RPO`/`RTO`; a second operator can execute the runbooks without undocumented knowledge. Evidence: `docs/quality-reports/production-readiness-phase-8-recovery.md`.

## Phase 9: Local Release Candidate Acceptance

**Goal:** Produce the strongest release candidate possible before hosted staging.

- Run every test, scan, migration, load test, browser audit, Docker smoke test, restore drill, and rollback drill against one immutable candidate.
- Reconcile OpenAPI, architecture, runbooks, limitations, risks, and release notes.
- Complete all API, UI, and UX records and list remaining external dependencies.

**Gate:** No unresolved Critical/High finding; no production-critical skip; all applicable `API-001-030`, `UI-001-025`, and `UX-001-025` controls pass or have approved `N/A`. Expected local readiness: `8.8-9.1/10`. Evidence: `docs/quality-reports/production-readiness-local-acceptance.md`.

## Coverage Matrix

| Requested improvement                           | Phase | Required proof                              |
| ----------------------------------------------- | ----: | ------------------------------------------- |
| Normalize MySQL and remove JSON persistence     |     1 | Migration, repository, reconciliation tests |
| Versioned migrations and rollback               |     1 | Repeated forward/rollback drill             |
| Transactions, constraints, indexes, concurrency |     1 | Schema inspection and race tests            |
| Separate environment configurations             |     2 | Configuration matrix and startup tests      |
| Secure cookies, trusted origins, validation     |     2 | Fail-closed tests                           |
| Authentication and authorization audit          |     2 | Endpoint permission matrix                  |
| Rate limiting, lockout, safe errors             |     2 | Abuse and recovery tests                    |
| Prevent sensitive data in logs                  |  2, 6 | Automated redaction tests                   |
| MySQL and Redis integration tests in CI         |  3, 5 | Required CI jobs without skips              |
| Frontend, backend, Playwright in CI             |  4, 5 | Required branch checks                      |
| Accessibility, keyboard, responsive tests       |     4 | Axe, browser, keyboard, screenshots         |
| Dependency, secret, image scanning              |  2, 5 | Blocking scan reports                       |
| Structured logging and correlation IDs          |  3, 6 | End-to-end trace evidence                   |
| Health, readiness, dependency endpoints         |     3 | Healthy/degraded tests                      |
| Email retry, timeout, idempotency               |     3 | Failure and duplicate tests                 |
| Bulk-import transaction and recovery            |     3 | Race, partial-failure, restart tests        |
| k6 load tests and thresholds                    |  5, 7 | Repeatable performance report               |
| Refactor oversized backend modules              |     3 | Architecture gate and focused tests         |
| Reduce large frontend lazy bundle               |     4 | Bundle profile and budget                   |
| Operational runbooks                            |  6, 8 | Reviewed executable documents               |
| Backup and restoration scripts                  |     8 | Timed isolated restore                      |
| Staging smoke and release checklists            |  5, 8 | Automated smoke and signed checklist        |
| Docker deployment, rollback, restoration        |  8, 9 | Recorded local drills                       |
| API, UI, UX evidence with screenshots           |  4, 9 | Complete reports and artifacts              |

Coverage: `24/24` requested locally achievable improvements have implementation and evidence gates.

## Tracking

| Phase                     | Status                                                                                                                                                                                                                                                                                                                                               | Depends on               | Evidence                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| 0. Baseline               | Complete with engineering defaults                                                                                                                                                                                                                                                                                                                   | None                     | `docs/quality-reports/production-readiness-phase-0-baseline.md`        |
| 1. Persistence            | In progress - normalized runtime and repeatable migration reconciliation verified; query-level repositories and populated rollback restoration blocked                                                                                                                                                                                               | Phase 0                  | `docs/quality-reports/production-readiness-phase-1-persistence.md`     |
| 2. Security               | In progress - fail-closed config, centralized API access policy, CSRF guard, and local security scan verified; advisory/container/hosted gates blocked                                                                                                                                                                                               | Phase 0                  | `docs/quality-reports/production-readiness-phase-2-security.md`        |
| 3. API reliability        | In progress - all collection contracts and backend modularity gate verified; durable email restart recovery, complete error catalogue, and hosted Linux shutdown evidence remain blocked                                                                                                                                                             | Phases 1-2               | `docs/quality-reports/production-readiness-phase-3-api-reliability.md` |
| 4. Frontend certification | In progress - full configured Playwright/quality matrix and responsive Admin-user, Delivery Log, and Template Management pagination/recovery pass; manual recovery/failure/focus evidence blocked                                                                                                                                                    | Stable Phase 3 contracts | `docs/quality-reports/production-readiness-phase-4-frontend.md`        |
| 5. CI/CD                  | In progress - production-quality workflow, security gate, and validated CycloneDX SBOM artifacts added; hosted/advisory/container/signing gates blocked                                                                                                                                                                                              | Phases 1-4 commands      | `docs/quality-reports/production-readiness-phase-5-cicd.md`            |
| 6. Observability          | In progress - sanitized request metrics/logging and error correlation verified, external telemetry blocked                                                                                                                                                                                                                                           | Stable Phase 3 services  | `docs/quality-reports/production-readiness-phase-6-observability.md`   |
| 7. Performance            | In progress - local API read-path load smoke verified, k6/resilience gates blocked                                                                                                                                                                                                                                                                   | Phases 1, 3, 5, 6        | `docs/quality-reports/production-readiness-phase-7-performance.md`     |
| 8. Recovery               | In progress - encrypted backup/check/restore/cleanup, isolated timed restore drill, post-restore smoke, migration rollback drill, retention cleanup drill, backup key recovery drill, deployment rollback manifest drill, and executable runbook validation verified locally; second-operator/live image rollback/managed key-recovery gates blocked | Phases 1, 5, 6           | `docs/quality-reports/production-readiness-phase-8-recovery.md`        |
| 9. Local acceptance       | NO-GO                                                                                                                                                                                                                                                                                                                                                | Phases 0-8               | `docs/quality-reports/production-readiness-local-acceptance.md`        |

Execution order: `0 -> 1 and 2 -> 3 -> 4 and 6 -> 5 -> 7 and 8 -> 9`.

## External Final Gates

- Hosted staging with DNS, TLS, managed secrets, and realistic networking.
- Hosted monitoring, alert delivery, and an on-call exercise.
- Managed backup or point-in-time recovery exercise.
- Independent penetration test and remediation verification.
- Representative-user acceptance, controlled pilot, and stabilization evidence.
