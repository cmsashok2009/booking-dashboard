# Booking Dashboard Style Migration Checklist

This checklist turns the current UI audit into a single source of truth for component and style work. The goal is simple: change a token, primitive, or state once and have it update everywhere.

## Current foundation

- Design tokens already live in `app/theme.css`.
- Global CSS still carries many one-off layout, hover, and page-specific rules in `app/globals.css`.
- Shared primitives already exist in `app/components/ui/`.

## Shared primitives to standardize on

| Primitive     | Use everywhere for                       | Current file                        |
| ------------- | ---------------------------------------- | ----------------------------------- |
| `Button`      | all actions, tabs, CTAs, menu actions    | `app/components/ui/Button.jsx`      |
| `Field`       | label + hint + error wrapping            | `app/components/ui/Field.jsx`       |
| `TextInput`   | all text, email, password, search inputs | `app/components/ui/TextInput.jsx`   |
| `TextArea`    | all multiline text fields                | `app/components/ui/TextArea.jsx`    |
| `Select`      | all dropdown selects                     | `app/components/ui/Select.jsx`      |
| `Checkbox`    | all checkbox controls                    | `app/components/ui/Checkbox.jsx`    |
| `Panel`       | all content cards and blocks             | `app/components/ui/Panel.jsx`       |
| `Table`       | all tabular data                         | `app/components/ui/Table.jsx`       |
| `ModalShell`  | all dialogs and overlays                 | `app/components/ui/ModalShell.jsx`  |
| `PageHeader`  | page titles + subtitles                  | `app/components/ui/PageHeader.jsx`  |
| `StatusBadge` | state pills and labels                   | `app/components/ui/StatusBadge.jsx` |
| `MetricCard`  | KPI cards                                | `app/components/ui/MetricCard.jsx`  |
| `EmptyState`  | empty / no-data screens                  | `app/components/ui/EmptyState.jsx`  |
| `LinkButton`  | button-styled links                      | `app/components/ui/LinkButton.jsx`  |

## Audit summary

| Area             | Status     | Action                                                                       |
| ---------------- | ---------- | ---------------------------------------------------------------------------- |
| Tokens and theme | Partial    | Move all literal colors, radii, shadows, and type sizes into `app/theme.css` |
| Shared controls  | Good start | Keep expanding `app/components/ui/` and remove raw controls from pages       |
| Page CSS         | Heavy      | Replace page-specific hover/layout rules with tokens and primitives          |
| Tables           | Mixed      | Standardize all row, header, action, and hover states through `Table`        |
| Buttons          | Mixed      | Route every action through the shared `Button` or `LinkButton`               |
| Forms            | Mixed      | Route all inputs through `Field` + `TextInput`/`Select`/`TextArea`           |
| Modals           | Mixed      | Route all dialogs through `ModalShell`                                       |

## Files that still need migration

### High priority

| File                                         | What still needs cleanup                                            | Recommended component target                                                         |
| -------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `app/booking-dashboard.jsx`                  | many raw buttons, inputs, selects, table blocks, and modal sections | `Button`, `Field`, `TextInput`, `Select`, `TextArea`, `Table`, `Panel`, `ModalShell` |
| `app/components/UserOnboardingWizard.jsx`    | raw form controls, tables, and workflow action rows                 | `Field`, `TextInput`, `Checkbox`, `Button`, `Table`, `ModalShell`, `Panel`           |
| `app/components/EmailTemplatesView.jsx`      | raw template editor inputs, textarea, select, preview modal buttons | `Field`, `TextInput`, `TextArea`, `Select`, `Button`, `ModalShell`, `Panel`          |
| `app/components/ReconciliationDashboard.jsx` | inline table and state blocks                                       | `Table`, `Panel`, `StatusBadge`, `MetricCard`                                        |
| `app/components/EditableUsersTable.jsx`      | inline inputs, sort controls, action buttons                        | `Table`, `Field`, `TextInput`, `Button`, `StatusBadge`                               |

### Medium priority

| File                                      | What still needs cleanup                          | Recommended component target                       |
| ----------------------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| `app/components/NotificationDrawer.jsx`   | list rows, action buttons, header controls        | `ModalShell`, `Button`, `StatusBadge`, `Panel`     |
| `app/components/Topbar.jsx`               | notification icon button and menu trigger styling | `Button`, `StatusBadge`, `ProfileMenu` primitives  |
| `app/components/ProfileMenu.jsx`          | menu item hover/state styling                     | shared menu primitive or `Button`-based menu items |
| `app/components/NotificationToast.jsx`    | toast action/close button styling                 | shared toast primitive + `Button`                  |
| `app/components/Pagination.jsx`           | page controls and active state                    | `Button` and tokenized state styles                |
| `app/components/PasswordRevealButton.jsx` | standalone password toggle                        | `Button` or dedicated icon-button primitive        |
| `app/components/ConfirmationModal.jsx`    | modal actions and emphasis blocks                 | `ModalShell`, `Button`, `Panel`                    |
| `app/components/ChangePasswordModal.jsx`  | form layout and validation messaging              | `Field`, `TextInput`, `ModalShell`, `Button`       |
| `app/components/ProfilePhotoModal.jsx`    | modal action layout                               | `ModalShell`, `Button`, `Panel`                    |
| `app/components/InfoTooltip.jsx`          | tooltip trigger and content styling               | tooltip primitive + tokens                         |
| `app/components/AutocompleteCombobox.jsx` | input + dropdown list styles                      | `TextInput`, `Panel`, `Button`                     |

### Low priority but still important

| File                                   | What still needs cleanup                                              | Recommended component target                           |
| -------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ |
| `app/components/Login.jsx`             | already uses shared form pieces, but layout still depends on page CSS | `Panel`, `Field`, `TextInput`, `Button`                |
| `app/components/EmailDeliveryView.jsx` | mostly standardized, review table/footer layout                       | `Table`, `Panel`, `PageHeader`, `EmptyState`           |
| `app/components/EmailSettingsView.jsx` | mostly standardized, review any remaining page CSS                    | `Panel`, `Field`, `TextInput`, `Button`, `StatusBadge` |
| `app/components/ui-kit/page.jsx`       | showcase page should mirror the final tokens                          | all primitives                                         |

## CSS cleanup checklist

### Token layer

- Move every hard-coded color in `app/globals.css` to `app/theme.css`.
- Keep only semantic aliases in `app/theme.css` for legacy compatibility if needed.
- Define token groups for:
  - brand
  - semantic states
  - surface/background
  - borders
  - typography
  - spacing
  - radius
  - shadows
  - control heights

### Component layer

- Make hover, focus, active, disabled, and selected states come from shared component classes.
- Give buttons explicit variants for:
  - primary
  - secondary
  - outline
  - ghost
  - danger
  - danger quiet
- Give inputs explicit variants for normal, error, disabled, and read-only states.
- Give tables explicit row, header, hover, and empty states.
- Give modals one backdrop, one shell, one footer pattern.

### Page override cleanup

- Remove page-specific hover colors where a shared primitive exists.
- Remove duplicated spacing rules when `Panel`, `Table`, or `Field` can own them.
- Remove any `button`, `input`, `select`, or `textarea` styling that targets a page instead of a shared primitive.

## Recommended migration order

1. Lock down `app/theme.css` as the only token source.
2. Finish `Button`, `Field`, `TextInput`, `TextArea`, `Select`, `Panel`, `Table`, `ModalShell`.
3. Convert all remaining raw controls in `app/booking-dashboard.jsx`.
4. Convert `UserOnboardingWizard`, `EmailTemplatesView`, and `ReconciliationDashboard`.
5. Normalize topbar, profile menu, drawer, toast, pagination, and tooltip patterns.
6. Remove leftover page-level CSS overrides from `app/globals.css`.
7. Re-run the UI audit page (`/ui-kit`) after every major pass.

## Definition of done

- One hover change updates every matching control.
- One font or size change updates every page.
- No raw `<button>`, `<input>`, `<select>`, or `<textarea>` remains in core app screens unless wrapped by a shared primitive.
- Page CSS only handles layout exceptions, not component styling.
