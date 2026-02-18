---
# beans-vscode-lpcb
title: Recursive Status Propagation
status: completed
type: feature
priority: high
created_at: 2026-02-18T20:58:04Z
updated_at: 2026-02-18T21:00:50Z
---

Implement recursive status propagation from parent beans to their children. When a parent status changes (e.g., closed, moved out of draft, reopened), all children should be updated to match, ensuring consistency across the task hierarchy. Includes updating BeansService.ts and expanding unit tests.
