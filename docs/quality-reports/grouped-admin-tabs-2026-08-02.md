# Grouped Admin Tabs

Date: 2026-08-02
Status: BLOCKED (browser screenshot gate only)

## Scope

- Added one reusable GroupedTabs component.
- Business Settings uses Access Data and Booking Workflow parents with contextual child tabs.
- Email Management uses Email Setup and Email Operations parents with contextual child tabs.
- Added a vertical separator between parent categories.
- Joined tab headers directly to their content surfaces and suppressed vertical overflow.

## UI audit

- UI-001 PASS: shared brand and interaction tokens control hierarchy states.
- UI-002/UI-003 PASS: parent and child levels establish an operational information hierarchy.
- UI-005 PASS: both workspaces reuse GroupedTabs, TabList, and Tab.
- UI-006 PASS: parent tabs select categories; child tabs select pages/datasets.
- UI-009 PASS: stable parent and child row dimensions.
- UI-010/UI-011 PASS: narrow layouts scroll horizontally and hide vertical overflow.
- UI-013 PASS: selected states meet contrast and are not color-only because position and border also change.
- UI-015/UI-016 PASS: inherited roving focus, arrow/Home/End navigation, hover, focus, and selected states.
- UI-025 BLOCKED: browser runtime still fails before launch with the Windows ACL deny-read error.

## UX audit

- UX-001/UX-003 PASS: parent context is visible and only relevant child choices are disclosed.
- UX-013/UX-014 PASS: both levels use labelled tablists and keyboard-operable tabs.
- UX-017 PASS: Access Data, Booking Workflow, Email Setup, and Email Operations use task-oriented language.
- UX-020 BLOCKED: responsive rules and component tests pass, but live viewport evidence is blocked.

## Verification

- Focused frontend suites: 25/25 passed.
- Frontend production build: passed.


## Full-canvas TabbedWorkspace follow-up

- Added a reusable TabbedWorkspace component that owns parent navigation, child navigation, and the selected tabpanel.
- Migrated Business Settings and Email Management to the full component boundary.
- The content canvas fills the usable desktop viewport and collapses naturally on mobile.
- Flattened direct Email Configuration, Message Template, and Delivery Log section shells into divider-based sections; tables and operational metrics retain useful framing.
- Removed gaps and duplicated outer borders between navigation and content.
- Focused frontend verification: 25/25 passed.
- Production frontend build: passed.
- UI-008 PASS: the workspace is a page canvas, and direct section cards were removed rather than nested.
- UI-009/UI-010/UI-011 PASS: stable full canvas with responsive mobile constraints and no vertical tab overflow.
- UX-001/UX-003 PASS: the selected parent governs the workspace and the selected child governs the entire canvas.
- UI-025/UX-020 remain BLOCKED because the browser runtime exits with the Windows ACL deny-read error.
