---
# beans-vscode-37dj
title: Expand error handlers in handleBeansError
status: completed
type: task
priority: normal
created_at: 2026-02-17T05:00:05Z
updated_at: 2026-02-17T05:01:23Z
---

Add handlers for validation, permission, and config errors to handleBeansError

## Summary of Changes

Added handlers for all Beans error types:
- BeansConfigMissingError: Shows init guidance with Learn More link
- BeansPermissionError: Shows actionable permission message
- BeansConcurrencyError: Offers Refresh button to reload
- BeansIntegrityCheckFailedError: Shows output log for debugging

All error types now provide:
- Specific user-facing messages
- Actionable next steps
- Appropriate severity (error vs warning)

Commit: a1c91ba
