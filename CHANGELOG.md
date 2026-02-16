# Change Log

All notable changes to the "beans-vscode" extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- Archive view for archived beans
- Timeline view for bean history
- Dependency graph visualization
- Saved filters and filter presets
- Bean templates for common issue types
- Rich edit mode with in-editor markdown editing
- Metrics dashboard for bean lifecycle analytics

## [1.0.0] - 2026-02-16

### Added

#### Core Features

- **Tree Views**: Dedicated views for Active, Draft, Completed, and Scrapped beans with hierarchical display
- **Search View**: Full-text search webview with result previews and filtering
- **Command Palette**: 25+ commands for all bean operations
- **Details Panel**: Markdown preview with metadata, relationships, and quick actions
- **Context Menus**: Right-click actions on tree items and views
- **Drag & Drop**: Visual parent relationship management

#### Bean Operations

- Create beans with interactive prompts (title, type, description)
- View beans in markdown preview pane
- Edit bean markdown files directly in VS Code
- Update bean status (todo, in-progress, draft, completed, scrapped)
- Update bean type (milestone, epic, feature, bug, task)
- Update bean priority (critical, high, normal, low, deferred)
- Manage parent-child relationships via drag-and-drop or commands
- Track blocking dependencies (blocking/blocked-by)
- Copy bean IDs to clipboard
- Delete draft/scrapped beans with confirmation
- Reopen completed/scrapped beans

#### Filtering and Sorting

- Filter by status (multi-select)
- Filter by type (multi-select)
- Filter by tags
- Full-text search across titles and bodies
- Sort modes: status/priority/type/title, priority-first, updated date, created date, ID
- Persistent filters across refresh operations
- Clear filters command

#### AI Integration

- **MCP Server**: Expose Beans as tools for AI clients (Copilot, Claude Desktop, Cline, etc.)
  - 20+ MCP tools for workspace, bean operations, relationships, and search
  - Stdio server bundled with extension
  - Dynamic server definition provider
  - MCP troubleshooting commands
- **Chat Participant**: `@beans` commands in GitHub Copilot Chat
  - `/summary`: Workspace status overview
  - `/priority`: Top-priority issues
  - `/stale`: Beans needing attention
  - `/create`: Guided bean creation
  - `/next`: Suggestion for next work
  - `/search`: Search beans by text
  - `/commit`: Commit message guidance
- **Copilot Skill**: Auto-generated `.github/skills/beans/SKILL.md` with planning guidance
- **Copilot Instructions**: Auto-generated `.github/copilot-instructions.md` for workflow integration

#### Remote Development

- Full support for SSH, WSL, Dev Containers, and GitHub Codespaces
- Extension runs in workspace extension host (`extensionKind: workspace`)
- Remote CLI resolution and execution
- Remote MCP server spawning
- Remote filesystem access via VS Code Uri APIs
- Devcontainer configuration examples

#### Settings

- `beans.cliPath`: Custom Beans CLI path
- `beans.workspaceRoot`: Override workspace root (advanced)
- `beans.enableOnlyIfInitialized`: Only activate if `.beans.yml` exists
- `beans.ai.enabled`: Master switch for AI features
- `beans.mcp.enabled`: Enable/disable MCP server provider
- `beans.defaultSortMode`: Default tree sort order
- `beans.logging.level`: Extension log verbosity

#### Developer Experience

- TypeScript throughout with strict type checking
- ESLint with TypeScript ESLint rules
- Vitest for fast unit testing (43+ tests)
- VS Code Test Electron for integration testing
- Mock VS Code API for rapid test iteration
- Watch mode for TDD workflow
- Comprehensive error handling and logging
- Debug configurations for extension and tests

#### CI/CD

- GitHub Actions CI workflow (Ubuntu, macOS, Windows)
- GitHub Actions release workflow (marketplace publishing)
- Dependabot for automated dependency updates
- Automated test execution on PR and push
- xvfb for headless testing on Linux
- Test artifact uploads on failure
- Issue templates (bug, feature, other)
- PR template with checklist
- Issue-to-bean workflow for automated bean creation

#### Documentation

- **Architecture Documentation**: Module boundaries, data flow, design decisions
- **Commands Reference**: Complete command guide with usage patterns and workflows
- **Testing Documentation**: Testing strategy, running tests, writing tests, CI/CD
- **Remote Compatibility Guide**: Setup and troubleshooting for remote scenarios
- **Comprehensive README**: Installation, features, settings, troubleshooting
- Accessibility note with WCAG 2.2 guidance

### Changed

- N/A (initial release)

### Deprecated

- N/A (initial release)

### Removed

- N/A (initial release)

### Fixed

- N/A (initial release)

### Security

- Secure process execution with argument arrays (no shell injection)
- Timeout protection on CLI operations (30s default)
- Input validation on all bean operations
- No hardcoded secrets
- Workspace content treated as untrusted
- VS Code secret storage ready for future credentials

## [0.1.0] - Development Milestones

### Alpha Phase: Sidebar & Tree Views

- Implemented tree data providers for Active, Draft, Completed, Scrapped beans
- Created `BeansService` for type-safe CLI operations
- Built `BeanTreeItem` for VS Code tree representation
- Added `BeansFilterManager` for centralized filter state
- Implemented drag-and-drop controller for parent relationships
- Created Details WebView Provider for bean rendering

### Beta Phase: Commands & Operations

- Registered 25+ commands for all bean operations
- Implemented interactive prompts for bean creation
- Added status/type/priority update workflows
- Built parent/blocking relationship management
- Created search and filter commands
- Implemented bean deletion with safety checks

### Release Candidate: AI Integration

- Built MCP server with 20+ tools
- Integrated MCP server definition provider
- Created `@beans` chat participant
- Implemented chat slash commands (/summary, /priority, /stale, etc.)
- Auto-generated Copilot skill file
- Auto-generated Copilot instructions

### Final: Polish & Documentation

- Comprehensive architecture documentation
- Complete commands reference documentation
- Testing documentation and strategy
- Enhanced README with all features
- Remote compatibility guide
- CI/CD workflows and automation

---

## Release Notes for v1.0.0

**Beans VS Code Extension** is now production-ready! 🎉

This extension brings the power of [Beans](https://github.com/hmans/beans)—the lightweight, file-based issue tracker—directly into VS Code with deep GitHub Copilot integration.

### What's New

- **Native VS Code UI**: Sidebar trees, details panels, and search views
- **Command-Rich**: 25+ commands accessible via palette and context menus
- **AI-Powered**: MCP tools for any AI client + `@beans` chat participant for Copilot
- **Remote-Ready**: Full support for SSH, WSL, Dev Containers, and Codespaces
- **Well-Tested**: 43+ unit tests, integration tests, and CI across platforms
- **Documented**: Architecture, commands, testing, and remote setup guides

### Getting Started

1. Install Beans CLI: `brew install hmans/beans/beans`
2. Install extension from VS Code Marketplace
3. Open your project, run: `Beans: Initialize Beans in Workspace`
4. Start creating and managing beans in VS Code!

### AI Workflows

Use `@beans` in Copilot Chat:

```text
@beans /summary         # Get workspace overview
@beans /priority        # See top-priority work
@beans /next            # Get suggestion for next bean
@beans /create Add login feature
```

Or let any AI client use Beans via MCP tools!

### For Contributors

Thank you to everyone who contributed feedback, testing, and code to make this release possible. Special thanks to:

- **[Hendrik Mans](https://github.com/hmans)** for creating Beans
- The **Beans community** for feedback and feature requests
- Early adopters who tested in remote scenarios

### Known Limitations

- No visual dependency graph yet (planned for future release)
- Archive view not yet implemented
- Custom keyboard shortcuts require manual configuration
- Testing documentation has minor markdown linting issues (cosmetic only)

### What's Next

See the **[Unreleased]** section above for planned features in future releases.

---

For detailed migration guides, troubleshooting, and usage examples, see:

- [README](./README.md)
- [Architecture Documentation](./docs/architecture.md)
- [Commands Reference](./docs/commands.md)
- [Testing Documentation](./docs/testing.md)
- [Remote Compatibility Testing](./docs/remote-compatibility-testing.md)
