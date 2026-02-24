---
title: Commands reference
---

This document provides a comprehensive reference for all Beans VS Code extension commands, including command palette access, keyboard shortcuts, context menu locations, and workflow examples.

## Overview

The Beans extension provides commands organized into the following categories:

- [Workspace Management](#workspace-management)
- [Bean Operations](#bean-operations)
- [Details View and AI](./commands.md#details-view-and-ai)
- [Status Management](./commands.md#status-management)
- [Type and Priority](./commands.md#type-and-priority)
- [Relationships](./commands.md#relationships)
- [Filtering and Search](./commands.md#filtering-and-search)
- [Utilities](./commands.md#utilities)
- [MCP Integration](./commands.md#mcp-integration)
- [Chat Participant](./commands.md#chat-participant)

## Command Quick Reference

| Command                        | Description                     | Keybinding | Context Menu         |
| ------------------------------ | ------------------------------- | ---------- | -------------------- |
| `beans.init`                   | Initialize Beans in workspace   | -          | -                    |
| `beans.refresh`                | Refresh all tree views          | -          | Active title bar     |
| `beans.view`                   | View bean details               | -          | Tree items           |
| `beans.create`                 | Create new bean                 | -          | Draft title bar      |
| `beans.edit`                   | Edit bean markdown file         | -          | Tree items           |
| `beans.setStatus`              | Change bean status              | -          | Tree items           |
| `beans.setType`                | Change bean type                | -          | Tree items           |
| `beans.setPriority`            | Change bean priority            | -          | Tree items           |
| `beans.setParent`              | Set parent bean                 | -          | Tree items           |
| `beans.removeParent`           | Remove parent relationship      | -          | Tree items           |
| `beans.editBlocking`           | Edit blocking relationships     | -          | Tree items           |
| `beans.filter`                 | Filter beans by criteria        | -          | -                    |
| `beans.search`                 | Search beans                    | -          | Search title bar     |
| `beans.sort`                   | Change sort mode                | -          | -                    |
| `beans.copyId`                 | Copy bean ID to clipboard       | -          | Tree items           |
| `beans.delete`                 | Delete draft/scrapped bean      | -          | Tree items           |
| `beans.reopenCompleted`        | Reopen completed bean           | -          | Command palette only |
| `beans.reopenScrapped`         | Reopen scrapped bean            | -          | Command palette only |
| `beans.openConfig`             | Open `.beans.yml`               | -          | -                    |
| `beans.openExtensionSettings`  | Open VS Code extension settings | -          | Help title bar       |
| `beans.openUserGuide`          | Open user guide documentation   | -          | -                    |
| `beans.openAiFeaturesGuide`    | Open AI features guide          | -          | -                    |
| `beans.showOutput`             | Show extension output channel   | -          | Help title bar       |
| `beans.details.back`           | Back to previous bean           | -          | Details title bar    |
| `beans.copilotStartWork`       | Copilot: Start Work on Bean     | -          | Details title bar    |
| `beans.searchView.filter`      | Filter search results           | -          | Search title bar     |
| `beans.searchView.clear`       | Clear search filters            | -          | Search title bar     |
| `beans.openFirstMalformedBean` | Open first malformed bean       | -          | Draft title bar      |

## Workspace Management

### Initialize Beans in Workspace

**Command**: `beans.init`
**Category**: Beans
**When**: Always available

Initialize a new Beans workspace in the current folder. Creates `.beans.yml` configuration file with default settings.

**Usage**:

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "Beans: Initialize Beans in Workspace"
3. Press Enter

**What it does**:

- Runs `beans init` in workspace root
- Creates `.beans/` directory
- Generates `.beans.yml` with default configuration
- Activates extension features

**When to use**:

- First time using Beans in a project
- After cloning a repository without Beans setup

### Refresh

**Command**: `beans.refresh`
**Category**: Beans
**Icon**: `$(refresh)`
**When**: Workspace initialized

Refresh all tree views to reflect latest changes from filesystem.

**Usage**:

1. Click refresh icon in any tree view title bar
2. Or run from Command Palette: "Beans: Refresh"

**What it does**:

- Executes `beans graphql` to fetch all beans
- Updates Active, Draft, Completed, and Scrapped tree views
- Re-applies current filters and sort mode

**When to use**:

- After making changes outside VS Code
- After CLI operations in terminal
- To ensure UI is in sync with filesystem

### Open Configuration

**Command**: `beans.openConfig`
**Category**: Beans

Open the `.beans.yml` configuration file in the editor.

**Usage**:

1. Command Palette: "Beans: Open Configuration"
2. Or click "Open Config" button in bean details view

**What it does**:

- Opens `.beans.yml` in VS Code editor
- Provides syntax highlighting for YAML
- Enables editing of statuses, types, priorities, and other settings

**Configuration Options**:

```yaml
statuses:
  - todo
  - in-progress
  - completed
  - scrapped
  - draft

types:
  - milestone
  - epic
  - feature
  - bug
  - task

priorities:
  - critical
  - high
  - normal
  - low
  - deferred
```

### Show Output

**Command**: `beans.showOutput`
**Category**: Beans
**Icon**: `$(terminal)`

Open the Beans extension output channel to view logs and diagnostic information.

**Usage**:

1. Command Palette: "Beans: Show Output"
2. Or click Output icon in tree view title bar

**What it includes**:

- Extension activation logs
- CLI command executions
- Error messages and stack traces
- Timing information
- MCP server status

**When to use**:

- Troubleshooting extension issues
- Verifying CLI operations
- Debugging MCP tool calls
- Reporting bugs

### Open Extension Settings

**Command**: `beans.openExtensionSettings`
**Category**: Beans
**Icon**: `$(gear)`

Open VS Code settings filtered to Beans extension configuration.

**Usage**:

1. Command Palette: "Beans: Open Extension Settings"
2. Or click gear icon in Help view title bar

**When to use**:

- Configuring AI features, display mode, sort defaults
- Adjusting file watcher debounce or logging levels

### Open User Guide

**Command**: `beans.openUserGuide`
**Category**: Beans
**Icon**: `$(info)`

Open the Beans extension user guide documentation.

**Usage**:

1. Command Palette: "Beans: Open User Guide"

### Open AI Features Guide

**Command**: `beans.openAiFeaturesGuide`
**Category**: Beans
**Icon**: `$(sparkle)`

Open the Beans AI features documentation covering MCP tools, chat participant, and Copilot integration.

**Usage**:

1. Command Palette: "Beans: Open AI Features Guide"

## Bean Operations

### View Bean

**Command**: `beans.view`
**Category**: Beans
**When**: Workspace initialized
**Context Menu**: Tree items

View bean details in markdown preview pane.

**Usage**:

- **Tree View**: Click bean to view in details panel
- **Context Menu**: Right-click bean → "View Bean"
- **Command Palette**: "Beans: View Bean" → Select bean from list

**What it does**:

- Opens bean in VS Code preview pane
- Displays markdown-rendered body content
- Shows metadata: status, type, priority, dates
- Highlights relationships: parent, children, blocking, blocked-by
- Provides action buttons for common operations

**Details Panel Sections**:

- **Header**: Bean code, title, status badge
- **Metadata**: Type, priority, created/updated dates
- **Relationships**: Parent bean, child beans, blocking relationships
- **Body**: Markdown-rendered description and checklists
- **Actions**: Quick access buttons for edit, status change, etc.

### Create Bean

**Command**: `beans.create`
**Category**: Beans
**Icon**: `$(add)`
**When**: Workspace initialized
**Context Menu**: Tree title bar

Create a new bean with interactive prompts.

**Usage**:

1. Click `+` icon in tree view title bar
2. Or Command Palette: "Beans: Create Bean"
3. Enter bean title (required)
4. Select bean type: milestone, epic, feature, bug, task
5. Enter description (optional)

**Workflow**:

```text
Enter Title → Select Type → Enter Description → Bean Created
```

## MCP Integration

This extension exposes a small set of MCP (Model Context Protocol) tools so external LLM-driven workflows can interact with the extension and the Beans CLI. We intentionally expose a compact, consolidated surface so callers can perform a wide range of operations without an explosion of fine-grained tools.

Public MCP tools (names and brief description):

- `beans_vscode_init` — Initialize Beans in the workspace (accepts optional `prefix`).
- `beans_vscode_view` — Fetch full bean details by `beanId`.
- `beans_vscode_create` — Create a new bean (title, type, optional status/priority/description/parent).
- `beans_vscode_update` — Consolidated update API for metadata fields (`beanId`, `status`, `type`, `priority`, `parent`, `clearParent`, `blocking`, `blockedBy`).
- `beans_vscode_delete` — Delete a bean (requires `beanId`, optional `force`).
- `beans_vscode_reopen` — Reopen a closed bean (`beanId`, `requiredCurrentStatus` of `completed|scrapped`, `targetStatus`).
- `beans_vscode_query` — Unified query tool for `refresh`, `filter`, `search`, `sort`, `llm_context`, and `open_config` operations. Accepts `operation` plus optional params like `mode`, `statuses`, `types`, `search`, `tags`, `includeClosed`, and `writeToWorkspaceInstructions`.
- `beans_vscode_bean_file` — Read/create/edit/delete files under `.beans` via an `operation` (`read|edit|create|delete`), `path`, `content`, and `overwrite` flag.
- `beans_vscode_output` — Read extension output logs or show usage guidance (`operation: read|show`, optional `lines`).

Notes and guidance

- Prefer `beans_vscode_query` for list/search/filter/sort workflows — it consolidates the logic and can also generate Copilot instructions (`llm_context`) or open the workspace config (`open_config`).
- Use `beans_vscode_update` for any metadata changes instead of per-field update tools; it preserves idempotency and reduces tool surface complexity.
- When reading or editing files under `.beans`, use `beans_vscode_bean_file` to ensure path sanitization and workspace-relative safety.
- `beans_vscode_output` enforces that the requested log path stays within the workspace or the VS Code log directory for security.

**Result**:

- New bean file created in `.beans/`
- Bean appears in Active tree view (status: `todo`)
- Success notification shows bean code
- All tree views refresh automatically

**Example**:

```text
Title: "Add user authentication"
Type: feature
Description: "Implement JWT-based auth with refresh tokens"
→ Creates beans-vscode-xyzw--add-user-authentication.md
```

### Edit Bean

**Command**: `beans.edit`
**Category**: Beans
**Icon**: `$(edit)`
**When**: Workspace initialized
**Context Menu**: Tree items, Details view

Open bean markdown file in VS Code editor.

**Usage**:

- **Context Menu**: Right-click bean → "Edit Bean"
- **Details View**: Click pencil icon in title bar
- **Command Palette**: "Beans: Edit Bean" → Select bean

**What it does**:

- Opens `.beans/<bean-file>.md` in editor
- Enables direct editing of:
  - Bean body (description, notes, checklists)
  - Frontmatter metadata (manually if needed)
- Saves changes to filesystem
- Tree views auto-update on save (if file watcher enabled)
