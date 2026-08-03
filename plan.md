# Production User Onboarding, Activation, and Email Delivery Plan

> Production-wide architecture, security, persistence, operations, and release work is governed by [Production Readiness Local Implementation and Audit Plan](docs/production-readiness-local-implementation-plan.md). This application targets one organization per deployment; multi-tenancy is out of scope.

## Purpose

Build a production-ready Admin workflow that imports users safely, skips existing users without failing the batch, reports every outcome clearly, sends secure activation links through managed email templates, and records delivery and activation history.

This file is the implementation checklist and final acceptance record. Every completed phase must update its checkboxes and verification notes.

## Confirmed Decisions

- The canonical roles are Area Manager, Regional Manager, All India I, All India II, All India, and Admin.
- Roles and hierarchy come from the database and are never accepted as arbitrary upload text.
- Existing users are skipped during bulk import; they are not silently overwritten.
- Valid rows may be imported even when other rows are invalid.
- Newly created users receive an expiring, single-use activation link instead of a username/password email.
- The activation flow requires the user to create a password before account access is granted.
- No plaintext password or activation token is stored in application logs or the database.
- Only Area Manager and Regional Manager are operationally actionable roles. Higher roles are oversight roles.
- Admin owns user onboarding, templates, campaigns, retries, and audit visibility.

## Activation and Password Experience

The activation link is the secure first-login gate. Because a user has no password before activation, password creation happens when the link is opened, immediately before the first authenticated session.

1. User opens the activation link.
2. Backend validates that the token is valid, unused, unexpired, and belongs to an eligible user.
3. UI shows the account email and a Set Password form.
4. User enters and confirms a password that satisfies the password policy.
5. Backend stores only the password hash, consumes the token, activates the account, and records an audit event.
6. User is directed to login or receives a new authenticated session according to the final authentication architecture.
7. Expired or consumed links show a safe recovery screen with a Request New Link action.

`mustChangePassword` remains available for future administrator-initiated password resets, but it is not required after a successful activation because the user has already created the initial password securely.

### Token Security

- Generate at least 256 bits of cryptographically secure randomness.
- Store only a SHA-256 token digest.
- Use a configurable expiry, initially 24 hours.
- Make tokens single-use and revoke older active invitations when a new one is issued.
- Rate-limit activation validation and resend requests.
- Do not reveal whether an arbitrary email exists in public recovery responses.
- Require HTTPS outside local development.

### Password Security

- Minimum 12 characters with clear, inline guidance.
- Permit password-manager-generated passwords and paste.
- Validate confirmation and common/compromised-password rules when the production identity service supports them.
- Hash using Argon2id or the approved identity provider.
- Never trim or alter passwords silently.
- Provide show/hide controls, Caps Lock guidance, accessible errors, and password-manager autocomplete attributes.

## End-to-End Admin Workflow

## Resumable Workflow and Safe Detours

The onboarding process must be a persistent, server-backed workflow rather than transient modal state. An Admin may leave at any step, close the browser, navigate to another Admin page, create a missing dependency such as an email template, and resume from the last valid checkpoint.

Each onboarding workflow has a durable workflow ID and one of these states:

- `draft_upload`
- `validating`
- `validation_review`
- `ready_to_import`
- `importing`
- `import_completed`
- `template_selection`
- `recipient_review`
- `ready_to_send`
- `sending`
- `delivery_monitoring`
- `completed`
- `cancelled`
- `failed_recoverable`

Persist after every meaningful action:

- Import batch and source-file reference.
- Parsed row outcomes and validation decisions.
- Created, skipped, and invalid user IDs/rows.
- Selected template and template version.
- Recipient inclusions and exclusions.
- Preview validation result.
- Campaign ID and delivery progress.
- Current step, last completed step, owning Admin, and timestamps.

### Missing Template Detour

If no eligible active activation template exists during Template Selection:

1. Show an empty state explaining that an activation template is required.
2. Offer **Create Activation Template** as the primary action.
3. Save the onboarding workflow before leaving the step.
4. Open Email Templates with onboarding return context stored server-side, not solely in URL query parameters.
5. Preselect template type `user_activation` and provide the approved merge fields.
6. After the template is saved and activated, show **Return to User Onboarding**.
7. Return to the original workflow ID at Template Selection.
8. Automatically select the newly activated template when it is eligible.
9. Preserve imported users, validation results, recipient exclusions, and all previous progress.

If the Admin cancels template creation, they may return to the onboarding step without losing progress and select another template later.

### Resume Experience

- Users page shows **Onboarding in progress** items with batch name, current step, counts, owner, and last updated time.
- The most recent recoverable workflow may display a non-blocking **Continue onboarding** banner.
- Opening a workflow restores the last valid step and revalidates only data that may have become stale.
- The browser Back action and normal Admin navigation must not discard progress.
- Leaving a step with unsaved local edits prompts the Admin to Save Draft, Discard Local Changes, or Stay.
- Saved server state is the source of truth; browser storage is only an optional performance cache and must contain no secrets.
- A workflow may be resumed on another device by the same authorized Admin.
- Other Admins see ownership and must explicitly take over a workflow before editing it.

### Step Revalidation

Resuming does not blindly trust old decisions:

- Before import, recheck user uniqueness, active roles, hierarchy, and reporting managers.
- Before preview/send, recheck template status/version, recipient eligibility, email status, and activation state.
- If data changed, keep the Admin at the current step and show what changed and what must be reviewed.
- Never restart the workflow or silently remove recipients because of stale data.

### Workflow Controls

Every step provides consistent controls where applicable:

- **Save and Continue**
- **Save Draft**
- **Back**
- **Exit**
- **Resume Later**
- **Cancel Workflow** with confirmation

Completed irreversible steps, such as imported users or sent emails, are shown as completed history and are never repeated when navigating backward.

### Step 1: Upload

- Admin opens Users and selects Bulk Upload.
- Accept the approved XLSX/CSV template only.
- Validate extension, MIME type, file size, worksheet presence, headers, and row limits.
- Create an immutable import batch ID.

### Step 2: Validate

Validate every row for:

- Required name, email, role, and status.
- Email syntax and normalized uniqueness.
- Duplicate email within the uploaded file.
- Existing user in the database.
- Canonical active database role.
- Region and role compatibility.
- Reporting-manager existence and hierarchy.
- Reporting managers included in the same batch, resolved in hierarchy order.
- Known dealer code where applicable.
- Safe maximum field lengths and spreadsheet formula injection.

Row outcomes:

- `ready`: valid new user.
- `skipped_existing`: email already belongs to an existing user.
- `invalid`: one or more validation problems.
- `duplicate_in_file`: repeated email inside the batch.
- `dependency_error`: reporting-manager dependency cannot be resolved.

### Step 3: Review and Import

Show a review screen with:

- Total rows.
- Ready to create.
- Existing users skipped.
- Invalid rows.
- Duplicate rows.

Provide a structured results table or side drawer containing row number, name, email, outcome, field, supplied value, and reason. Support search, outcome filters, and Download Validation Report.

The Import Valid Users command:

- Requires explicit confirmation.
- Creates only `ready` users.
- Uses an idempotency key to prevent double submission.
- Rechecks uniqueness inside the database transaction.
- Sets new accounts to `pending_invitation`.
- Records created, skipped-race-condition, and failed outcomes separately.

Completion message example:

> 42 of 50 users were created. 5 existing users were skipped and 3 rows need correction.

### Step 4: Select Email Template

- Continue directly from import success to Send Invitations.
- List active templates of type `user_activation`.
- Default to the organization-approved activation template.
- Newly created users are the only eligible recipients.
- Existing, invalid, inactive, or already-activated users are excluded with a visible reason.

### Step 5: Preview

- Render the exact subject and HTML/text body for a representative recipient.
- Allow switching among recipients to verify dynamic content.
- Show the complete recipient table with name, email, role, region, and invitation status.
- Allow removing recipients from this campaign without deleting their accounts.
- Validate all merge fields before enabling Send.

Approved activation merge fields:

- `{{user_name}}`
- `{{login_email}}`
- `{{activation_link}}`
- `{{activation_expiry}}`
- `{{login_url}}`
- `{{role}}`
- `{{region}}`
- `{{reporting_manager}}`
- `{{support_email}}`

Credentials and passwords are not valid template fields.

### Step 6: Confirm and Send

- Show final recipient count and template version.
- Require confirmation before bulk send.
- Create one campaign and one recipient job per user.
- Generate the activation token as close to dispatch as possible so the expiry does not run during Admin review.
- Queue email jobs; do not block the UI while sending.
- Protect against duplicate sends with campaign and recipient idempotency keys.

### Step 7: Delivery and Activation Results

Display live or refreshable campaign results:

- Queued.
- Submitted to provider.
- Delivered, when provider webhooks support it.
- Failed.
- Bounced.
- Activation opened.
- Account activated.
- Expired.

Allow retry for eligible failed recipients and resend activation for expired invitations. A resend revokes the previous token.

## Admin Navigation

Add Admin-only navigation:

- **Users**: single creation, bulk onboarding wizard, import history.
- **Email Templates**: template management and preview.
- **Email Delivery**: campaigns, recipient delivery logs, failures, retries, and activation status.

Non-Admin roles must not see or access these routes or APIs.

## Email Template Management

Start with template type `user_activation`, while supporting future reminder and escalation types.

### Sample Template Library

Provide Admins with production-quality starter templates so they do not need to compose an email from an empty editor.

Initial samples:

- User Account Activation - Standard
- User Account Activation - Concise
- User Account Activation - Role Aware

Future samples may include Area Manager reminders, Regional Manager reminders, pending-workflow escalation, activation expiry, and invitation resend.

Sample-template experience:

1. Admin opens Email Templates or arrives from the onboarding Template Selection detour.
2. A starter gallery shows template name, purpose, type, supported roles, last reviewed date, and status.
3. Admin can Preview a sample using realistic mock merge data without sending an email.
4. Admin selects **Use This Template**.
5. The system creates an editable draft copy owned by the organization/Admin.
6. Admin may amend the name, subject, HTML body, plain-text body, applicable roles, and approved merge fields.
7. Live preview supports desktop and narrow/mobile email widths and switching between representative recipient roles.
8. Validation identifies missing required merge fields, unknown fields, unsafe links/content, empty subject/body, and rendering problems.
9. Admin saves the draft, optionally sends a test email, and activates the approved version.
10. When launched from onboarding, activation returns the Admin to the original workflow and selects the new template automatically.

System samples are immutable and versioned. Admin changes always create a separate organization draft, so the original sample remains available for future use. Updating a system sample never changes an existing Admin template or a previously sent campaign.

Sample preview data must be clearly marked as sample data and must never contain real user credentials, activation tokens, or personal information.

Capabilities:

- List, search, filter, create, edit, preview, duplicate, activate, deactivate, and archive.
- Draft and active states.
- Subject, HTML body, plain-text fallback, description, and applicable role set.
- Approved merge-field picker; no arbitrary executable content.
- Validation for unknown fields, missing required fields, unsafe links, empty subject/body, and excessive length.
- Version history. Campaigns retain the exact template version sent.
- Send Test Email through the same rendering pipeline.
- Audit actor and timestamps for create, edit, activate, archive, and send-test events.
- Starter-template gallery with Preview, Use This Template, and compare-with-current-version actions.
- Restore from the original sample by creating a new draft version; never destructively overwrite an active version.

Initial seeded template:

- Name: User Account Activation - Standard
- Type: `user_activation`
- Required fields: `user_name`, `activation_link`, `activation_expiry`, `support_email`
- Ownership: immutable system sample

## Data Model

MySQL entities:

- `roles`
- `users`
- `user_onboarding_workflows`
- `user_onboarding_checkpoints`
- `user_import_batches`
- `user_import_rows`
- `activation_tokens`
- `email_templates`
- `email_template_versions`
- `email_template_samples`
- `email_campaigns`
- `email_recipients`
- `email_delivery_events`
- `audit_logs`

Important constraints:

- Case-insensitive unique normalized user email.
- Foreign keys for role, reporting manager, batch, template version, campaign, and recipient.
- Unique token digest and unique campaign-recipient relationship.
- Indexed status and timestamp columns for Admin filtering.
- Optimistic concurrency/version column on resumable workflows to prevent two Admins overwriting each other.
- Unique idempotency keys for import and send checkpoints so resume/retry cannot duplicate users or emails.
- Retention policy for import source files, row data, tokens, and delivery payloads.

The current JSON prototype must preserve equivalent behavior until the MySQL repository is connected. Business rules belong in shared services, not in route handlers or UI components.

## Backend Architecture

- Import parser service.
- User validation service.
- Idempotent user import service.
- Invitation service.
- Template rendering and merge-field validation service.
- Email-provider adapter.
- Background job/queue adapter with retry and exponential backoff.
- Provider webhook handler with signature verification.
- Campaign and delivery-query service.
- Central authorization and audit service.

API validation is authoritative. Frontend validation improves usability but cannot grant permission or bypass backend rules.

## Quality Skills, Stable Validation IDs, and Agent Rules

Create three independent repository skills and reference all of them from the repository `AGENTS.md`:

- `.agents/skills/booking-dashboard-ux/SKILL.md`
- `.agents/skills/booking-dashboard-ui/SKILL.md`
- `.agents/skills/booking-dashboard-api/SKILL.md`

Each skill must contain stable validation IDs. IDs cannot be silently renamed or reused for a different requirement. Changes to a rule require a short changelog entry in the skill.

Every validation result uses one of:

- `PASS`: requirement was checked and satisfied.
- `FAIL`: requirement was checked and not satisfied.
- `N/A`: requirement is genuinely outside the change, with a written reason.
- `BLOCKED`: validation could not be completed, with the blocker and owner recorded.

Each result records: ID, status, severity, changed surface, validation method, evidence, reviewer/agent, and date.

### UX Skill: `booking-dashboard-ux`

The UX skill governs workflows, usability, accessibility, feedback, recovery, and user comprehension.

- `UX-001` Task clarity: page and dialog clearly state the user goal and current context.
- `UX-002` Action ownership: actionable items identify the responsible role/person; oversight roles are not presented as owners.
- `UX-003` Progressive disclosure: advanced or secondary information does not obstruct the primary task.
- `UX-004` Workflow continuity: multi-step work persists and resumes from the last valid checkpoint.
- `UX-005` Detour recovery: dependency creation, such as creating a template, returns to the originating workflow without data loss.
- `UX-006` Navigation safety: Back, Exit, Refresh, and normal navigation do not silently discard saved progress.
- `UX-007` Unsaved changes: local unsaved edits trigger a clear Stay, Save Draft, or Discard decision.
- `UX-008` Validation proximity: field errors appear beside the field and large/bulk forms include an error summary.
- `UX-009` Error recovery: failures explain what happened, what was preserved, and the next available action.
- `UX-010` Partial success: batch operations separately communicate created, skipped, invalid, and failed outcomes.
- `UX-011` System states: loading, empty, success, partial-success, warning, failure, retry, disabled, and completed states are designed.
- `UX-012` Confirmation: irreversible, destructive, resend, retry, takeover, import, and bulk-send actions require proportionate confirmation.
- `UX-013` Accessibility semantics: headings, landmarks, labels, descriptions, errors, and live status announcements are meaningful.
- `UX-014` Keyboard operation: all workflows are usable without a pointer, with logical focus order and no keyboard trap.
- `UX-015` Focus management: dialogs/drawers receive focus, trap it where appropriate, close with Escape, and return focus to the trigger.
- `UX-016` User control: Admin can review recipients, exclude users, cancel drafts, and retry eligible failures.
- `UX-017` Clear language: copy uses plain language and names consequence, owner, status, and next action.
- `UX-018` Data confidence: totals reconcile across summary, tables, exports, and logs.
- `UX-019` Privacy comprehension: the interface does not expose secrets and clearly distinguishes sample from real data.
- `UX-020` Responsive workflow: the complete task remains usable at desktop and supported mobile widths.
- `UX-021` Time and progress: long-running validation/import/send operations show progress without misleading completion.
- `UX-022` Idempotent experience: retry/resume cannot appear to create duplicate users or send duplicate invitations.
- `UX-023` Empty dependency state: missing templates or recipients provide an explanatory empty state and a direct recovery action.
- `UX-024` Role appropriateness: dashboards, fields, commands, and messages match the current role's permissions and responsibilities.
- `UX-025` Help at point of need: formats, merge fields, validation rules, and expiry behavior are explained where decisions occur.

### UI Skill: `booking-dashboard-ui`

The UI skill governs visual consistency, components, responsive layout, visual accessibility, and implementation polish.

- `UI-001` Design tokens: colors, spacing, typography, radii, shadows, and borders use shared tokens.
- `UI-002` Theme consistency: new screens match the established application shell and operational-tool visual language.
- `UI-003` Typography hierarchy: page, section, panel, table, and helper text sizes match their information level.
- `UI-004` Spacing rhythm: padding and gaps follow the shared spacing scale and remain consistent across equivalent components.
- `UI-005` Component reuse: common Button, Field, Modal, Drawer, Table, Pagination, Status, Toast, and EmptyState components are reused.
- `UI-006` Control choice: icons, toggles, selects, checkboxes, segmented controls, and buttons match the interaction type.
- `UI-007` Icon quality: familiar icons come from the approved icon library and unfamiliar icons include tooltips/labels.
- `UI-008` No nested decoration: page sections are not decorative cards inside cards; cards represent genuine bounded objects/tools.
- `UI-009` Stable layout: controls, tables, badges, and dynamic states do not cause unintended layout shifts.
- `UI-010` Responsive constraints: grids, tables, dialogs, drawers, and toolbars have explicit responsive behavior.
- `UI-011` No overlap or clipping: text and controls do not overlap, truncate critical content, or escape containers.
- `UI-012` Long content handling: emails, names, errors, template text, and reconciliation values wrap or truncate with accessible disclosure.
- `UI-013` Contrast: text, controls, borders, focus indicators, charts, and statuses meet WCAG AA contrast targets.
- `UI-014` Non-color status: icons/text accompany status colors.
- `UI-015` Focus visibility: interactive controls have a consistent, visible keyboard focus treatment.
- `UI-016` Input states: default, hover, focus, filled, disabled, readonly, invalid, and success states are visually distinct.
- `UI-017` Modal standards: width, scroll body, fixed header/footer where needed, close control, backdrop, and mobile behavior are consistent.
- `UI-018` Drawer standards: drawer width, hierarchy, overlay, close behavior, scroll containment, and responsive behavior are consistent.
- `UI-019` Table standards: readable headers, alignment, row density, sticky columns when necessary, horizontal overflow, filters, and pagination.
- `UI-020` Form standards: required markers, hints, labels, errors, grouping, and action alignment are consistent.
- `UI-021` Feedback components: snackbar/toast styling and timing are consistent for success, information, warning, and error.
- `UI-022` Motion: transitions are restrained, purposeful, and disabled/reduced under `prefers-reduced-motion`.
- `UI-023` Email preview fidelity: desktop/mobile previews have stable widths and clearly separate sample data from editable content.
- `UI-024` Chart integrity: scales, legends, labels, values, and colors are readable and numerically consistent.
- `UI-025` Visual regression evidence: changed screens are screenshot-checked at required desktop and mobile viewports.

### API Skill: `booking-dashboard-api`

The API skill governs contracts, security, validation, correctness, resilience, observability, and maintainability.

- `API-001` Authentication: protected endpoints derive identity from the authenticated session/token, never client-supplied role parameters.
- `API-002` Authorization: every endpoint enforces least-privilege role and resource ownership server-side.
- `API-003` Input schema: request body, query, path, file, and header inputs use explicit schemas and reject unknown/unsafe values appropriately.
- `API-004` Canonical roles: user roles are validated against active database roles and hierarchy rules.
- `API-005` Normalization: email, status, identifiers, and comparable text are normalized consistently before validation.
- `API-006` Error contract: errors use stable codes, field/row details, safe messages, correlation ID, and appropriate HTTP status.
- `API-007` Partial batch result: bulk APIs report per-row created, skipped, invalid, duplicate, dependency, and failed outcomes.
- `API-008` Idempotency: import, activation resend, campaign creation, and send operations cannot duplicate side effects on retry.
- `API-009` Transaction integrity: related writes commit atomically or expose a documented partial-result boundary.
- `API-010` Concurrency: uniqueness races and workflow version conflicts are handled explicitly.
- `API-011` Pagination/filtering: list endpoints have bounded pagination, validated sorting/filtering, and total metadata.
- `API-012` Rate limiting: login, activation validation, resend, test email, upload, and bulk send have appropriate limits.
- `API-013` Token security: activation tokens use secure randomness, digest-only storage, expiry, single use, and revocation.
- `API-014` Password security: passwords are securely hashed, never logged/returned, and validated by the approved policy.
- `API-015` Secret handling: provider credentials and secrets come from secure configuration and are redacted from output/logs.
- `API-016` File safety: uploads enforce type/size/row limits, safe parsing, formula-injection protection, and retention rules.
- `API-017` Template safety: merge fields use an allowlist and rendered HTML/text is sanitized and validated.
- `API-018` Email delivery resilience: sending is queued, retryable with backoff, deduplicated, and provider responses are recorded safely.
- `API-019` Webhook security: provider webhooks verify signatures, timestamps, replay protection, and event idempotency.
- `API-020` Auditability: security and business actions record actor, action, entity, result, time, and correlation ID without secrets.
- `API-021` Observability: structured logs, metrics, traces/correlation IDs, queue depth, failure rates, and latency are available.
- `API-022` Data privacy: responses, exports, logs, events, and retention follow least-data and masking principles.
- `API-023` Versioned templates: campaigns reference an immutable template version and cannot change after sending.
- `API-024` Resume correctness: workflow checkpoints are durable, versioned, revalidated, and safe across devices.
- `API-025` Documentation: OpenAPI/Swagger includes schemas, examples, errors, authorization, pagination, and idempotency behavior.
- `API-026` Testing: unit, integration, authorization, race, retry, expiry, malformed input, and failure-path tests cover changed behavior.
- `API-027` Performance bounds: imports, list queries, previews, and campaign operations have documented limits and avoid unbounded work.
- `API-028` Dependency isolation: database, queue, identity, and email provider integrations are behind testable adapters.
- `API-029` Backward compatibility: contract changes are additive or versioned and include migration/deprecation handling.
- `API-030` Health readiness: health/readiness endpoints distinguish process health from database, queue, and provider readiness.

### Agent Enforcement in `AGENTS.md`

The repository rule must require:

- Use UX and UI skills for every user-facing change.
- Use API skill for every endpoint, backend business rule, persistence, security, integration, or contract change.
- Use all three skills for end-to-end workflows such as onboarding and email delivery.
- Add relevant IDs to the implementation checklist before editing.
- Validate all applicable IDs before declaring completion.
- Treat unjustified `N/A`, missing evidence, or any unresolved Critical/High `FAIL` as incomplete work.
- Record deferred Medium/Low failures with owner and follow-up issue.

### Validation Report Format

Each phase creates or updates a report in `docs/quality-reports/<feature-or-phase>.md`:

| ID      | Status | Severity | Validation method            | Evidence                      | Notes/owner                             |
| ------- | ------ | -------- | ---------------------------- | ----------------------------- | --------------------------------------- |
| UX-004  | PASS   | High     | Resume browser test          | Test name and screenshot path | Workflow restored at template selection |
| UI-017  | PASS   | Medium   | Desktop/mobile visual review | Screenshot paths              | Modal scroll and focus verified         |
| API-008 | FAIL   | Critical | Integration test             | Failing test name             | Duplicate send on retry; must fix       |

Reports must also include:

- Feature/change summary.
- Applicable ID list and reason for applicability.
- Automated commands and results.
- Browser viewport sizes.
- Console/hydration findings.
- Known limitations.
- Overall gate: `PASS`, `FAIL`, or `BLOCKED`.

### Minimum Verification Commands and Evidence

1. Run the production frontend build.
2. Run relevant unit/integration/API tests.
3. Verify the changed workflow in the browser at desktop width.
4. Verify it at a supported mobile breakpoint.
5. Check browser console errors and hydration warnings.
6. Check keyboard navigation and focus behavior.
7. Capture or inspect screenshots for overflow, alignment, contrast, and state coverage.
8. Verify Swagger/OpenAPI for changed APIs.
9. Complete the ID-based quality report.
10. Record the result in this plan under Verification Notes.

## Implementation Phases

### Phase 1: Foundations

- [x] Add MySQL migrations and repository interfaces.
- [x] Add import batch and row outcome models (local JSON persistence for this prototype).
- [x] Add persistent onboarding workflow, checkpoint, ownership, and version models (local JSON persistence).
- [x] Add template, template-version, campaign, recipient, token, event, session, and audit models (local JSON persistence).
- [x] Add separate repository UX, UI, and API skills with stable validation IDs and rule changelogs.
- [x] Add `AGENTS.md` skill-selection and completion-gate enforcement.
- [x] Add quality-report template and `docs/quality-reports` location.

### Phase 2: Validation and Partial Import

- [x] Split parse, validate, review, and commit operations.
- [x] Implement existing-user skip behavior.
- [x] Implement within-file duplicate and hierarchy dependency handling.
- [x] Implement idempotent partial import boundary.
- [ ] Implement downloadable validation report.
- [x] Add upload wizard review UI and detailed outcome table.
- [x] Persist validation progress and restore the last valid upload/review step.

### Phase 3: Activation and Password Setup

- [x] Implement secure invitation token lifecycle.
- [x] Implement activation validation endpoint.
- [x] Build Set Password and invalid/expired-link recovery screens.
- [x] Implement password policy, hashing, token consumption, and account activation.
- [ ] Implement resend activation and rate limiting.

### Phase 4: Email Templates

- [x] Add Admin Email Templates navigation and authorization.
- [x] Build template list, editor, merge-field reference, live preview, versioning, and lifecycle states.
- [x] Seed the User Account Activation template.
- [x] Add immutable sample-template library and starter gallery.
- [ ] Add sample preview with realistic safe merge data and desktop/mobile email widths.
- [x] Add Use This Template cloning into an editable organization draft.
- [ ] Add draft editing, validation, test-send, activation, and original-sample comparison.
- [x] Implement allowlisted, escaped HTML and plain-text rendering.
- [x] Implement Create Template detour and return-to-onboarding behavior without losing batch progress.

### Phase 5: Campaign Preview and Sending

- [x] Connect successful imports to template selection.
- [x] Build rendered preview and recipient review.
- [x] Implement campaign confirmation and local-provider submission.
- [ ] Add email-provider adapter and local mock provider.
- [ ] Implement retry, idempotency, rate limiting, and provider webhooks.
- [x] Persist template choice, recipient exclusions, and campaign checkpoint for cross-session resume.

### Phase 5A: Resume and Recovery UX

- [x] Add Onboarding in Progress list and Continue actions.
- [x] Restore workflow state by workflow ID from the backend.
- [ ] Add Save Draft, Exit, Back, Resume Later, and Cancel controls.
- [x] Add bulk-send confirmation and focus-safe main onboarding dialog.
- [ ] Add stale-data revalidation and changed-data review messages.
- [ ] Add workflow ownership, explicit Admin takeover, and optimistic-concurrency conflict UX.
- [x] Verify persisted workflow retrieval, navigation detour, recoverable validation, and idempotent retry in automated tests.

### Phase 6: Delivery Logs

- [x] Add Email Delivery navigation.
- [x] Build campaign summary, recipient table, and status details.
- [ ] Add retry failed and resend expired actions.
- [x] Show delivery outcomes without exposing secrets.

### Phase 7: Testing and Release Verification

- [x] Unit tests for normalization, validation, hierarchy, rendering, tokens, and password policy.
- [x] Integration tests for partial imports, duplicate handling, and idempotency.
- [ ] Authorization tests for every Admin-only endpoint and route.
- [ ] Email job, retry, webhook, resend, expiry, and idempotency tests.
- [ ] Activation success, expired, consumed, invalid, and rate-limited tests.
- [ ] Accessibility and keyboard workflow checks.
- [ ] Complete applicable UX, UI, and API ID validations with evidence.
- [ ] Desktop and mobile visual verification using the UX and UI skills.
- [ ] API contract, authorization, security, resilience, and Swagger verification using the API skill.
- [ ] Publish final quality report with no unresolved Critical/High failures.
- [x] Production frontend build and backend tests pass.
- [ ] Final requirement-to-evidence matrix completed.

## Acceptance Criteria

- An upload containing valid, existing, duplicate, and invalid users completes without losing valid rows.
- Existing users are skipped and never overwritten by bulk onboarding.
- Admin sees exact totals and a reason for every row not created.
- Only newly created users proceed to invitation.
- Admin can select, preview, confirm, and send an active activation template.
- Admin can preview a supplied sample, clone it, amend it, validate it, and activate it without modifying the original sample.
- Sample previews never expose real recipient data, activation links, credentials, or tokens.
- If no activation template exists, Admin can create and activate one, then return to the same onboarding workflow and continue from Template Selection.
- Refreshing, closing the browser, navigating elsewhere, or signing in on another device does not lose a saved workflow.
- Previously imported users and sent emails are never duplicated when a workflow is resumed or moved backward.
- Resume revalidates stale roles, users, templates, recipients, and hierarchy and explains any changes.
- Concurrent Admin edits cannot silently overwrite workflow progress.
- Every recipient has a traceable delivery and activation status.
- Activation links are expiring, single-use, securely stored, and safely renewable.
- A user cannot access the application until password setup and activation are complete.
- All onboarding, template, campaign, retry, resend, and activation actions are audited.
- Non-Admin users cannot access onboarding or email-management functionality.
- UI behavior satisfies the repository UX skill at desktop and mobile breakpoints.

## Verification Notes

Update this section after each completed phase with:

- Date and phase.
- Files/components changed.
- Automated test commands and results.
- Browser workflows verified.
- Desktop/mobile viewport results.
- Accessibility observations.
- Known limitations or deferred work.

No implementation phase is complete until its verification evidence is recorded here.

### 2026-07-29 - Local Prototype Completion

- Implemented resumable onboarding, partial import, existing-user skip, template detour/return, recipient confirmation, local invitation delivery, HttpOnly sessions, and activation/password setup.
- Added UX/UI/API repository skills and the ID-based report at `docs/quality-reports/user-onboarding-email-activation.md`.
- Backend: 29 tests passed. Frontend: Next.js production build passed. OpenAPI JSON and Swagger UI verified.
- Browser: activation recovery verified without console/hydration errors at desktop and 390x844; no mobile horizontal overflow.
- Production gate remains blocked on MySQL transactions, durable email queue/provider, retries/webhooks, rate limiting, and operational telemetry. These unchecked items remain intentionally open.

### 2026-08-01 - Dashboard Hover State Correction

- Replaced bright generic button hover leakage with shared neutral interaction tokens for metric cards, profile controls, menu items, and the notification icon.
- Corrected selector specificity so shared component hover and focus-visible rules override the generic button rule consistently.
- Frontend production build passed; live dashboard stylesheet and desktop rendering were verified in the browser.
- Validation evidence: `docs/quality-reports/dashboard-hover-states.md`.

### 2026-08-01 - Email Delivery Layout Correction

- Restored standard page gutters and panel padding on the Email Delivery view.
- Prevented expanded recipient tables from increasing the CSS Grid minimum width and causing page-level horizontal scrolling.
- Kept overflow inside the reusable table wrapper so all delivery columns remain accessible at narrow widths.
- Frontend production build passed; collapsed and expanded delivery states were browser-verified at 910x658 with no document overflow.
- Validation evidence: `docs/quality-reports/email-delivery-layout.md`.

### 2026-08-01 - Reconciliation Heatmap Guidance

- Added plain-language guidance explaining model rows, status columns, booking counts, and color intensity.
- Added an accessible heatmap description so meaning is not dependent on visual color alone.
- Added placement support to the shared information tooltip and positioned the heatmap tooltip below its trigger within narrow card boundaries.
- Frontend production build passed; the open tooltip was browser-verified at a 304px viewport without clipping.
- Validation evidence: `docs/quality-reports/reconciliation-heatmap-help.md`.

### 2026-08-01 - Global Close-Control System

- Added a reusable `CloseButton` component with one accessible SVG icon and shared behavior.
- Migrated notification drawer, notification toast, password modal, and profile-photo modal close controls to the shared component.
- Centralized default, hover, focus, and active colors in global `--interactive-*` tokens.
- Audited drawer, modal, toast, and confirmation close families and removed their per-control hard-coded hover colors.
- Frontend production build passed; notification drawer rendering and loaded interaction rules were browser-verified.
- Validation evidence: `docs/quality-reports/global-close-controls.md`.

### 2026-08-01 - Heatmap Cell Tooltips

- Added a native hover tooltip to every reconciliation heatmap cell with model, status, booking count, and relative color intensity.
- Added keyboard focus, accessible labels, and grid/row/header/cell semantics.
- Added a shared-token hover/focus highlight and help cursor without changing chart data.
- Frontend production build passed; all 12 rendered cells and their labels were browser-verified.
- Validation evidence: `docs/quality-reports/heatmap-cell-tooltips.md`.

### 2026-08-01 - Backend Security, Privacy, and Reliability Hardening

- Replaced client-supplied booking identity with authenticated session identity and added HTTP spoofing regression tests.
- Disabled default credentials in production, removed change-password fallback, added Secure production cookies, request bounds, throttling, safe errors, and correlation IDs.
- Added AES-256-GCM production persistence, tamper/plaintext rejection, serialized recoverable writes, fail-closed database loading, retention policies, and audit PII minimization.
- Backend: syntax check passed; 48/48 tests passed.
- Evidence: `docs/quality-reports/backend-security-privacy-reliability.md`.
- Production gate remains blocked on transactional SQL persistence, managed key/secret infrastructure, distributed rate limiting, readiness/telemetry, backup/restore, load/failover, and recovery-drill evidence.

### 2026-08-01 - MySQL, Redis, and Production Operations Phase

- Added MySQL/file persistence adapters, InnoDB migration, explicit state migration, optimistic concurrency, and production MySQL default.
- Added Redis/memory abuse-control adapters with atomic Redis Lua limits and production Redis requirement.
- Separated liveness/readiness, added graceful shutdown, OpenAPI readiness documentation, production config, CI services, operations runbook, and privacy lifecycle.
- Backend complete suite passed 54/54 with real isolated MySQL and Redis; production-mode readiness reported both dependencies healthy.
- Frontend production build passed. Fresh frontend Vitest execution did not provide a final summary and is not claimed.
- Evidence: `docs/quality-reports/backend-production-readiness-2026-08-01.md`.
- Production 10/10 remains blocked on durable email outbox/workers, universal server pagination, deployed backup/restore/failover/monitoring/key-rotation drills, hosted CI enforcement, and owner approvals.

### 2026-08-02 - Portable Docker Product

- Added frontend/backend images, MySQL/Redis Compose, clean database initialization, ignored generated secrets, and health-gated startup.
- Verified login, session restoration, and authenticated bootstrap through the frontend proxy.
- Added GitHub Container Registry publishing and replaced obsolete default-password documentation.
- Verification: frontend lint/build and 162/162 tests passed; backend 60 passed with 2 infrastructure skips; all services healthy.
- Evidence: docs/quality-reports/portable-docker-product-2026-08-02.md.
- Remaining gates: VPS TLS, backup/restore drill, browser screenshot evidence, and current Next transitive advisory updates.

### 2026-08-02 - Onboarding Recovery and Template Editor

- Fixed invitation readiness errors so the API returns a stable, actionable provider error instead of throwing a secondary generic 500; users and workflow progress remain saved.
- Explicitly cancelling onboarding now removes only unsent `pending_invitation` users created by that workflow from Current Users, while retaining the cancelled workflow and audit history; the same email can then start a fresh journey.
- Moved the activation-template quick editor to the shared right-side drawer with fixed header/footer and added a Tiptap visual HTML editor with Lucide formatting controls.
- Verification: backend onboarding 13/13; frontend focused 31/31 and full 165/165; frontend production build and changed-file lint passed; isolated backend process security 2/2; rebuilt Compose services healthy.
- Cancellation follow-up verification: backend full suite 62 passed with 2 infrastructure skips; frontend cancellation suites 28/28 passed.
- Evidence: `docs/quality-reports/onboarding-recovery-and-template-editor-2026-08-02.md`.
- Gate remains BLOCKED only on required desktop/mobile browser screenshots and keyboard/console checks because the in-app browser runtime failed twice with a Windows ACL sandbox error; dependency advisory attribution is also pending an authorized registry audit.

### 2026-08-02 - Clean Production Access Management

- Removed the legacy startup migration that re-added seeded Area/Regional Manager and hierarchy demo accounts in production.
- Added exact seed ID plus normalized email reconciliation, preserving configured Admin and real/custom users.
- Verification: validators 17/17; backend full suite 63 passed with 2 infrastructure skips; Docker services healthy; aggregate database check reports 2 users, 0 legacy demo users, and 2 Admins.
- Evidence: `docs/quality-reports/onboarding-recovery-and-template-editor-2026-08-02.md`.

### 2026-08-02 - Admin Visibility in Access Management

- Removed the frontend-only rule that hid Admin accounts from Current Users and filter option lists.
- Verification: focused frontend tests 5/5; production build passed; rebuilt Docker backend/frontend are healthy.
- Browser screenshot verification remains blocked by the existing Windows ACL browser-runtime issue.
- Evidence: `docs/quality-reports/onboarding-recovery-and-template-editor-2026-08-02.md`.

### 2026-08-02 - Admin Activation with Temporary Password

- Added an explicit pending-account recovery action that atomically activates the user, sets a hash-only temporary password, requires password change, revokes activation/reset links and sessions, and records a dedicated audit event.
- The drawer updates the table to Active and confirms activation without exposing the password again.
- Verification: password tests 6/6; drawer tests 8/8; frontend production build passed; backend process security 2/2 in isolation; rebuilt Docker services healthy.
- Live browser screenshot verification remains blocked by the existing Windows ACL browser-runtime issue.
- Evidence: `docs/quality-reports/onboarding-recovery-and-template-editor-2026-08-02.md`.

### 2026-08-02 - Access Master Data Drawer

- Moved Add Single User to the shared side drawer with fixed header/footer and preserved form state.
- Added Admin-only Region and Dealer Code creation detours with normalization, duplicate validation, persistence, auditing, automatic return, and automatic selection.
- Added persistent Region/Dealer Code bootstrap catalogs and onboarding validation support.
- Verification: backend 67 passed with 2 infrastructure skips; frontend 167/167; production build and OpenAPI parse passed; Docker services healthy.
- Browser evidence remains blocked by the existing Windows ACL browser-runtime issue.
- Evidence: `docs/quality-reports/access-master-data-drawer-2026-08-02.md`.

### 2026-08-02 - Reference Data Tabs and Brand Hierarchy

- Renamed the page and navigation to Reference Data and introduced grouped Access Data and Booking Workflow tabs.
- Enhanced the shared Tabs component with roving focus and Arrow/Home/End keyboard navigation.
- Added selected parent-group and child-tab states, corrected global hover-rule interference, and preserved narrow-screen horizontal navigation.
- Added Region and Dealer Code catalogs, protected create/update APIs, OpenAPI contracts, and active-master validation for single and bulk onboarding.
- Verification: Reference Data backend 21/21; tabs/components 11/11; frontend production build passed; rebuilt Docker backend/frontend healthy.
- Browser screenshot and live responsive evidence remain BLOCKED by the Windows ACL browser-runtime failure.
- Evidence: `docs/quality-reports/reference-data-tabs-2026-08-02.md`.

- Connected the Reference Data tab header directly to its content panel, strengthened the selected parent group, and merged the active child tab into the page surface. Focused tests 11/11; rebuilt frontend healthy.

### 2026-08-02 - Email Management Workspace

- Consolidated Message Templates, Delivery Logs, and Email Configuration into one Email Management sidebar destination with shared child tabs.
- Preserved all existing routes while keeping the parent sidebar item selected for every email subsection.
- Renamed Access Management to User Management and ordered Business Settings directly below it.
- Verification: focused frontend tests 18/18; production build passed.
- Live browser evidence remains blocked by the Windows ACL browser-runtime failure.
- Evidence: `docs/quality-reports/email-management-navigation-2026-08-02.md`.

- Reordered Email Management to configuration, templates, then delivery; made configuration the default; removed tab/body spacing and vertical tab-header overflow in Email Management and Business Settings. Focused tests 25/25 passed.

### 2026-08-02 - Shared Grouped Admin Tabs

- Added a reusable GroupedTabs component with parent categories, contextual child tabs, vertical parent separators, and shared keyboard behavior.
- Migrated Business Settings and Email Management to the component.
- Connected both tab headers directly to their content surfaces and suppressed vertical tab overflow.
- Verification: focused frontend tests 25/25; production build passed.
- Live desktop/mobile evidence remains blocked by the Windows ACL browser-runtime failure.
- Evidence: `docs/quality-reports/grouped-admin-tabs-2026-08-02.md`.

### 2026-08-02 - Full-Canvas Tabbed Workspaces

- Added TabbedWorkspace to own parent tabs, child tabs, and the complete selected page canvas.
- Migrated Business Settings and Email Management from separate navigation/body containers.
- Flattened direct email section cards into divider-based sections while preserving framed tables and metrics.
- Verification: focused frontend tests 25/25; production build passed.
- Live browser evidence remains blocked by the Windows ACL browser-runtime failure.
- Evidence: `docs/quality-reports/grouped-admin-tabs-2026-08-02.md`.

### 2026-08-02 - Unified Tab Shells and Email Drawers

- Extended GroupedTabs for one-level workspaces and migrated Booking Management into TabbedWorkspace.
- Ensured Booking Management, Business Settings, and Email Management keep the complete selected page inside the tab shell.
- Flattened direct email subsection cards into one continuous canvas and strengthened selected parent tabs with a branded top edge.
- Moved organization-template editing, starter preview, and live preview to shared right-side drawers.
- Reused the existing TipTap visual editor while preserving the bodyHtml and plain-text fallback contracts.
- Verification: focused frontend tests 36/36; production build passed.
- Live desktop/mobile evidence remains BLOCKED by the Windows ACL browser-runtime failure.
- Evidence: docs/quality-reports/tabbed-workspaces-email-drawers-2026-08-02.md.

### 2026-08-02 - Bulk Onboarding Drawer Follow-up

- Corrected starter-preview Subject label/value spacing.
- Migrated Bulk User Onboarding to the shared right-side drawer with fixed header/progress and a scrollable step body.
- Preserved nested template editing, confirmation layering, upload validation, resumable progress, and cancellation behavior.
- Verification: focused onboarding and preview tests 26/26; production build passed.
- Live browser evidence remains BLOCKED by the Windows ACL browser-runtime failure.
- Evidence: docs/quality-reports/tabbed-workspaces-email-drawers-2026-08-02.md.

### 2026-08-02 - Built-in Roles and Catalog-backed User Filters

- Added read-only Roles as the first Business Settings Access Data tab.
- Reused normalized built-in role definitions in User Management filters and user forms.
- Populated status filters from supported lifecycle states and region filters from active master data.
- Added a reusable illustrated no-data table state.
- Verification: frontend focused tests 41/41; backend role/master-data tests 21/21; frontend production build passed.
- Live browser evidence remains BLOCKED by the Windows ACL browser-runtime failure.
- Evidence: docs/quality-reports/built-in-role-catalog-filters-2026-08-02.md.

### 2026-08-02 - Dealer Code and User Region Linking

- Linked Dealer Code selection to its authoritative Region in single-user onboarding and protected the linked Region from incompatible edits.
- Added an empty-state Add Region detour that returns to Dealer Code creation without losing user-form state.
- Enforced Dealer Code/Region consistency for single-user and bulk-upload validation with field-specific errors.
- Verification: focused frontend 11/11; focused backend 21/21; full frontend 172/172; production build passed; server security rerun 2/2 after full-suite startup contention.
- Live browser evidence remains BLOCKED by the Windows ACL browser-runtime failure.
- Evidence: `docs/quality-reports/dealer-user-region-linking-2026-08-02.md`.

### 2026-08-02 - Sticky Workspace Tabs and User Management Shell

- Made shared TabbedWorkspace navigation sticky beneath the persistent page topbar for Booking Management, Business Settings, Email Management, and User Management.
- Migrated User Management to connected Current Users and Add Users tabs, with Current Users as the default operational view and onboarding recovery in Add Users.
- Anchored the booking no-data state to the visible table viewport so it remains centered during horizontal scrolling.
- Verification: cross-workspace tests 21/21; full frontend 172/172; production build passed.
- Live desktop/mobile evidence remains BLOCKED by the Windows ACL browser-runtime failure.
- Evidence: `docs/quality-reports/sticky-workspace-tabs-user-management-2026-08-02.md`.

## Production Readiness Verification Notes - 2026-08-02

- Foundation implementation completed: secure production-cookie default, frontend CI, module extractions, shared-control compliance, stylesheet ownership, and route-level lazy loading.
- `frontend npm run quality`: PASS; 172 tests, production build, bundle budgets, and 10k scale budgets passed.
- `backend npm test`: 68 passed, 2 infrastructure tests skipped, 0 failed.
- Docker Compose configuration and `git diff --check` passed.
- Overall production gate remains BLOCKED: browser evidence, MySQL/Redis integration execution, relational persistence, observability, recovery, resilience, and hosted acceptance are incomplete.
- Evidence: `docs/quality-reports/production-readiness-foundation-2026-08-02.md`.
- Re-audit evidence: `docs/quality-reports/production-readiness-reaudit-2026-08-02.md`; production score `6.6/10`, release verdict `NO-GO`.

### 2026-08-03 - Production Readiness Phase 0 and Phase 1 Persistence Foundation

- Refreshed Phase 0 baseline evidence with current frontend quality results, backend host results, Docker Compose validation, and Docker-backed MySQL/Redis integration evidence.
- Added reversible versioned baseline migration files and migration tests for ordered/reversible repository migrations.
- Added Docker-backed infrastructure coverage for normalized schema application, key foreign-key inspection, latest migration rollback, and reapply.
- Verification: frontend `npm run quality` passed; backend host suite 71 passed with 3 infrastructure skips; Docker infrastructure suite 3/3 passed; Compose config and `git diff --check` passed.
- Superseded by the 2026-08-03 normalized runtime cutover note below: the single-row runtime blocker is resolved; query-level repositories, row-scoped concurrency, populated rollback restoration, and approved production-scale evidence remain incomplete.
- Evidence: `docs/quality-reports/production-readiness-phase-0-baseline.md` and `docs/quality-reports/production-readiness-phase-1-persistence.md`.

### 2026-08-03 - Production Readiness Phase 2 Runtime Configuration Security

- Added backend runtime configuration validation for production application origin, cookie security mode, demo credential flag, MySQL/Redis URL protocols, and Google OAuth redirect origin.
- Added focused config tests and a process-level fail-closed startup regression for unsafe public HTTP production origin.
- Verification: focused backend config/security 8/8; backend full suite 77 passed with 3 host infrastructure skips; previous Docker infrastructure suite 3/3 covers those skips.
- Phase 2 remains BLOCKED on complete endpoint authorization matrix, CSRF strategy, dependency/container/static scans, managed secrets/rotation, webhook signature controls, and observability redaction/alert evidence.
- Evidence: `docs/quality-reports/production-readiness-phase-2-security.md`.

### 2026-08-03 - Production Readiness Phase 3 Booking API Pagination

- Added bounded pagination validation and metadata for `GET /api/bookings` while preserving existing `rows` and `total` response fields.
- Added authenticated process-test coverage for scoped booking pagination and excessive page-size rejection.
- Verification: focused server-security 3/3; backend full suite 77 passed with 3 host infrastructure skips.
- Phase 3 remains BLOCKED on universal pagination, OpenAPI pagination schemas, backend route/service modularity, email retry/restart recovery, and dependency-failure tests.
- Evidence: `docs/quality-reports/production-readiness-phase-3-api-reliability.md`.

### 2026-08-03 - Production Readiness Phase 4 Focused Frontend Evidence

- Updated Playwright fixtures for current User Management navigation copy, mocked notification endpoints, and made responsive viewport checks align with the current shell.
- Verification: role/accessibility Playwright 4/4; responsive/axe Playwright 2/2 with viewport screenshots; frontend `npm run quality` passed with 172/172 tests, production build, bundle budgets, and 10k scale budgets.
- In-app browser evidence remains BLOCKED because the browser-control Node runtime failed twice with the Windows ACL sandbox error.
- Phase 4 remains BLOCKED on full critical workflow browser evidence, manual/focus walkthroughs, and live onboarding/email/drawer mobile checks.
- Evidence: `docs/quality-reports/production-readiness-phase-4-frontend.md`.

### 2026-08-03 - Production Readiness Phase 5 CI Workflow Expansion

- Added a production-quality GitHub Actions workflow covering backend tests with MySQL/Redis services, OpenAPI JSON parse, frontend quality, focused Playwright browser evidence, npm audits, and Docker Compose config validation.
- Verification: local equivalent Compose config command passed; local backend, frontend quality, Docker infrastructure, and focused Playwright evidence remained passing from prior phase runs.
- Phase 5 remains BLOCKED on hosted CI run evidence, required branch checks, image signing/SBOM/container scanning, staging promotion, rollback, release notes, and k6 smoke jobs.
- Evidence: `docs/quality-reports/production-readiness-phase-5-cicd.md`.

### 2026-08-03 - Production Readiness Local Acceptance NO-GO

- Added blocked reports for observability, performance/resilience, and recovery/deployment to avoid hiding unimplemented operational gates.
- Added final local acceptance report with decision `NO-GO` and estimated readiness `7.1/10`.
- Verified evidence carried forward: backend full suite 77 passed with 3 host infrastructure skips; Docker infrastructure 3/3; frontend quality 172/172 plus build/bundle/scale; focused Playwright role/accessibility 4/4 and responsive/axe 2/2; Compose config passed.
- Remaining release blockers include normalized runtime persistence, complete authorization/CSRF/scanning, in-app/manual browser evidence, observability, recovery, load/resilience, hosted CI/supply chain, and email worker/webhook hardening.
- Evidence: `docs/quality-reports/production-readiness-local-acceptance.md`.

### 2026-08-03 - Production Readiness Phase 6 Request Metrics and Redacted Logs

- Added sanitized route labels, structured request-completion logs, in-process route/status/latency metrics, and an Admin-only `/api/metrics` endpoint.
- Documented `/api/metrics` in OpenAPI and repaired invalid trailing literal `\\n` so `backend/openapi.json` parses.
- Verification: focused backend process tests 4/4; backend full suite 78 passed with 3 host infrastructure skips; OpenAPI parse and metrics contract presence passed.
- Phase 6 remains BLOCKED on external telemetry storage, dashboards, alert thresholds, SLOs, staged failure tracing, comprehensive redaction tests, and complete audit coverage.
- Evidence: `docs/quality-reports/production-readiness-phase-6-observability.md`.

### 2026-08-03 - Production Readiness Phase 8 Encrypted Backup Restore Foundation

- Added encrypted MySQL logical backup, backup integrity-check, confirmed restore, and guarded cleanup commands with safe summary output that excludes row contents.
- Added recovery unit coverage for encrypted round-trip, tamper detection, restore behavior, row-content redaction, and retention cleanup planning.
- Verification: focused recovery tests 5/5; backend full suite 83 passed with 3 host infrastructure skips; isolated Docker `booking_dashboard_test` backup/check/restore drill passed across 23 tables and 3 rows; cleanup CLI dry-run smoke passed; generated encrypted and temporary artifacts were removed.
- Phase 8 remains BLOCKED on scheduled retention automation, timed RPO/RTO restore, post-restore smoke, failed deployment/migration/image rollback, key recovery, incident drills, and second-operator runbook validation.
- Evidence: `docs/quality-reports/production-readiness-phase-8-recovery.md`.

### 2026-08-03 - Production Readiness Phase 7 Local API Load Smoke

- Added dependency-free local API load-smoke tooling, metric/threshold unit coverage, a checked-in k6 scenario, and a production-quality workflow load-smoke step.
- Verification: focused load-smoke tests 3/3; `npm run load:smoke:local` against a temporary backend passed with 583 requests, 0 failures, p95 29.5 ms / 750 ms, p99 51.6 ms; backend full suite 86 passed with 3 host infrastructure skips.
- k6 execution remains BLOCKED locally because the `k6` binary is not installed in this Windows environment; the scenario is present at `backend/load/booking-dashboard.k6.js` for CI/operator environments that provide k6.
- Phase 7 remains BLOCKED on repeated k6 threshold reports, write/upload/export/onboarding/campaign load, CPU/memory/queue/database contention metrics, dependency-loss drills, retry-storm drills, and universal pagination.
- Evidence: `docs/quality-reports/production-readiness-phase-7-performance.md` and `docs/quality-reports/production-readiness-phase-7-load-smoke-summary.json`.

### 2026-08-03 - Production Readiness Phase 3 OpenAPI Pagination Contract

- Documented the runtime `/api/bookings` pagination contract in OpenAPI, including `page`, `pageSize`, `limit`, `BookingListResponse`, `BookingPagination`, and `422` invalid page-size response example.
- Added focused OpenAPI contract coverage so the booking pagination documentation cannot silently drift from runtime behavior.
- Verification: focused OpenAPI/server-security 5/5; OpenAPI JSON parse passed; backend full suite 87 passed with 3 host infrastructure skips.
- Phase 3 remains BLOCKED on universal pagination beyond bookings, route/service modularity, email retry/restart recovery, and dependency-failure/graceful-shutdown tests.
- Evidence: `docs/quality-reports/production-readiness-phase-3-api-reliability.md`.

### 2026-08-03 - Production Readiness Phase 2 CSRF Origin Guard

- Added central server-side CSRF protection for cookie-authenticated unsafe methods using Fetch Metadata and Origin validation against configured/request origins.
- Verification: focused server-security 4/4; backend full suite 87 passed with 3 host infrastructure skips.
- Phase 2 remains BLOCKED on complete endpoint authorization matrix, dependency/container/static/secret scans as blocking gates, managed secrets/rotation/TLS/trusted proxy evidence, webhook signature/replay/idempotency controls, and hosted observability/security evidence.
- Evidence: `docs/quality-reports/production-readiness-phase-2-security.md`.

### 2026-08-03 - Production Readiness Security Scan Gate

- Added a root production security scan for high-confidence source secrets, sensitive static patterns, and prohibited dependency sources.
- Wired `npm run test:security-scan` and `npm run security:scan` into a blocking `security` job in `.github/workflows/production-quality.yml`.
- Verification: scanner tests 4/4; production security scan passed across 245 files.
- Phase 2/5 remain BLOCKED because frontend npm audit reports 4 High and 2 Moderate advisories, backend npm audit requires explicit approval to send dependency metadata externally, and container scanning/SBOM/signing/hosted CI evidence remain incomplete.
- Evidence: `docs/quality-reports/production-readiness-phase-2-security.md` and `docs/quality-reports/production-readiness-phase-5-cicd.md`.

### 2026-08-03 - Production Readiness Phase 2 Authorization Matrix

- Added representative process-test coverage for unauthenticated, Area Manager, Regional Manager, All India, and Admin access across admin-only reads/writes, metrics, bootstrap data minimization, and role-scoped booking update routes.
- Verification: focused server-security 5/5; backend full suite 88 passed with 3 host infrastructure skips.
- Phase 2 remains BLOCKED on an exhaustive endpoint permission matrix, advisory/container security remediation, managed secrets/rotation/TLS/trusted proxy evidence, webhook signature/replay/idempotency controls, and hosted observability/security evidence.
- Evidence: `docs/quality-reports/production-readiness-phase-2-security.md`.

### 2026-08-03 - Production Readiness API Error Correlation Envelope

- Added central JSON error enrichment so API error responses include a stable `code` and the request `correlationId` when route handlers do not already provide them.
- Documented standard `ErrorResponse.code` and `ErrorResponse.correlationId` fields in OpenAPI with contract coverage.
- Verification: focused OpenAPI/server-security 7/7; backend full suite 89 passed with 3 host infrastructure skips.
- Phase 3/6 remain BLOCKED on universal pagination, route/service modularity, complete route-by-route error catalogue, external telemetry, staged failure trace, dashboards, alerts, and complete audit/redaction coverage.
- Evidence: `docs/quality-reports/production-readiness-phase-3-api-reliability.md` and `docs/quality-reports/production-readiness-phase-6-observability.md`.

### 2026-08-03 - Production Readiness Phase 8 Executable Recovery Runbooks and Cleanup

- Added `docs/operations/production-recovery-runbook.md` with concrete backup, integrity-check, restore, cleanup, timed RPO/RTO drill, post-restore smoke, failed deployment, failed migration, image rollback, key recovery, incident triage, and second-operator checklist commands.
- Added `scripts/validate-production-runbooks.mjs`, root `runbooks:check` and `test:runbooks` scripts, and `test/production-runbooks.test.mjs`; wired the checks into `.github/workflows/production-quality.yml` and made docs changes trigger the workflow.
- Removed obsolete/dead artifacts after reference checks: `backend/migrations/001-application-state.sql`, `docs/quality-reports/production-readiness-plan-2026-08-02.md`, and `docs/quality-reports/production-readiness-plan-coverage-2026-08-03.md`.
- Verification: `npm run test:runbooks` passed 2/2; `npm run runbooks:check` passed with 13 headings, 16 required snippets, and 5 backend recovery scripts checked; focused recovery tests passed 5/5; cleanup reference audit passed before evidence updates; `git diff --check` passed with line-ending warnings only.
- Phase 8 remains BLOCKED because timed RPO/RTO restore, post-restore app smoke, scheduled retention, rollback/key-recovery/incident drills, and second-operator execution are not proven.
- Evidence: `docs/quality-reports/production-readiness-phase-8-recovery.md`, `docs/quality-reports/production-readiness-phase-5-cicd.md`, and `docs/quality-reports/production-readiness-local-acceptance.md`.

### 2026-08-03 - Production Readiness Phase 8 Timed Recovery Drill Orchestration

- Added guarded timed recovery drill orchestration in `backend/src/recovery-drill.js` and `backend/scripts/recovery-drill.js` with `CONFIRM_RECOVERY_DRILL=yes` fail-closed behavior.
- Added backend `recovery:drill` script that composes backup, integrity check, confirmed restore, optional post-restore smoke, safe RPO/RTO measurements, restored table/row counts, and per-step timings without printing secrets or row contents.
- Tightened `docs/operations/production-recovery-runbook.md` and `scripts/validate-production-runbooks.mjs` so the runbook validator now requires the timed drill command and six backend recovery scripts.
- Verification: focused recovery suites passed 8/8; runbook tests passed 2/2; `npm run runbooks:check` passed with 13 headings, 18 snippets, and 6 scripts checked; unconfirmed `npm --prefix backend run recovery:drill` failed closed as expected; backend full suite passed with 92 tests, 3 known infrastructure skips, 0 failed; `git diff --check` passed with line-ending warnings only.
- Phase 8 remains BLOCKED because the new drill wrapper has not been executed against a real isolated Docker/MySQL restore target with measured RPO/RTO, post-restore app smoke, second-operator execution, scheduled retention, or rollback/key-recovery incident rehearsal.
- Evidence: `docs/quality-reports/production-readiness-phase-8-recovery.md` and `docs/quality-reports/production-readiness-local-acceptance.md`.

### 2026-08-03 - Production Readiness Phase 8 Isolated Timed Restore Drill

- Added `LOAD_SMOKE_USE_CURRENT_ENV=true` support to `backend/scripts/load-smoke.js` so recovery drills can smoke the restored MySQL environment instead of a temporary file-backed backend.
- Hardened `backend/src/recovery-drill.js` so child-process stdout/stderr are redacted for secrets, tokens, keys, passwords, and MySQL URLs before being attached to failures.
- Ran a disposable local `mysql:8.4` recovery drill with generated local-only credentials: migrations and production-state initialization, encrypted backup, integrity check, confirmed restore, and post-restore backend smoke against the restored MySQL environment.
- Drill result: `ok: true`; RPO age `0.12` minutes against 15 minute target; RTO `0.13` minutes against 60 minute target; elapsed `7805 ms`; restored `23` tables and `3` rows; post-restore smoke `277` requests, `0` failures, p95 `16.73 ms`; disposable container and encrypted backup artifact removed after verification.
- Verification: full backend suite passed with 93 tests, 3 known infrastructure skips, 0 failed; focused recovery/load-smoke tests passed 7/7; runbook tests passed 2/2; `npm run runbooks:check` passed with 13 headings, 18 snippets, and 6 scripts checked; `git diff --check` passed with line-ending warnings only.
- Phase 8 remains BLOCKED on scheduled retention, failed deployment/migration/image rollback rehearsal, key-recovery/incident drills, second-operator execution, and managed/PITR or production-sized restore evidence.
- Evidence: `docs/quality-reports/production-readiness-phase-8-recovery.md` and `docs/quality-reports/production-readiness-local-acceptance.md`.

### 2026-08-03 - Production Readiness Phase 8 Migration Rollback Drill

- Added guarded migration rollback/reapply drill tooling in `backend/src/migration-rollback-drill.js` and `backend/scripts/migration-rollback-drill.js`, exposed as `npm --prefix backend run migration:rollback-drill` with `CONFIRM_MIGRATION_ROLLBACK_DRILL=yes`.
- Tightened `docs/operations/production-recovery-runbook.md` and `scripts/validate-production-runbooks.mjs` so runbook validation requires the migration rollback drill command and seven backend recovery scripts.
- Ran a disposable local `mysql:8.4` rollback drill with generated local-only credentials: migrations applied, expected latest `002-normalized-domain` verified, rolled back, verified removed, reapplied, and verified restored.
- Drill result: `ok: true`; migration count `2`; elapsed `5085 ms`; before rollback `001-application-state`, `002-normalized-domain`; after rollback `001-application-state`; after reapply `001-application-state`, `002-normalized-domain`; disposable container removed after verification.
- Verification: focused migration rollback/migration tests passed 5/5; runbook tests passed 2/2; `npm run runbooks:check` passed with 13 headings, 20 snippets, and 7 scripts checked; focused server-security retry passed 5/5 after one full-suite startup flake; backend full rerun passed with 95 tests, 3 known infrastructure skips, 0 failed; `git diff --check` passed with line-ending warnings only.
- Phase 8 remains BLOCKED on scheduled retention, failed deployment/image rollback rehearsal, key-recovery/incident drills, second-operator execution, and managed/PITR or production-sized restore evidence.
- Evidence: `docs/quality-reports/production-readiness-phase-8-recovery.md` and `docs/quality-reports/production-readiness-local-acceptance.md`.

### 2026-08-03 - Production Readiness Phase 8 Backup Retention Drill

- Added guarded backup retention cleanup drill tooling in `backend/src/backup-retention-drill.js` and `backend/scripts/backup-retention-drill.js`, exposed as `npm --prefix backend run backup:retention-drill` with `CONFIRM_BACKUP_RETENTION_DRILL=yes`.
- Tightened `docs/operations/production-recovery-runbook.md` and `scripts/validate-production-runbooks.mjs` so runbook validation requires the retention drill command and eight backend recovery scripts.
- Ran the disposable local retention drill: dry-run scanned 4 fake encrypted-backup filenames and identified 2 removal candidates; confirmed cleanup removed 2; final dry-run scanned 2 retained backup files with 0 candidates; ignored non-backup file remained; temporary drill directory was removed.
- Verification: focused retention/backup tests passed 7/7; runbook tests passed 2/2; `npm run runbooks:check` passed with 13 headings, 22 snippets, and 8 scripts checked; backend full suite passed with 97 tests, 3 known infrastructure skips, 0 failed; `git diff --check` passed with line-ending warnings only.
- Phase 8 remains BLOCKED on production retention scheduling/second-operator approval, failed deployment/image rollback rehearsal, managed secret-platform key recovery/rotation, incident drills, second-operator execution, and managed/PITR or production-sized restore evidence.
- Evidence: `docs/quality-reports/production-readiness-phase-8-recovery.md` and `docs/quality-reports/production-readiness-local-acceptance.md`.

### 2026-08-03 - Production Readiness Phase 8 Backup Key Recovery Drill

- Added guarded backup key recovery drill tooling in `backend/src/backup-key-recovery-drill.js` and `backend/scripts/backup-key-recovery-drill.js`, exposed as `npm --prefix backend run backup:key-recovery-drill` with `CONFIRM_BACKUP_KEY_RECOVERY_DRILL=yes`.
- Tightened `docs/operations/production-recovery-runbook.md` and `scripts/validate-production-runbooks.mjs` so runbook validation requires the key recovery drill command and nine backend recovery scripts.
- Ran the guarded local drill with a generated local-only 32-byte key: correct key verification passed, wrong-key rejection passed, output reported `safeSummaryOnly: true`, and no key material or drill row contents were printed.
- Verification: focused key-recovery/backup tests passed 9/9; runbook tests passed 2/2; `npm run runbooks:check` passed with 13 headings, 24 snippets, and 9 scripts checked; backend full suite passed with 104 tests, 101 passed, 3 known infrastructure skips, 0 failed; `git diff --check` passed with line-ending warnings only.
- No additional redundant docs or dead files were removed in this slice; prior cleanup remains limited to confirmed obsolete artifacts with reference-audit evidence.
- Phase 8 remains BLOCKED on production retention scheduling/second-operator approval, failed deployment/image rollback rehearsal, managed secret-platform key recovery/rotation, incident drills, second-operator execution, and managed/PITR or production-sized restore evidence.
- Evidence: `docs/quality-reports/production-readiness-phase-8-recovery.md` and `docs/quality-reports/production-readiness-local-acceptance.md`.

### 2026-08-03 - Production Readiness Phase 8 Deployment Rollback Drill

- Added guarded deployment/image rollback manifest drill tooling in `backend/src/deployment-rollback-drill.js` and `backend/scripts/deployment-rollback-drill.js`, exposed as `npm --prefix backend run deployment:rollback-drill` with `CONFIRM_DEPLOYMENT_ROLLBACK_DRILL=yes`.
- Tightened `docs/operations/production-recovery-runbook.md` and `scripts/validate-production-runbooks.mjs` so runbook validation requires the deployment rollback drill command and ten backend recovery scripts.
- Ran the guarded local drill with synthetic immutable previous/failed image digests: immutable digest verification passed, required previous-image gates passed, rollback checklist was produced, failed digest was retained for forensics, and only shortened digests/safe fields were printed.
- Verification: focused deployment rollback tests passed 4/4; runbook tests passed 2/2; `npm run runbooks:check` passed with 13 headings, 26 snippets, and 10 scripts checked; backend full suite passed with 108 tests, 105 passed, 3 known infrastructure skips, 0 failed; `git diff --check` passed with line-ending warnings only.
- Phase 8 remains BLOCKED on production retention scheduling/second-operator approval, live orchestrator image rollback, managed secret-platform key recovery/rotation, incident drills, second-operator execution, and managed/PITR or production-sized restore evidence.
- Evidence: `docs/quality-reports/production-readiness-phase-8-recovery.md` and `docs/quality-reports/production-readiness-local-acceptance.md`.

### 2026-08-03 - Production Readiness Phase 2 Central API Access Policy

- Applicable controls: API-001, API-002, API-006, API-015, API-020, API-022, and API-026; UI/UX N/A because no rendered workflow changed.
- Added a centralized fail-closed API access policy covering public, authenticated, role-scoped, and Admin route classes while preserving domain-level booking assignment and workflow ownership checks.
- Preserved established response contracts: Admin and role-scoped denials return 403, general missing authentication returns 401, and undeclared method/path pairs return a safe 404.
- Removed the superseded production-readiness implementation audit plan after updating its only live reference to the canonical local implementation plan.
- Verification: focused authorization/security suite passed 9/9; backend full suite passed 112 total with 109 passed and 3 known host infrastructure skips; security scanner tests passed 4/4; production security scan passed across 262 files; obsolete-roadmap reference search returned no matches.
- Phase 2 remains BLOCKED on frontend dependency advisories, backend advisory network evidence, container scanning/SBOM/signing, managed secrets/rotation, hosted TLS/trusted-proxy validation, webhook security, and external observability evidence.
- Evidence: docs/quality-reports/production-readiness-phase-2-security.md and docs/quality-reports/production-readiness-local-acceptance.md.

### 2026-08-03 - Production Readiness Phase 5 CycloneDX SBOM Evidence

- Applicable controls: API-015, API-022, API-026, API-029, and API-030; UI/UX N/A because no rendered workflow changed.
- Added validated backend/frontend production-dependency CycloneDX 1.5 generation with malformed, component-identity, empty-component, and dependency-graph checks.
- Added a CI supply-chain job that validates the generator, produces both SBOMs from lockfiles, and retains them as a 30-day build artifact.
- Verification: SBOM validator passed 2/2; disposable generation produced backend 22 components/23 dependency records and frontend 181/182; generated files were deleted; git diff check remained clean except line-ending warnings.
- Removed a confirmed zero-byte accidental repository-root npm artifact after exact path and size validation.
- Phase 5 remains BLOCKED on dependency advisory remediation, local/hosted Docker Scout execution, image signing, immutable digest-pinned bases, hosted CI/branch protection, and staging promotion evidence.
- Evidence: docs/quality-reports/production-readiness-phase-5-cicd.md and docs/quality-reports/production-readiness-local-acceptance.md.

### 2026-08-03 - Production Readiness Phase 1 Normalized Runtime Cutover

- Applicable controls: API-004, API-005, API-008, API-009, API-010, API-011, API-020, API-022, API-023, API-024, API-026, API-029, and API-030; UI/UX N/A because no rendered workflow changed.
- Cut production MySQL behavior over from the encrypted `application_state` row to normalized per-entity tables with transactional replacement, lossless entity JSON, and a global optimistic revision. Normal runtime smoke verified zero `application_state` rows.
- Added guarded legacy migration `dry-run`, `migrate`, `verify`, and `cleanup` modes with deterministic checksums/inventory, duplicate detection, deterministic region/dealer materialization, historical template-version reconciliation, and SQL/row-value redaction.
- Hardened rollback enum conversion and persistence error sanitization. The evolved legacy fixture exposed and drove fixes for missing access-master rows, missing historical template versions, deleted audit actors, and nondeterministic SQL row order.
- Verification: production MySQL/Redis initializer and load smoke passed 103 requests with 0 failures and p95 71.3 ms; strict migration reconciliation passed twice on clean schemas for 69 users, 100 bookings, 100 dealer assignments/codes, and all modeled domains; disposable infrastructure tests passed 4/4 unskipped; backend full suite passed 118 total with 114 passed, 4 separately covered host infrastructure skips, and 0 failed.
- Phase 1 remains BLOCKED on High findings: saves still replace all normalized rows from an in-memory aggregate, unrelated writes conflict under one global revision, universal query-level pagination is incomplete, and populated rollback plus restoration/reconciliation is not proven twice at approved production scale.
- Evidence: `docs/quality-reports/production-readiness-phase-1-persistence.md` and `docs/quality-reports/production-readiness-local-acceptance.md`.

### 2026-08-03 - Production Readiness Phase 4 Full Browser Matrix and Grouped Tabs

- Applicable controls: UI-001 through UI-025, UX-001 through UX-025, and API-026.
- Ran the full configured Playwright matrix. It exposed stale evolved-workflow labels, stale visual baselines, and a real Critical Axe defect where grouped parent tabs referenced a nonexistent child tablist.
- Updated the Admin journey for current Business Settings and Add Users paths, regenerated reviewed UI Kit primitive/modal baselines, and fixed `GroupedTabs`/`TabList` so `aria-controls` resolves to a real child tablist ID. Added focused component regression coverage.
- Added a portable Playwright standalone launcher that mirrors Docker asset layout and removes the unsupported `next start` warning; Chromium public-entry smoke passed against it.
- Verification: Playwright 16 executed passed, 12 intentional project-specific mobile exclusions, 0 failed; Admin critical journey passed across bookings, settings, onboarding, email templates/delivery with Axe checkpoints; Vitest 38 files/173 tests passed; production build, lint, architecture, design-system, secret, format, and performance budgets passed.
- Phase 4 remains BLOCKED on manual/in-app browser evidence and unconfigured mobile recovery/resume, slow/failing-network, and complete focus-trap walkthroughs. In-app browser control remains unavailable because of the Windows ACL runtime error.
- Evidence: `docs/quality-reports/production-readiness-phase-4-frontend.md` and `docs/quality-reports/production-readiness-local-acceptance.md`.

### 2026-08-03 - Production Readiness Phase 3 Dependency Failure Evidence

- Applicable controls: API-006, API-021, API-026, API-028, and API-030; UI/UX N/A because no rendered workflow changed.
- Added process coverage proving /api/health remains available while /api/ready fails closed with sanitized dependency state when Redis or MySQL is unavailable.
- Added a SIGTERM drain regression that remains active on Linux CI and is explicitly skipped on Windows, where Node cannot deliver POSIX SIGTERM to a child process; code inspection confirms listener drain, dependency closure, and a 10-second hard-stop fallback.
- Verification: focused slice 3 total, 2 passed, 1 Windows-only skip, 0 failed; backend full suite 121 total, 116 passed, 5 skipped, 0 failed.
- Phase 3 remains BLOCKED on universal pagination, route/service/repository modularity, complete error catalogue, durable email timeout/retry/terminal-failure/restart recovery, and hosted Linux graceful-shutdown evidence.
- Evidence: docs/quality-reports/production-readiness-phase-3-api-reliability.md and docs/quality-reports/production-readiness-local-acceptance.md.

### 2026-08-03 - Production Readiness Phase 3 Bounded Email Delivery

- Applicable controls: API-006, API-008, API-009, API-018, API-021, API-023, API-024, API-026, and API-028; UI/UX N/A because no rendered workflow contract changed.
- Added configurable bounded email timeout, 1-5 attempts, exponential full jitter, conservative provider retry classification, and terminal handling for timeout/ambiguous submission failures.
- Added recipient idempotency keys, activation-token recipient linkage, attempt counts, retry-scheduled events, provider references, and terminal failure codes using the existing normalized persistence model.
- Wired policy defaults into local/production environment examples and Compose, and documented duplicate-safe operational behavior plus the remaining crash-safety limitation.
- Verification: focused email reliability 22/22; backend full suite 127 total, 122 passed, 5 documented skips, 0 failed; production security scan passed 268 files; Compose parse, runbook validator, and diff check passed.
- API-018 is PARTIAL PASS, not complete: delivery remains request-bound without atomic worker claims, durable restart recovery, resend controls, or provider webhook reconciliation.
- Phase 3 remains BLOCKED on those email durability items plus universal pagination, route/service/repository modularity, complete error catalogue, and hosted Linux graceful-shutdown evidence.
- Evidence: `docs/quality-reports/production-readiness-phase-3-api-reliability.md` and `docs/quality-reports/production-readiness-local-acceptance.md`.

### 2026-08-03 - Production Readiness Phase 3/4 Bounded Admin Users

- Applicable controls: API-001, API-002, API-003, API-006, API-011, API-025, API-026, API-029; UI-005, UI-009, UI-019, UI-025; UX-009, UX-011, UX-018, UX-020, UX-024.
- Extracted a dedicated Admin-user query service with allowlisted search/filter/sort inputs, deterministic ordering, safe projection, stable validation codes, default 10-row pages, and a 100-row maximum.
- Added `GET /api/admin/users`, bounded the legacy bootstrap users page to 100 with discoverable pagination/link metadata, and documented/tested the contracts in OpenAPI.
- Migrated the Admin user table to cancelled/debounced server queries with exact totals, page correction, loading and retryable failure states, local record reconciliation, and bounded multi-page export.
- Browser evidence passed in desktop/mobile Chromium for page transitions, filtered totals, no horizontal overflow, and no serious/critical Axe violations; both screenshots were visually inspected and retained.
- Verification: backend 135 total/130 passed/5 documented skips/0 failed; frontend 39 files/177 tests; focused affected frontend 28/28; production build and all static/performance gates passed; security scan passed 272 files; focused Playwright 2/2 plus expanded Admin Chromium workflow passed.
- API-011 remains PARTIAL PASS: onboarding workflows, campaigns/events, templates, notifications, uploads, and audit logs still need bounded query contracts and consumer migration.
- Phase 3 and Phase 4 remain BLOCKED on their recorded broader modularity, durable recovery, remaining collection, and manual recovery/failure/focus gates.
- Evidence: `docs/quality-reports/production-readiness-phase-3-api-reliability.md`, `docs/quality-reports/production-readiness-phase-4-frontend.md`, and `docs/quality-reports/production-readiness-local-acceptance.md`.

### 2026-08-03 - Production Readiness Phase 3/4 Bounded Email Campaigns

- Applicable controls: API-001, API-002, API-003, API-006, API-011, API-025, API-026, API-029; UI-005, UI-009, UI-019, UI-025; UX-009, UX-011, UX-018, UX-020, UX-024.
- Extracted a dedicated campaign query service with validated 200-character search, status/outcome filters, allowlisted deterministic sorting, five-row UI pages, a 100-row API cap, exact filtered totals, and server-computed campaign/sent/failed summaries.
- Added bounded `/api/admin/email-campaigns` and bootstrap compatibility contracts in OpenAPI; campaigns are capped at 100 and discoverable through collection metadata, while legacy delivery events are capped at 100 with explicit compatibility metadata.
- Migrated Delivery Logs to cancelled/debounced server requests with page correction, loading, stale-result refresh, retryable failures, and exact totals. Mobile Axe exposed and drove a shared `Table` fix: scroll regions are now named and keyboard focusable.
- Browser evidence passed 2/2 in desktop/mobile Chromium for injected `503` recovery, page transitions, recipient search, exact totals, no page overflow, and no serious/critical Axe violations. Screenshots were visually inspected and retained.
- Verification: backend full suite exited 0 across 145 tests (140 passed, 5 documented infrastructure/platform skips); frontend full suite 180/180 after the shared-table fix plus focused post-fix 13/13; production build passed through Playwright web-server startup; expanded Admin Chromium workflow passed; architecture/design/style/secret/format/performance gates passed; production security scan passed 276 files; `git diff --check` passed with line-ending warnings only.
- API-011 remains PARTIAL PASS: onboarding workflows, templates, notifications, uploads, and audit logs remain unbounded, and delivery events still need an independent cursor/page contract. Phase 3/4 remain BLOCKED on the broader modularity, durable delivery/restart recovery, and manual/remaining recovery-focus evidence recorded in their reports.
- Evidence: `docs/quality-reports/production-readiness-phase-3-api-reliability.md`, `docs/quality-reports/production-readiness-phase-4-frontend.md`, `docs/quality-reports/production-readiness-local-acceptance.md`, and `frontend/docs/evidence/screenshots/admin-delivery-pagination-{chromium,mobile-chromium}.png`.

### Bounded Onboarding Workflow Readiness - 2026-08-03

- Applicable controls: API-001, API-002, API-003, API-006, API-011, API-020, API-025, API-026, API-029; UI-005, UI-009, UI-019, UI-025; UX-009, UX-011, UX-018, UX-020, UX-024.
- Added owner-scoped bounded onboarding workflow queries, a dedicated list endpoint, capped/discoverable bootstrap compatibility data, safe row-free projections, and corrected session-identity OpenAPI contracts.
- Enforced workflow ownership for detail, preview, and recipient updates; removed obsolete client userId/actorId identity fields.
- Added frontend recovery, exact totals, and load-more traversal. Desktop/mobile browser evidence passed 2/2 after an injected 503, retry, 20-of-25 page, and load more to 25; Axe and document overflow checks passed without application proxy errors.
- Verification: query/domain 22/22; query/onboarding/HTTP security 29 passed with 1 documented Windows signal skip; OpenAPI/query 14/14; final focused frontend 16/16; formatting, lint, architecture (130 modules <=350 lines), and dependency cycles passed.
- Evidence: docs/quality-reports/bounded-onboarding-workflows-2026-08-03.md.
- API-011 remains PARTIAL PASS at product scope only for uploads, audit logs, and independently paged delivery events. Production remains NO-GO on the broader persistence, restart recovery, external, and acceptance gates.

### 2026-08-03 - Local Production-Readiness Completion Reconciliation

- Applicable controls: API-001, API-002, API-003, API-006, API-011, API-018, API-021, API-022, API-025, API-026, API-028, API-029, API-030; UI-002, UI-005, UI-009, UI-010, UI-011, UI-012, UI-015, UI-016, UI-019, UI-025; UX-001, UX-009, UX-011, UX-013, UX-014, UX-018, UX-020, UX-024.
- Completed the bounded collection inventory for uploads, audit events, delivery events, reference data, mutation responses, and booking export; API-011 now passes locally.
- Split backend routes, persistence, validation, HTTP, bootstrap, and retention responsibilities. Added a CI architecture gate: 52 production modules <=510 lines, no relative-import cycles.
- Verification: backend 211 total/206 pass/5 documented skips; frontend 44 files/196 tests plus build/static/performance gates; Admin Chromium 6/6; security scan 323 files; runbook and populated CycloneDX checks pass.
- Removed confirmed obsolete `backend/public` and generated temporary/test artifacts; retained quality reports and screenshots because they remain referenced evidence.
- Local implementation goal is complete. Production remains NO-GO on aggregate persistence/row-scoped concurrency, durable email restart recovery, hosted/advisory/container/observability/recovery evidence, and human/operator approvals.
- Evidence: `docs/quality-reports/production-readiness-local-completion-2026-08-03.md`.

### 2026-08-03 - Area Manager Reporting Hierarchy Relaxation

- Applicable controls: API-003, API-004, API-006, API-026, API-029; UI-005, UI-009, UI-016, UI-025; UX-009, UX-011, UX-022.
- Removed only the rule that an Area Manager's reporting manager must have the Regional Manager role. Area Managers still require a reporting-manager email, and that email must identify an active existing user; all other role hierarchy validation remains unchanged.
- Updated Add Single User guidance so Area Manager displays neutral active-manager help instead of prescribing Regional Manager.
- Verification: focused backend validation/onboarding 34/34; focused frontend 14/14; backend full suite 212 total with 207 passed and 5 documented skips; frontend lint, architecture, cycle, and format checks passed; Admin Chromium workflow and Axe checkpoint passed 1/1.
- Evidence: `docs/quality-reports/area-manager-reporting-validation-2026-08-03.md` and `frontend/docs/evidence/screenshots/area-manager-generic-reporting-manager-chromium.png`.

### 2026-08-03 - Shared Tabbed Workspace Padding

- Applicable controls: UI-001, UI-002, UI-004, UI-009, UI-010, UI-011, UI-019, UI-025; UX-001, UX-013, UX-014, UX-020. API controls N/A because no backend or contract behavior changed.
- Added a shared 24px desktop and 16px mobile inset to tabbed workspace canvases, correcting flush content in Booking Management, User Management, Business Settings, and Email Management without duplicating page-specific rules.
- Verification: frontend lint, format, module-size, and cycle checks passed; targeted Playwright coverage passed 6 with 2 intentional project-specific skips and 0 failures across Chromium and mobile Chromium, including Axe and overflow checks.
- Evidence: `docs/quality-reports/shared-workspace-padding-2026-08-03.md` and regenerated screenshots under `frontend/docs/evidence/screenshots/`.
- Limitation: host Windows ACL restrictions prevented direct inspection through the local image-viewer tool; browser rendering, assertions, accessibility checks, overflow checks, and screenshot capture passed.

### 2026-08-03 - User Phone and Reference Creation Regressions

- Applicable controls: API-003, API-005, API-006, API-009, API-020, API-025, API-026, API-029; UI-005, UI-009, UI-016, UI-020, UI-025; UX-008, UX-009, UX-011, UX-013, UX-020, UX-023.
- Enforced exactly 10 digits for optional supplied user phone values in controlled UI entry, backend validation, and OpenAPI. Mixed typed/pasted input is sanitized before the 10-digit cap, and short values are blocked with an adjacent accessible error.
- Fixed the Single User drawer crash after successful Region/Dealer creation by reconciling bounded mutation items locally instead of expecting obsolete full collection arrays, while retaining background reference-data refresh.
- Strengthened executable guardrails instead of changing skill prose: component fixtures now model bounded production responses, backend tests cover invalid/valid/omitted phone values, OpenAPI tests pin the schema, and the Admin browser journey creates and selects both a Region and Dealer Code without entering the error boundary.
- Verification: backend focused 44/44; backend full 214 total with 209 passed and 5 documented skips; frontend full 44 files/197 tests; post-extraction focused 12/12; frontend lint, format, module-size (132 modules <=350 lines), and cycle checks passed; Admin Chromium workflow and Axe passed 1/1.
- Evidence: `docs/quality-reports/user-phone-reference-creation-regressions-2026-08-03.md` and `frontend/docs/evidence/screenshots/area-manager-generic-reporting-manager-chromium.png`.

### 2026-08-03 - Session Authority and Single User Alignment

- Applicable controls: API-001, API-002, API-006, API-022, API-026, API-029; UI-004, UI-009, UI-010, UI-011, UI-020, UI-025; UX-006, UX-009, UX-011, UX-013, UX-020, UX-024.
- Fixed stale cross-tab identity by making authenticated bootstrap `currentUser` authoritative during restore before role-scoped requests. Cached Admin identity can no longer coexist with a non-Admin server session after refresh, and public identity projection excludes credential/token material.
- Corrected Add Single User drawer alignment with stable label/control sizing, consistent grid gaps, responsive standalone Dealer Code placement, and removal of a stray JSX render artifact.
- Verification: backend full 215 total/210 passed/5 documented skips/0 failed; frontend full 44 files/198 tests passed; production build, lint, architecture, cycle, CSS/design-system, and affected-file format gates passed; Admin browser file 11 passed with 1 intentional mobile exclusion, including exact Phone/Role geometry, Axe, numeric phone, Region creation, and Dealer creation.
- Evidence: `docs/quality-reports/session-authority-single-user-alignment-2026-08-03.md` and `frontend/docs/evidence/screenshots/single-user-form-alignment-chromium.png`.
- Rebuilt and restarted backend/frontend containers with the existing `.env.docker`; all four services are healthy and both local and public Cloudflare entry points returned HTTP 200. Broader production NO-GO items are unchanged.
### 2026-08-03 - Access Master Data Mutation Routing

- Applicable controls: API-003, API-006, API-009, API-025, API-026, API-029; UI-009, UI-016, UI-025; UX-009, UX-011, UX-024.
- Fixed Region and Dealer Code edit/deactivate/reactivate actions so they use their dedicated Admin PATCH endpoints instead of the booking-workflow lookup endpoint. The shared UI payload is translated to Region `name` or Dealer `code` while preserving status.
- Verification: controller 23/23; focused backend 13 total/12 passed/1 documented Windows skip; desktop/mobile browser 2/2 with exact endpoint/payload assertions and Axe; frontend full uncontended 44 files/200 tests; production build and lint passed.
- Evidence: `docs/quality-reports/access-master-data-mutations-2026-08-03.md` and `frontend/docs/evidence/screenshots/admin-reference-mutations-{chromium,mobile-chromium}.png`.- Deployment: rebuilt and restarted only the frontend service; health is green and both local/public entry points returned HTTP 200.

### 2026-08-03 - Reusable Blocking Dependency Modal

- Applicable controls: API-006, API-026; UI-005, UI-016, UI-017, UI-020, UI-025; UX-009, UX-012, UX-015, UX-017, UX-023, UX-024.
- Added `BlockingDependencyModal` to the shared UI control library. The production-ready alert dialog reuses shared modal lifecycle/buttons, labels its explanation, starts focus on the safe Close action, supports Escape/backdrop close, and provides a configurable recovery command.
- Region `REGION_IN_USE` conflicts now open the modal with the affected Region and a `View Dealer Codes` action instead of showing a transient toast. Recovery closes the modal and navigates directly to Dealer Codes without mutating preserved data.
- Verification: focused 45/45; full frontend 44 files/202 tests; desktop/mobile Chromium conflict workflow passed with Axe and screenshots; production build, lint, design-system/CSS, 133-module size, and cycle gates passed.
- Evidence: `docs/quality-reports/blocking-dependency-modal-2026-08-03.md` and `frontend/docs/evidence/screenshots/region-dependency-modal-{chromium,mobile-chromium}.png`.- Deployment: rebuilt/restarted only the frontend; service is healthy and local/public entry points returned HTTP 200.
### 2026-08-03 - Modal Visual Standards and Enforcement

- Applicable controls: UI-001, UI-003, UI-004, UI-005, UI-010, UI-011, UI-013, UI-015, UI-017, UI-020, UI-025; UX-009, UX-012, UX-013, UX-015, UX-017, UX-020, UX-023. API controls N/A because the server conflict contract did not change.
- Fixed the dependency modal's production CSS ownership: its old rules were in an unimported email stylesheet, causing the generic 90vw modal fallback. The shared alert dialog is now capped at 520px, positioned in the upper viewport, structured into warning header/body/detail/footer, tokenized, responsive, reduced-motion aware, and semantically labelled.
- Added mandatory Modal Visual and Modal Workflow gates to the UI/UX skills plus an executable `check:modal-ux` design-system gate that detects missing stylesheet imports and required responsive/accessibility contract regressions.
- Verification: design-system/modal gate passed; frontend lint and architecture passed; 44 files/202 tests passed; production build passed; desktop/mobile Chromium passed 2/2 with Axe, geometry/color/layout assertions, screenshots, expected conflict handling, and direct Dealer Codes recovery.
- Evidence: `docs/quality-reports/modal-visual-standards-2026-08-03.md` and `frontend/docs/evidence/screenshots/region-dependency-modal-{chromium,mobile-chromium}.png`.
- Deployment: rebuilt/restarted only the frontend; service is healthy and local/public entry points returned HTTP 200. Existing dependency-audit findings remain tracked outside this modal scope, so this phase does not change the broader production NO-GO decision.
### 2026-08-03 - Coupled User Region Update

- Applicable controls: API-003, API-006, API-009, API-026, API-029; UI-009, UI-016, UI-020, UI-025; UX-008, UX-009, UX-011, UX-023, UX-024.
- Fixed inline Region updates for users with an assigned Dealer Code. The editor now exposes a Region-filtered Dealer Code control, visibly clears an incompatible code when Region changes, sends both values together, and surfaces safe server field details instead of a generic request failure.
- Backend validation and persistence now accept the additive optional `dealerCode` update field, validate Region/Dealer consistency, persist both in one save, and document the contract in OpenAPI. Removed the ignored client `updatedBy` hint; audit identity remains session-derived.
- Verification: backend 218 total/213 passed/5 documented skips/0 failed; frontend 44 files/202 tests; lint, design-system, CSS/modal, 135-module size, cycle, and production build gates passed; desktop/mobile Chromium passed 2/2 with Axe, exact payload, successful edit completion, and screenshots.
- Evidence: `docs/quality-reports/coupled-user-region-update-2026-08-03.md` and `frontend/docs/evidence/screenshots/user-region-update-{chromium,mobile-chromium}.png`.
- Deployment: rebuilt/restarted backend and frontend; both are healthy, backend readiness confirms MySQL normalized persistence and Redis abuse control, and local/public entry points return HTTP 200.


### 2026-08-03 - Compact Booking Import Preview

- Applicable controls: UI-003-007, UI-010-012, UI-015-020, UI-025; UX-001, UX-003, UX-013-015, UX-020, UX-025. API controls are N/A because no backend or contract behavior changed.
- Reduced upload-header, utility-action, and file-picker vertical space; added a compact selected-file Ready/Replace state; gave the preview the remaining modal height with an internally scrolling table, sticky headers, and stable footer actions.
- Verification: focused component test 2/2, changed-file ESLint, Stylelint, and Next.js production build passed.
- Browser desktop/mobile evidence remains BLOCKED by the Windows sandbox ACL runtime failure; no screenshot pass is claimed.
- Evidence: `docs/quality-reports/compact-booking-import-preview-2026-08-03.md`.

- Compact booking-import follow-up: combined the Data Import label, title, and description into one desktop line; merged file selection, template download, and sample-data actions into one desktop toolbar; pinned upload actions to an opaque sticky footer for short viewports. Mobile retains intentional wrapping. Stylelint, focused component tests, ESLint, and the production build passed; browser evidence remains blocked by the recorded ACL runtime failure.
