---
# beans-vscode-aiks
title: 'feat: recursive complete children when parent is completed'
status: completed
type: task
priority: normal
created_at: 2026-02-18T20:09:40Z
updated_at: 2026-02-18T21:15:00Z
branch: feature/beans-vscode-aiks-recursive-complete-children
---

When a parent bean is updated to status 'completed', all children should also be automatically updated to 'completed'.

## Todo

- [x] Research `BeansService` and how it handles updates.
- [x] Write failing test for recursive completion in `BeansService.test.ts`.
- [x] Implement recursive status update in `BeansService.ts`.
- [x] Verify fix with tests.

## Summary of Changes

- Updated `BeansService.listBeans` to support parent ID filtering via the `--parent` flag.
- Implemented recursive completion in `BeansService.updateBeanWithConfig`: when a bean is marked as `completed`, it now fetches all child beans and recursively updates them to `completed` if they aren't already terminal (completed/scrapped).
- Added comprehensive unit tests in `src/test/beans/service/BeansService.test.ts` to verify recursive behavior and ensure no infinite loops occur.
