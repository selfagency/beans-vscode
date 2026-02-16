---
# beans-vscode-98r5
title: Unit tests
status: completed
type: task
priority: normal
created_at: 2026-02-16T04:05:02Z
updated_at: 2026-02-16T16:25:34Z
parent: beans-vscode-xwzf
---

Write unit tests for tree shaping/sorting/filtering, command argument mapping, config parsing/defaults, and error mapping

## Summary of Changes

- Switched default test runner to Vitest (`pnpm test` now runs `vitest run`).
- Added `test:watch` and `test:integration` scripts for unit-watch and legacy VS Code integration runs.
- Added `vitest.config.ts` with aliasing for `vscode` to a local test mock.
- Added `src/test/mocks/vscode.ts` to support Node-based unit tests.
- Migrated all existing tests under `src/test/**/*.test.ts` from Mocha-style `suite/test` + Node assert to Vitest `describe/it` + `expect`.
- Verified with `pnpm run check-types`, `pnpm run lint`, and `pnpm test` (43 passing tests).
