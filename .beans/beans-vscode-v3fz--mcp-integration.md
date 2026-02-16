---
# beans-vscode-v3fz
title: MCP integration
status: completed
type: task
priority: normal
created_at: 2026-02-16T04:04:51Z
updated_at: 2026-02-16T16:15:00Z
parent: beans-vscode-03yk
---

Implement BeansMcpIntegration with MCP server definition provider, stdio command wrapper, change events, and troubleshooting commands

## Summary of Changes

- Added a dynamic MCP server definition provider (`beans.mcpServers`) and wired activation in the extension.
- Implemented a bundled stdio MCP server (`dist/beans-mcp-server.js`) that mirrors extension command capabilities as MCP tools.
- Added MCP troubleshooting commands and `beans.mcp.enabled` setting.
- Updated build pipeline to emit both extension and MCP server bundles.
- Added MCP helper unit tests and validated compile + full extension test suite.

### Follow-up updates
- Added runtime generation of `.github/instructions/beans.instructions.md` from `beans prime` during extension init flows.
- Added MCP tool `beans_vscode_llm_context` to return generated LLM instructions and optionally write them into the workspace instructions file.

### Follow-up updates (file I/O + output read)
- Added MCP tools for direct `.beans` file operations: read/edit/create/delete with path traversal safeguards.
- Added output mirror support in extension logger and MCP tool `beans_vscode_read_output` to read output log contents.
- Wired MCP provider env var `BEANS_VSCODE_OUTPUT_LOG` and extension mirror path `.beans/.vscode/beans-output.log`.
