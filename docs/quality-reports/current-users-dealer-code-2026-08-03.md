# Quality Report: Current Users Dealer Code

- Date: 2026-08-03
- Reviewer/agent: Codex
- Changed surface: Current Users table, inline user editor, user-table layout, user export column declaration
- Overall gate: `BLOCKED`

| ID | Status | Severity | Validation method | Evidence | Notes/owner |
|---|---|---|---|---|---|
| UI-004 | PASS | High | Component test and code review | Dealer Code renders as a dedicated table column | Empty assignments render as `Not assigned` |
| UI-009 | PASS | High | Component test | Existing Dealer Code data renders in the Current Users row | No API contract change required |
| UI-010 | PASS | Medium | ESLint and code review | Semantic table header/cell structure retained | Dealer Code is intentionally non-sortable |
| UI-011 | PASS | Medium | Stylelint and production build | Stable 140px Dealer Code column and 1130px table minimum | Horizontal containment retained |
| UI-012 | PASS | Medium | Component test | Empty table colspan updated from 6 to 7 | Empty-state alignment retained |
| UI-019 | PASS | Medium | Component test | Edit mode discloses that Dealer Code is edited with Region | Existing coupled control remains authoritative |
| UI-025 | BLOCKED | High | Browser visual verification | Browser runtime was unavailable because the Windows ACL helper rejected startup | Requires desktop/mobile screenshot pass |
| UX-001 | PASS | High | Component test | Dealer Code is visible beside Region and Status | Directly supports mapping diagnosis |
| UX-013 | PASS | Medium | Code review | `Not assigned` provides an explicit empty value | Avoids ambiguous blank cells |
| UX-018 | PASS | Medium | Component test | Edit mode preserves Region-filtered Dealer Code workflow | No duplicate editable control introduced |
| UX-020 | BLOCKED | High | Browser workflow | Browser runtime unavailable due the recorded Windows ACL failure | Requires signed-in visual acceptance |

## Automated Verification

- `vitest run test/components/UserAdministration.test.jsx`: PASS, 12/12 tests.
- Changed-file ESLint: PASS.
- `stylelint app/styles/08-tables.css`: PASS.
- Next.js production build: PASS.
- Docker Compose frontend rebuild: PASS.
- Compose health: frontend and backend healthy.
- HTTP probe: `http://localhost:3000/` returned 200.

## Browser Verification

- Desktop viewport: BLOCKED by Windows ACL browser runtime failure.
- Mobile viewport: BLOCKED by Windows ACL browser runtime failure.
- Keyboard/focus: BLOCKED; automated semantic table coverage passed.
- Console/hydration: Production build passed; live browser console inspection blocked.

## Limitations and Follow-up

- Full visual acceptance remains blocked until desktop and mobile browser evidence can be captured.
- The backend already returned `dealerCode`, and the Excel export already included Dealer Code; no API, persistence, or export behavior changed.
