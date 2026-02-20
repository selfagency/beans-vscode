---
# beans-vscode-9386
title: Offer Beans installation during initialization by OS
status: completed
type: feature
priority: normal
created_at: 2026-02-19T19:12:44Z
updated_at: 2026-02-20T05:13:47Z
---

During initialization, if there is no beans present in the PATH, offer to install the Beans CLI automatically with OS-specific install paths/instructions for macOS, Linux, and Windows.

## Todo

- [x] Add OS-specific install actions in CLI-missing prompt.
- [x] Route init/beans.init CLI-not-found failures to install prompt.
- [x] Add activation integration coverage for OS-specific install actions.
- [x] Run targeted regression tests and compile.
- [x] Add summary and close out bean.

## Validation Checkpoints

- [x] Activation flow shows install actions including OS-specific labels when CLI is missing.
- [x] Initialization catches `BeansCLINotFoundError` and offers install actions.
- [x] Integration tests pass locally.
- [x] Compile remains green.

## Summary of Changes

- Added platform-aware install actions to the CLI-missing prompt with explicit options for macOS, Linux, and Windows.
- Reused the same install prompt path when initialization fails due to `BeansCLINotFoundError` (both startup init prompt and `beans.init` command path).
- Added activation integration coverage to verify that missing CLI surfaces OS-specific install actions.
- Verified with targeted regression tests (`extension-activation`, `BeansCommands`, `BeansService`) and successful `pnpm run compile`.
