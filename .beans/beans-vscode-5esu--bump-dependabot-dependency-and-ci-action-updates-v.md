---
# beans-vscode-5esu
title: Bump Dependabot dependency and CI action updates (vite 8, esbuild, lint-staged, codicons, actions)
status: completed
type: task
priority: high
created_at: 2026-04-06T13:06:14Z
updated_at: 2026-04-06T13:11:04Z
branch: chore/5esu-dependency-bumps
pr: 127
---

Apply requested Dependabot bumps in package dependencies and GitHub Actions workflows, refresh lockfile, and validate compile/tests.

## Todo
- [x] Inspect current versions in package.json and workflows
- [x] Bump requested dependencies and CI actions
- [x] Refresh lockfile
- [x] Run compile/tests
- [x] Summarize changes

## Summary of Changes
- Bumped `vite` from `^7.3.1` to the latest 8.x (`^8.0.5` after install resolution).
- Updated workflow actions:
  - `pnpm/action-setup` v4 -> v5 (ci, docs-deploy, release, remote-test)
  - `codecov/codecov-action` v5 -> v6 (ci)
  - `actions/configure-pages` v5 -> v6 (docs-deploy)
  - `actions/deploy-pages` v4 -> v5 (docs-deploy)
- Refreshed `pnpm-lock.yaml` and validated with compile + tests.
- Not changed because already at/above requested targets:
  - `esbuild` is already `^0.28.0` (newer than 0.27.5)
  - `lint-staged` already `^16.4.0`
  - `@vscode/codicons` already `^0.0.45`
