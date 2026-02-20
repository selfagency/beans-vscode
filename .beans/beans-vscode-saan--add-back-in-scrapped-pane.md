---
# beans-vscode-saan
title: Add back in scrapped pane
status: in-progress
type: task
priority: normal
branch: feature/beans-vscode-saan-add-back-scrapped-pane
created_at: 2026-02-20T05:56:32Z
updated_at: 2026-02-20T06:04:33Z
---

Restore the missing Scrapped pane for scrapped issues

## Todo

- [x] Add failing tests proving Scrapped pane registration and count-title updates
- [x] Add `beans.scrapped` view contribution back to `package.json`
- [x] Implement `ScrappedBeansProvider` and wire into `registerBeansTreeViews`
- [x] Add scrapped selection + filter wiring and include in refresh/title updates
- [x] Run focused tests, then compile validation
