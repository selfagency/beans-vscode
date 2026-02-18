---
# beans-vscode-aiks
title: 'feat: recursive complete children when parent is completed'
status: in-progress
type: task
priority: normal
created_at: 2026-02-18T20:09:40Z
updated_at: 2026-02-18T20:09:40Z
branch: feature/beans-vscode-aiks-recursive-complete-children
---

When a parent bean is updated to status 'completed', all children should also be automatically updated to 'completed'.

## Todo
- [ ] Research `BeansService` and how it handles updates.
- [ ] Write failing test for recursive completion in `BeansService.test.ts`.
- [ ] Implement recursive status update in `BeansService.ts`.
- [ ] Verify fix with tests.
