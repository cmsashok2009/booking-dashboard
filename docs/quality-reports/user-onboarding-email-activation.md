# User Onboarding, Email Templates, and Activation Quality Report

Date: 2026-07-29

Overall gate: **BLOCKED for production deployment; PASS for the local prototype scope**

The complete local workflow is implemented and tested. Production deployment remains blocked on the planned MySQL transaction layer, real queued email provider, retry/webhook processing, rate limiting, and operational telemetry. These are documented rather than represented as completed.

## Change Summary

- Durable, resumable bulk-user onboarding with row-level created, skipped, duplicate, dependency, invalid, and failed outcomes.
- Existing users are skipped and valid rows import idempotently.
- Admin Email Templates and Email Delivery navigation, supplied sample templates, cloning, editing, validation, preview, versioning, and campaign logs.
- Missing-template detour returns to the same workflow and preselects/previews the new active template.
- Recipient review, exclusion, explicit send confirmation, local mock delivery, and digest-only activation tokens.
- Account activation route with password policy, secure hashing, token consumption, and invalid/expired state.
- HttpOnly same-site sessions and server-enforced Admin authorization for `/api/admin/*`.
- Repository UX, UI, and API skills with stable IDs plus `AGENTS.md` enforcement.

## UX Skill Results

PASS: `UX-001`, `UX-003`, `UX-004`, `UX-005`, `UX-006`, `UX-008`, `UX-009`, `UX-010`, `UX-011`, `UX-012`, `UX-013`, `UX-014`, `UX-015`, `UX-016`, `UX-017`, `UX-018`, `UX-019`, `UX-020`, `UX-021`, `UX-022`, `UX-023`, `UX-024`, `UX-025`.

- Evidence: named stepper, saved workflow ID, progress list, row outcome table, missing-template recovery, recipient exclusions, confirmation panel, focus trap/Escape/return focus in the main wizard, sample-data labels, desktop build, and 390x844 no-overflow browser check.
- `UX-002`: N/A. This Admin-only workflow does not assign operational booking actions.
- `UX-007`: PARTIAL. Server checkpoints persist; template-editor local edits currently offer Cancel rather than a three-way Save/Discard/Stay prompt.

## UI Skill Results

PASS: `UI-001`, `UI-002`, `UI-003`, `UI-004`, `UI-005`, `UI-006`, `UI-007`, `UI-008`, `UI-009`, `UI-010`, `UI-011`, `UI-012`, `UI-014`, `UI-015`, `UI-016`, `UI-017`, `UI-019`, `UI-020`, `UI-021`, `UI-025`.

- Evidence: shared existing tokens/components, 6px operational panels, responsive constraints, status text plus color, sticky wizard header, scroll-bounded tables, consistent required markers/errors, successful production render, and mobile overflow metrics (`scrollWidth=390`, `clientWidth=390`).
- `UI-013`: PARTIAL. Colors use established high-contrast tokens; a formal automated WCAG contrast scan was not available.
- `UI-018`: N/A. No new drawer was introduced.
- `UI-022`: PARTIAL. Motion is limited to a loading spinner; `prefers-reduced-motion` remains to be added globally.
- `UI-023`: PARTIAL. Email content is clearly marked as sample, but dedicated desktop/mobile email-width toggles are deferred.
- `UI-024`: N/A. No chart was introduced.

## API Skill Results

PASS: `API-001`, `API-002`, `API-004`, `API-005`, `API-007`, `API-008`, `API-013`, `API-014`, `API-015`, `API-016`, `API-017`, `API-022`, `API-023`, `API-024`, `API-028`, `API-029`.

- Evidence: HttpOnly cookie identity, global Admin guard, database role catalog/hierarchy, per-row outcomes, idempotent import/send tests, SHA-256 token digests, 256-bit random tokens, 24-hour expiry, revocation, one-time use, scrypt password hashing, upload size/row bounds, merge allowlist, unsafe HTML rejection, escaped HTML merge values, versioned templates/workflows, and local provider isolation.
- `API-003`: PARTIAL. Inputs have explicit manual validators; a shared schema library is not yet used server-side.
- `API-006`: PARTIAL. Status codes and safe messages are present; stable error codes and correlation IDs are deferred.
- `API-009`: BLOCKED. Local JSON persistence cannot provide MySQL-grade multi-record transactions.
- `API-010`: PARTIAL. Workflows are versioned and owner-checked; optimistic compare-and-swap conflict enforcement is deferred.
- `API-011`: N/A for the bounded workflow detail endpoints; campaign-list pagination is deferred before production scale.
- `API-012`: BLOCKED. Activation and send rate limiting is not yet implemented.
- `API-018`: BLOCKED. The local mock provider records and deduplicates sends but does not use a durable retry queue.
- `API-019`: N/A for the local provider; required when a production provider is configured.
- `API-020`: PARTIAL. Core import/template/campaign/activation events are audited; correlation IDs are deferred.
- `API-021`: BLOCKED. Production metrics, queue depth, latency, and alerting are not configured.
- `API-025`: PARTIAL. Swagger includes the changed endpoints and security-sensitive fields, but full response schemas/idempotency examples remain.
- `API-026`: PARTIAL. Core success/failure/idempotency/security tests pass; rate-limit, webhook, queue retry, and concurrent database tests depend on production infrastructure.
- `API-027`: PARTIAL. Upload bounds are 5 MB and 500 rows; measured latency budgets are not documented.
- `API-030`: BLOCKED. `/api/health` reports process health only and does not check MySQL, queue, or provider readiness.

## Verification Evidence

- `backend: npm.cmd test` -> 29 tests passed, 0 failed.
- `frontend: npm.cmd run build` -> Next.js 16.2.12 production build passed; `/activate` generated.
- OpenAPI JSON parsed successfully; Swagger UI returned HTTP 200.
- Local services: frontend HTTP 200, backend health HTTP 200.
- Auth boundary: anonymous bootstrap 401, anonymous Admin API 403, login 200, authenticated bootstrap 200, authenticated Admin API 200, one HttpOnly session cookie.
- Browser desktop: invalid activation token removed from URL, safe recovery state rendered, no console errors/warnings.
- Browser mobile 390x844: `scrollWidth=390`, no horizontal overflow, no console errors/warnings.
- Activation tests cover invalid, successful, consumed, strong-password, secret-redaction, and digest-only persistence behavior.

## Known Deployment Work

1. Replace local JSON persistence with the planned MySQL repositories and transactions.
2. Add a durable queue, production email-provider adapter, retries, webhook verification, and resend actions.
3. Add rate limiting, correlation IDs, readiness checks, metrics, and alerting.
4. Complete formal accessibility/contrast automation and remaining template-editor unsaved-change handling.
