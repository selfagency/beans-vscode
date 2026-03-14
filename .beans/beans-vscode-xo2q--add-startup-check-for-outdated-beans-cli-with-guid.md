---
# beans-vscode-xo2q
title: Add startup check for outdated Beans CLI with guided upgrade prompt
status: completed
type: feature
priority: high
created_at: 2026-03-13T20:00:35Z
updated_at: 2026-03-13T20:15:09Z
---

Extend extension startup checks to verify whether installed Beans CLI is latest. If outdated, prompt user to upgrade with guidance tailored to detected installation method (Homebrew, Go install, npm/npx, or generic). Begin implementation and tests.

## Todo

- [x] Add/update plan item for startup latest-version check
- [x] Implement Beans CLI version detection and latest release lookup
- [x] Infer install method and generate tailored upgrade actions
- [x] Integrate prompt into startup check flow
- [x] Add/update unit tests for detection and prompt gating
- [x] Run compile/tests and fix regressions

## Summary of Changes

Implemented startup-time Beans CLI update checks and guided upgrade prompts.

- Added CLI metadata helpers in `BeansService`:
  - `getCLIVersion()`
  - `detectCLIInstallMethod()` (`brew`, `go`, or `unknown`)
- Added startup check in `activate()` that:
  - compares installed CLI version against latest GitHub release
  - prompts only when installed version is older
  - avoids repeated prompts for the same installed/latest pair via workspace state
- Added install-method-aware actions:
  - Homebrew: opens terminal and runs `brew upgrade hmans/beans/beans`
  - Go install: opens terminal and runs `go install github.com/hmans/beans@latest`
  - Unknown: opens installation instructions URL
- Added/updated tests for:
  - service CLI metadata helpers
  - startup upgrade prompt behavior
  - activation/lifecycle mocks to include new service methods

Validation:
- Targeted tests: passing
- `pnpm run compile`: passing
