---
# beans-vscode-x5ez
title: Use specific error types in BeansService
status: scrapped
type: task
priority: low
created_at: 2026-02-17T03:46:12Z
updated_at: 2026-02-17T05:06:15Z
---

BeansService could throw more specific error types beyond BeansCLINotFoundError and BeansTimeoutError for better error handling.

Examples:
- BeansWorkspaceNotInitializedError
- BeansInvalidConfigError  
- BeansCLIVersionMismatchError
- BeansNetworkError

This would allow consumers to handle different error scenarios appropriately.



Duplicate of beans-vscode-m886; keeping beans-vscode-m886 as the canonical open issue.
