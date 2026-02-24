---
id: beans-vscode-ryj0
title: perf: cache BeansConfigManager as instance field instead of re-instantiating on every getConfig() call
status: in-progress
type: task
priority: high
parent: none
tags: []
blocking: []
blocked_by: []
---

## Problem

`BeansService.getConfig()` instantiates a new `BeansConfigManager` and reads from disk on every call. This causes repeated I/O on hot paths.

## Proposal

1. Add a private `configManager` instance field on `BeansService` and instantiate it once in the constructor.
2. Add a short TTL cache for the parsed `BeansConfig` (e.g. 5s) so repeated calls within the TTL return cached parsed value but changes on disk will be observed after TTL expiry.
3. Write unit tests (TDD): first write a failing test asserting `BeansConfigManager` is constructed only once and that `getConfig()` returns cached instance within TTL.

## Implementation notes

- Files to change:
  - `src/beans/service/BeansService.ts` (constructor + `getConfig()`)
  - `src/test/beans/service/getConfig.cache.test.ts` (new tests)

- Validation checkpoints (safe):
  - Tests: write failing test first, confirm it fails
  - Implement minimal code change, run focused tests
  - Run full test suite

## Progress

- This bean was created and set to `in-progress` as the first step.

