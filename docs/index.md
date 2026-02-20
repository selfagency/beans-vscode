---
title: Beans Documentation
---

![Beans](./icon.png)

**Beautifully integrated Beans issue tracking for VS Code**

[Beans](https://github.com/hmans/beans) is a file-based issue tracker that lives alongside your code. This extension brings the full Beans experience into VS Code with native tree views, AI integration, and powerful workflow automation.

[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fselfagency%2Fbeans-vscode%2Fmain%2Fpackage.json&query=%24.version&label=Version&color=blue)](https://github.com/selfagency/beans-vscode/releases) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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
