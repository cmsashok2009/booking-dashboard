# Phase 1 Architecture Progress

Checkpoint: 2026-08-01
Status: In progress

## Verified Changes

- The dashboard entry point is a 33-line controller consumer with feature-owned shell and overlay composition.
- Bookings, users, Area Fields, reconciliation, onboarding, email-template dialogs, and dashboard view models now have explicit feature or component boundaries.
- Booking, user, session, notification, export, metric, and workflow-abort actions were removed from the monolithic dashboard controller and moved into owning feature modules.
- Role permissions, dashboard metrics, insights, filtering, sorting, payload mapping, and option filtering are pure modules with focused unit coverage.
- All app JavaScript and JSX modules are at or below 350 lines.
- Relative app imports form an acyclic graph.
- Global undefined-symbol lint is enabled.
- Module-size and dependency-cycle gates run in local quality checks and hosted CI.
- Shared `ModalShell` now owns email-template dialog focus, Escape, backdrop, and nested-dialog suspension behavior.

## Current Measurements

| Measure                       |             Baseline |             Verified result |
| ----------------------------- | -------------------: | --------------------------: |
| `app/booking-dashboard.jsx`   |          2,503 lines |                    33 lines |
| Largest app JS/JSX module     |            888 lines |                   346 lines |
| `UserOnboardingWizard.jsx`    |            888 lines |                   301 lines |
| `EmailTemplatesView.jsx`      |            507 lines |                   202 lines |
| `ReconciliationDashboard.jsx` |            376 lines |                   291 lines |
| App modules checked           |         Not enforced |                         111 |
| Circular dependencies         |         Not measured |                           0 |
| Unit and component tests      | 13 at original audit | 159 passing across 38 files |
| Component tests               |  0 at original audit |   12 passing across 7 files |
| Generated routes              |                   11 |                          11 |

Largest current modules:

1. `app/hooks/useDashboardController.js`: 349 lines.
2. `app/components/EditableUsersTable.jsx`: 337 lines.
3. `app/features/dashboard/viewModel.js`: 311 lines.

## Passed Gates

- `npm run lint`
- `npm run check:architecture`
- `npm test`: 159 tests across 38 files passing.
- `npm run build`: Next.js 16.2.12 production build and all 11 routes generated.
- Focused dialog lifecycle tests: 6 passing after the shared-modal migration.

## Remaining Phase 1 Gates

1. Move API calls still owned directly by onboarding and email container components into feature service/action modules.
2. Document the final feature import ownership map.
3. Complete authenticated browser behavior evidence for Admin, Area Manager, Regional Manager, dealer, and unauthorized access.
4. Re-run all gates after those final ownership changes.

Phase 1 is not marked complete until these gates pass. The architecture measurements above do not imply that coverage, CSS, security, performance, CI history, or production-readiness phases are complete.

## Verification Commands

```powershell
npm run lint
npm run check:architecture
npm test
npm run build
```
