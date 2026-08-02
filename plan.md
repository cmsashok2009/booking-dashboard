# Production User Onboarding, Activation, and Email Delivery Plan

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

| ID | Status | Severity | Validation method | Evidence | Notes/owner |
|---|---|---|---|---|---|
| UX-004 | PASS | High | Resume browser test | Test name and screenshot path | Workflow restored at template selection |
| UI-017 | PASS | Medium | Desktop/mobile visual review | Screenshot paths | Modal scroll and focus verified |
| API-008 | FAIL | Critical | Integration test | Failing test name | Duplicate send on retry; must fix |

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