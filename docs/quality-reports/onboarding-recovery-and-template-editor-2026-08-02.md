# Quality Report: Onboarding Recovery and Template Editor

- Date: 2026-08-02
- Reviewer/agent: Codex
- Changed surface: Single-user onboarding recovery, clean production user initialization, invitation delivery errors, template editor drawer, HTML rich-text editing
- Overall gate: `BLOCKED`

| ID | Status | Severity | Validation method | Evidence | Notes/owner |
|---|---|---|---|---|---|
| UX-004 | PASS | High | Backend regression test | Cancelled single-user workflow is closed and a fresh journey can start | Pending user is removed |
| UX-006 | PASS | High | Backend regression test | Resume Later preserves work; explicit cancellation removes unsent pending users | Audit history retained |
| UX-009 | PASS | High | Backend and component tests | Error states name preserved progress and next action | Gmail recovery copy verified |
| UX-011 | PASS | Medium | Component tests | Recoverable error and resumed-success states covered | 31 focused tests passed |
| UX-014 | BLOCKED | High | Browser required | In-app browser startup failed with Windows ACL error twice | Environment owner |
| UX-015 | PASS | High | Shared SideDrawer lifecycle and component tests | Drawer uses shared focus trap, Escape, backdrop, and focus return | Existing shared control |
| UX-017 | PASS | Medium | Copy assertion | Confirmation and success feedback name pending-user removal | Plain language used |
| UX-019 | PASS | High | Code review and tests | No provider secrets, tokens, or credentials enter UI errors | Safe error mapping |
| UX-020 | BLOCKED | High | Desktop/mobile browser required | Browser unavailable due Windows ACL error | Environment owner |
| UX-022 | PASS | High | Backend regression test | Cancellation removes the pending user; retry creates one fresh user | No duplicate account |
| UX-023 | PASS | High | Component/backend tests | Missing Google sender points to Email Configuration | Progress remains saved |
| UI-005 | PASS | Medium | Code review | Shared SideDrawer, Button, TextInput, and Lucide controls reused | No new modal shell |
| UI-009 | PASS | Medium | CSS review and production build | Fixed toolbar controls and flex drawer regions | Dynamic state dimensions stable |
| UI-010 | PASS | High | CSS review | 680px desktop drawer and 100vw mobile constraint | Scroll isolated to body |
| UI-011 | BLOCKED | High | Browser screenshot required | Automated build passed; visual overlap check unavailable | Environment owner |
| UI-012 | PASS | Medium | CSS review | Toolbar wraps and link form reflows on narrow screens | Long editor body scrolls |
| UI-014 | PASS | High | Component test | Error status includes heading and explanatory text | Not color-only |
| UI-015 | BLOCKED | High | Keyboard browser path required | Shared lifecycle is present; live keyboard check unavailable | Environment owner |
| UI-016 | PASS | Medium | Component tests | Editor validation, save, disabled, and error states covered | Toolbar disabled states implemented |
| UI-018 | PASS | High | Code review | Shared drawer hierarchy with fixed header/footer and scrollable body | Mobile full width |
| UI-025 | BLOCKED | High | Screenshot required | Browser connection blocked | Environment owner |
| API-005 | PASS | Medium | Backend regression test | Email comparison uses normalized address | Same pending user found reliably |
| API-006 | PASS | High | Code review and regression test | Stable email-provider code and safe 503 message returned | Route no longer formats errors as campaigns |
| API-008 | PASS | High | Backend regression test | Repeated creation after cancellation produces one fresh account | No duplicate write |
| API-010 | PASS | High | State guard review | Completed/campaign workflows are protected from pending-user cleanup | Owner and campaign guards enforced |
| API-015 | PASS | Critical | Code review | Error response excludes OAuth details and secrets | Generic recovery guidance only |
| API-018 | PASS | High | Backend regression test | Failed readiness check creates no campaign or activation token | Workflow remains at recipients |
| API-021 | PASS | Medium | Existing correlation/error boundary review | Unexpected secondary 500 removed | Direct provider status retained |
| API-024 | PASS | High | Backend regression test | Persisted cancelled workflow is versioned and records removed-user count | Audit history retained |
| API-026 | PASS | High | Automated tests | Backend 13/13 focused; frontend 31/31 focused; frontend 165/165 full | Process tests 2/2 isolated |
| API-028 | PASS | Medium | Adapter boundary review | Gmail readiness remains behind mailer/provider adapter | No provider logic added to route |

## Automated Verification

- Backend full suite after cancellation cleanup: 62 passed, 2 infrastructure tests skipped.
- Frontend cancellation-focused suites: 28/28 passed. Earlier full frontend run: 165/165 passed across 38 files.
- `npm run build` in frontend: passed with Next.js 16.2.12.
- `npx eslint ...` for changed frontend files: passed.
- `node --check server.js && node --check src/onboarding.js`: passed.
- `node --test test/server-security.test.js`: 2/2 passed in isolation.
- Full backend run: 60 passed, 2 infrastructure tests skipped, 2 process-start tests timed out under full parallel contention; both passed in isolation.
- Docker Compose rebuild: backend and frontend images rebuilt; MySQL, Redis, backend, and frontend healthy.

## Browser Verification

- Desktop viewport: BLOCKED; in-app browser runtime failed to start due Windows ACL sandbox error.
- Mobile viewport: BLOCKED for the same reason.
- Keyboard/focus: Shared SideDrawer lifecycle verified by code and tests; live keyboard path BLOCKED.
- Console/hydration: Production build passed; live browser console inspection BLOCKED.

## Limitations and Follow-up

- Retry desktop/mobile browser verification when the local browser runtime ACL issue is resolved.
- `npm ci` reports 6 dependency advisories (2 moderate, 4 high). A registry audit was not authorized in this run, so attribution and remediation remain pending.
## Production Seed Cleanup Follow-up

| ID | Status | Severity | Validation method | Evidence | Notes/owner |
|---|---|---|---|---|---|
| UX-018 | PASS | High | Live aggregate database check | Current Docker state reports 2 users, 0 legacy demo users, 2 Admins | Totals reconcile; no emails printed |
| UX-019 | PASS | High | Code review and aggregate-only verification | Exact seed ID/email pairs only; no personal data logged | Real/custom users preserved |
| UX-024 | PASS | High | Production environment review | Cleanup runs only when `NODE_ENV=production` | Development fixtures remain available |
| UI-019 | PASS | Medium | Existing users-table behavior | Removed records disappear through normal bootstrap refresh | No table code change required |
| API-005 | PASS | High | Unit test | Exact normalized seed identity matching | Repurposed seed ID with changed email preserved |
| API-009 | PASS | High | Startup reconciliation review | State is saved once through existing versioned store | No broad delete operation |
| API-022 | PASS | High | Aggregate live verification | Only counts printed; no emails or credentials exposed | Privacy preserved |
| API-024 | PASS | High | Docker restart verification | Existing production state reconciled during startup | `legacyDemoUsers: 0` |
| API-026 | PASS | High | Automated tests | Validators 17/17; backend full suite 63 passed, 2 infrastructure skips | Regression covered |
| API-029 | PASS | Medium | Contract review | No HTTP contract change | Startup behavior corrected |

Docker rebuild completed. MySQL, Redis, backend, and frontend are healthy. Aggregate state after restart: 2 total users, 0 legacy demo users, 2 Admin users.

## Admin Visibility Follow-up

- UX-001/011/018/024: PASS by selector/component tests; Admin accounts now participate in Current Users totals, search, filters, sorting, and pagination.
- UI-019: PASS by code review and focused tests; existing table behavior is reused.
- UI-025: BLOCKED because the in-app browser remains unavailable due the recorded Windows ACL issue.
- API checks: N/A; the bootstrap API already returned all Admin users and no contract changed.
- Verification: focused frontend tests 5/5 passed; production frontend build passed; Docker backend/frontend rebuilt and healthy.

## Admin Activation Follow-up

- UX-009/011/012/016/017: PASS by component tests and code review; pending accounts receive explicit consequence copy and an activation-specific command.
- UX-019: PASS; temporary passwords, hashes, and activation tokens are not logged or returned.
- UI-005/016/018/021: PASS by shared drawer/button reuse, focused component tests, and production build.
- UI-025: BLOCKED because the in-app browser remains unavailable due the recorded Windows ACL issue.
- API-001/002: PASS through the existing authenticated Admin-only route and server-derived Admin identity.
- API-003/006: PASS; `activatePending` is accepted only as explicit boolean `true`, with existing safe 409/422 contracts.
- API-013/014/020/026: PASS; outstanding activation tokens are revoked, password is hash-only, distinct audit action recorded, and regression tests pass.
- Verification: password tests 6/6; drawer tests 8/8; frontend production build passed; backend full run 62 passed, 2 infrastructure skips, 2 parallel process-start failures that passed 2/2 in isolation.
- Docker backend/frontend rebuilt and healthy.
