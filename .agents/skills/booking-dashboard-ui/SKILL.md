---
name: booking-dashboard-ui
description: Audit Booking Dashboard visual design, responsive layouts, shared components, tables, forms, modals, drawers, email previews, and visual accessibility. Use for every frontend component or styling change and report applicable UI IDs with evidence.
---

# Booking Dashboard UI Audit

Inspect the rendered interface at desktop and mobile with dynamic content, errors, long text, and keyboard focus. Record applicable IDs in `docs/quality-reports/<feature>.md`.

## Checks

- `UI-001` Shared tokens control colors, spacing, type, radii, shadows, and borders.
- `UI-002` Screens match the established operational-tool theme.
- `UI-003` Typography reflects information hierarchy.
- `UI-004` Equivalent components share a spacing rhythm.
- `UI-005` Shared Button, Field, Modal, Drawer, Table, Pagination, Status, Toast, and EmptyState are reused.
- `UI-006` Control type matches the interaction.
- `UI-007` Approved icons are used and unfamiliar icons are labelled.
- `UI-008` No decorative card nesting.
- `UI-009` Dynamic states avoid unintended layout shifts.
- `UI-010` Layouts have explicit responsive constraints.
- `UI-011` No overlap, critical clipping, or container overflow.
- `UI-012` Long content wraps or discloses accessibly.
- `UI-013` Text, controls, focus, charts, and status meet WCAG AA contrast.
- `UI-014` Text/icon accompanies status color.
- `UI-015` Keyboard focus is consistently visible.
- `UI-016` Default, hover, focus, disabled, readonly, invalid, and success states differ.
- `UI-017` Modals have consistent width, scroll, close, focus, and mobile behavior.
- `UI-018` Drawers have consistent hierarchy, overlay, scroll, close, and mobile behavior.
- `UI-019` Tables support scanning, alignment, overflow, filtering, sorting, and pagination as needed.
- `UI-020` Required markers, labels, hints, errors, grouping, and form actions are consistent.
- `UI-021` Toast variants and timing are consistent.
- `UI-022` Motion is restrained and respects reduced motion.
- `UI-023` Email preview supports desktop/mobile widths and marked sample data.
- `UI-024` Charts use accurate scales, legends, labels, values, and accessible colors.
- `UI-025` Changed screens have desktop/mobile screenshot evidence.

## Modal Visual Gate

For every new or changed modal, agents must verify all of the following before PASS:

- Use a shared modal control and a feature-specific class; generic `.modal` fallback styling is a failure.
- Desktop width must fit content, remain at or below 50% of the viewport, and have an explicit pixel/rem cap. Mobile must fit without horizontal overflow or zoom.
- Place compact dialogs in the upper half of the viewport, preserve visible parent context, and avoid full-screen desktop dialogs unless the workflow requires it.
- Header, body, optional detail block, and footer must be visually distinct. Icons may not detach from titles; labels and values may not collide.
- Semantic tone and color must match the state (warning, danger, information, success) with text/icon support and WCAG AA contrast.
- Primary and escape actions must be unambiguous; actions belong in a stable footer and must not wrap or overlap at supported widths.
- Browser evidence must assert geometry, overflow, focus entry/trap/return, Escape close, accessible name/description, and capture desktop/mobile screenshots.
- Inspect the final production CSS bundle/load order. A selector that exists only in an unimported stylesheet is a Critical failure.
Fail any screen with overlap, inaccessible focus, hidden critical content, or incomplete responsive behavior.
