# Beans VS Code Extension

Beans support for VS Code, with tree-based issue workflows and MCP integration for Copilot.

## Features

- Sidebar views for active/draft/completed/scrapped beans.
- Command palette and context-menu flows for common Beans operations.
- MCP server definition provider that exposes Beans commands as MCP tools.

## Requirements

- `beans` CLI installed and available in `PATH` (or set `beans.cliPath`).
- VS Code `^1.109.0`.

## MCP Integration

This extension contributes a dynamic MCP server provider (`beans.mcpServers`) that launches an internal stdio server bundled in `dist/beans-mcp-server.js`.

The server exposes tools that mirror extension capabilities, including:

- init / refresh / view / create / edit
- set status / type / priority
- set or remove parent
- edit blocking relationships
- copy id / delete
- filter / search / sort
- open config / show output guidance

### MCP troubleshooting commands

- `Beans: MCP: Refresh Server Definitions`
- `Beans: MCP: Show Server Info`
- `Beans: MCP: Open MCP Settings`
- `Beans: MCP: Open Logs`

## Extension Settings

- `beans.cliPath`: path to Beans CLI.
- `beans.mcp.enabled`: enable or disable MCP provider publishing.
- `beans.logging.level`: extension log level.

## Development

```bash
pnpm install
pnpm run compile
pnpm test
```

## Accessibility note

This extension is built with accessibility in mind, but issues may still exist. Please manually test keyboard and screen-reader flows and consider auditing with Accessibility Insights.
