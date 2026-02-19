---
# beans-vscode-uh4y
title: Fix Go version in remote testing and CodeQL race warning in release script
status: completed
type: bug
priority: high
branch: feature/beans-vscode-uh4y-go-version-and-release-race-fix
created_at: 2026-02-19T16:24:02Z
updated_at: 2026-02-19T16:24:02Z
---

## Todo
- [x] Create branch for fix work
- [x] Update remote test workflow Go version to support beans@latest on Windows
- [x] Remove exists-check TOCTOU pattern in release changelog update
- [x] Run targeted validation and push changes

## Summary of Changes
- Created branch `feature/beans-vscode-uh4y-go-version-and-release-race-fix`.
- Updated Go setup in remote testing workflow to `1.24.x` (plus cache key/restore-key alignment) for `beans@latest` compatibility.
- Updated Go setup in issue-to-bean workflow to `1.24.x` to avoid the same install break.
- Removed `existsSync` TOCTOU pattern in `scripts/release.mjs` changelog handling by switching to `readFileSync` with fallback in `catch`.
- Verified with `pnpm run compile`.
