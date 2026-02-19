---
# beans-vscode-fgsh
title: Fix normalizeBean crash on malformed bean markdown and add .fixme fallback
status: in-progress
type: bug
priority: high
created_at: 2026-02-19T16:44:24Z
updated_at: 2026-02-19T16:49:28Z
---

## Context
Users see `Failed to fetch beans` when a bean parsed from markdown is missing required fields (`id`, `title`, `status`, or `type`). This currently aborts list/fetch flows.

## Goal
1. Prevent a single malformed bean from breaking bean fetch/list operations.
2. Add a remediation flow for malformed markdown: attempt an automatic markdown repair when possible.
3. If repair is not possible, rename the bean file extension to `.fixme` so it is excluded and visibly flagged.

## Todo
- [x] Reproduce and locate the normalize/list failure path
- [x] Implement tolerant handling so malformed beans are skipped/quarantined instead of throwing globally
- [x] Implement markdown auto-fix attempt for malformed bean files
- [x] Rename unrecoverable malformed files to `.fixme`
- [x] Add/adjust tests for malformed-bean handling and fixme rename behavior
- [x] Run compile/tests and verify no regressions

## Summary of Changes
- Updated `BeansService.listBeans` to handle per-bean normalization failures without aborting full fetch.
- Added malformed-bean repair flow that infers missing required fields and writes corrected frontmatter when possible.
- Added quarantine flow that renames unrecoverable malformed bean files to `.fixme`.
- Added unit tests for both auto-repair and quarantine behavior and validated with Vitest.
