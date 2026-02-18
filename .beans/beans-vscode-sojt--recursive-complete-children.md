---
# beans-vscode-sojt
title: Recursive complete children
status: in-progress
type: epic
priority: high
created_at: 2026-02-18T22:03:04Z
updated_at: 2026-02-18T22:03:17Z
branch: feature/beans-vscode-aiks-recursive-complete-children
---

Implement recursive status propagation from parent to all children in BeansService. Ensure idempotency and bulk operations for efficiency.

## Todo

- [ ] Implement `recurseChildren` in `BeansService` (beans-vscode-sxwd)
- [ ] Implement recursive status propagation in `updateBean` (beans-vscode-cu1c)
- [ ] Add unit tests for recursion and idempotency (beans-vscode-lgkl)
- [ ] Verify performance for deeply nested hierarchies
- [ ] Add recursive status tools to `BeansMcpServer`
