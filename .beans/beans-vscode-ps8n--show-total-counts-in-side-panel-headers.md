---
# beans-vscode-ps8n
title: Show total counts in side panel headers
status: completed
type: feature
priority: normal
branch: feature/beans-vscode-ps8n-show-total-counts-side-panel-headers
pr: 57
created_at: 2026-02-19T19:12:35Z
updated_at: 2026-02-20T04:43:17Z
---

Display aggregate totals in side panel headers, e.g. DRAFTS (x), OPEN BEANS (x), COMPLETED (x), SEARCH (x), and keep counts in sync with filters/refresh.

## Todo

- [x] Add failing tests that assert view header titles include counts for Draft/Open/Completed/Search.
- [x] Extend tree/search providers to expose current visible item totals after filters are applied.
- [x] Update tree/search view registration to set dynamic view titles (`NAME (count)`) on initial load.
- [x] Keep titles synchronized on refresh/filter events (`beans.refreshAll`, watcher refresh, and search filter changes).
- [x] Add a user setting to toggle whether side panel headers display counts.
- [x] Verify no regressions in malformed-draft warning and details selection behavior.

## Validation checkpoints

- [x] Red: new/updated tests fail for missing header counts.
- [x] Green: tests pass after dynamic title updates are implemented.
- [x] Safety: run compile and targeted test suites for tree/search/activation wiring.
