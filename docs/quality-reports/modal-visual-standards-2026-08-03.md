# Quality Report: Modal Visual Standards

- Date: 2026-08-03
- Reviewer/agent: Codex
- Changed surface: shared blocked-action dialog, CSS ownership, UI/UX agent gates, browser regression
- Overall gate: `PASS`

## Root Cause

The dependency dialog used `confirmation-modal` styling defined in `06-email-templates.css`, but that stylesheet was not imported by `globals.css`. Production therefore rendered the generic `.modal` fallback at up to 90vw/1380px, producing the oversized dialog, detached warning mark, weak hierarchy, and detail-label collision shown by the user.

## Applicable Controls

| ID | Status | Severity | Validation method | Evidence |
| --- | --- | --- | --- | --- |
| UI-001 | PASS | Medium | CSS/design-system gate | Warning, surface, border, text, overlay, and shadow use shared tokens. |
| UI-003 | PASS | Medium | Browser and CSS inspection | Eyebrow, title, body, detail label/value, and actions have distinct hierarchy. |
| UI-004 | PASS | Medium | Shared control inspection | Header, body, detail, and footer use stable shared spacing. |
| UI-005 | PASS | Medium | Component inspection | Reuses `ModalShell`, `CloseButton`, and `Button`; feature styling is owned by imported `13-dialogs.css`. |
| UI-010 | PASS | High | Desktop/mobile Playwright | Width is capped at 520px; mobile uses viewport-safe insets and stacked full-width actions. |
| UI-011 | PASS | High | Browser geometry assertions | Dialog/detail stay inside viewport/content; footer follows content with no overlap. |
| UI-013 | PASS | High | Token review and Axe | Warning state has icon/text support and no serious/critical Axe violations. |
| UI-015 | PASS | High | Dialog lifecycle/browser | Safe initial focus, visible controls, focus trap/return, and Escape behavior pass. |
| UI-017 | PASS | High | Contract gate and Playwright | Bounded width/height, upper placement, scroll behavior, close paths, and mobile rules pass. |
| UI-020 | PASS | High | Semantic inspection | `alertdialog`, associated title/description, and semantic `dl` dependency context are present. |
| UI-025 | PASS | Medium | Browser screenshots | Desktop/mobile screenshots regenerated under `frontend/docs/evidence/screenshots/`. |
| UX-009 | PASS | High | Copy/browser workflow | Copy explains cause, preserved state, prerequisite, and next action. |
| UX-012 | PASS | High | Workflow inspection | Modal appears only after a user-triggered deactivation conflict and performs no mutation. |
| UX-013 | PASS | High | Axe/semantic inspection | Meaningful title, description, detail label, and commands are programmatically exposed. |
| UX-015 | PASS | High | Browser lifecycle | Close button, Close action, Escape, focus trap, and focus return use shared lifecycle behavior. |
| UX-017 | PASS | Medium | Copy review | Labels are explicit: `Close` and `View Dealer Codes`. |
| UX-020 | PASS | High | Chromium projects | Complete conflict and recovery flow passes at desktop and mobile widths. |
| UX-023 | PASS | High | Browser recovery | Recovery opens Dealer Codes directly without losing or changing Region data. |

## Implementation

- Rebuilt `BlockingDependencyModal` as a compact, structured alert dialog with a warning header, readable body, semantic dependency detail, and stable action footer.
- Added a feature-specific backdrop and 520px desktop cap, upper-viewport placement, 80dvh maximum height, responsive mobile actions, tokenized warning colors, and reduced-motion handling.
- Added `backdropClassName` to `ModalShell` so modal variants can own presentation without duplicating lifecycle behavior.
- Moved shared dialog rules into imported `13-dialogs.css`; removed the misplaced duplicate block from the unimported email-template stylesheet.
- Added UI and UX Modal Gates to the repository skills.
- Added `check:modal-ux` to `check:design-system`. It fails when dialog CSS is not imported or when required bounded, responsive, reduced-motion, semantic, and safe-focus contracts disappear.

## Verification

- `npm run check:design-system`: PASS, including the new modal UX contract, 18-stylesheet architecture, control ownership, and Stylelint.
- `npm run lint`: PASS.
- `npm run check:architecture`: PASS; 133 modules are <=350 lines and the import graph is acyclic.
- `npm test`: PASS; 44 files, 202/202 tests.
- `npm run build`: PASS with Next.js 16.2.12 production output.
- Focused Playwright: PASS 2/2 on Chromium and mobile Chromium. Assertions cover width cap, upper placement, viewport containment, warning background, semantic detail layout, footer ordering, expected 409 handling, Axe, and direct recovery.
- Screenshots: `frontend/docs/evidence/screenshots/region-dependency-modal-chromium.png` and `region-dependency-modal-mobile-chromium.png`.

## Limitation

Windows ACL restrictions prevented a second inspection through the local image-viewer tool. Real-browser rendering, deterministic geometry/color/layout checks, accessibility checks, and screenshot capture all passed; no browser verification is missing.

## Deployment

- Rebuilt and restarted only the frontend service with the existing `.env.docker` configuration.
- `booking-dashboard-frontend-1`: running and healthy.
- Local frontend and public Cloudflare entry point: HTTP 200.
- Docker `npm ci` reported 2 moderate and 4 high dependency-audit findings already present in the lockfile. They are outside this visual component change and prevent treating this report as whole-application production approval.
