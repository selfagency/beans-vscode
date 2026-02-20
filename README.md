# Beans VS Code Extension

![Three green beans](./assets/icon.png)

**Beautifully integrated Beans issue tracking for VS Code**

[Beans](https://github.com/hmans/beans) is a file-based issue tracker that lives alongside your code. This extension brings the full Beans experience into VS Code with native tree views, AI integration, and powerful workflow automation.

[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fselfagency%2Fbeans-vscode%2Fmain%2Fpackage.json&query=%24.version&label=Version&color=blue)](https://github.com/selfagency/beans-vscode/releases)
[![Tests](https://github.com/selfagency/beans-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/tests.yml)
[![codecov](https://codecov.io/github/selfagency/beans-vscode/graph/badge.svg?token=2TKB7KQ6II)](https://codecov.io/github/selfagency/beans-vscode)
[![Remote Tests](https://github.com/selfagency/beans-vscode/actions/workflows/remote-test.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/remote-test.yml)
[![Release](https://github.com/selfagency/beans-vscode/actions/workflows/release.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Key Features

- **🌴 Tree Views**: Organized sidebar panes for drafts, open, completed, and scrapped beans with hierarchical nesting, in-progress descendant badges, and item counts
- **📋 Details View**: Rich webview panel with rendered markdown, interactive checklists, editable properties, relationship navigation, and browsing history with back navigation
- **🔍 Search & Filter**: Full-text search across all fields, filter by status/type/priority/tags, five sort modes, and dedicated search results view with context menus
- **🎯 Drag & Drop**: Create parent-child hierarchies visually with cycle detection and confirmation
- **🔗 Relationships**: Parent-child hierarchies (milestone > epic > feature > task) and blocking/blocked-by dependency tracking
- **🤖 AI Integration**: MCP tools for all operations, `@beans` chat participant with 7 slash commands, auto-generated Copilot skills & instructions, and "Start Work" templates for Copilot-assisted workflows
- **🌐 Remote Ready**: Works seamlessly in SSH, WSL, containers, and Codespaces
- **⚡ Keyboard-First**: Configurable shortcuts for all operations
- **📂 File Watching**: Automatic tree refresh on filesystem changes with configurable debounce
- **🛡️ Resilient**: Offline mode with caching, request deduplication, retry with exponential backoff, malformed bean detection, and structured error handling with actionable guidance
- **🧪 Extensively Tested**: Comprehensive automated unit and integration test suite
- **♿ Accessible**: Built following WCAG 2.2 Level AA guidelines
- **🤫 Privacy Respecting**: No telemetry or data collection of any kind

## About Beans

Beans is a modern, file-based issue tracker designed for developers who want their issues to live alongside their code. Each "bean" is a markdown file in your repository—no databases, no external services, just version-controlled files.

**Why file-based?**

- ✅ Version controlled with your code
- ✅ Readable in any text editor
- ✅ Works offline
- ✅ No vendor lock-in
- ✅ Greppable and scriptable
- ✅ Perfect for remote development

Learn more about Beans: [github.com/hmans/beans](https://github.com/hmans/beans)

## Quick Start

### 1. Install Prerequisites

**Install Beans CLI**:

```bash
# macOS (Homebrew)
brew install hmans/beans/beans

# Go
go install github.com/hmans/beans@latest
```

Full installation guide: [Beans Documentation](https://github.com/hmans/beans#installation)

### 2. Install Extension

Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=selfagency.beans-vscode) or [Open VSX](https://open-vsx.org/extension/selfagency/beans-vscode).

### 3. Initialize Your Project

```bash
cd your-project
beans init
```

Or use Command Palette: `Beans: Initialize Beans in Workspace`

### 4. Create Your First Bean

Click the `+` icon in the Beans sidebar, enter a title, select a type (task, bug, feature), and you're done!

## Documentation

- **[User Guide](./docs/user-guide.md)** - Complete guide to using the extension
- **[AI Features](./docs/ai-features.md)** - MCP tools, chat participant, Copilot skills, and "Start Work" templates
- **[Commands Reference](./docs/commands.md)** - All 30+ commands with examples and workflow guides
- **[Architecture](./docs/architecture.md)** - Technical design and module boundaries
- **[Testing Guide](./docs/testing.md)** - Test strategy, running tests, and writing new tests
- **[Remote Development](./docs/remote-compatibility-testing.md)** - Remote testing guide

## Remote Development

This extension fully supports VS Code Remote Development (SSH, WSL, containers, Codespaces).

**Critical requirement**: The Beans CLI must be installed on the **remote** machine, not your local machine.

See the [Remote Development Guide](./docs/remote-compatibility-testing.md) for detailed setup instructions.

## Development

We welcome contributions and follow a strict **TDD-first** (Test-Driven Development) workflow. For detailed onboarding, branch naming conventions, and the Beans workflow, please refer to the **[Contributing Guide](./CONTRIBUTING.md)**.

### Quick Setup

```bash
git clone https://github.com/selfagency/beans-vscode.git
cd beans-vscode
pnpm install
pnpm run compile
pnpm test
```

### Common Commands

```bash
pnpm run watch         # Watch for code and type changes
pnpm run test:watch    # Watch mode for unit tests
pnpm run lint          # Lint changes
pnpm run check-types   # Type-check everything
```

### Running Locally

- **Debug Extension**: Press `F5` in VS Code to launch the **Extension Development Host**.
- **MCP Server**: Run `node ./dist/beans-mcp-server.js` (see [CONTRIBUTING.md](./CONTRIBUTING.md#running-the-mcp-server-locally) for details).

## Contributing

Please see our **[Contributing Guide](./CONTRIBUTING.md)** for full details on our developer principles, branch naming, and pull request process.

1. **Find or create a Bean** in `.beans/` (this project uses Beans for self-tracking!)
2. **Implement changes** using the TDD-first workflow.
3. **Ensure all checks pass** including linting and tests.
4. **Submit a PR** with conventional commits.

## Support the Project

If you find this extension useful, please leave a review on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=selfagency.beans-vscode) or [Open VSX](https://open-vsx.org/extension/selfagency/beans-vscode). Reviews help other developers discover the extension.

## License

[MIT](./LICENSE)

## Credits

- **[Hendrik Mans](https://github.com/hmans)**: Creator of Beans

## Accessibility Note

This extension is built with accessibility in mind following WCAG 2.2 Level AA guidelines, but issues may still exist. Please manually test keyboard navigation and screen-reader workflows. Consider auditing with [Accessibility Insights](https://accessibilityinsights.io/).

Feedback and accessibility improvement suggestions are welcome—please file an issue!
