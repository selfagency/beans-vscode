---
# beans-vscode-4snu
title: Move logs to .vscode/logs and make AI toggle runtime-accurate
status: completed
type: bug
priority: high
branch: feature/beans-vscode-t4hi-init-ai-prompts-view-order
pr: 46
created_at: 2026-02-19T15:26:26Z
updated_at: 2026-02-19T15:26:26Z
---

## Todo
- [x] Move extension and MCP mirrored output log path from `.beans/.vscode` to `.vscode/logs`
- [x] Ensure AI enable/disable in activation prompt applies integrations consistently at runtime
- [x] Update tests for new log path and AI integration toggle behavior
- [x] Run targeted tests and compile

## Summary of Changes
- Changed extension log mirroring and MCP output-log defaults to `.vscode/logs/beans-output.log` (moved off `.beans/.vscode`).
- Updated AI enablement prompt copy and follow-up notices to reflect that MCP/chat registration changes require window reload for full effect.
- Verified with targeted Vitest suites and a full `compile` run.
