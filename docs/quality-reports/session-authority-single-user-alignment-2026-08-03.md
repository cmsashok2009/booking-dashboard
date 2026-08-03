# Quality Report: Session Authority and Single User Alignment

- Date: 2026-08-03
- Reviewer/agent: Codex
- Changed surface: authenticated session restoration; bootstrap identity contract; Add Single User drawer alignment
- Overall gate: `PASS`

| ID | Status | Severity | Validation method | Evidence |
| --- | --- | --- | --- | --- |
| API-001 | PASS | Critical | Authenticated server test | Bootstrap identity is derived from the HttpOnly session, not browser-supplied role data. |
| API-002 | PASS | Critical | Authorization matrix and browser workflow | Admin APIs remain server-authorized; stale client Admin identity is reconciled before navigation. |
| API-006 | PASS | High | Full backend/frontend suites | Expired sessions return to sign-in; temporary backend failures preserve the cached restore marker. |
| API-022 | PASS | Critical | Server security assertions | `currentUser` excludes password hashes and activation tokens. |
| API-026 | PASS | High | Focused, full, and browser regression | Backend 215 total; frontend 198/198; Admin browser file 11 passed and 1 intentional skip. |
| API-029 | PASS | Medium | OpenAPI contract test | `BootstrapResponse.currentUser` is required and references the public `User` schema. |
| UI-004 | PASS | Medium | CSS/component inspection | Drawer uses stable two-column spacing with a responsive single-column fallback. |
| UI-009 | PASS | High | Chromium Admin workflow | User Management and Add Single User remain usable through Region and Dealer creation. |
| UI-010 | PASS | Medium | Pixel geometry assertion | Phone and Role controls share the same top coordinate and height within 1 pixel. |
| UI-011 | PASS | Medium | Desktop and existing responsive coverage | Standalone Dealer Code fills one visual column and becomes full width below 900px. |
| UI-020 | PASS | High | Existing Axe checkpoint | Labels, hints, errors, and dialog semantics remain accessible. |
| UI-025 | PASS | Medium | Browser screenshot | `frontend/docs/evidence/screenshots/single-user-form-alignment-chromium.png`. |
| UX-006 | PASS | Critical | Session reconciliation test | The displayed role now matches the authenticated server session after refresh. |
| UX-009 | PASS | High | Browser workflow | Region/Dealer success returns to the preserved user form without an error boundary. |
| UX-011 | PASS | High | Unit/browser states | Restore success, expiry, outage, form validation, and successful creation states are covered. |
| UX-013 | PASS | High | Axe and semantic locators | Dialog and form controls retain names and relationships. |
| UX-020 | PASS | High | Chromium end-to-end journey | Complete Admin desktop workflow passed. |
| UX-024 | PASS | High | Failure-state tests | Server authorization failures cannot leave a misleading cached Admin shell. |

## Root Cause and Fix

- A shared HttpOnly cookie can change when another tab signs in, while `sessionStorage` remains tab-local. The old restore path trusted the cached role, producing an Admin header with a non-Admin server session and correct 403 responses from Admin endpoints.
- `/api/bootstrap` now returns the authoritative public session user. Restore fetches bootstrap first, replaces stale cached identity, and only then loads role-scoped bookings.
- The drawer had inconsistent field-label heights, control sizing, and standalone Dealer Code grid placement. A stray JSX render artifact was also removed. Shared drawer CSS now pins row alignment and responsive width.

## Verification

- Backend full: 215 total, 210 passed, 5 documented infrastructure/platform skips, 0 failed.
- Frontend full uncontended run: 44 files, 198 tests passed, 0 failed.
- Browser: Admin critical file executed 12 cases across projects, 11 passed and 1 intentional mobile exclusion; the target Chromium journey passed with Axe, form geometry, phone sanitization, Region creation, and Dealer creation.
- Production build: passed. Frontend/backend architecture, lint, CSS/design-system, dependency-cycle, and affected-file formatting gates passed.
- One unrelated password-change test exceeded its 5-second timeout only while build, lint, and the full suite ran concurrently. It passed 5/5 in isolation, and the subsequent uncontended full suite passed 198/198.

## Limitations

- The Windows ACL helper prevented direct image-viewer inspection. Browser rendering, screenshot capture, exact geometry assertions, overflow checks, semantic locators, and Axe checks passed.
- Deployment completed using the existing `.env.docker` configuration. Backend/frontend/MySQL/Redis are healthy; local and public Cloudflare entry points both returned HTTP 200. Existing production-readiness NO-GO items outside this fix remain unchanged.