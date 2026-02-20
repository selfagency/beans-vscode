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

### Sidebar Layout

The Beans sidebar contains seven panels:

- **Drafts** - Beans in draft status, needing refinement
- **Open Beans** - Active beans (todo and in-progress)
- **Completed** - Successfully finished beans
- **Scrapped** - Abandoned beans
- **Search** - Full-text search results with context menus
- **Details** - Rich webview showing the selected bean's content, properties, and relationships
- **Help** - Quick access to documentation, output channel, and settings

On first launch, the sidebar defaults are tuned to prioritize active work. After first use, VS Code persists your panel expand/collapse state and sizing, so you can resize panes once and keep your preferred layout.

You can toggle item counts in panel headers via the `beans.view.showCounts` setting.

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

### Details View

Click any bean in the sidebar to open its Details panel. The Details view provides:

- **Rendered markdown** body with full formatting support
- **Interactive checklists** - Click checkboxes to toggle completion directly in the view; changes persist to the bean file
- **Editable properties** - Status, type, priority displayed as actionable elements
- **Relationship navigation** - Click parent beans, children, or blocking relationships to navigate between beans
- **Browsing history** - Use the back button to return to previously viewed beans
- **Live updates** - File watcher detects external edits and refreshes the view

### Copilot Start Work

From the Details view, click the chat icon to launch a Copilot-assisted workflow for the selected bean. Choose from six templates:

- **Assess current status** - Get Copilot's analysis of the bean's progress
- **Determine remaining steps** - Ask Copilot what work remains
- **Close and commit** - Get guidance on completing and committing the bean
- **Export to GitHub issue** - Draft a GitHub issue from the bean's content
- **Set in-progress** - Mark the bean as in-progress with Copilot assistance
- **Flesh out specs** - Have Copilot help expand the bean's description and requirements

### File Watching

The extension automatically watches the `.beans/` directory for changes and refreshes tree views when files change. This detects edits from the CLI, other editors, or git operations.

The debounce interval is configurable via `beans.fileWatcher.debounceMs` (default: 20 seconds).

### Malformed Bean Detection

If Beans detects malformed files (indicated by `.fixme` files), a warning icon appears in the Drafts pane title bar. Click it to navigate directly to the first malformed bean for correction.

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

| Setting                         | Type    | Default   | Description                                             |
| ------------------------------- | ------- | --------- | ------------------------------------------------------- |
| `beans.cliPath`                 | string  | `"beans"` | Path to Beans CLI executable                            |
| `beans.workspaceRoot`           | string  | `""`      | Override workspace root (advanced)                      |
| `beans.enableOnlyIfInitialized` | boolean | `false`   | Only activate if `.beans.yml` exists                    |
| `beans.autoInit.enabled`        | boolean | `true`    | Show initialization prompt for uninitialized workspaces |
| `beans.hideClosedInQuickPick`   | boolean | `true`    | Hide completed/scrapped beans from quick picks          |

### AI Settings

| Setting                             | Type    | Default | Description                                  |
| ----------------------------------- | ------- | ------- | -------------------------------------------- |
| `beans.ai.enabled`                  | boolean | `true`  | Master switch for AI features (MCP and chat) |
| `beans.mcp.enabled`                 | boolean | `true`  | Enable MCP server definition provider        |
| `beans.mcp.port`                    | number  | `39173` | Port metadata propagated to MCP process      |
| `beans.mcp.showStartupNotification` | boolean | `true`  | Show notification when MCP server starts     |

### UI Settings

| Setting                             | Type    | Default                        | Description                                        |
| ----------------------------------- | ------- | ------------------------------ | -------------------------------------------------- |
| `beans.view.displayMode`            | enum    | `"separate-panes"`             | Sidebar layout: separate panes by status           |
| `beans.view.showCounts`             | boolean | `true`                         | Show item counts in panel headers                  |
| `beans.defaultSortMode`             | enum    | `"status-priority-type-title"` | Default sort mode for trees                        |
| `beans.fileWatcher.debounceMs`      | number  | `20000`                        | File watcher debounce interval in ms (1000-120000) |
| `beans.logging.level`               | enum    | `"info"`                       | Extension log verbosity                            |
| `beans.logging.diagnostics.enabled` | boolean | `false`                        | Verbose diagnostics including GraphQL queries      |

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
