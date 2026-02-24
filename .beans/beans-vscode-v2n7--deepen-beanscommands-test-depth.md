---
# beans-vscode-v2n7
title: Deepen BeansCommands test depth
status: scrapped
type: task
priority: high
created_at: 2026-02-17T03:25:40Z
updated_at: 2026-02-24T16:05:30Z
---

Expand BeansCommands test coverage beyond broad unit mocks:

- Add command-palette/integration-style tests for each registered command.
- Cover advanced QuickPick interaction paths (`createQuickPick` button toggles, cancel/accept races).
- Add exhaustive error-branch assertions for Beans-specific error classes and fallback errors across handlers.
