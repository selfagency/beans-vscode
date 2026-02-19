---
# beans-vscode-fn0f
title: Harden release git detection in pnpm/zx on Windows
status: completed
type: bug
priority: high
branch: main
created_at: 2026-02-19T15:41:06Z
updated_at: 2026-02-19T15:41:06Z
---

## Todo
- [x] Reproduce git-detection behavior in zx runtime context
- [x] Replace brittle git check with robust cross-platform detection
- [x] Validate detection via pnpm exec zx probe
- [x] Commit and push fix

## Summary of Changes
- Reworked release-script git detection to resolve a concrete git executable path using `spawnSync` with `shell: false`, with `where`/`which` fallback.
- Switched all release-script git invocations to use the resolved executable path so behavior is consistent across Windows, macOS, and Linux shells.
- Verified detection approach inside `pnpm exec zx` runtime.
