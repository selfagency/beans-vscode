---
# beans-vscode-rp2y
title: Fix MCP startup notification and Copilot artifact reinitialization issues
status: completed
type: fix
priority: high
created_at: 2026-02-25T00:13:01Z
updated_at: 2026-03-14T03:51:39Z
---

Fix two extension initialization issues:

1. **MCP startup notification error handling**: Remove the `void` operator and add proper `.catch()` handler to prevent unhandled promise rejections when the MCP startup notification is dismissed. Filter out "Canceled" errors since dismissal is normal behavior.

2. **Copilot artifact double-prompting**: Remove redundant confirmation dialog from `reinitializeCopilotArtifacts()` command. The command is only called from:
   - Extension update prompt (user already confirmed)
   - Command palette (explicit user action)
   
   Double-prompting adds unnecessary friction.

These fixes resolve:
- Extension failing to activate when initializing Beans in a new project (MCP notification dismissed)
- Extension update flow requiring two confirmations to regenerate Copilot files
