---
# beans-vscode-an5a
title: Update README badges labels and version format
status: completed
type: task
priority: normal
branch: feature/an5a-update-readme-badges
created_at: 2026-02-19T19:12:37Z
updated_at: 2026-02-19T20:50:14Z
pr: https://github.com/selfagency/beans-vscode/pull/50
---

Update README badges so version labels use capital V, rename display label CI to Tests, and rename Remote Compatibility display label to Remote Tests (display name change only).

## Todo

- [x] Add failing tests that assert the README badge strings (TDD)
- [x] Update `README.md`: `label=version` → `label=Version`, alt text `CI` → `Tests`, `Remote Compatibility` → `Remote Tests`
- [x] Update workflow display names: `CI` → `Tests`, `Remote Compatibility Tests` → `Remote Tests`
- [x] Run full test & build locally (compile + lint + vitest)
- [x] Push branch & open PR
- [x] Update PR description and bean summary; mark bean `completed` on merge

## Summary of changes

- Added unit tests to assert README badge labels (`src/test/readme/readme-badges.test.ts`).
- Updated `README.md` badge labels and added Codecov badge.
- Renamed workflows: `CI` → `Tests`, `Remote Compatibility Tests` → `Remote Tests` (workflow display names only).
- Added Codecov upload step to CI (`.github/workflows/ci.yml`).
- All unit tests pass locally; branch pushed to `feature/an5a-update-readme-badges` and PR created (#50).

## Result

Work complete for this task; marking bean as `completed`.
