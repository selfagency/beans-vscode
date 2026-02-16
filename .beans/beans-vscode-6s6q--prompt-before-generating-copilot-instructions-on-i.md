---
# beans-vscode-6s6q
title: Prompt before generating Copilot instructions on init
status: completed
type: task
priority: normal
created_at: 2026-02-16T17:02:14Z
updated_at: 2026-02-16T17:03:16Z
---

Add confirmation dialog during Beans init flow asking whether to generate Copilot instructions before creating files.

## Summary of Changes

- Added a confirmation dialog during init flows before generating Copilot instructions file.
- Applied the prompt in both init entry points: command-based init and initialization prompt flow.
- Kept generation gated by beans.ai.enabled and skipped generation when user selects Skip.
- Verified compile and tests pass (46 tests).
