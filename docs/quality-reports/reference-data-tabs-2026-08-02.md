# Reference Data Tabs and Master Validation

Date: 2026-08-02
Status: BLOCKED (browser screenshot gate only)

## Scope

- Renamed Workflow Options / Area Fields to Reference Data.
- Added grouped tabs for Access Data and Booking Workflow.
- Added a reusable keyboard-operable Tabs primitive.
- Added parent-group and child-tab selected states using shared brand and interaction tokens.
- Added contextual Region and Dealer Code management and active-catalog validation for single and bulk onboarding.

## UI audit

- UI-001 PASS: brand and interactive tokens control hover, focus, and selection.
- UI-002 PASS: compact operational layout matches the dashboard.
- UI-005 PASS: shared Tabs, Button, Select, TextInput, Modal, and Table primitives are reused.
- UI-006 PASS: tabs replace the dataset select; commands remain buttons.
- UI-009 PASS: fixed tab dimensions prevent selection layout shift.
- UI-010 PASS: grouped tabs scroll horizontally at narrow widths.
- UI-013 PASS: selected child uses dark branded text on a light branded surface; status is not color-only.
- UI-015 PASS: visible brand focus ring and roving tab stops.
- UI-016 PASS: default, hover, focus, and selected states are distinct.
- UI-019 PASS: contextual search/status filtering and dataset-specific Dealer Region column remain scannable.
- UI-025 BLOCKED: browser runtime exits before launch with Windows ACL deny-read error, so desktop/mobile screenshots could not be captured.

## UX audit

- UX-001 PASS: Reference Data title and group labels clarify purpose.
- UX-003 PASS: parent groups expose Access Data versus Booking Workflow without another page.
- UX-011 PASS: empty/filter/status states remain available.
- UX-013 PASS: tablists, tabs, tabpanel, labels, and headings have semantic relationships.
- UX-014 PASS: ArrowLeft/ArrowRight/Home/End move and select tabs; focused component tests pass.
- UX-020 BLOCKED: responsive CSS is built and tested structurally, but live mobile browser evidence is blocked.
- UX-023 PASS: active master data is surfaced at onboarding decision points.
- UX-024 PASS: Reference Data remains Admin-only.

## API audit

- API-001 PASS: endpoints derive the Admin from the authenticated session.
- API-002 PASS: create/update endpoints enforce Admin authorization.
- API-003 PASS: Region, Dealer Code, Region assignment, and status are validated.
- API-005 PASS: names and codes normalize consistently with case-insensitive duplicate checks.
- API-006 PASS: stable safe errors and HTTP status codes are returned.
- API-020 PASS: create/update actions record actor, entity, outcome, and time.
- API-024 PASS: single and bulk onboarding revalidate against active managed values.
- API-025 PASS: POST and PATCH Region/Dealer contracts are documented in OpenAPI.
- API-026 PASS: Reference Data and validator regression tests cover duplicates, inactive values, and missing dependencies.

## Verification

- Backend focused: 21/21 passed.
- Frontend focused: 11/11 passed.
- Frontend production build: passed.
- Docker: backend and frontend rebuilt and healthy.
- Browser: BLOCKED by `windows sandbox failed: helper_unknown_error: apply deny-read ACLs`.

## Connected tab surface follow-up

- Active parent group uses a branded section band and top marker.
- Active child uses a conventional raised tab whose lower edge merges with the content panel.
- Removed the vertical gap and joined header/content borders and corner radii.
- Focused frontend tests: 11/11 passed; rebuilt frontend container healthy.
