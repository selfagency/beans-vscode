---
# beans-vscode-m886
title: Use specific error types in BeansService
status: completed
type: task
priority: low
created_at: 2026-02-17T02:32:48Z
updated_at: 2026-02-17T22:42:49Z
---

BeansService should throw specific error types (like BeansCLINotFoundError) instead of generic errors for better error handling.

**Location:** src/beans/service/BeansService.ts various error paths

**Examples:**
- CLI not found -> BeansCLINotFoundError
- CLI unavailable in offline mode -> more specific than generic Error

**Benefit:** Callers can handle specific error cases appropriately

## Summary of Changes

- Identified one remaining generic error path in `BeansService.listBeans()` when CLI is unavailable and no cache exists.
- Replaced that generic `Error` with `BeansCLINotFoundError` so callers can reliably branch on typed Beans errors.
- Preserved the user-facing message text while attaching the original error as cause.
- Updated `BeansService` tests to assert typed error behavior for the offline/no-cache path.
- Validation: `BeansService.test.ts` passing and compile/typecheck/lint/build passing.
