---
# beans-vscode-zz46
title: Add settings for AI integration control
status: completed
type: task
priority: normal
created_at: 2026-02-16T04:22:28Z
updated_at: 2026-02-16T16:29:31Z
parent: beans-vscode-03yk
---

Add beans.ai.enabled setting to allow users to disable AI features (MCP server and chat participant). Requires conditional registration in activation and clear user messaging.

## Summary of Changes

- Added global beans.ai.enabled setting as a master switch for AI features.
- Gated MCP definition publishing and runtime registration behind beans.ai.enabled.
- Gated chat participant registration behind beans.ai.enabled.
- Added clear user-facing documentation in README and setting descriptions.
