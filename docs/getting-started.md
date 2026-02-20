---
title: Getting started
---

## Quick start for users

## Quick Start

### Install the [`beans`](https://github.com/hmans/beans#installation) CLI

#### macOS (Requires Homebrew)

```bash
brew install hmans/beans/beans
```

#### Linux, MacOs, Windows (Requires Go)

```bash
go install github.com/hmans/beans@latest
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
cd \<project-folder\>
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
