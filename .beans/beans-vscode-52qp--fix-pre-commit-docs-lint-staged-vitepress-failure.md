---
# beans-vscode-52qp
title: Fix pre-commit docs lint-staged vitepress failure
status: completed
type: task
priority: high
branch: fix/52qp-precommit-vitepress-hook
created_at: 2026-03-14T01:55:11Z
updated_at: 2026-03-14T01:55:11Z
---

Fix pre-commit hook failure where lint-staged runs `vitepress build` with file arguments and crashes (`ENOTDIR ... docs/users/ai.md/.vitepress/.temp`). Keep docs checks, but make them robust with file-list invocation.

## Todo

- [x] Confirm current staged/working-tree state and branch
- [x] Update lint-staged docs command so vitepress build ignores appended file args
- [x] Run lint-staged repro check and ensure no ENOTDIR
- [x] Run compile + targeted tests
- [x] Summarize and close bean

## Summary of Changes

- Moved lint-staged config from `package.json` to `.lintstagedrc.mjs` to support function-based task definitions.
- Updated docs markdown handling so `vitepress build` runs without filename arguments (prevents `ENOTDIR .../.vitepress/.temp` failures).
- Kept markdown formatting by running `prettier --write` with the matched docs files in the same lint-staged task.
- Validated pre-commit behavior via staged-file lint-staged runs (`--allow-empty`) and confirmed no VitePress path crash.
