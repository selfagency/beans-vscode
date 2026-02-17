---
# beans-vscode-iwse
title: Rethrow typed errors in offline mode
status: completed
type: bug
priority: low
created_at: 2026-02-17T03:33:54Z
updated_at: 2026-02-17T03:38:55Z
---

When CLI is unavailable and no valid cache exists, listBeans throws a generic Error instead of preserving the original typed error (BeansCLINotFoundError/BeansTimeoutError).

**Location:** src/beans/service/BeansService.ts:373-375

**Impact:** Breaks downstream typed error handling for install/configure actions

**Fix:** Either rethrow original error or use Error cause property
