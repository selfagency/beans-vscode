---
# beans-vscode-4t7m
title: Expand chat followup prompts
status: completed
type: task
priority: normal
created_at: 2026-02-16T16:35:53Z
updated_at: 2026-02-16T16:37:02Z
---

Add richer Beans chat followup prompts for create issue, priority, stale issues, and issue-related commit guidance.

## Summary of Changes

- Replaced chat followups with richer issue-management prompts: top priority, stale issues, create issue, and issue-related commit guidance (plus summary).
- Added corresponding chat commands in manifest: priority, stale, create, and commit.
- Implemented handlers in BeansChatIntegration for these commands with workspace-aware outputs.
- Updated README to reflect expanded chat capabilities.
- Verified compile and tests pass (44 tests).
