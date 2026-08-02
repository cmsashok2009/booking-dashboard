# Quality Report: Reconciliation Heatmap Help

- Date: 2026-08-01
- Reviewer/agent: Codex
- Changed surface: Reconciliation heatmap explanation, accessible description, and tooltip placement
- Overall gate: `PASS`

| ID | Status | Severity | Validation method | Evidence | Notes/owner |
|---|---|---|---|---|---|
| UX-001 | PASS | High | Content review | Subtitle now explains comparison purpose | Heatmap goal is clear before interaction |
| UX-003 | PASS | Medium | Browser visual review | Short explanation is visible; detailed guidance remains in tooltip | Detail does not obstruct the chart |
| UX-013 | PASS | High | Semantic review | Heatmap has an accessible `role="img"` description | Meaning is available beyond color and layout |
| UX-014 | PASS | High | Focus-state browser review | Tooltip opens through `:focus-within` and uses an accessible trigger | Mouse and keyboard paths are retained |
| UX-025 | PASS | Medium | Browser content review | “How to read” guidance appears directly below the map | Guidance is available at the decision point |
| UI-010 | PASS | High | Narrow-width browser test | Bottom tooltip width is viewport-aware and aligned back into the card | Placement works at 304px viewport width |
| UI-011 | PASS | High | Tooltip bounds inspection | Tooltip bounds were 22px–301px in a 304px viewport | Tooltip is not clipped by the heatmap card |
| UI-012 | PASS | Medium | Narrow-width screenshot review | Guidance and tooltip text wrap without truncation | Full explanation remains readable |
| UI-015 | PASS | High | CSS and focus review | Existing visible focus treatment remains on the info trigger | No focus regression introduced |
| UI-024 | PASS | High | Chart meaning review | Text identifies rows, columns, counts, and darker-color meaning | Color intensity is explained explicitly |
| UI-025 | PASS | Medium | In-app browser screenshot | Heatmap and open tooltip captured at narrow width in this task | No overlap with the preceding card |

## Automated Verification

- Command: `npm run build`
- Result: PASS; Next.js production build and TypeScript validation completed successfully.

## Browser Verification

- Desktop: Tooltip opens below the heatmap title instead of above the card.
- Narrow viewport: PASS at 304px; tooltip remained within viewport bounds.
- Keyboard/focus: PASS through the shared focus-within interaction.
- Console/hydration: No issue observed during live update and tooltip interaction.

## Limitations and Follow-up

- The dashboard has pre-existing narrow-width overflow from other wide data surfaces; this change prevents the heatmap tooltip from adding overflow and does not alter unrelated tables.
