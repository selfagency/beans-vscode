---
# beans-vscode-s2x9
title: Search bar icons missing (magnifying glass and filter)
status: completed
type: bug
priority: high
created_at: 2026-02-17T12:36:34Z
updated_at: 2026-02-17T12:39:09Z
---

## Problem
The search bar no longer shows the magnifying glass and filter icons, reducing discoverability and expected UI affordances.

## Expected
- Search bar shows the magnifying glass icon.
- Search bar shows the filter icon.
- Icons remain visible in supported themes.

## Tasks
- [x] Reproduce and identify regression source
- [x] Implement fix for icon rendering
- [x] Verify compile/tests pass
- [x] Validate in VS Code UI

## Summary of Changes
- Replaced search and filter codicon-font rendering in the search bar with inline SVG icons to avoid missing icon regressions when codicon font resources fail to load.
- Updated search webview resource roots and removed codicon stylesheet dependency for this view.
- Updated and passed search view provider unit tests.
- Verified project compile/check-types/lint pass via the compile task.
