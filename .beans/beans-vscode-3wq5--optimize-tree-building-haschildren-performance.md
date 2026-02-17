---
# beans-vscode-3wq5
title: Optimize tree building hasChildren performance
status: completed
type: task
priority: normal
created_at: 2026-02-17T02:32:49Z
updated_at: 2026-02-17T22:30:19Z
---

The tree building still has O(n²) complexity for hasChildren checks. The cache optimization only covers hasInProgressDescendants but not hasChildren.

**Location:** src/beans/tree/BeansTreeDataProvider.ts

**Current:** hasChildren uses .some() which is O(n) per bean = O(n²) total
**Better:** Build parent->children map once, use O(1) lookups

**Performance:** Would improve tree building for large workspaces

## Summary of Changes

- Added a `childrenByParentCache` in `BeansTreeDataProvider` to index direct children by parent in one pass.
- Replaced per-item `hasChildren` O(n) scans with O(1) cache lookups.
- Replaced child retrieval for expanded nodes with cache lookups instead of filtering the full bean list.
- Consolidated tree performance cache rebuild into a single `rebuildCaches()` pass that updates both descendant and child caches.
- Added regression coverage in `BeansTreeDataProvider.test.ts` to verify hasChildren cache is rebuilt correctly when child relationships change across refreshes.
