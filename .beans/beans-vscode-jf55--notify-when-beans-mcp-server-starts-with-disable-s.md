---
# beans-vscode-jf55
title: Notify when Beans MCP server starts (with disable setting)
status: in-progress
type: feature
priority: normal
created_at: 2026-02-19T19:12:42Z
updated_at: 2026-02-20T04:21:08Z
branch: feature/beans-vscode-jf55-notify-mcp-server-startup
pr: 56
---

Show a startup notification when the Beans MCP server starts on port X, with an action/setting to disable this notice from extension configuration.

## Todo

- [x] Add a new setting `beans.mcp.showStartupNotification` (default `true`) in `package.json`.
- [x] Add a startup-notice helper in `src/beans/mcp/BeansMcpIntegration.ts` and invoke it on MCP definition resolution/registration path.
- [x] Include actions in the notice to open settings and disable future notices.
- [x] Add/extend tests in `src/test/integration/ai/mcp-integration.test.ts` for both enabled and disabled behavior.
- [x] Run targeted tests, then full compile/lint to validate no regressions.
