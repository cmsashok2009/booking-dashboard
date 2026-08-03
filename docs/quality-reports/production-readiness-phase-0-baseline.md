# Production Readiness Phase 0 Baseline

## Result

- Date: `2026-08-03`
- Gate: `PASS WITH ENGINEERING DEFAULTS`
- Release: `BLOCKED`
- Baseline production readiness: `6.6/10`

## Acceptance Targets

These conservative defaults govern local verification until the product owner approves stricter values.

| Target | Value |
|---|---:|
| Registered users | 500 |
| Concurrent sessions | 100 |
| Retained bookings | 100,000 |
| Bulk import | 500 rows |
| Email campaign | 500 recipients |
| API p95 | <= 750 ms |
| API errors | < 1% |
| Availability objective | 99.5% monthly |
| RPO | <= 15 minutes |
| RTO | <= 60 minutes |
| Audit retention | 365 days |
| Upload retention | 30 days |
| Desktop browsers | Latest two Chrome, Edge, Firefox |
| Viewports | 320, 375, 768, and 1440 CSS pixels |
| Accessibility | WCAG 2.2 AA critical workflows |

## Architecture and Threat Baseline

- Next.js frontend and Node.js backend run as separate Docker services.
- MySQL 8.4 currently stores one encrypted `application_state` `LONGTEXT` document.
- Redis 7.4 coordinates production rate limits.
- Digest-only activation/reset tokens and encrypted provider credentials are implemented.
- Main trust boundaries are browser/frontend, frontend/backend, backend/MySQL/Redis, backend/Gmail, CI/registry, and operator/backups.
- Sensitive assets include password hashes, sessions, token digests, OAuth tokens, keys, personal data, bookings, imports, delivery records, and audit events.
- Principal threats include broken authorization, replay, brute force, duplicate effects, state overwrite, migration loss, malicious uploads, log leakage, dependency compromise, dependency outage, and backup exposure.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Backend suite | PASS | 70 passed, 2 infrastructure tests skipped, 0 failed |
| Backend integrations | PASS | Docker MySQL/Redis infrastructure tests passed 2/2 against `booking_dashboard_test` |
| Frontend architecture | PASS | 122 modules; size and cycle gates pass |
| Frontend design system | PASS | controls, CSS, and Stylelint pass |
| Frontend secrets/format | PASS | scan and Prettier pass |
| Frontend tests | PASS | 38 files, 172 tests |
| Frontend build | PASS | Next.js production build |
| Entry JavaScript | PASS | 124.4 KiB / 250 KiB |
| Entry CSS | PASS | 112.6 KiB / 120 KiB |
| Largest lazy JavaScript | PASS WITH RISK | 909.1 KiB / 1024 KiB |
| 10k booking filter | PASS | 184.3 ms / 250 ms |
| 10k reconciliation | PASS | 92.3 ms / 500 ms |
| Browser evidence | BLOCKED | Current release-candidate run pending |
| Recovery evidence | BLOCKED | Restore and rollback drill pending |

## Control Audit

- `API-001-019`: `PARTIAL PASS`; workflow, security, MySQL conflict, and Redis limiter tests exist, but normalized persistence remains incomplete.
- `API-020-030`: `BLOCKED`; normalized persistence, observability, capacity, and recovery evidence are incomplete.
- `UI-001-008`: `PASS` through automated architecture/design controls.
- `UI-009-025`: `BLOCKED` pending rendered browser certification.
- `UX-001-012`: `PARTIAL PASS` through component/workflow tests.
- `UX-013-025`: `BLOCKED` pending keyboard, responsive, focus, and end-to-end evidence.

## Exit Decision

The baseline, workload, threat boundaries, and acceptance targets are defined sufficiently to begin persistence and security work. Production remains blocked. Integration, browser, recovery, Critical, and High failures cannot be waived at final acceptance.
