---
# beans-vscode-bj0o
title: "Cache beans in memory for sidebar loading"
status: completed
type: task
priority: high
branch: feat/bj0o-cache-beans-in-memory
pr: 129
created_at: 2026-04-06T14:29:18Z
updated_at: 2026-04-06T14:42:02Z
---

Improve sidebar startup and refresh performance by caching bean file data in memory. Keep cached beans until their file timestamp changes or extension actions mutate those beans.

## Todo
- [x] Inspect tree loading path and identify the right cache boundary
- [x] Implement an in-memory bean cache keyed by bean file path with timestamp-based invalidation
- [x] Invalidate or update cached entries after extension actions that mutate those beans
- [x] Add regression tests for cache hits, timestamp invalidation, and mutation invalidation
- [x] Verify compile/tests still pass

## Summary of Changes

- Added a timestamp-aware warm cache in `BeansService` so full bean lists stay in memory until bean markdown file mtimes or sizes change.
- Added `workspaceState` persistence so the cache can survive a VS Code window reload and skip the initial CLI scan when the workspace bean files are unchanged.
- Kept search and parent-targeted queries on the CLI path for correctness, while status/type sidebar loads now reuse the shared cached snapshot.
- Invalidated the cache after create/update/delete and batch mutations.
- Added regression tests for in-memory reuse, timestamp invalidation, mutation invalidation, and workspaceState warm-start restoration.
- Verified with `pnpm run compile` and full Vitest suite.
