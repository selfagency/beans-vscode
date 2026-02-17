---
# beans-vscode-k1s7
title: Replace hardcoded validation with workspace config
status: completed
type: task
priority: normal
created_at: 2026-02-17T03:46:01Z
updated_at: 2026-02-17T03:48:05Z
---

validateType/validateStatus/validatePriority methods in BeansService use hardcoded arrays. These should read from workspace config via configManager.getWorkspaceConfig() to support custom types/statuses and maintain single source of truth.

Location: src/beans/service/BeansService.ts lines 490-517

## Checklist
- [x] Update validateType to read from config.types
- [x] Update validateStatus to read from config.statuses  
- [x] Update validatePriority to read from config.priorities
- [x] Update tests if needed (all tests passing)

## Summary
Modified validation methods to accept arrays from workspace config as parameters. Updated createBean and updateBean to fetch config and pass validation arrays. All 127 tests passing.

Commit: 0ee70cc
