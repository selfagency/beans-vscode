---
# beans-vscode-uo8r
title: Optimize markAncestorsHaveInProgressDescendants with id->bean map
status: completed
type: bug
priority: normal
created_at: 2026-02-17T03:33:53Z
updated_at: 2026-02-17T03:37:44Z
---

The markAncestorsHaveInProgressDescendants method does a linear this.beans.find() for each ancestor, making cache rebuild O(n²) in common cases.

**Location:** src/beans/tree/BeansTreeDataProvider.ts:214-219

**Fix:** Build an id->bean map once in rebuildInProgressCache and use it for O(1) lookups instead of repeated find() calls. Also consider iterative loop instead of recursion to avoid deep call stacks.

**Impact:** Performance degradation with deep hierarchies
