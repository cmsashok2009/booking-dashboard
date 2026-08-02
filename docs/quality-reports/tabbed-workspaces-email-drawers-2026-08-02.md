# Tabbed Workspaces and Email Drawers

Date: 2026-08-02
Status: BLOCKED (browser evidence only)

## Scope

- Extended the shared GroupedTabs component with a single-group mode.
- Migrated Booking Management to the shared TabbedWorkspace architecture.
- Kept the complete selected page inside each tab shell.
- Flattened Email Configuration, Message Templates, and Delivery Logs into continuous in-canvas sections.
- Added a branded top edge to selected parent tabs.
- Moved organization-template editing, starter preview, and live preview to shared right-side drawers.
- Reused the existing TipTap RichTextEditor for visual HTML authoring while preserving the bodyHtml form contract.

## UI audit

- UI-001 PASS: selected parent and child states use shared brand and interaction tokens.
- UI-002/UI-003 PASS: parent, child, and content hierarchy is explicit and continuous.
- UI-005 PASS: shared workspace, tabs, drawer, close, and editor components are reused.
- UI-006 PASS: tabs select views; buttons remain commands; the editor toolbar uses icon controls.
- UI-008 PASS: direct email and booking page shells are unframed inside the owning tab canvas.
- UI-009 PASS: tab rows, drawer header/footer, and content regions have stable dimensions.
- UI-010/UI-011 PASS: tab headers scroll horizontally; drawers become full-width and stack actions on narrow screens.
- UI-012 PASS: drawer content scrolls independently without moving its header or footer.
- UI-013 PASS: hierarchy uses borders, position, and background in addition to color.
- UI-014 PASS: editor and preview content remain within responsive drawer bounds.
- UI-015/UI-016 PASS: semantic tabs, labelled dialogs, focus lifecycle, close controls, and toolbar labels are retained.
- UI-025 BLOCKED: browser runtime exits before launch because the Windows ACL sandbox helper fails.

## UX audit

- UX-001/UX-003 PASS: each selected tab owns the complete task surface and discloses only relevant children.
- UX-005 PASS: editing and previewing stay in the same right-side workflow.
- UX-008 PASS: visual HTML authoring replaces raw markup while retaining plain-text fallback.
- UX-010 PASS: preview and save actions remain visible in fixed drawer footers.
- UX-013/UX-014 PASS: tab and dialog semantics support keyboard navigation and focus containment.
- UX-017 PASS: labels use task-oriented administrative language.
- UX-020 BLOCKED: responsive rules and tests pass, but live viewport evidence cannot start.
- UX-024 PASS: existing Admin-only feature visibility and API behavior are unchanged.

## Verification

- Focused frontend component tests: 36/36 passed.
- Frontend production build: passed.
- API/backend changes: none.
- Browser attempt: BLOCKED by the Windows deny-read ACL sandbox helper failure.

## Preview spacing and onboarding drawer follow-up

- Restored block spacing between the Subject label and preview value after the preview modal-to-drawer migration.
- Migrated Bulk User Onboarding from its custom wide modal to the shared SideDrawer.
- The drawer uses a fixed header and progress region with an independently scrolling active-step body.
- Nested template editing and send confirmation suspend the parent drawer and restore it after completion.
- UI-005/UI-008/UI-009/UI-010/UI-012/UI-014/UI-015/UI-016 PASS.
- UX-001/UX-003/UX-005/UX-010/UX-013/UX-014 PASS.
- UX-020 remains BLOCKED on live browser evidence because the Windows ACL browser runtime cannot start.
- Focused onboarding and preview tests: 26/26 passed.
- Frontend production build: passed.