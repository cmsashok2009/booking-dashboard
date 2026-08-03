# Quality Report: User Phone and Reference Creation Regressions

- Date: 2026-08-03
- Reviewer/agent: Codex
- Changed surface: Single-user phone entry and validation; Region/Dealer creation inside the Single User drawer
- Overall gate: `PASS`

| ID      | Status | Severity | Validation method                      | Evidence                                                                                     | Notes/owner                                                             |
| ------- | ------ | -------- | -------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| API-003 | PASS   | High     | Validator and schema tests             | `backend/src/user-validation.js`                                                             | An optional supplied phone must match exactly 10 ASCII digits.          |
| API-005 | PASS   | Medium   | Unit tests                             | Invalid symbols, prefixes, and lengths are rejected consistently.                            |
| API-006 | PASS   | High     | Unit/component tests                   | Phone errors identify the `Phone` field with safe actionable text.                           |
| API-009 | PASS   | High     | Browser and existing mutation tests    | Successful Region/Dealer writes are retained while client reconciliation completes.          |
| API-020 | PASS   | Medium   | Existing access-master tests           | Existing creation audit events remain unchanged.                                             |
| API-025 | PASS   | High     | OpenAPI contract test                  | `UserUploadRow.Phone` documents pattern and exact length.                                    |
| API-026 | PASS   | High     | Focused, full, and browser regressions | Backend 214 total; frontend 197 total; browser 1/1                                           | Invalid/valid/omitted phone and bounded mutation responses are covered. |
| API-029 | PASS   | Medium   | Contract inspection                    | Existing bounded Region/Dealer response shape is preserved.                                  |
| UI-005  | PASS   | Medium   | Component inspection                   | Shared `TextInput`, field error, drawer, and buttons remain in use.                          |
| UI-009  | PASS   | High     | Browser workflow                       | Region and Dealer creation return to the preserved user form without a crash.                |
| UI-016  | PASS   | Medium   | Component/browser tests                | Phone hint, invalid state, and valid sanitized state are distinguishable.                    |
| UI-020  | PASS   | High     | Component tests                        | Phone guidance and adjacent error text are exposed through `aria-describedby`.               |
| UI-025  | PASS   | Medium   | Browser screenshot                     | `frontend/docs/evidence/screenshots/area-manager-generic-reporting-manager-chromium.png`     | Screenshot is captured after successful Region/Dealer creation.         |
| UX-008  | PASS   | High     | Component test                         | Short phone input is blocked with an adjacent error.                                         |
| UX-009  | PASS   | High     | Browser workflow                       | Successful master-data creation returns to the preserved form instead of the error boundary. |
| UX-011  | PASS   | High     | Component/browser tests                | Default, hint, invalid, saving, and success-return states are exercised.                     |
| UX-013  | PASS   | High     | Axe checkpoint and semantic locators   | Drawer names transition through Add Single User, Add Region, and Add Dealer Code.            |
| UX-020  | PASS   | High     | Chromium Admin journey                 | The complete supported desktop workflow passes.                                              |
| UX-023  | PASS   | Medium   | Existing drawer workflow               | Missing Region recovery remains available from Dealer creation.                              |

## Automated Verification

- Backend focused: validation, onboarding, and OpenAPI contract tests passed 44/44.
- Backend full: 214 total, 209 passed, 5 documented infrastructure/platform skips, 0 failed; architecture passed.
- Frontend full before the behavior-preserving component extraction: 44 files and 197 tests passed.
- Frontend post-extraction focused: 12/12 passed; lint, formatting, module-size, and dependency-cycle gates passed.
- Browser: Admin critical Chromium journey passed 1/1 after exercising mixed phone input, bounded Region creation, bounded Dealer creation, state preservation, and Axe checks.

## Browser Verification

- Desktop viewport: PASS in Chromium.
- Mobile viewport: Not separately rerun because the fix changes input sanitization and response reconciliation, not responsive layout.
- Keyboard/focus: Existing focus-managed drawer transitions remain intact; semantic dialog-name locators passed.
- Console/hydration: No error boundary appeared after successful Region or Dealer creation.

## Root Cause and Guardrail

- Root cause: the frontend expected obsolete `result.regions` and `result.dealerCodes` arrays after successful mutations. Production correctly returned bounded `{ region, collectionUrl }` and `{ dealerCode, collectionUrl }` contracts, causing `undefined` to enter component state and fail on the next `.map()`/`.filter()` render.
- Fix: reconcile the returned item into local state and trigger the existing background reference-data refresh.
- Guardrail: component fixtures now use the real bounded production response, and Playwright creates both records before asserting the user drawer remains usable. Executable tests were strengthened; no skill wording change was necessary.

## Limitations and Follow-up

- Phone remains optional to preserve the existing API contract. When supplied, it is restricted to exactly 10 digits in both UI and backend validation.
