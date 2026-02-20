---
# beans-vscode-saan
title: Add back in scrapped pane
status: completed
type: task
priority: normal
created_at: 2026-02-20T05:56:32Z
updated_at: 2026-02-20T13:53:43Z
---

Restore the missing Scrapped pane for scrapped issues

## Todo

- [x] Add failing tests proving Scrapped pane registration and count-title updates
- [x] Add `beans.scrapped` view contribution back to `package.json`
- [x] Implement `ScrappedBeansProvider` and wire into `registerBeansTreeViews`
- [x] Add scrapped selection + filter wiring and include in refresh/title updates
- [x] Run focused tests, then compile validation
