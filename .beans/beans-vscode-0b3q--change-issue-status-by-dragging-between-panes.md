---
# beans-vscode-0b3q
title: Change issue status by dragging between panes
status: completed
type: feature
priority: normal
created_at: 2026-02-21T00:46:02Z
updated_at: 2026-02-24T13:30:00Z
---
 
## Summary of Changes

- Added `targetStatus` and `nativeStatuses` constructor params to `src/beans/tree/BeansDragAndDropController.ts`.
- Cross-pane drops are detected when `targetStatus !== null && bean.status` is not in `nativeStatuses`.
- Background drop on a pane: shows modal confirmation and updates bean status via `BeansService.updateBean`.
- Drop on another bean: shows prompt with options `Change Status Only` and `Change Status & Move to <code>`; the Move path runs type and cycle validation before updating parent and status.
- Each tree view now receives its own `BeansDragAndDropController` instance (per-pane wiring in `src/beans/tree/registerBeansTreeViews.ts`).
- Added unit tests for cross-pane behavior and serialized DataTransfer encodings; tests cover status-only, status+move, validation failures, and serialization fallbacks.

All changes are covered by unit tests and the branch has a draft PR open for review.

