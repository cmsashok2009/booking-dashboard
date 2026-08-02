---
name: booking-dashboard-ux
description: Audit Booking Dashboard workflow usability, accessibility, recovery, role appropriateness, bulk operations, and feedback. Use for every user-facing workflow change and report applicable UX IDs as PASS, FAIL, N/A, or BLOCKED with evidence.
---

# Booking Dashboard UX Audit

Identify changed user goals, roles, states, and irreversible actions before implementation. Exercise success, empty, partial-success, failure, retry, resume, and permission states. Record every applicable ID in `docs/quality-reports/<feature>.md`; unresolved Critical/High failures block completion.

## Checks

- `UX-001` Task and context are immediately clear.
- `UX-002` Actions identify the responsible role; oversight is not ownership.
- `UX-003` Secondary detail uses progressive disclosure.
- `UX-004` Multi-step work persists and resumes at the last valid checkpoint.
- `UX-005` Dependency detours return without lost work.
- `UX-006` Back, Exit, refresh, and navigation preserve saved work.
- `UX-007` Unsaved edits offer Stay, Save Draft, or Discard.
- `UX-008` Field errors are adjacent; bulk forms include an error summary.
- `UX-009` Errors explain cause, preserved state, and next action.
- `UX-010` Batch results separate created, skipped, invalid, duplicate, and failed.
- `UX-011` Loading, empty, success, partial, warning, failure, retry, disabled, and completed states exist.
- `UX-012` Destructive and bulk actions use proportionate confirmation.
- `UX-013` Landmarks, headings, labels, descriptions, errors, and live regions are meaningful.
- `UX-014` Complete workflows are keyboard operable with no trap.
- `UX-015` Dialog/drawer focus enters, closes with Escape, and returns to trigger.
- `UX-016` Users can review, exclude, cancel, and retry where permitted.
- `UX-017` Copy names owner, consequence, status, and next action.
- `UX-018` Totals reconcile across summary, tables, exports, and logs.
- `UX-019` Secrets stay hidden and sample data is identified.
- `UX-020` Workflow completes at supported desktop and mobile widths.
- `UX-021` Long operations show honest progress and completion.
- `UX-022` Resume/retry does not duplicate users or messages.
- `UX-023` Missing dependencies explain the issue and offer recovery.
- `UX-024` Commands, fields, and messages match the signed-in role.
- `UX-025` Format, merge-field, validation, and expiry help appears at decision points.

Use `N/A` only with a concrete reason. Include browser viewport, keyboard path, and screenshot/test evidence.
