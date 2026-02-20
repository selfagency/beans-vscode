---
title: Extension settings
---

Access via `Cmd+,` (Mac) or `Ctrl+,` (Windows/Linux), search "Beans".

## Core Settings

| Setting                         | Type    | Default   | Description                                             |
| ------------------------------- | ------- | --------- | ------------------------------------------------------- |
| `beans.cliPath`                 | string  | `"beans"` | Path to Beans CLI executable                            |
| `beans.workspaceRoot`           | string  | `""`      | Override workspace root (advanced)                      |
| `beans.enableOnlyIfInitialized` | boolean | `false`   | Only activate if `.beans.yml` exists                    |
| `beans.autoInit.enabled`        | boolean | `true`    | Show initialization prompt for uninitialized workspaces |
| `beans.hideClosedInQuickPick`   | boolean | `true`    | Hide completed/scrapped beans from quick picks          |

## AI Settings

| Setting                             | Type    | Default | Description                                  |
| ----------------------------------- | ------- | ------- | -------------------------------------------- |
| `beans.ai.enabled`                  | boolean | `true`  | Master switch for AI features (MCP and chat) |
| `beans.mcp.enabled`                 | boolean | `true`  | Enable MCP server definition provider        |
| `beans.mcp.port`                    | number  | `39173` | Port metadata propagated to MCP process      |
| `beans.mcp.showStartupNotification` | boolean | `true`  | Show notification when MCP server starts     |

## UI Settings

| Setting                             | Type    | Default                        | Description                                        |
| ----------------------------------- | ------- | ------------------------------ | -------------------------------------------------- |
| `beans.view.displayMode`            | enum    | `"separate-panes"`             | Sidebar layout: separate panes by status           |
| `beans.view.showCounts`             | boolean | `true`                         | Show item counts in panel headers                  |
| `beans.defaultSortMode`             | enum    | `"status-priority-type-title"` | Default sort mode for trees                        |
| `beans.fileWatcher.debounceMs`      | number  | `20000`                        | File watcher debounce interval in ms (1000-120000) |
| `beans.logging.level`               | enum    | `"info"`                       | Extension log verbosity                            |
| `beans.logging.diagnostics.enabled` | boolean | `false`                        | Verbose diagnostics including GraphQL queries      |

## Sort Modes

- `status-priority-type-title` (default): Grouped by status with priority
- `priority-status-type-title`: Highest priority first
- `updated`: Most recently updated first
- `created`: Newest beans first
- `id`: Alphabetical by bean code
