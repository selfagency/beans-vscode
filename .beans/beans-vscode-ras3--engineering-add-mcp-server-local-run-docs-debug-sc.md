---
# beans-vscode-ras3
title: 'engineering: Add MCP server local-run docs & debug script'
status: completed
type: task
priority: normal
created_at: 2026-02-18T19:11:39Z
updated_at: 2026-02-18T21:15:53Z
parent: beans-vscode-li45
---

Add docs and a small npm script (dev:run-mcp) that runs `node ./dist/beans-mcp-server.js --workspace <root> --cli-path <path> --port <port>` and document env vars (BEANS_VSCODE_MCP, BEANS_VSCODE_OUTPUT_LOG, BEANS_VSCODE_MCP_PORT). Include troubleshooting steps when vscode.lm API is unavailable.
