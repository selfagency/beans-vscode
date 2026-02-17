# Beans VS Code Extension - User Guide

Complete guide for using the Beans VS Code extension in your workflow.

## Table of Contents

- [Getting Started](#getting-started)
- [Core Features](#core-features)
- [Commands](#commands)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Extension Settings](#extension-settings)
- [Troubleshooting](#troubleshooting)

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

## Commands

Full command reference → [commands.md](./commands.md)

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

### Performance Issues

**Check**:

- Number of beans (1000+ may be slow)
- File system speed (especially remote)
- Filter and sort complexity

**Solutions**:

- Apply filters to reduce displayed beans
- Use simpler sort modes
- Check remote connection speed

---

For AI integration features, see [ai-features.md](./ai-features.md).

For remote development, see [remote-compatibility-testing.md](./remote-compatibility-testing.md).
