# Beans VS Code Extension

[![CI](https://github.com/selfagency/beans-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/ci.yml)
[![Release](https://github.com/selfagency/beans-vscode/actions/workflows/release.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/release.yml)

A production-grade VS Code extension for [Beans](https://github.com/hmans/beans), the lightweight file-based issue tracker designed for developer workflows and AI collaboration.

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

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Core Features](#core-features)
- [AI Integration](#ai-integration)
- [Commands](#commands)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Extension Settings](#extension-settings)
- [Remote Development](#remote-development)
- [CI/CD](#cicd)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Documentation](#documentation)

## Features

### Tree Views

- **Active Beans**: Todo and in-progress beans in one view
- **Draft Beans**: Beans that need refinement before work
- **Completed Beans**: Successfully finished work
- **Scrapped Beans**: Beans that were decided not to do
- **Search View**: Full-text search across all beans

### Bean Operations

- Create, view, and edit beans with interactive prompts
- Set status (todo, in-progress, draft, completed, scrapped)
- Set type (milestone, epic, feature, bug, task)
- Set priority (critical, high, normal, low, deferred)
- Manage parent-child relationships via drag-and-drop
- Track blocking dependencies

### AI-Powered Workflows

- **MCP Server**: Expose Beans as tools for AI clients (Copilot, Claude Desktop, Cline)
- **Chat Participant**: `@beans` commands in GitHub Copilot Chat
- **Smart Planning**: AI can decompose epics into features and tasks
- **Context-Aware**: AI reads project structure to suggest next work

### Developer Experience

- Keyboard-first navigation
- Command palette for all operations
- Context menus for quick actions
- Markdown preview for bean details
- File watcher for auto-refresh
- Multi-select for batch operations

## Requirements

### Essential

- **VS Code**: Version 1.109.0 or higher
- **Beans CLI**: Must be installed and available in `PATH`

### Optional

- **GitHub Copilot**: For `@beans` chat participant features
- **MCP-compatible AI client**: For MCP tool access (Claude Desktop, Cline, etc.)

## Installation

### 1. Install Beans CLI

#### macOS / Linux (Homebrew)

```bash
brew install hmans/beans/beans
```

#### Go Install

```bash
go install github.com/hmans/beans@latest
```

#### Manual Download

Download from [Beans Releases](https://github.com/hmans/beans/releases)

### 2. Verify Installation

```bash
beans --version
# Should output: beans version X.Y.Z
```

### 3. Install VS Code Extension

#### From VS Code Marketplace

1. Open VS Code
2. Press `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Windows/Linux)
3. Search for "Beans"
4. Click "Install"

#### From VSIX File

1. Download `.vsix` from [GitHub Releases](https://github.com/selfagency/beans-vscode/releases)
2. Run: `code --install-extension beans-vscode-X.Y.Z.vsix`

## Getting Started

### Initialize Beans in Your Project

#### Option 1: Command Palette

1. Open your project in VS Code
2. Press `Cmd+Shift+P` / `Ctrl+Shift+P`
3. Run: "Beans: Initialize Beans in Workspace"

#### Option 2: Terminal

```bash
cd your-project
beans init
```

### Create Your First Bean

1. Click the `+` icon in the Beans sidebar
2. Enter a title: "My first bean"
3. Select type: "task"
4. Optionally add a description
5. Bean created! 🎉

### View Beans

- **Sidebar**: Click any bean in the Active tree
- **Details Panel**: Opens with bean markdown content
- **Edit**: Click pencil icon to edit bean file directly

## Core Features

### Hierarchical Organization

Create structured workflows with parent-child relationships:

```text
Milestone: v1.0 Release
└── Epic: User Authentication
    ├── Feature: Login flow
    │   ├── Task: Design login UI
    │   └── Task: Implement JWT tokens
    └── Feature: Password reset
```

**Drag & Drop**: Drag a child bean onto a parent to create the relationship.

### Status Workflow

Beans flow through statuses:

```text
draft → todo → in-progress → completed
                ↓
            scrapped
```

- **draft**: Needs refinement
- **todo**: Ready to start
- **in-progress**: Being worked on
- **completed**: Done
- **scrapped**: Won't do

### Dependency Tracking

Mark beans as blocking others:

```text
Bean A: "Set up database" (blocking → Bean B)
Bean B: "Implement login" (blocked-by ← Bean A)
```

Use "Edit Blocking Relationships" to manage dependencies.

### Filtering and Search

- **Filter by Status**: Show only specific statuses
- **Filter by Type**: Show only bugs, features, etc.
- **Filter by Tag**: Custom tag filtering
- **Full-Text Search**: Search across titles and bodies
- **Sort Modes**: By status, priority, updated date, created date, or ID

## AI Integration

### MCP Tools (When `beans.ai.enabled` is true)

The extension provides an MCP server that exposes Beans operations as tools for AI clients:

**Available Tools**:

- `beans_vscode_init`, `beans_vscode_refresh`
- `beans_vscode_view`, `beans_vscode_list`, `beans_vscode_create`, `beans_vscode_edit`
- `beans_vscode_set_status`, `beans_vscode_set_type`, `beans_vscode_set_priority`
- `beans_vscode_set_parent`, `beans_vscode_remove_parent`, `beans_vscode_edit_blocking`
- `beans_vscode_search`, `beans_vscode_filter`, `beans_vscode_sort`
- `beans_vscode_copy_id`, `beans_vscode_delete`

**MCP Commands**:

- `Beans: MCP: Refresh Server Definitions`
- `Beans: MCP: Show Server Info`
- `Beans: MCP: Open MCP Settings`
- `Beans: MCP: Open Logs`

### Chat Participant: `@beans`

Use `@beans` in GitHub Copilot Chat for conversational workflows:

- **`@beans /summary`**: Get workspace status overview
- **`@beans /priority`**: Show top-priority issues
- **`@beans /stale`**: List beans needing attention
- **`@beans /create [description]`**: Create bean with AI guidance
- **`@beans /next`**: Get suggestion for next bean to work on
- **`@beans /search [query]`**: Search beans
- **`@beans /commit [bean-id]`**: Get commit message guidance

**Example**:

```text
You: @beans /summary

Copilot: You have 12 active beans across 3 priorities:
- Critical: 2 bugs
- High: 4 features
- Normal: 6 tasks
Top priority: "Fix authentication timeout" (critical bug)
```

### Copilot Skill (Auto-Generated)

When AI features are enabled, the extension generates `.github/skills/beans/SKILL.md` with:

- Planning-mode guidance for epic decomposition
- Instructions for creating and linking child issues
- Best practices for Beans workflow with AI

## Commands

Full command reference → [docs/commands.md](./docs/commands.md)

### Essential Commands

| Command             | Description                   |
| ------------------- | ----------------------------- |
| `beans.init`        | Initialize Beans in workspace |
| `beans.refresh`     | Refresh all tree views        |
| `beans.create`      | Create new bean               |
| `beans.view`        | View bean details             |
| `beans.edit`        | Edit bean markdown file       |
| `beans.setStatus`   | Update bean status            |
| `beans.setType`     | Update bean type              |
| `beans.setPriority` | Update bean priority          |
| `beans.search`      | Full-text search              |
| `beans.filter`      | Filter beans                  |

### Running Commands

**Command Palette**: `Cmd+Shift+P` / `Ctrl+Shift+P`, type "Beans"

**Context Menu**: Right-click beans in tree views

**Tree Actions**: Click icons in tree view title bars

## Keyboard Shortcuts

The extension does not define default shortcuts to avoid conflicts. You can configure custom keybindings:

### Setting Up Custom Keybindings

1. Open Keyboard Shortcuts: `Cmd+K Cmd+S` / `Ctrl+K Ctrl+S`
2. Search for command (e.g., "Beans: Create Bean")
3. Click `+` to add binding

### Recommended Keybindings

Add to your `keybindings.json`:

```json
[
  {
    "key": "cmd+shift+b c",
    "command": "beans.create",
    "when": "beans.initialized"
  },
  {
    "key": "cmd+shift+b v",
    "command": "beans.view",
    "when": "beans.initialized"
  },
  {
    "key": "cmd+shift+b r",
    "command": "beans.refresh",
    "when": "beans.initialized"
  },
  {
    "key": "cmd+shift+b s",
    "command": "beans.search",
    "when": "beans.initialized"
  }
]
```

**Pattern**: `Cmd+Shift+B` (Beans prefix) + operation letter

## Extension Settings

Access via `Cmd+,` (Mac) or `Ctrl+,` (Windows/Linux), search "Beans".

### Core Settings

| Setting                         | Type    | Default   | Description                          |
| ------------------------------- | ------- | --------- | ------------------------------------ |
| `beans.cliPath`                 | string  | `"beans"` | Path to Beans CLI executable         |
| `beans.workspaceRoot`           | string  | `""`      | Override workspace root (advanced)   |
| `beans.enableOnlyIfInitialized` | boolean | `false`   | Only activate if `.beans.yml` exists |

### AI Settings

| Setting             | Type    | Default | Description                   |
| ------------------- | ------- | ------- | ----------------------------- |
| `beans.ai.enabled`  | boolean | `true`  | Master switch for AI features |
| `beans.mcp.enabled` | boolean | `true`  | Enable MCP server provider    |

### UI Settings

| Setting                 | Type | Default                        | Description                 |
| ----------------------- | ---- | ------------------------------ | --------------------------- |
| `beans.defaultSortMode` | enum | `"status-priority-type-title"` | Default sort mode for trees |
| `beans.logging.level`   | enum | `"info"`                       | Extension log verbosity     |

### Sort Modes

- `status-priority-type-title` (default): Grouped by status with priority
- `priority-status-type-title`: Highest priority first
- `updated`: Most recently updated first
- `created`: Newest beans first
- `id`: Alphabetical by bean code

## Remote Development

This extension fully supports VS Code Remote Development and runs in the remote extension host (`"extensionKind": ["workspace"]`).

### Supported Environments

- **SSH**: Connect to remote machines
- **WSL**: Windows Subsystem for Linux
- **Dev Containers**: Docker-based development
- **GitHub Codespaces**: Cloud-based development

### Critical Requirements

**The `beans` CLI must be installed on the remote machine, not your local machine.**

#### Install Beans on Remote

```bash
# Homebrew (recommended)
brew install hmans/beans/beans

# Go
go install github.com/hmans/beans@latest

# Manual download
# https://github.com/hmans/beans/releases
```

### How Remote Works

1. Extension runs entirely on remote host
2. `beans.cliPath` resolves on remote filesystem
3. Workspace paths point to remote filesystem
4. MCP server spawns on remote using remote Node.js
5. All file operations use remote filesystem

### Verify Remote Setup

Open integrated terminal (connects to remote automatically):

```bash
beans --version  # Should show installed version
which beans      # Should show path on remote machine
```

### Common Remote Issues

#### Error: "Beans CLI not found"

**Cause**: Extension can't find `beans` on remote machine.

**Solutions**:

1. Install beans CLI on remote (not local)
2. Configure `beans.cliPath` to absolute path: `/home/user/.local/bin/beans`
3. Ensure beans in remote `PATH`: `echo $PATH`
4. Reload window: `Developer: Reload Window`

#### MCP Tools Not Available

**Cause**: Copilot can't find Beans MCP tools.

**Solutions**:

1. Check extension activated: View "Beans" output channel
2. Verify `beans.ai.enabled` is `true`
3. Run: `Beans: MCP: Refresh Server Definitions`
4. Check: `Beans: MCP: Show Server Info`
5. View logs: `Beans: MCP: Open Logs`

#### Workspace Not Initialized

**Cause**: No `.beans.yml` in workspace.

**Solution**: Run `beans init` in remote terminal or command: `Beans: Initialize Beans in Workspace`

### Devcontainer Configuration

Pre-install beans in devcontainers with `.devcontainer/devcontainer.json`:

```json
{
  "postCreateCommand": "brew install hmans/beans/beans",
  "customizations": {
    "vscode": {
      "extensions": ["selfagency.beans-vscode"]
    }
  }
}
```

### GitHub Codespaces

Install beans automatically with devcontainer config or manually in Codespace terminal.

## Troubleshooting

### Extension Not Activating

**Check**:

- Is workspace folder open? Extension requires workspace
- Is `.beans.yml` present? Run `beans init` to create
- Check "Beans" output channel for errors

**Solutions**:

- Reload window: `Cmd+R` / `Ctrl+R`
- Check beans CLI: `beans --version` in terminal
- Review "Beans" output: `Beans: Show Output`

### Tree Views Empty

**Check**:

- Is workspace initialized? Run `beans init`
- Are beans created? Try `beans list` in terminal
- Check filters: Run `Beans: Filter Beans` → Clear

**Solutions**:

- Create test bean: `Beans: Create Bean`
- Refresh trees: `Beans: Refresh`
- Check status filters match your beans

### Commands Missing from Palette

**Check**:

- Are commands filtered? Type "Beans" to filter
- Is workspace initialized? Some commands require init

**Solutions**:

- Initialize workspace: `Beans: Initialize Beans in Workspace`
- Check context: `Developer: Inspect Context Keys` → Look for `beans.initialized`

### MCP Tools Not Working

**Check**:

- Is `beans.ai.enabled` true?
- Is MCP server running?

**Solutions**:

- Enable AI: Settings → `beans.ai.enabled` → `true`
- Refresh MCP: `Beans: MCP: Refresh Server Definitions`
- View server info: `Beans: MCP: Show Server Info`
- Check logs: `Beans: MCP: Open Logs`

### Chat Participant Not Responding

**Check**:

- Is GitHub Copilot activated?
- Is `beans.ai.enabled` true?
- Is `@beans` recognized in Chat?

**Solutions**:

- Check Copilot status in status bar
- Enable AI features in settings
- Try: `@beans /summary` to test

### Performance Issues

**Check**:

- Number of beans (1000+ may be slow)
- File system speed (especially remote)
- Filter and sort complexity

**Solutions**:

- Apply filters to reduce displayed beans
- Use simpler sort modes
- Check remote connection speed

## CI/CD

The extension uses GitHub Actions for continuous integration and deployment.

### CI Workflow

Runs on every push to `main` and pull requests:

- Tests on Ubuntu, macOS, and Windows
- Executes type checking, linting, and all tests
- Uses xvfb for headless testing on Linux
- Uploads artifacts and coverage on failures
- **No secrets required** (fully automated)

### Release Workflow

Triggered on version tags (e.g., `v1.0.0`):

- Builds and packages extension
- Creates GitHub releases with `.vsix` artifacts
- Publishes to VS Code Marketplace and Open VSX

**Required Secrets** (configure in repository Settings → Secrets):

- **`VSCE_PAT`**: VS Code Marketplace Personal Access Token

  - Create at [Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers)
  - Scope: **Marketplace (Publish)** or **Marketplace (Manage)**
  - Minimum expiration: 90 days

- **`OVSX_PAT`**: Open VSX Personal Access Token
  - Create at [Open VSX Registry](https://open-vsx.org/user-settings/tokens)
  - Permission: **Publish** extensions

**Note**: `GITHUB_TOKEN` is automatic. Without `VSCE_PAT` or `OVSX_PAT`, releases will be created on GitHub but publishing to marketplaces will fail.

### Dependabot

- Automatically creates PRs for dependency updates weekly
- Groups related dependencies for easier review
- **No secrets required** (uses default `GITHUB_TOKEN`)

## Development

### Setup

```bash
# Clone repository
git clone https://github.com/selfagency/beans-vscode.git
cd beans-vscode

# Install dependencies
pnpm install

# Compile TypeScript and bundle
pnpm run compile

# Run tests
pnpm test
```

### Development Workflow

```bash
# Watch mode for development
pnpm run watch

# Run tests in watch mode
pnpm run test:watch

# Lint code
pnpm run lint

# Type check
pnpm run typecheck
```

### Testing

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# All tests
pnpm run compile && pnpm test
```

### Debug Extension

1. Open project in VS Code
2. Press `F5` to launch Extension Development Host
3. Set breakpoints in TypeScript files
4. Test extension functionality in new window

## Documentation

Comprehensive documentation is available in the `docs/` folder:

- **[Architecture Documentation](./docs/architecture.md)**: Module boundaries, data flow, design decisions
- **[Commands Reference](./docs/commands.md)**: Complete command guide with workflows
- **[Testing Documentation](./docs/testing.md)**: Testing strategy and guidelines _(coming soon)_
- **[Remote Compatibility Testing](./docs/remote-compatibility-testing.md)**: Remote development testing guide

## Contributing

Contributions are welcome! Please:

1. Check existing issues or create a new one
2. Fork the repository
3. Create a feature branch: `git checkout -b feature/your-feature`
4. Make changes with tests
5. Run `pnpm run compile && pnpm test`
6. Commit with conventional commits: `feat: add feature`
7. Push and create a Pull Request

## License

[MIT](./LICENSE)

## Credits

- **[Hendrik Mans](https://github.com/hmans)**: Creator of Beans
- **[Beans Contributors](https://github.com/hmans/beans/graphs/contributors)**: For the excellent CLI and ecosystem

## Accessibility Note

This extension is built with accessibility in mind following WCAG 2.2 Level AA guidelines, but issues may still exist. Please manually test keyboard navigation and screen-reader workflows. Consider auditing with [Accessibility Insights](https://accessibilityinsights.io/).

Feedback and accessibility improvement suggestions are welcome—please file an issue!
