# Production Readiness Re-Audit

- Date: 2026-08-02
- Reviewer/agent: Codex
- Target: Single-organization production business application
- Multi-tenancy: Out of scope
- Overall gate: `BLOCKED`
- Release verdict: `NO-GO`

## Executive Assessment

Booking Dashboard is a strong, unusually disciplined MVP and is suitable for local demonstrations and a controlled non-production pilot. The foundation work materially improved frontend architecture, initial-load performance, design-system enforcement, and pull-request quality controls.

It is not yet production-ready. The largest remaining risk is the persistence model: all business data is still stored as one versioned encrypted `LONGTEXT` document. Production transport configuration, real MySQL/Redis integration execution, browser/accessibility evidence, observability, and recovery drills are also incomplete.

Current ratings:

- Demo readiness: `8.7/10`.
- Controlled staging/pilot readiness: `7.4/10`.
- Production readiness: `6.6/10`.

The production score increased from `6.2` because frontend quality now passes, frontend CI exists, bundle budgets pass, and secure cookies default correctly. It remains below release level because improvements in presentation and delivery controls do not offset unresolved data-integrity and operational risks.

## Release Blockers

### High: Whole-application document persistence

`backend/src/state-store.js` stores the complete encrypted application state in one `LONGTEXT` row and updates it using one global version.

Impact:

- Unrelated concurrent writes can conflict.
- Every successful mutation rewrites the complete state.
- Database constraints cannot enforce relationships between users, roles, regions, dealers, bookings, templates, and workflows.
- Reporting, indexing, retention, deletion, audit queries, and large-data operations are constrained.
- Multiple backend replicas would contend on one state version.

Required before production:

- Normalized MySQL tables, foreign keys, unique/status constraints, indexes, transactions, versioned migrations, legacy reconciliation, and demonstrated rollback.

Applicable controls: `API-004`, `API-008–011`, `API-020`, `API-022–024`, `API-026–030`.

### High: No production-specific transport profile

`compose.yaml` now defaults session cookies to secure, which is correct. However, it still defaults `APP_URL` to HTTP and forces database TLS off. `.env.docker.example` explicitly sets insecure local values.

This is acceptable for local Docker, but it is unsafe as the only deployment profile because copied local settings can silently reach a hosted environment.

Required before production:

- Separate local and production configuration.
- Production startup must reject HTTP public URLs, insecure cookies, missing trusted-proxy configuration, insecure database transport where required, placeholder secrets, and invalid OAuth callback origins.

Applicable controls: `API-001`, `API-012`, `API-015`, `API-021–022`, `API-028–030`.

### High: Production MySQL and Redis tests are skipped locally

The backend suite passes `68` tests but skips the two tests that prove concurrent MySQL writes and shared Redis rate limiting. CI is configured to supply these dependencies, but this re-audit did not obtain a completed CI run or local integration execution.

Required before production:

- Produce a green CI run where both integration tests execute rather than skip.
- Add migration, rollback, dependency-loss, and reconnect tests.

Applicable controls: `API-010`, `API-012`, `API-026`, `API-028–030`.

### High: Browser and accessibility certification is missing

All component tests pass, but no current rendered evidence was captured because browser control was unavailable in this audit session.

Required before production:

- Desktop and mobile screenshots of critical workflows.
- Keyboard-only and focus-restoration evidence.
- Automated accessibility results and manual screen-reader checks.
- Browser console, hydration, overflow, long-content, error, empty, loading, and retry checks.

Applicable controls: `UI-009–025`, `UX-008–025`.

### High: Recovery is documented but not demonstrated

Backup and restore expectations exist in the runbook, but this audit has no timed restore, point-in-time recovery, key-recovery, reconciliation, or rollback evidence.

Required before production:

- Automated encrypted backups, monitored backup failures, isolated restore drill, reconciled application data, and measured RPO/RTO.

Applicable controls: `API-020–024`, `API-027`, `API-029–030`.

### High: Operational observability remains incomplete

Correlation IDs and safe structured error logs exist. There is no verified metrics platform, tracing, error monitoring, alerting, SLO dashboard, queue-depth monitoring, or searchable business audit trail.

Required before production:

- Structured request/latency logs, metrics, error monitoring, privileged-action audit events, dashboards, alert tests, ownership, and escalation procedures.

Applicable controls: `API-006`, `API-018–022`, `API-027–030`.

## Medium Findings

### Backend modules remain oversized

- `backend/server.js`: approximately 941 lines.
- `backend/src/validators.js`: approximately 722 lines.
- `backend/src/onboarding.js`: approximately 419 lines.

Routing, infrastructure, orchestration, and validation should be split into explicit middleware, route, service, repository, and provider boundaries.

### Frontend E2E is not enforced in the quality workflow

The new frontend workflow runs `npm run quality`, which covers lint, architecture, design system, secrets, formatting, unit/component tests, build, and performance. It does not install Playwright browsers or execute `npm run test:e2e`.

### Largest lazy JavaScript chunk remains substantial

The initial entry bundle is excellent at `124.4 KiB`, but the largest lazy/shared chunk is `909.1 KiB`. This is within the current 1 MiB budget but should be profiled on slower devices and networks, especially around email template editing.

### No hosted staging acceptance evidence

Docker configuration validates and health checks exist, but there is no evidence in this audit of automated staging deployment, TLS, managed secrets, domain configuration, deployment smoke tests, or rollback from a released artifact.

## Confirmed Strengths

- Secure, HttpOnly, SameSite session cookies; production defaults now include `Secure`.
- Session-derived backend identity and role authorization tests.
- Digest-only activation/reset tokens with expiry, revocation, and single use.
- Encrypted production persistence and encrypted provider refresh tokens.
- Redis requirement for production rate limiting.
- OpenAPI specification and Swagger UI.
- Docker health/readiness checks and one-shot database initialization.
- Backend CI with MySQL, Redis, tests, and dependency audit.
- Frontend CI with a comprehensive quality command.
- Frontend module-size, dependency-cycle, control-ownership, CSS architecture, Stylelint, secret, formatting, test, build, bundle, and scale gates.
- `172/172` frontend tests pass.
- Initial JavaScript reduced from `627.8 KiB` to `124.4 KiB` without raising the budget.
- Initial CSS is `112.6 KiB`, below the `120 KiB` budget.
- 10k booking and reconciliation performance checks pass.
- Responsive operational UI patterns, shared drawers/tabs/controls, safe empty states, and workflow recovery coverage are present in code and tests.

## Scorecard

| Criterion | Score | Evidence-based assessment |
|---|---:|---|
| Product workflow coverage | 8.3 | Booking, administration, onboarding, password, master-data, and email workflows are substantial. |
| UI consistency | 8.1 | Shared controls and CSS architecture gates now pass; browser certification is missing. |
| UX and recovery | 7.8 | Strong validation and recoverable workflows; full browser paths remain unverified. |
| Accessibility | 6.7 | Semantic and component-test effort is visible; current manual/browser evidence is absent. |
| Frontend architecture | 8.2 | All modules are below 350 lines, cycles are absent, and feature surfaces are lazy loaded. |
| Frontend performance | 8.5 | Entry JS/CSS and 10k synthetic budgets pass convincingly. |
| Backend/API design | 6.8 | Good contracts and security behavior; server, validators, and onboarding remain concentrated. |
| Security and privacy | 6.8 | Strong token/encryption fundamentals; production fail-closed configuration and scanning evidence remain incomplete. |
| Data integrity and scalability | 4.5 | Single-row document persistence remains the dominant blocker. |
| Automated testing | 8.0 | Strong frontend/backend suites; two production integrations skip and E2E is not in CI. |
| Reliability and resilience | 6.0 | Health/readiness and optimistic conflicts exist; dependency-loss and recovery proof are missing. |
| Observability and auditability | 4.5 | Correlation IDs exist; metrics, alerts, tracing, and operational audit evidence do not. |
| CI/CD and release controls | 7.0 | Backend/frontend CI and image publishing exist; staging promotion and rollback are not proven. |
| Backup and disaster recovery | 4.0 | Runbook guidance exists, but no demonstrated restore or RPO/RTO evidence. |
| Documentation | 8.0 | OpenAPI, runbooks, plans, and quality reports are extensive and actionable. |

## Control Summary

| Control group | Result | Reason |
|---|---|---|
| `API-001–006` | PARTIAL PASS | Identity, authorization, and safe errors are tested; complete schema/production-origin review remains. |
| `API-007–019` | PARTIAL PASS | Batch, idempotency, tokens, uploads, and email have good coverage; queue/webhook/production integration scope is incomplete. |
| `API-020–030` | BLOCKED | Auditability, observability, normalized persistence, performance bounds, recovery, and production integration evidence are incomplete. |
| `UI-001–008` | PASS | Tokens, operational theme, hierarchy, and shared component ownership are enforced. |
| `UI-009–024` | BLOCKED | Automated checks pass, but current rendered responsive/accessibility evidence is missing. |
| `UI-025` | BLOCKED | No current desktop/mobile screenshot evidence. |
| `UX-001–012` | PARTIAL PASS | Code/tests show clear workflows and recovery; live end-to-end evidence is incomplete. |
| `UX-013–025` | BLOCKED | Keyboard, focus, mobile completion, and decision-point help require browser verification. |

## Verification Evidence

- `frontend: npm run quality`: PASS.
- Frontend: 38 files, 172 tests passed.
- Frontend production build: PASS.
- Entry JavaScript: 124.4 KiB / 250 KiB.
- Entry CSS: 112.6 KiB / 120 KiB.
- Largest lazy/shared JavaScript: 909.1 KiB / 1024 KiB.
- 10k booking filter: 121.6 ms / 250 ms.
- 10k reconciliation analysis: 146.5 ms / 500 ms.
- `backend: npm test`: 68 passed, 2 skipped, 0 failed.
- `docker compose --env-file .env.docker config --quiet`: PASS.
- `git diff --check`: PASS with line-ending warnings only.

## Required Order of Work

1. Approve Phase 0 workload, retention, RPO, RTO, uptime, and browser targets.
2. Implement normalized MySQL persistence, migration, reconciliation, and rollback.
3. Add fail-closed production configuration and complete the security review.
4. Execute MySQL/Redis integration tests and enforce Playwright/accessibility checks in CI.
5. Add observability, business audit events, alerts, dashboards, and ownership.
6. Demonstrate backup restore, rollback, dependency failure, and resilience behavior.
7. Deploy a release candidate to staging and collect browser, accessibility, TLS, smoke, and rollback evidence.
8. Conduct the final go/no-go review with no unresolved Critical/High findings.

## Final Verdict

The project has moved from a polished student/MVP application toward a credible professional codebase. Its frontend engineering and workflow depth compare well with modern internal business software. It must not yet be represented as production-ready because the persistence, operational, recovery, and browser-certification gates are materially incomplete.
