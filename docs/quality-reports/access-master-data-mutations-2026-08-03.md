# Quality Report: Access Master Data Mutations

- Date: 2026-08-03
- Reviewer/agent: Codex
- Changed surface: Business Settings Region and Dealer Code edit/deactivate/reactivate actions
- Overall gate: `PASS`

| ID | Status | Severity | Validation method | Evidence |
| --- | --- | --- | --- | --- |
| API-003 | PASS | High | Controller and backend mutation tests | Shared UI patches are translated to explicit Region `{name,status}` and Dealer `{code,status}` schemas. |
| API-006 | PASS | High | Existing server and frontend error tests | Dedicated endpoints retain stable validation/status errors; the obsolete lookup-field error is no longer triggered. |
| API-009 | PASS | High | Server security mutation test | Successful writes persist before bounded continuation metadata is returned. |
| API-025 | PASS | Medium | OpenAPI mutation contract test | Dedicated Region and Dealer PATCH operations remain documented with bounded responses. |
| API-026 | PASS | High | Unit, server, and browser regressions | Controller 23/23; backend focused 12 passed/1 Windows skip; browser 2/2; frontend full 200/200. |
| API-029 | PASS | Medium | Contract inspection | Existing dedicated additive endpoints are used; no API contract changed. |
| UI-009 | PASS | High | Desktop/mobile Chromium | Edit and deactivate complete without error toast or layout shift. |
| UI-016 | PASS | Medium | Browser interaction | Edit, save, deactivate, and resulting success paths are exercised. |
| UI-025 | PASS | Medium | Desktop/mobile screenshots | `frontend/docs/evidence/screenshots/admin-reference-mutations-{chromium,mobile-chromium}.png`. |
| UX-009 | PASS | High | Browser workflow | Mutations return success feedback instead of the misleading non-editable lookup error. |
| UX-011 | PASS | High | Unit/browser states | Edit, save, deactivate, API failure, and success states remain covered. |
| UX-024 | PASS | High | Authenticated Admin browser/server tests | Commands remain Admin-only and match the signed-in role. |

## Root Cause and Fix

- Region and Dealer Code creation already used dedicated endpoints, but the shared edit/status action always sent PATCH requests to `/api/admin/lookups/{field}/options/{id}`.
- Regions and Dealer Codes are access master data, not booking-workflow lookup fields, so the backend correctly returned `Lookup field is not editable or does not exist.`
- The action now routes Region mutations to `/api/admin/regions/{id}` and Dealer mutations to `/api/admin/dealer-codes/{id}`, translating the shared label into the resource-specific `name` or `code` field.

## Verification

- Focused controller: 23/23 passed, including encoded IDs, exact endpoints, exact payloads, refresh, and success feedback.
- Focused backend: 13 total, 12 passed, 1 documented Windows SIGTERM skip, 0 failed.
- Browser: desktop and mobile Chromium passed 2/2 with Region rename, Dealer deactivation, endpoint/payload assertions, Axe, responsive checks, and screenshots.
- Frontend full uncontended: 44 files, 200/200 tests. Production build and lint passed.
- A concurrent suite run experienced three unrelated 5-second interaction-test timeouts while build/backend tests competed for resources; the subsequent uncontended full suite passed 200/200.
- Deployment: frontend image rebuilt and service restarted; container healthy; local and public Cloudflare entry points returned HTTP 200.
