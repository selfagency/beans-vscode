---
# beans-vscode-5flm
title: Add debug logging mode in extension settings
status: in-progress
type: feature
priority: normal
branch: feature/beans-vscode-5flm-add-debug-logging-mode
pr: 55
created_at: 2026-02-19T19:12:43Z
updated_at: 2026-02-20T04:09:05Z
---

Add an extension setting to enable debug logging that includes fuller diagnostics such as GraphQL queries and CLI responses.

## Todo

- [x] Add a new boolean setting to enable diagnostic debug mode in extension configuration
- [x] Wire debug mode into logger/service execution paths for GraphQL and CLI diagnostics
- [x] Add/update unit tests for config + logging behavior
- [x] Compile and run focused tests, then full test suite checkpoints
- [x] Address patch-coverage review feedback for diagnostics-mode changes
