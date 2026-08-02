# Built-in Role Catalog and User Filters

Date: 2026-08-02
Status: BLOCKED (browser evidence only)

## Scope

- Added Roles as the first Access Data child tab in Business Settings.
- Displayed the six protected built-in roles as a read-only reference table.
- Connected User Management role selectors to the same bootstrap role definitions.
- Populated User Management status filters from supported lifecycle statuses.
- Populated region filters from active region master data, retaining stored values for compatibility.
- Added a reusable illustrated table empty state with a decorative Lucide watermark.

## UI audit

- UI-001/UI-002/UI-003 PASS: existing workspace tokens and hierarchy are preserved.
- UI-004/UI-005 PASS: shared tab, table controls, and TableEmptyState are reused.
- UI-006 PASS: Roles is informational and therefore exposes no mutation controls.
- UI-007 PASS: the watermark uses a labelled-library icon and is decorative to assistive technology.
- UI-008/UI-009 PASS: the empty state is unframed and maintains stable table height.
- UI-010/UI-011/UI-012 PASS: tables and filter controls retain responsive constraints and wrapping.
- UI-013/UI-014 PASS: active/inactive states include text; watermark is not required to understand the state.
- UI-015/UI-016 PASS: existing tab and filter focus/state behavior is unchanged.
- UI-019/UI-020 PASS: role, status, and region filters are complete and consistently labelled.
- UI-025 BLOCKED: live browser screenshots cannot start because the Windows ACL browser helper fails.

## UX audit

- UX-001 PASS: Roles clearly explains that built-in definitions are application-owned.
- UX-003 PASS: role reference data is disclosed under Access Data.
- UX-008/UX-009 PASS: empty results provide a clear heading and contextual explanation.
- UX-011 PASS: genuine and filtered empty states are represented.
- UX-013/UX-014 PASS: semantic tabs, labels, tables, and keyboard behavior are preserved.
- UX-017 PASS: filter labels and role scopes use task-oriented language.
- UX-020 BLOCKED: automated responsive rules pass, but live viewport evidence is blocked.
- UX-024 PASS: protected role behavior matches the signed-in Admin context.

## API audit

- API-004 PASS: UI role lists come from persisted normalized role definitions used by validation.
- API-026 PASS: existing validator and access-master tests remain green.
- All other API IDs N/A: no endpoint, persistence, authorization, or contract changes were made.

## Verification

- Focused frontend tests: 41/41 passed.
- Backend validators and access master-data tests: 21/21 passed.
- Frontend production build: passed.
- Browser evidence: BLOCKED by the Windows deny-read ACL sandbox helper failure.
