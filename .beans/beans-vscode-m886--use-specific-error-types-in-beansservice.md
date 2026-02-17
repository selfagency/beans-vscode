---
# beans-vscode-m886
title: Use specific error types in BeansService
status: todo
type: task
priority: low
created_at: 2026-02-17T02:32:48Z
updated_at: 2026-02-17T02:32:48Z
---

BeansService should throw specific error types (like BeansCLINotFoundError) instead of generic errors for better error handling.

**Location:** src/beans/service/BeansService.ts various error paths

**Examples:**
- CLI not found -> BeansCLINotFoundError
- CLI unavailable in offline mode -> more specific than generic Error

**Benefit:** Callers can handle specific error cases appropriately
