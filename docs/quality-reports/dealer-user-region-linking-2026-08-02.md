# Dealer Code and User Region Linking

Date: 2026-08-02
Status: BLOCKED (browser evidence only)

## Scope

- Selecting a Dealer Code now assigns its authoritative Region to the user and prevents an incompatible manual Region selection.
- Creating a Dealer Code carries its Region back to the user form.
- An empty Dealer Code drawer offers an Add Region recovery action and returns to Dealer Code creation without discarding user input.
- Single-user and bulk-upload validation reject Dealer Code and Region mismatches with an actionable row-level error.

## UI audit

- UI-005/UI-006 PASS: existing Select, Button, SideDrawer, and form patterns are reused.
- UI-009/UI-010 PASS: the linked-region hint and recovery action fit the established drawer layout and wrap on narrow widths.
- UI-015/UI-016 PASS: native labelled selects retain keyboard and focus behavior; the locked Region remains programmatically associated with its hint.
- UI-018/UI-020 PASS: disabled state and linked-region explanation make the dependency visible without color-only communication.
- UI-025 BLOCKED: live desktop/mobile browser evidence could not start because the Windows ACL helper failed before browser initialization.

## UX audit

- UX-001/UX-003 PASS: Dealer Code selection immediately produces the expected Region relationship and explains why Region is locked.
- UX-008/UX-009 PASS: mismatches produce a field-specific Region error naming the required Region and Dealer Code.
- UX-013/UX-014/UX-015 PASS: labels, native keyboard controls, and focus-managed drawer navigation are preserved.
- UX-024/UX-025 PASS: Admin-only master-data creation remains role appropriate, and bulk rows receive the same authoritative validation as single-user onboarding.

## API audit

- API-003/API-004 PASS: the persisted active Dealer Code catalog is authoritative for its Region relationship.
- API-005/API-006 PASS: validation normalizes comparison case and rejects a mismatched Region before persistence.
- API-009 PASS: existing Admin authorization for Region and Dealer Code mutation is unchanged.
- API-020/API-025/API-026 PASS: failures use the existing row-error envelope and are covered for valid and mismatched pairs.
- API-029 PASS: request/response shapes are unchanged; this is additive validation of an existing relationship, so no OpenAPI schema change is required.

## Automated Verification

- Focused frontend component tests: 11/11 passed.
- Focused backend validator/master-data tests: 21/21 passed.
- Full frontend suite: 172/172 passed.
- Full backend suite: 66 passed, 2 infrastructure skips, 2 parallel server-start failures; the two failed security tests passed 2/2 when rerun in isolation.
- Frontend production build: passed.
- `git diff --check`: passed (line-ending notices only).

## Browser Verification

- Desktop viewport: BLOCKED by `windows sandbox failed: helper_unknown_error: apply deny-read ACLs`.
- Mobile viewport: BLOCKED by the same browser-runtime failure.
- Keyboard/focus: covered by native-control component tests; live evidence BLOCKED.
- Console/hydration: production build passed; live console evidence BLOCKED.

## Limitations and Follow-up

- Capture desktop and mobile screenshots after the Windows browser sandbox ACL issue is resolved.