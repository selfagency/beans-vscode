# Beans VS Code Extension

[![CI](https://github.com/selfagency/beans-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/ci.yml)
[![Release](https://github.com/selfagency/beans-vscode/actions/workflows/release.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/release.yml)

A VS Code extension for [Beans](https://github.com/hmans/beans), the lightweight file-based issue tracker designed for developer workflows and AI collaboration.

## About Beans

**[Beans](https://github.com/hmans/beans)** by [Hendrik Mans](https://github.com/hmans) is a brilliant CLI-based, flat-file issue tracker that stores issues as Markdown files in your repository's `.beans/` folder. Unlike traditional issue trackers, Beans is:

- **Git-native**: Issues live in your repo, version-controlled alongside your code
- **Offline-first**: No network required, works anywhere git works
- **Merge-friendly**: Designed to minimize merge conflicts in team workflows
- **LLM-optimized**: Plain text Markdown format is perfect for AI assistants to read and modify issues
- **GraphQL API**: Built-in query engine for efficient context retrieval
- **Beautiful TUI**: Interactive terminal interface for browsing and managing beans
- **Project memory**: Archived beans serve as historical context for agents

### Why Beans + LLMs = Magic ✨

Beans shines when working with Large Language Models like GitHub Copilot because:

1. **Context-aware**: LLMs can read your entire issue structure to understand project priorities
2. **GraphQL queries**: Agents can fetch exactly the data they need, minimizing token usage
3. **Automated planning**: AI can create, organize, and break down issues intelligently
4. **Workflow automation**: Agents can update statuses, link dependencies, and manage your backlog
5. **No API limits**: Everything is local files, no rate limiting or authentication needed
6. **Project memory**: Completed beans provide historical context for better decision-making

### This Extension

This extension brings Beans into VS Code with deep GitHub Copilot integration through the Model Context Protocol (MCP). It provides:

- Native VS Code UI with tree views and commands
- MCP server that exposes Beans operations as tools for any AI chat client
- Specialized `@beans` chat participant for GitHub Copilot
- Remote development support (SSH, WSL, Dev Containers, Codespaces)

**Thank you** to [Hendrik Mans](https://github.com/hmans) and the [Beans contributors](https://github.com/hmans/beans/graphs/contributors) for creating such an elegant, developer-friendly issue tracker that pairs perfectly with modern AI tools!

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

## Remote Development

This extension fully supports VS Code Remote Development scenarios and runs in the remote extension host (`"extensionKind": ["workspace"]`).

### Supported Remote Environments

- **SSH**: Connect to remote machines via SSH
- **WSL**: Windows Subsystem for Linux
- **Dev Containers**: Docker-based development environments
- **GitHub Codespaces**: Cloud-based development environments

### Remote Requirements

**Critical**: The `beans` CLI must be installed on the remote machine, not your local machine.

```bash
# Install beans on the remote machine via Homebrew
brew install hmans/beans/beans

# Or download from releases
# https://github.com/hmans/beans/releases

# Or install via Go
go install github.com/hmans/beans@latest
```

### How Remote Operation Works

1. The extension runs entirely on the remote host
2. `beans.cliPath` resolves on the remote filesystem (defaults to `beans` in remote PATH)
3. Workspace folder paths (`workspaceFolder.uri.fsPath`) point to remote filesystem
4. MCP server process spawns on remote using remote Node.js (`process.execPath`)
5. All file operations use remote filesystem via VS Code's Uri APIs

### Verifying Remote Setup

```bash
# In VS Code integrated terminal (automatically connected to remote)
beans --version  # Should show installed version
which beans      # Should show path on remote machine
```

### Troubleshooting Remote Scenarios

#### Error: "Beans CLI not found"

**Problem**: Extension can't find `beans` executable on remote machine.

**Solutions**:

1. Install beans CLI on the remote machine (not local)
2. Configure `beans.cliPath` setting to absolute path on remote: `/home/user/.local/bin/beans`
3. Ensure beans CLI is in remote machine's PATH: `echo $PATH`
4. Reload VS Code window after installing beans: `Cmd/Ctrl+Shift+P` → "Developer: Reload Window"

#### MCP Tools Not Available

**Problem**: Copilot can't find Beans MCP tools in remote environment.

**Solutions**:

1. Verify extension is installed and activated: Check "Beans" output channel
2. Ensure `beans.ai.enabled` is true in workspace settings
3. Run command: "Beans: MCP: Refresh Server Definitions"
4. Check MCP server info: "Beans: MCP: Show Server Info"
5. View logs: "Beans: MCP: Open Logs"

#### Workspace Not Initialized

**Problem**: Extension shows "_Initialize Beans in Workspace_" prompt.

**Solution**: Run `beans init` in the remote terminal or via command palette: "Beans: Initialize Beans in Workspace"

### Devcontainer Configuration

To pre-install beans CLI in devcontainers, add to `.devcontainer/devcontainer.json`:

```json
{
  "postCreateCommand": "curl -fsSL https://raw.githubusercontent.com/h-arry-smith/beans/main/install.sh | sh",
  "customizations": {
    "vscode": {
      "extensions": ["selfagency.beans-vscode"]
    }
  }
}
```

### GitHub Codespaces

Beans CLI can be installed automatically using a `.devcontainer` configuration or manually in the Codespace terminal.

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
