# Sticky Workspace Tabs and User Management Shell

Date: 2026-08-02
Status: BLOCKED (browser evidence only)

## Scope

- Made the shared TabbedWorkspace navigation sticky beneath the persistent page topbar.
- Applied the behavior consistently to Booking Management, Business Settings, Email Management, and User Management.
- Migrated User Management into the connected tab-shell architecture with Current Users as the default view and Add Users as the onboarding view.
- Kept active onboarding recovery with Add Users and retained all existing user filtering, download, edit, password, single-user, and bulk-upload actions.
- Anchored the booking empty state to the visible table viewport so horizontal table scrolling does not move the message.

## UI audit

- UI-004/UI-005 PASS: the existing GroupedTabs and TabbedWorkspace components remain the single implementation for all workspace navigation.
- UI-009/UI-010/UI-011 PASS: tabs and content form one continuous shell; the sticky bar has a restrained separation shadow and horizontally scrolls on narrow viewports.
- UI-015/UI-016 PASS: roving focus, Arrow keys, Home/End, selected state, and tab-panel relationships are preserved.
- UI-020 PASS: User Management uses the same hierarchy and selected-state treatment as the other administrative workspaces.
- UI-025 BLOCKED: live desktop/mobile screenshots could not start because the Windows browser sandbox ACL helper failed.

## UX audit

- UX-001/UX-003 PASS: Current Users is the default daily task; Add Users is a focused secondary workflow.
- UX-008/UX-011 PASS: onboarding recovery remains visible in the Add Users context and the booking no-data message stays centered in the visible viewport.
- UX-013/UX-014 PASS: semantic tab roles, keyboard navigation, focus states, and labelled panels are retained.
- UX-017 PASS: Current Users and Add Users use direct, task-oriented labels.
- UX-020 BLOCKED: responsive CSS and component tests pass, but live viewport evidence is unavailable.
- UX-024 PASS: all User Management actions remain within the authenticated Admin workspace.

## API audit

- N/A: no endpoint, authorization, validation, persistence, or API contract behavior changed.

## Automated Verification

- Cross-workspace focused tests: 21/21 passed.
- Full frontend suite: 172/172 passed.
- Frontend production build: passed.
- Formatting completed for all touched frontend files.

## Browser Verification

- Desktop sticky behavior: BLOCKED by `windows sandbox failed: helper_unknown_error: apply deny-read ACLs`.
- Mobile horizontal tab behavior: BLOCKED by the same runtime failure.
- Keyboard/focus: component coverage passed; live evidence BLOCKED.
- Console/hydration: production build passed; live console evidence BLOCKED.

## Limitations and Follow-up

- Capture desktop and mobile sticky-scroll screenshots once the Windows browser sandbox ACL issue is resolved.