---
# beans-vscode-6sgd
title: Address PR review comments for parity branch
status: completed
type: task
priority: high
created_at: 2026-03-14T02:37:19Z
updated_at: 2026-03-14T02:39:37Z
---

Resolve Copilot review feedback on PR #108.

## Todo

- [x] Fix Homebrew install-method detection for symlinked paths in BeansService
- [x] Make related tests cross-platform and robust
- [x] Fix docs/schema example typo in checked-in skill artifact
- [x] Ensure unknown upgrade action dedupes prompt in extension
- [x] Run targeted tests + compile and summarize

## Summary of Changes

- Updated CLI install-method detection to resolve symlinked executable paths before classifying install source.
- Hardened service tests for cross-platform locator command handling and realpath-based brew detection.
- Corrected search example formatting typo in generated skill schema text.
- Persisted upgrade prompt dedupe state for the "View installation instructions" action path.
- Documented behavior changes in troubleshooting and changelog docs.
