---
# beans-vscode-3y8z
title: Fix parent completion cascade by querying children with correct parent filter
status: completed
type: bug
priority: high
created_at: 2026-04-17T22:57:43Z
updated_at: 2026-04-17T22:59:23Z
---

## Todo
- [x] Confirm root cause and impacted call paths
- [x] Implement fix for child lookup during status cascade
- [x] Update/add tests to cover real GraphQL parent filter key
- [x] Run compile and focused tests
- [x] Update docs if behavior notes are needed (no user-facing docs changes required)

## Notes
User request: when a parent is completed, all children should become completed.

## Summary of Changes
- Fixed child lookup in `BeansService` status propagation by using GraphQL `BeanFilter.parentId` (instead of `parent`).
- Updated recursive status propagation tests to assert and mock `filter.parentId`.
- Verified by running focused tests (which include compile + lint in pretest).
