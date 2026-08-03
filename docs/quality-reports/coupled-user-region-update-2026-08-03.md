# Quality Report: Coupled User Region Update

- Date: 2026-08-03
- Reviewer/agent: Codex
- Changed surface: inline Admin user editing, Region/Dealer Code validation and persistence, OpenAPI
- Overall gate: `PASS`

## Root Cause

The affected Area Manager had Dealer Code `1001` assigned to Region `test`. Changing only the Region to `test 2` correctly failed backend integrity validation because the existing Dealer Code would become invalid. The inline user editor did not expose Dealer Code, the backend update always reused the hidden current code, and the UI replaced structured `422` details with a generic request-failed toast. The user therefore had no visible way to resolve the dependency.

## Control Results

| ID | Status | Evidence |
| --- | --- | --- |
| API-003 | PASS | Update validation accepts an explicit optional `dealerCode`, validates it against Region, and OpenAPI documents the coupled field. |
| API-006 | PASS | Structured `422` field details, default stable error code, and correlation ID remain intact; UI surfaces the first safe detail. |
| API-009 | PASS | Region and Dealer Code are validated together and persisted in the same user update/save transaction. |
| API-026 | PASS | Validator, authenticated endpoint, full backend, component, and browser regressions pass. |
| API-029 | PASS | `dealerCode` is an additive optional request property; existing clients remain compatible. |
| UI-009 | PASS | Region changes update the Dealer Code control in place without table-layout loss. |
| UI-016 | PASS | Incompatible Dealer Code visibly resets to `No Dealer Code`; validation errors remain adjacent and the Save state completes. |
| UI-020 | PASS | Region and Dealer Code have explicit accessible names, hint text, and adjacent error support. |
| UI-025 | PASS | Desktop/mobile screenshots captured before Save with the corrected coupled state. |
| UX-008 | PASS | Server field errors are mapped adjacent to controls and repeated in actionable alert feedback. |
| UX-009 | PASS | Generic request failure is replaced by the first safe server validation detail. |
| UX-011 | PASS | Edit, dependency-cleared, invalid, saving, success, and unchanged states are covered. |
| UX-023 | PASS | The dependency is visible and directly resolvable in the same row before Save. |
| UX-024 | PASS | The Admin workflow and authenticated audit ownership remain role-appropriate. |

## Implementation

- Added a Region-filtered Dealer Code selector to the inline user editor.
- Changing Region visibly clears an incompatible Dealer Code and explains that behavior before Save; the Admin can select another valid code or keep `No Dealer Code`.
- Added `dealerCode` to the editable draft, user collection model, request payload, backend validator, persisted update, and OpenAPI schema.
- Server validation details now populate adjacent errors and the error toast instead of falling back to generic copy.
- Removed the ignored client `updatedBy` hint; audit identity continues to come from the authenticated backend session.
- Extracted Region editor and field/error helpers to keep all 135 frontend modules within the 350-line architecture cap.

## Verification

- Backend full suite: 218 total; 213 passed, 5 documented skips, 0 failed.
- Frontend full suite: 44 files, 202/202 tests.
- Frontend lint, design-system/CSS/modal gates, module-size, dependency-cycle, and production build: PASS.
- Focused Playwright: Chromium and mobile Chromium 2/2 PASS with exact `{ region: "South", dealerCode: "" }` payload assertion, edit completion, Axe, and screenshots.
- Screenshots: `frontend/docs/evidence/screenshots/user-region-update-{chromium,mobile-chromium}.png`.

## Deployment

- Rebuilt and restarted backend and frontend with the existing `.env.docker` configuration.
- Backend and frontend containers are running and healthy.
- Backend readiness confirms MySQL normalized persistence and Redis abuse control are ready.
- Local frontend and public Cloudflare entry point return HTTP 200.
