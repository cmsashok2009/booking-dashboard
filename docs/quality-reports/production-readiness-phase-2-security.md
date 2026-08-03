# Quality Report: Production Readiness Phase 2 Security and Privacy

- Date: 2026-08-03
- Reviewer/agent: Codex
- Changed surface: Backend runtime configuration validation, centralized fail-closed API access policy, production startup and cookie/security regression tests, CSRF origin/fetch-metadata guard, and repository source/config production security scan gate
- Overall gate: `BLOCKED`

## Applicable IDs Before Implementation

- API: `API-001`, `API-002`, `API-003`, `API-006`, `API-012`, `API-013`, `API-014`, `API-015`, `API-016`, `API-017`, `API-019`, `API-020`, `API-021`, `API-022`, `API-025`, `API-026`, `API-028`, `API-030`
- UI: `N/A` - no rendered frontend surface changed for this phase slice.
- UX: `N/A` - no user-facing workflow changed for this phase slice.

## Control Results

| ID | Status | Severity | Changed surface | Validation method | Evidence | Notes/owner |
|---|---|---|---|---|---|---|
| API-001 | PASS | Critical | API route access policy and authenticated routes | Policy unit tests and backend process tests | Explicit public, authenticated, role-scoped, and Admin policy classes derive identity from the server session; spoof rejection and bootstrap minimization pass | Central policy is fail-closed for undeclared method/path pairs. |
| API-002 | PASS | Critical | Central authorization and resource-scoped checks | Policy unit tests and backend process tests | All Admin API methods are centrally Admin-only except the exact OAuth callback; explicit policies cover every non-Admin API class; undeclared routes fail closed; role and assignment checks pass | Workflow ownership and booking assignment remain enforced by domain handlers after the central gate. |
| API-003 | PARTIAL PASS | High | Config inputs | Unit tests | Runtime URL/bool validation added | Request schema centralization remains Phase 3. |
| API-006 | PASS | High | Safe startup/errors | Backend tests | Unsafe production origin exits before serving; CSRF failures return stable safe JSON codes | Structured error taxonomy remains Phase 3/6. |
| API-012 | PASS | High | Abuse controls | Backend tests | Production Redis requirement retained; Docker Redis integration passed in Phase 1 | Distributed CI service proof remains Phase 5. |
| API-013 | PASS | Critical | Activation/reset tokens | Backend tests | Digest-only, expiring, single-use activation and reset tests pass | No change in this phase slice. |
| API-014 | PASS | Critical | Passwords | Backend tests | Temporary password and hash-only tests pass | No plaintext password returned/stored. |
| API-015 | PARTIAL PASS | Critical | Runtime configuration, request origin, and secret/dependency source scanning | Unit/process tests/security scan | Production public HTTP `APP_URL`, insecure public cookies, bad URL protocols, OAuth origin mismatch, foreign cookie-authenticated origins, high-confidence source secrets, and prohibited dependency sources are rejected | Managed secret store, rotation, advisory remediation, and container scans remain open. |
| API-016 | PARTIAL PASS | High | Upload safety | Existing tests | Booking upload rejects missing/duplicate unsafe input paths | MIME/retention/provider scanning remains open. |
| API-017 | PASS | High | Template rendering | Existing tests | Recipient-controlled HTML merge values are escaped | No change in this phase slice. |
| API-019 | BLOCKED | High | Webhooks | Code inspection | No provider webhook signature/replay implementation verified | Future email provider phase. |
| API-020 | PARTIAL PASS | High | Audit | Existing tests/schema | Audit records retained for privileged changes | Full audit matrix remains Phase 6. |
| API-021 | BLOCKED | High | Observability | Code inspection | Correlation IDs and safe error logs exist | Metrics, dashboards, alerting, and redaction tests remain Phase 6. |
| API-022 | PARTIAL PASS | High | Privacy minimization | Tests/code inspection/security scan | Repository source/config high-confidence secret scan passes; token digest, encrypted provider token, and safe errors retained | Retention/deletion drills remain Phase 8. |
| API-025 | PARTIAL PASS | High | Contracts | OpenAPI exists | `/api/ready` and many schemas documented | Contract completeness remains Phase 3/5. |
| API-026 | PASS | High | Security tests | Automated tests | Security scanner tests 4/4; production security scan passed 266 files; central policy/security 9/9; backend full suite 118 total, 114 pass, 4 host infra skips | Host infra skips covered by Docker Phase 1 run. |
| API-028 | PARTIAL PASS | High | External adapters | Existing tests | Gmail adapter tests pass with mocked fetch/token behavior | Timeout/retry hardening remains Phase 3. |
| API-030 | PASS | High | Readiness/config | Tests and Docker readiness | Runtime config validates dependencies; `/api/ready` separates persistence and abuse control | Hosted dependency drill remains Phase 9. |

## Implemented Changes

- Added `backend/src/config.js` with explicit runtime validation for application origin, session-cookie mode, demo credential flag, database URL protocol, Redis URL protocol, and Google OAuth redirect origin.
- Wired validation into backend startup before persistence and rate-limit adapters initialize.
- Added unit coverage for allowed localhost Docker smoke configuration and rejected unsafe production settings.
- Added a process-level startup regression proving public HTTP production `APP_URL` exits before the server serves traffic.
- Made the production cookie test set its own safe production origin and OAuth values instead of inheriting ambient environment state.
- Added a central CSRF guard for cookie-authenticated unsafe methods using Fetch Metadata (`Sec-Fetch-Site`) and Origin validation against the configured app origin or request origin.
- Added process-test coverage proving cross-site and foreign-origin cookie-authenticated booking mutations are rejected while same-origin mutation still succeeds.
- Added backend/src/api-access-policy.js as a centralized, fail-closed registry for public, authenticated, role-scoped, and Admin API classes. Undeclared method/path pairs return a safe 404, the public OAuth callback exception is exact, and existing resource ownership/assignment checks remain defense in depth.
- Added policy-level coverage for every access class plus process-level coverage for unauthenticated, Area Manager, Regional Manager, All India, and Admin sessions across admin-only reads/writes, metrics, bootstrap minimization, CSRF, and role-scoped booking updates.
- Added `scripts/production-security-scan.mjs` and root npm gates for repository source/config high-confidence secret scanning, sensitive static-pattern checks, and dependency source-policy checks.
- Wired the production security scan into `.github/workflows/production-quality.yml` as a blocking `security` job.

## Automated Verification

- `backend: node --test test/config.test.js test/server-security.test.js`: PASS, 8/8 for fail-closed runtime configuration and existing security regressions.
- `backend: node --test test/api-access-policy.test.js test/server-security.test.js`: PASS, 9/9 for fail-closed policy behavior, exact OAuth callback exposure, established status contracts, CSRF, identity derivation, Admin boundaries, bootstrap minimization, and role-scoped booking updates.
- `backend: npm test`: PASS, 118 tests, 114 passed, 4 host infrastructure tests skipped, 0 failed.
- Prior Phase 1 Docker infrastructure run: PASS, 3/3 for MySQL, Redis, and migration rollback/reapply.
- `npm run test:security-scan`: PASS, 4/4 scanner regression tests.
- `npm run security:scan`: PASS, 266 files scanned; secret, static-sensitive, and dependency-source gates passed.
- `frontend: npm audit --audit-level=high`: FAIL, 4 high and 2 moderate advisories reported for transitive frontend dependencies; not remediated in this local slice.
- `backend: npm audit --audit-level=high`: BLOCKED by approval policy because audit sends dependency metadata to an external registry service without explicit user approval.

## Browser Verification

- `N/A` for this backend configuration/security slice. No user-facing screen changed.

## Remaining Blockers

- Resolved locally: the centralized fail-closed policy covers every API request class, all protected policy entries reject insufficient identity, and undeclared method/path pairs return a safe 404; domain ownership/assignment checks remain layered behind it.
- High: centralized API access and CSRF policy now pass locally; hosted reverse-proxy/trusted-origin behavior still needs deployment-environment evidence.
- High: local repository source/config secret/static/dependency-source scanning is wired as a blocking CI gate and passes; frontend advisory audit still reports High findings, backend advisory audit needs explicit approval, and blocking Docker Scout scans are configured but have not been executed locally or in hosted CI.
- High: managed secrets, rotation, MySQL/Redis TLS enforcement in hosted production, and trusted proxy policy need deployment-environment evidence.
- High: webhook signature/replay/idempotency controls are not implemented.
- High: observability redaction tests, metrics, alerting, and incident evidence remain Phase 6.

## Exit Decision

Phase 2 is not complete. The local fail-closed configuration and representative authorization foundations are stronger and verified, but the security phase remains `BLOCKED` until the remaining advisory/container, managed-secret/TLS, webhook, and observability High items are implemented or explicitly accepted with owner approval.