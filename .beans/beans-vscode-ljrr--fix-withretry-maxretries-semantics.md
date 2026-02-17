---
# beans-vscode-ljrr
title: Fix withRetry maxRetries semantics
status: completed
type: bug
priority: low
created_at: 2026-02-17T03:33:53Z
updated_at: 2026-02-17T03:37:44Z
---

The withRetry method loop uses 'attempt <= maxRetries' which results in maxRetries+1 total attempts, but the parameter name suggests maxRetries attempts.

**Location:** src/beans/service/BeansService.ts:124-135

**Options:**
1. Rename parameter to maxAttempts to match behavior
2. Change loop to 'attempt < maxRetries' to match name
3. Update JSDoc to clarify it's retries after initial attempt

**Impact:** Misleading API naming, could cause incorrect retry behavior
