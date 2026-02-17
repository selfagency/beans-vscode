---
# beans-vscode-f3bv
title: Fix offline mode filtering in listBeans
status: in-progress
type: bug
priority: high
created_at: 2026-02-17T02:32:43Z
updated_at: 2026-02-17T02:33:03Z
---

The offline mode in listBeans returns cached data without applying filters (status, type, search). This breaks the tree view when offline as it shows all beans regardless of the requested filter.

**Location:** src/beans/service/BeansService.ts:325+

**Expected:** Apply the same filter logic to cached beans as to fresh CLI results
**Actual:** Returns unfiltered cachedBeans directly

**Impact:** Tree view shows incorrect beans when in offline mode
