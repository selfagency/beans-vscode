---
# beans-vscode-alpk
title: Fix search icons not visible in dark mode
status: completed
type: bug
priority: normal
created_at: 2026-02-17T07:50:11Z
updated_at: 2026-02-17T12:50:12Z
---

Search result and/or search view icons are not rendering with sufficient contrast in VS Code dark themes, making them hard or impossible to see.

## Reproduction
1. Switch VS Code to a dark theme.
2. Open the Beans search view.
3. Observe search-related icons in results/toolbar.

## Expected
Icons remain visible and meet contrast expectations across dark themes.

## Actual
Icons appear too dark/low-contrast and are difficult to see.

## Notes
- Validate icon color token usage against theme-aware codicon/theming guidance.
- Add/adjust tests if feasible for icon rendering logic where applicable.

## Summary of Changes
- Updated search bar icon styling to use a gray theme token (`--vscode-descriptionForeground`) for both magnifying glass and filter controls.
- Changed the filter glyph to an empty/outline funnel icon for clearer visual intent.
- Kept interactions and accessibility labels unchanged.
- Verified with focused unit tests and full compile (typecheck + lint + build).

### Follow-up: lighter gray in dark mode
- Added a dark-theme-specific override for search and filter icons so they render in a lighter gray (`--vscode-input-foreground`) when VS Code uses dark themes.
- Kept neutral gray (`--vscode-descriptionForeground`) for non-dark themes.
