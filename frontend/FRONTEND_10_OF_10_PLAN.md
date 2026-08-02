# Frontend 10/10 Quality Plan

## Purpose

This plan moves the Booking Dashboard frontend from a functional prototype to a production-grade application. A 10/10 rating means every measurable release gate below passes; it does not mean defects are impossible.

## Baseline

| Area            |           Current | Target |
| --------------- | ----------------: | -----: |
| Build stability |               8.5 |     10 |
| Architecture    |                 6 |     10 |
| UI consistency  |                 7 |     10 |
| Accessibility   |               5.5 |     10 |
| Error recovery  |                 7 |     10 |
| Testing         |                 3 |     10 |
| Maintainability |               5.5 |     10 |
| Security        | Not fully audited |     10 |
| Performance     | Not fully audited |     10 |
| Operations      | Not fully audited |     10 |

## Phase 1: Architecture and Feature Boundaries

### Objective

Separate application composition, feature UI, state, and API behavior to reduce regression risk.

### Implementation

- Extract BookingWorkspace, AreaFieldsView, UsersView, metrics, navigation, and modal workflows from booking-dashboard.jsx.
- Organize code under bookings, users, reconciliation, onboarding, and email feature folders.
- Move data loading and mutations into feature hooks.
- Move payload mapping and error normalization into service modules.
- Keep the dashboard shell responsible only for authentication, navigation, and composition.
- Document shared and feature-specific component ownership.

### Evaluation Checklist

- [ ] booking-dashboard.jsx is under 350 lines.
- [ ] No feature component exceeds 350 lines without a documented reason.
- [ ] Data fetching is separated from presentation-only components.
- [ ] Each feature has one clear public entry component.
- [ ] Cross-feature imports follow documented ownership rules.
- [ ] Circular dependency checks report zero cycles.
- [ ] Behavior is unchanged for every supported role.
- [ ] Production build and all tests pass.

### Exit Evidence

- Module-size report.
- Feature dependency map.
- Architecture summary.
- Passing build and test output.

## Phase 2: Testing Foundation

### Objective

Create reliable tests before larger structural and visual migrations.

### Implementation

- Add React component testing and DOM assertions.
- Add unit tests for validation, filtering, pagination, transformations, and role rules.
- Add component tests for forms, filters, tables, drawers, modals, and error states.
- Add integration tests for API success, failure, timeout, and session expiry.
- Add end-to-end tests for critical workflows.
- Add deterministic fixtures for every user role.

### Critical Workflows

- Login and logout.
- Role-specific navigation.
- Booking search, details, filters, and updates.
- Booking import preview and confirmation.
- User creation and editing.
- Bulk onboarding and delivery.
- Email template editing.
- Email provider connection and test delivery.
- Session expiry and recovery.

### Evaluation Checklist

- [ ] Every critical workflow has automated coverage.
- [ ] Meaningful statement and branch coverage is at least 85%.
- [ ] Every supported role has authorization-behavior tests.
- [ ] Network and server failures are tested.
- [ ] Error-boundary fallback and retry behavior is tested.
- [ ] Three consecutive CI runs pass without flakes.
- [ ] No test depends on execution order.
- [ ] Test duration stays within the agreed CI budget.
- [ ] Production build and all tests pass.

### Exit Evidence

- Coverage report.
- Workflow coverage matrix.
- CI duration report.
- Flaky-test report.

## Phase 3: Design System Completion

### Objective

Make shared controls the source of truth for visual states, behavior, and accessibility.

### Implementation

- Complete Button, IconButton, TextInput, Select, TextArea, Checkbox, FileInput, Tabs, NavigationItem, DataTable, FilterToolbar, ModalShell, and SideDrawer.
- Replace remaining ordinary native controls.
- Keep native controls only inside primitives or documented composite widgets.
- Document variants, sizes, states, and usage in the UI Kit.
- Add visual regression coverage.
- Deprecate legacy control selectors.

### Evaluation Checklist

- [ ] No ordinary raw controls remain outside approved primitives.
- [ ] Controls support all applicable interaction and validation states.
- [ ] Controls use tokens for color, spacing, border, and typography.
- [ ] Features do not duplicate standard-control styles.
- [ ] The UI Kit demonstrates every supported state.
- [ ] Desktop and mobile visual snapshots pass.
- [ ] Contrast meets WCAG AA.
- [ ] Production build and all tests pass.

### Exit Evidence

- Raw-control audit.
- UI Kit screenshots.
- Visual regression report.
- Deleted legacy-selector list.

## Phase 4: CSS Architecture

### Objective

Replace the monolithic stylesheet with predictable layers and eliminate selector conflicts.

### Implementation

- Split globals.css into tokens, base, primitives, layout, features, and responsive utilities.
- Adopt consistent naming and ownership.
- Remove duplicate, obsolete, and conflicting selectors.
- Prevent feature CSS from styling generic elements.
- Add Stylelint.
- Add token checks for colors, spacing, radii, and typography.

### Evaluation Checklist

- [ ] No stylesheet exceeds the agreed size threshold.
- [ ] Shared primitives do not depend on feature selectors.
- [ ] Feature styles extend primitives only through documented classes.
- [ ] Stylelint passes without warnings.
- [ ] No duplicate selectors remain.
- [ ] No unapproved hard-coded colors remain.
- [ ] Responsive checks pass at 320, 375, 768, 1024, 1440, and 1920 pixels.
- [ ] Visual regression tests pass.
- [ ] Production build and all tests pass.

### Exit Evidence

- Stylesheet-size report.
- Duplicate-selector report.
- Token-usage report.
- Responsive screenshots.

## Phase 5: Accessibility

### Objective

Meet WCAG 2.2 AA and provide complete keyboard and assistive-technology support.

### Implementation

- Add focus trapping and trigger restoration to modals and drawers.
- Apply Escape behavior consistently.
- Complete combobox keyboard and screen-reader behavior.
- Announce table sorting.
- Associate errors and hints with controls.
- Add live announcements for async outcomes.
- Verify landmarks and headings.
- Respect reduced motion and high contrast.
- Test at 200% and 400% zoom.

### Evaluation Checklist

- [ ] Axe reports zero critical or serious violations.
- [ ] Every workflow works with keyboard only.
- [ ] Focus cannot escape an open modal or drawer.
- [ ] Focus returns to the triggering element after close.
- [ ] Every interactive control has visible focus.
- [ ] Errors, loading, sorting, status, and completion are announced.
- [ ] Every form control has a programmatic label.
- [ ] Color is never the only status indicator.
- [ ] Layout remains usable at 400% zoom.
- [ ] Reduced-motion mode disables nonessential animation.
- [ ] Production build and all tests pass.

### Exit Evidence

- Axe report.
- Keyboard checklist.
- Screen-reader notes.
- Zoom and contrast screenshots.

## Phase 6: Error Handling and Resilience

### Objective

Keep failures isolated, recoverable, observable, and understandable.

### Implementation

- Extract inline views so boundaries can catch render failures.
- Add boundaries to bookings, workflow options, users, and overlays.
- Standardize loading, empty, offline, timeout, unauthorized, and server-error states.
- Add request cancellation and stale-response protection.
- Retry only safe operations.
- Prevent duplicate submissions.
- Send sanitized production errors to an observability platform.
- Include correlation identifiers without personal data.

### Evaluation Checklist

- [ ] A feature render failure does not remove navigation or unrelated features.
- [ ] Modal and drawer failures can be dismissed or retried.
- [ ] Async event failures display actionable feedback.
- [ ] Session expiry returns to login without corrupting local state.
- [ ] Duplicate submissions are prevented.
- [ ] Timeout and offline states are distinguishable.
- [ ] Production errors include route, feature, release, and correlation context.
- [ ] Telemetry contains no credentials, tokens, email bodies, or personal data.
- [ ] Failure-injection tests pass.
- [ ] Production build and all tests pass.

### Exit Evidence

- Boundary coverage map.
- Failure-injection report.
- Sanitized telemetry example.
- Recovery screenshots.

## Phase 7: Security

### Objective

Reduce frontend and integration risk with evidence-backed controls and automated gates.

### Implementation

- Review authentication, session storage, logout, and expiry.
- Verify backend authorization for privileged operations.
- Audit XSS, URLs, redirects, uploads, and spreadsheet exports.
- Validate security headers and content security policy.
- Audit dependencies and lockfile.
- Confirm secrets never enter client bundles.
- Review OAuth callback and token assumptions.
- Add abuse controls for repeated mutations and email actions.

### Evaluation Checklist

- [ ] No critical or high dependency vulnerabilities remain.
- [ ] No secrets appear in source, bundles, logs, or browser storage.
- [ ] Backend authorization protects every privileged operation.
- [ ] User content is never inserted as unsafe HTML.
- [ ] Upload type, size, and content are validated server-side.
- [ ] Security headers meet policy.
- [ ] OAuth state and callback validation are verified.
- [ ] Spreadsheet formula injection is mitigated.
- [ ] No critical or high security findings remain.
- [ ] Production build and all tests pass.

### Exit Evidence

- Security review.
- Dependency audit.
- Header scan.
- Secret scan.
- Authorization matrix.

## Phase 8: Performance and Scale

### Objective

Keep the application responsive as data volume grows.

### Implementation

- Define JavaScript, CSS, image, and route bundle budgets.
- Profile rerenders and expensive calculations.
- Add server pagination or virtualization for large datasets.
- Cancel obsolete requests during rapid filter changes.
- Test large imports and campaign histories.
- Optimize fonts, icons, images, and critical CSS.
- Measure on representative mid-range hardware.

### Evaluation Checklist

- [ ] LCP is at most 2.5 seconds at the 75th percentile.
- [ ] INP is at most 200 milliseconds at the 75th percentile.
- [ ] CLS is at most 0.1 at the 75th percentile.
- [ ] Route bundles remain within budget.
- [ ] Tables remain responsive with production-scale data.
- [ ] Filtering and sorting stay within main-thread budgets.
- [ ] No unnecessary repeated API requests occur.
- [ ] Performance checks pass in CI.
- [ ] Production build and all tests pass.

### Exit Evidence

- Lighthouse report.
- Bundle analysis.
- React profiling report.
- Large-dataset benchmark.

## Phase 9: CI Quality Gates

### Objective

Prevent regressions from entering the main branch.

### Implementation

- Add linting, formatting, type checking, tests, and build checks.
- Add accessibility, visual, dependency, secret, and bundle-budget checks.
- Require pull-request review.
- Publish test and coverage artifacts.
- Protect the main branch.

### Evaluation Checklist

- [ ] Lint passes with zero warnings.
- [ ] Formatting passes.
- [ ] Type checking passes.
- [ ] Unit, component, integration, and end-to-end tests pass.
- [ ] Accessibility checks pass.
- [ ] Visual regression checks pass.
- [ ] Security and secret scans pass.
- [ ] Bundle budgets pass.
- [ ] Failed required checks block merges.
- [ ] Artifacts are visible on every pull request.

### Exit Evidence

- Branch-protection configuration.
- Successful sample pull request.
- Published reports.
- Demonstrated blocked merge.

## Phase 10: Production Operations

### Objective

Make releases observable, repeatable, and recoverable.

### Implementation

- Separate development, staging, and production configuration.
- Add release versioning and source maps.
- Monitor uptime, frontend errors, API latency, and workflows.
- Create deployment, rollback, incident, and recovery runbooks.
- Define service objectives and alert thresholds.
- Run post-deployment smoke tests.
- Practice rollback and incident response.
- Document ownership and escalation.

### Evaluation Checklist

- [ ] Staging matches production without sharing secrets.
- [ ] Every deployment has a release identifier.
- [ ] Smoke tests run after deployment.
- [ ] Rollback meets the recovery-time objective.
- [ ] Alerts are actionable and tested.
- [ ] Dashboards cover availability, errors, latency, and workflows.
- [ ] Another engineer can execute every runbook.
- [ ] Recovery assumptions are documented and tested.
- [ ] Rollback and incident drills pass.
- [ ] Product owner approves production readiness.

### Exit Evidence

- Monitoring dashboard.
- Release and rollback runbooks.
- Completed drills.
- Signed readiness checklist.

## Final 10/10 Release Gate

- [ ] Every phase checklist is complete.
- [ ] No unresolved critical or high defects exist.
- [ ] No unresolved critical or high security findings exist.
- [ ] A clean checkout builds successfully.
- [ ] All required CI checks pass.
- [ ] Critical workflows pass on supported browsers and mobile sizes.
- [ ] WCAG 2.2 AA evaluation passes.
- [ ] Performance budgets pass.
- [ ] Staging smoke tests pass.
- [ ] Rollback drill passes.
- [ ] Remaining risks are documented, owned, and accepted.

## Recommended Sequence

1. Architecture and feature boundaries.
2. Testing foundation.
3. Design system completion.
4. CSS architecture.
5. Accessibility.
6. Error resilience.
7. Security.
8. Performance and scale.
9. CI quality gates.
10. Production operations.

## Phase Review Template

- Phase:
- Review date:
- Reviewer:
- Checklist completion:
- Tests added:
- Evidence:
- Open defects:
- Accepted risks:
- Current rating:
- Decision: Pass / Conditional pass / Fail
- Next phase:

## Amended Recovery Plan: 6.2/10 to 10/10

Amendment date: 2026-08-01
Baseline evidence: `QUALITY_EVALUATION_2026-08-01.md`
Current evidence-backed rating: **6.2/10**

This amendment replaces the original recommended sequence with a dependency-driven recovery plan. A phase is complete only when its evaluation gate passes and its evidence is committed. Passing a linter or build alone does not complete a phase.

### Current Blockers

| Blocker                        |         Measured baseline |                                         Required result |
| ------------------------------ | ------------------------: | ------------------------------------------------------: |
| Dashboard composition          |               2,503 lines |                                         Under 350 lines |
| Largest feature components     |             359-888 lines |                 Under 350 lines or documented exception |
| Global stylesheet              |               6,863 lines |        Split into owned layers within agreed thresholds |
| Line coverage                  |                    15.64% |                                            At least 85% |
| Statement coverage             |                    13.34% |                                            At least 85% |
| Branch coverage                |                    18.08% |                                            At least 80% |
| Function coverage              |                    10.07% |                                            At least 85% |
| Authenticated browser coverage |           Not established |                    Every critical role workflow covered |
| High dependency findings       | 5 reported during install |                  Zero unresolved high/critical findings |
| Performance evidence           |           Not established |                             CWV and bundle budgets pass |
| Hosted/operational evidence    |           Not established | CI, staging, monitoring, smoke, and rollback gates pass |

### Workstream A: Architecture Foundation

**Priority:** P0

1. Extract `BookingWorkspace`, `AreaFieldsView`, `UsersView`, upload workflows, and overlay orchestration from `booking-dashboard.jsx`.
2. Create public feature entry points for bookings, users, reconciliation, onboarding, and email.
3. Move feature data loading and mutations into hooks and service modules.
4. Move role permissions into a tested authorization-policy module.
5. Remove state that can be derived and migrate away from the temporary `react-hooks/set-state-in-effect` exception.
6. Add dependency-cycle and module-size checks to CI.

**Evaluation:**

- [ ] Dashboard shell is under 350 lines.
- [ ] Every feature component is under 350 lines or has an approved explanation.
- [ ] Presentation components do not call APIs directly.
- [ ] Feature imports follow documented ownership boundaries.
- [ ] Zero circular dependencies.
- [ ] Existing unit, component, and browser tests pass.

**Evidence:** module-size report, dependency graph, role behavior matrix, build and test output.

### Workstream B: Test and Coverage Closure

**Priority:** P0; begins alongside each architecture extraction.

1. Add deterministic fixtures for Admin, Area Manager, Regional Manager, dealer, and unauthorized users.
2. Unit-test filters, pagination, role policies, payload mapping, imports, exports, and error normalization.
3. Component-test every shared primitive and major feature state.
4. Integration-test success, validation failure, timeout, offline behavior, cancellation, session expiry, and retry.
5. Add authenticated Playwright journeys for booking search/details/update, imports, user administration, onboarding, email templates, provider setup, and delivery.
6. Run the suite repeatedly to detect order dependencies and flakes.

**Evaluation:**

- [ ] Statements, lines, and functions are at least 85%; branches are at least 80%.
- [ ] Every critical workflow and supported role has automated coverage.
- [ ] Failure and recovery paths are covered.
- [ ] Three consecutive CI runs pass without flakes.
- [ ] Test artifacts and coverage are published by CI.

**Evidence:** coverage report, workflow matrix, role matrix, CI run links, flaky-test report.

### Workstream C: Design System and CSS Decomposition

**Priority:** P1; starts after the corresponding feature boundary is stable.

1. Complete shared control states and migrate remaining composite controls where appropriate.
2. Split CSS into tokens, base, primitives, layout, and feature-owned styles.
3. Remove obsolete selectors and prohibit feature styles from targeting generic controls.
4. Add token and stylesheet-size enforcement.
5. Add UI Kit examples and desktop/mobile visual snapshots for every control state.

**Evaluation:**

- [ ] No ordinary native control exists outside a primitive or documented composite widget.
- [ ] No duplicate or unowned generic selector exists.
- [ ] Stylesheet and token checks pass.
- [ ] UI Kit covers every supported state.
- [ ] Visual snapshots pass at all supported breakpoints.

**Evidence:** raw-control audit, stylesheet report, token report, UI Kit and responsive snapshots.

### Workstream D: Accessibility and Resilience

**Priority:** P1.

1. Run Axe on every authenticated critical workflow.
2. Complete keyboard, focus, screen-reader, reduced-motion, high-contrast, and 200%/400% zoom reviews.
3. Standardize loading, empty, offline, timeout, unauthorized, and server-error experiences.
4. Add stale-response protection, safe-operation retry rules, and duplicate-submission prevention.
5. Integrate sanitized production error telemetry with release and correlation context.

**Evaluation:**

- [ ] Zero critical or serious Axe violations across critical workflows.
- [ ] Every workflow is keyboard operable and maintains correct focus.
- [ ] Forms expose labels, hints, errors, and async status programmatically.
- [ ] Failure injection proves feature isolation and recovery.
- [ ] Telemetry contains no credentials or personal content.

**Evidence:** Axe reports, keyboard checklist, screen-reader notes, zoom screenshots, failure-injection report, sanitized telemetry sample.

### Workstream E: Security Closure

**Priority:** P0 for high findings; otherwise P1.

1. Run the approved dependency audit and resolve all high/critical advisories.
2. Complete the formal frontend security scan when its capability preflight is ready.
3. Review backend authorization for every privileged frontend operation.
4. Verify upload type, size, content, and row limits server-side.
5. Verify OAuth state/callback handling, cookie policy, logout, expiry, and token storage.
6. Replace CSP `unsafe-inline` and `unsafe-eval` with nonces or hashes where supported.
7. Add server-side abuse controls for repeated mutations and email actions.

**Evaluation:**

- [ ] Zero unresolved critical/high dependency or security findings.
- [ ] Authorization matrix proves server enforcement.
- [ ] Upload and OAuth controls have automated negative tests.
- [ ] Security headers pass the approved policy scanner.
- [ ] No secret appears in source, bundles, logs, or browser storage.

**Evidence:** dependency report, security report, header scan, secret scan, authorization matrix, backend test output.

### Workstream F: Performance and Scale

**Priority:** P2 after architecture stabilizes.

1. Define route JavaScript, CSS, image, and request-count budgets.
2. Profile rendering and memoize only measured hot paths.
3. Add server pagination or virtualization for production-scale data.
4. Benchmark large tables, campaign histories, imports, filtering, and sorting.
5. Measure representative desktop and mobile Web Vitals.

**Evaluation:**

- [ ] LCP is at most 2.5 seconds, INP at most 200 milliseconds, and CLS at most 0.1 at p75.
- [ ] Every route remains within its bundle budget.
- [ ] Production-scale tables and imports remain within interaction budgets.
- [ ] No unnecessary repeated or obsolete request remains.

**Evidence:** Lighthouse/Web Vitals report, bundle report, React profile, large-data benchmark.

### Workstream G: CI and Production Readiness

**Priority:** P0 for CI enforcement; production validation is the final gate.

1. Run all existing quality checks in hosted CI and make them required.
2. Add coverage, browser, accessibility, security, secret, and bundle artifacts.
3. Protect `main` with review and required-status policies.
4. Establish staging parity, immutable release identifiers, source maps, monitoring, and actionable alerts.
5. Execute post-deployment smoke, rollback, incident, and recovery drills.
6. Record engineering, security, operations, and product approval.

**Evaluation:**

- [ ] Three consecutive hosted CI runs pass.
- [ ] A deliberately failing change demonstrates blocked merge behavior.
- [ ] Staging smoke and monitoring checks pass.
- [ ] Rollback meets the agreed recovery-time objective.
- [ ] Runbooks are executable by an engineer who did not author them.
- [ ] Accountable owners sign the final readiness checklist.

**Evidence:** CI links and artifacts, branch-protection configuration, monitoring screenshots, smoke results, completed drill records, signed readiness checklist.

### Delivery Order

1. Close high dependency findings and approve the security-audit path.
2. Execute architecture extraction with tests added per migrated feature.
3. Raise unit/component coverage while completing role fixtures.
4. Decompose CSS and finish design-system adoption feature by feature.
5. Expand authenticated browser, accessibility, and resilience coverage.
6. Complete backend security and authorization evidence.
7. Establish performance budgets and production-scale benchmarks.
8. Enforce every gate in hosted CI.
9. Validate staging, monitoring, smoke, rollback, and ownership.
10. Rerun the complete evaluation and claim 10/10 only when every release gate passes.

### Evaluation Cadence

After each workstream:

- Update `QUALITY_EVALUATION_2026-08-01.md` or create a dated successor.
- Record commands, results, artifact paths, defects, owners, and accepted risks.
- Recalculate the rating from evidence; do not increase it based on planned work.
- Keep a failed phase open until every mandatory checklist item passes.

### Definition of 10/10

The repository reaches 10/10 only when all repository-local gates pass and external evidence confirms backend authorization, dependency closure, hosted CI enforcement, WCAG 2.2 AA, performance budgets, staging health, monitoring, rollback, and accountable owner approval. No single local command can substitute for those independent checks.

## Execution Outcome - 2026-08-01

Repository-local implementation is complete and evidenced in `docs/evidence/frontend-local-completion-2026-08-01.md`.

### Passed Locally

- Architecture: 111 modules at or below 350 lines; zero cycles.
- Tests: 159 tests across 38 files; all coverage thresholds pass.
- Design/CSS: ownership, token, size, duplicate, Stylelint, and responsive gates pass.
- Accessibility: public and four-role Axe/keyboard checks pass.
- Security hardening: production CSP, secret scan, formula safety, and upload validation pass.
- Performance: production bundle and 10,000-row budgets pass.
- Build/runtime: production build passes and the local server returns HTTP 200.
- CI definition enforces local gates, dependency audit, browser tests, coverage, and artifacts.

### Still Required for 10/10

- Approved dependency/formal security reports and backend security evidence.
- Manual WCAG and deployed p75 Web Vitals.
- Hosted CI history, branch protection, staging, monitoring, drills, and owner approval.

Current evidence-backed ratings: **8.8/10 repository-local engineering; 7.9/10 release readiness**. No 10/10 claim is made until external gates pass.

## Superseding Verification Outcome - 2026-08-01

The earlier execution outcome is superseded by a complete rerun documented in `docs/evidence/frontend-local-completion-2026-08-01.md` and phase 1-10 evidence files.

### Repository-Local Result

- PASS: architecture, tests, coverage, design controls, CSS, formatting, accessibility automation, resilience, secret scanning, production build, bundle/scale budgets, visual regression, and full browser matrix.
- Current local engineering rating: **9.6/10**.
- Current release-readiness rating: **8.2/10**.

### Required Before a 10/10 Release Claim

- Independent dependency/security and backend authorization evidence.
- Manual assistive-technology/WCAG sign-off and deployed p75 Web Vitals.
- Hosted CI history and branch-protection enforcement.
- Staging, monitoring, smoke, rollback/incident drills, and owner approvals.

No supported application behavior was intentionally removed or changed during this work.
