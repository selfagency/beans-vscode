---
# beans-vscode-3wq5
title: Optimize tree building hasChildren performance
status: todo
type: task
priority: normal
created_at: 2026-02-17T02:32:49Z
updated_at: 2026-02-17T02:32:49Z
---

The tree building still has O(n²) complexity for hasChildren checks. The cache optimization only covers hasInProgressDescendants but not hasChildren.

**Location:** src/beans/tree/BeansTreeDataProvider.ts

**Current:** hasChildren uses .some() which is O(n) per bean = O(n²) total
**Better:** Build parent->children map once, use O(1) lookups

**Performance:** Would improve tree building for large workspaces
