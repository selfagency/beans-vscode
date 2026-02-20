---
# beans-vscode-5flm
title: Add debug logging mode in extension settings
status: in-progress
type: feature
priority: normal
branch: feature/beans-vscode-5flm-add-debug-logging-mode
created_at: 2026-02-19T19:12:43Z
updated_at: 2026-02-20T03:57:32Z
---

Add an extension setting to enable debug logging that includes fuller diagnostics such as GraphQL queries and CLI responses.

## Todo

- [ ] Add a new boolean setting to enable diagnostic debug mode in extension configuration
- [ ] Wire debug mode into logger/service execution paths for GraphQL and CLI diagnostics
- [ ] Add/update unit tests for config + logging behavior
- [ ] Compile and run focused tests, then full test suite checkpoints
