# Beans VS Code Extension

[![CI](https://github.com/selfagency/beans-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/ci.yml)
[![Release](https://github.com/selfagency/beans-vscode/actions/workflows/release.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/release.yml)

Beans support for VS Code, with tree-based issue workflows and MCP integration for Copilot.

## Features

- Sidebar views for active/draft/completed/scrapped beans.
- Command palette and context-menu flows for common Beans operations.
- MCP server definition provider that exposes Beans commands as MCP tools.
- Beans chat participant (`@beans`) with slash commands for summary, top-priority issues, stale issues, issue creation guidance, search, and issue-related commit guidance.

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

## Copilot Skill Generation

When `beans.ai.enabled` is true, the extension generates and maintains a compact Beans skill file at:

- `.github/skills/beans/SKILL.md`

The generated skill includes planning-mode guidance to help map an epic into child issues and then create/link those issues with parent relationships.

If AI features are turned off, the extension removes this generated skill file.

## Extension Settings

- `beans.cliPath`: path to Beans CLI.
- `beans.ai.enabled`: master switch for AI integrations (MCP + chat participant).
- `beans.mcp.enabled`: enable or disable MCP provider publishing.
- `beans.logging.level`: extension log level.

## CI/CD

The extension uses GitHub Actions for continuous integration and deployment:

### CI Workflow

- Runs on every push to `main` and on pull requests
- Tests on Ubuntu, macOS, and Windows
- Executes type checking, linting, and all tests
- Uses xvfb for headless VS Code extension testing on Linux
- Uploads test artifacts and coverage reports on failures
- **Required secrets**: None (fully automated)

### Release Workflow

- Triggered on version tags (e.g., `v1.0.0`)
- Builds and packages the extension
- Creates GitHub releases with `.vsix` artifacts
- Publishes to VS Code Marketplace and Open VSX

**Required secrets** (configure in repository Settings → Secrets and variables → Actions):

- **`VSCE_PAT`**: VS Code Marketplace Personal Access Token

  - Create at [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers)
  - Click "Create new Personal Access Token" in Azure DevOps
  - Required scope: **Marketplace (Publish)** or **Marketplace (Manage)**
  - Set expiration to 90 days or longer
  - Associate the token with your publisher account

- **`OVSX_PAT`**: Open VSX Personal Access Token
  - Create at [Open VSX Registry](https://open-vsx.org/user-settings/tokens)
  - Sign in and navigate to User Settings → Access Tokens
  - Click "Generate a new access token"
  - Required permission: **Publish** extensions

**Note**: `GITHUB_TOKEN` is automatically provided by GitHub Actions and doesn't need manual configuration.

If you skip configuring `VSCE_PAT` or `OVSX_PAT`, the release workflow will still create GitHub releases but will fail when attempting to publish to those registries.

### Dependabot

- Automatically creates PRs for dependency updates weekly
- Groups related dependencies for easier review
- **Required secrets**: None (uses default `GITHUB_TOKEN`)

## Development

```bash
pnpm install
pnpm run compile
pnpm test
```

## Accessibility note

This extension is built with accessibility in mind, but issues may still exist. Please manually test keyboard and screen-reader flows and consider auditing with Accessibility Insights.
