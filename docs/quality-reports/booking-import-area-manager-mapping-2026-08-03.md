# Quality Report: Booking Import Area Manager Mapping

- Date: 2026-08-03
- Reviewer/agent: Codex
- Changed surface: Booking CSV assignment validation and manager resolution
- Overall gate: `BLOCKED`

| ID | Status | Severity | Validation method | Evidence | Notes/owner |
|---|---|---|---|---|---|
| API-003 | PASS | High | Exact CSV validation and unit tests | Dealer Code, Region, AM and active user mapping are normalized and validated | Unknown Dealer Codes remain rejected |
| API-006 | PASS | High | Controller test | Failure copy now names the actual missing dependency: active Area Manager mapping | Duplicate row errors remain aggregated |
| API-009 | PASS | High | Code review and full backend suite | Assignment is resolved before booking upsert; failed validation writes no bookings | Existing canonical mappings remain supported |
| API-026 | PASS | High | Full backend test suite | 214 passed, 5 documented skips, 0 failed | Added no-Regional-Manager regression |
| API-029 | PASS | Medium | Compatibility tests | Existing canonical Dealer Code mappings and startup repair still pass | Regional Manager is additive/optional for this import path |
| UI-009 | PASS | Medium | Controller feedback test | Existing preview/error layout contract is unchanged | Only safe message text changed |
| UI-020 | PASS | Medium | Controller feedback test | Error identifies the actionable missing field | Success path retains existing upload controls |
| UI-025 | BLOCKED | High | Browser evidence | Windows ACL browser runtime failure prevented screenshot capture | No production layout or CSS changed |
| UX-008 | PASS | High | Controller test | Batch failure summary remains deduplicated with affected-row count | Exact message covered |
| UX-009 | PASS | High | Exact CSV simulation | Valid mapped rows now proceed; invalid mappings explain the cause | Preview state remains retryable |
| UX-011 | PASS | Medium | Unit and controller tests | Success and failure paths are covered | Five-row success verified |
| UX-023 | PASS | High | Contract test | Missing dependency is limited to active Area Manager mapping | Regional Manager is not required |
| UX-024 | PASS | Medium | Code review | Assignment derives from active User Management data | CSV cannot spoof a manager for an unknown Dealer Code |
| UX-020 | BLOCKED | High | Browser workflow | Signed-in desktop/mobile retry could not be automated due browser runtime ACL failure | User can retry on deployed localhost |

## Automated Verification

- Focused backend mapping and validation: PASS, 26/26.
- Full backend suite: PASS, 214 passed, 5 documented skips, 0 failed.
- Frontend controller feedback suite: PASS, 25/25.
- Backend architecture/cycle gate: PASS.
- Exact `bookings-5-records-ashok.csv` simulation: PASS, 5 rows inserted, 0 failed, all assigned to `u-ashok`, Regional Manager empty.
- Docker backend rebuild: PASS.
- Compose health: backend and frontend healthy.
- HTTP probes: `http://localhost:3000/` and `/api/health` returned 200.

## Browser Verification

- Desktop viewport: BLOCKED by Windows ACL browser runtime failure.
- Mobile viewport: BLOCKED by Windows ACL browser runtime failure.
- Keyboard/focus: N/A; no UI structure or controls changed.
- Console/hydration: HTTP and production container health passed; live console inspection blocked.

## Limitations and Follow-up

- Signed-in browser screenshot evidence remains outstanding.
- The live CSV was not imported automatically to avoid mutating production-like booking data; the exact file was validated against an isolated copy of the current `1001 / ashok / test` mapping.
