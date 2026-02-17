---
# beans-vscode-344m
title: Show offline mode warning to users
status: completed
type: task
priority: normal
created_at: 2026-02-17T03:49:42Z
updated_at: 2026-02-17T03:51:55Z
parent: beans-vscode-3y36
---

Currently offline mode only logs to output channel, but users should see a VS Code warning notification when extension falls back to cached data.

Location: src/beans/service/BeansService.ts lines 368-369

## Solution
Add vscode.window.showWarningMessage when entering offline mode (only show once, not repeatedly)

## Summary
Added vscode.window.showWarningMessage when extension enters offline mode. Warning only shown once when transitioning (checks if already in offline mode). Improves UX visibility of offline state.

Commit: bd7e53b
