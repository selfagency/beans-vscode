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
- **🤖 AI Integration**: Consolidated MCP tools for query/update/batch/file/log workflows, `@beans` chat participant with 7 slash commands, auto-generated Copilot skills & instructions, and "Start Work" templates for Copilot-assisted workflows
- **🌐 Remote Ready**: Works seamlessly in SSH, WSL, containers, and Codespaces
- **⚡ Keyboard-First**: Configurable shortcuts for all operations
- **📂 File Watching**: Automatic tree refresh on filesystem changes with configurable debounce
- **🛡️ Resilient**: Offline mode with caching, request deduplication, retry with exponential backoff, malformed bean detection, and structured error handling with actionable guidance
- **🧪 Extensively Tested**: Comprehensive automated unit and integration test suite
- **♿ Accessible**: Built following WCAG 2.2 Level AA guidelines
- **🤫 Privacy Respecting**: No telemetry or data collection of any kind
- **🐶 Completely Dogfooded**: The extension was used by the developer to project manage developing the extension

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

### Install the [`beans`](https://github.com/hmans/beans#installation) CLI

#### macOS (Requires Homebrew)

```bash
brew install hmans/beans/beans
```

#### Linux, MacOs, Windows (Requires Go)

```bash
go install github.com/hmans/beans@v0.4.2
```

### Install the Beans extension

Use the IDE's Extension sidebar to search for `beans` or execute the following command:

```bash
code --install-extension selfagency.beans-vscode
```

### Initialize Beans in your project

#### Option 1: Command Palette

1. Open your project in VS Code
2. Press `Cmd+Shift+P` / `Ctrl+Shift+P`
3. Run: "Beans: Initialize Beans in Workspace"

#### Option 2: Terminal

```bash
cd <project-folder>
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

## Remote Development

This extension fully supports VS Code Remote Development (SSH, WSL, containers, Codespaces).

**Critical requirement**: The Beans CLI must be installed on the **remote** machine, not your local machine.

## Documentation

Full user and developer documentation can be found at [beans.self.agency](beans.self.agency).

## Support the Project

If you find this extension useful, please leave a review on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=selfagency.beans-vscode) or [Open VSX](https://open-vsx.org/extension/selfagency/beans-vscode). Reviews help other developers discover the extension.

## License

[MIT](./LICENSE)

## Credits

- **[Hendrik Mans](https://github.com/hmans)**: Creator of Beans

## Accessibility Note

This extension is built with accessibility in mind following WCAG 2.2 Level AA guidelines, but issues may still exist. Please manually test keyboard navigation and screen-reader workflows. Consider auditing with [Accessibility Insights](https://accessibilityinsights.io/).

Feedback and accessibility improvement suggestions are welcome—please file an issue!
