---
# beans-vscode-sknf
title: Update details Copilot button to use general chat prompt menu
status: completed
type: task
priority: high
created_at: 2026-02-17T22:26:33Z
updated_at: 2026-02-17T22:26:42Z
---

## Goal
Switch the Details pane Copilot action from direct @beans targeting to a prompt picker that launches general Copilot Chat.

## Checklist
- [x] Replace hardcoded @beans prompt usage
- [x] Add issue-oriented prompt options in quick pick
- [x] Update tests for new prompt labels/behavior
- [x] Run targeted tests and compile

## Summary of Changes
- Reworked the Details pane Copilot action to open a prompt picker instead of sending a hardcoded @beans prompt.
- Added issue-oriented prompt options for status, remaining work, close-and-commit guidance, GitHub issue export, set in-progress, and spec/todo expansion.
- Updated BeansCommands tests for new prompt labels and behavior, and validated with unit tests plus compile/lint/typecheck.
