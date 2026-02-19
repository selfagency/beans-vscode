---
# beans-vscode-an5a
title: Update README badges labels and version format
status: in-progress
type: task
priority: normal
branch: feature/an5a-update-readme-badges
created_at: 2026-02-19T19:12:37Z
updated_at: 2026-02-19T20:22:30Z
pr: https://github.com/selfagency/beans-vscode/pull/50
---

Update README badges so version labels use capital V, rename display label CI to Tests, and rename Remote Compatibility display label to Remote Tests (display name change only).

## Todo
- [x] Add failing tests that assert the README badge strings (TDD)
- [x] Update `README.md`: `label=version` → `label=Version`, alt text `CI` → `Tests`, `Remote Compatibility` → `Remote Tests`
- [x] Update workflow display names: `CI` → `Tests`, `Remote Compatibility Tests` → `Remote Tests`
- [ ] Run full test & build locally (compile + lint + vitest)
- [ ] Push branch & open PR
- [ ] Update PR description and bean summary; mark bean `completed` on merge

## Summary of changes (in progress)
- WIP: test + README changes (branch: `feature/an5a-update-readme-badges`)
