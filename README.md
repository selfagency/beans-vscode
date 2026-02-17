# Beans VS Code Extension

Beautifully integrated Beans issue tracking for VS Code.

Beans is a file-based issue tracker that lives alongside your code. This extension brings the full Beans experience into VS Code with native tree views, AI integration, and powerful workflow automation.

[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fselfagency%2Fbeans-vscode%2Fmain%2Fpackage.json&query=%24.version&label=version&color=blue)](https://github.com/selfagency/beans-vscode/releases)
[![CI](https://github.com/selfagency/beans-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/ci.yml)
[![Remote Compatibility](https://github.com/selfagency/beans-vscode/actions/workflows/remote-test.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/remote-test.yml)
[![Release](https://github.com/selfagency/beans-vscode/actions/workflows/release.yml/badge.svg)](https://github.com/selfagency/beans-vscode/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

## Key Features

- **🌴 Tree Views**: Organized views for active, completed, draft, and scrapped beans
- **🔍 Search & Filter**: Full-text search, filter by status/type/priority/tags
- **🎯 Drag & Drop**: Create hierarchies and relationships visually
- **🤖 AI Integration**: MCP tools, `@beans` chat participant, auto-generated Copilot skills & instructions
- **🌐 Remote Ready**: Works seamlessly in SSH, WSL, containers, and Codespaces
- **⚡ Keyboard-First**: Configurable shortcuts for all operations
- **🧪 Extensively Tested**: Comprehensive automated unit and integration test suite
- **♿ Accessible**: Built following WCAG 2.2 Level AA guidelines

## Documentation

- **[User Guide](./docs/user-guide.md)** - Complete guide to using the extension
- **[AI Features](./docs/ai-features.md)** - MCP tools, chat participant, and Copilot integration
- **[Commands Reference](./docs/commands.md)** - Complete command listing with examples
- **[Architecture](./docs/architecture.md)** - Technical design and module boundaries
- **[Remote Development](./docs/remote-compatibility-testing.md)** - Remote testing guide

## Remote Development

This extension fully supports VS Code Remote Development (SSH, WSL, containers, Codespaces).

**Critical requirement**: The Beans CLI must be installed on the **remote** machine, not your local machine.

See the [Remote Development Guide](./docs/remote-compatibility-testing.md) for detailed setup instructions.

## Development

### Setup

```bash
git clone https://github.com/selfagency/beans-vscode.git
cd beans-vscode
pnpm install
pnpm run compile
pnpm test
```

### Workflow

```bash
pnpm run watch       # Watch mode
pnpm run test:watch  # Test watch mode
pnpm run lint        # Lint code
pnpm run check-types # Type check
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

## Accessibility Note

This extension is built with accessibility in mind following WCAG 2.2 Level AA guidelines, but issues may still exist. Please manually test keyboard navigation and screen-reader workflows. Consider auditing with [Accessibility Insights](https://accessibilityinsights.io/).

Feedback and accessibility improvement suggestions are welcome—please file an issue!
