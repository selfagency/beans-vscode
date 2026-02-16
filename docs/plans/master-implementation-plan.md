# Beans VS Code Extension - Complete Implementation Specification

## Executive Summary

This specification defines the complete implementation of a production-ready VS Code extension for the Beans issue tracker. The extension will emulate Beans TUI workflows while providing a native VS Code experience through sidebar trees, commands, Copilot integration, and remote environment support.

**Current State**: Microsoft starter template with single hello-world command
**Target State**: Full-featured Beans integration with tree views, TUI parity, AI integration, and comprehensive testing
**Timeline**: 5 milestones over ~8-10 weeks
**Tech Stack**: TypeScript 5.9, VS Code API 1.109+, esbuild, vitest/mocha integration tests

## Core Architecture Decisions

| Decision                                                | Rationale                                                               | Trade-offs                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------- |
| Single Beans view container with 5 dedicated panes      | Satisfies non-negotiable UX requirement for independent expand/collapse | More manifest complexity vs. single filtered view |
| CLI `--json` as primary data source                     | Stable, machine-parse-able, officially supported                        | GraphQL queries only via CLI, not direct          |
| Process execution via argument arrays only              | Prevents shell injection vulnerabilities                                | Slightly more verbose than template strings       |
| Workspace extension execution preference                | Ensures CLI access in remote scenarios                                  | May not work if beans CLI not in remote path      |
| Separate provider per pane vs. shared filtered provider | Better state isolation and performance                                  | More code but clearer separation                  |

---

## Data Models and Type Definitions

### Core Bean Model

```typescript
// src/beans/model/Bean.ts
export interface Bean {
  id: string; // Full bean ID (e.g., 'beans-vscode-abc1')
  code: string; // Short code (e.g., 'abc1')
  title: string;
  body: string; // Markdown content
  status: BeanStatus;
  type: BeanType;
  priority?: BeanPriority;
  tags: string[]; // Tags from frontmatter
  parent?: string; // Parent bean ID
  blocking: string[]; // IDs this bean blocks
  blockedBy: string[]; // IDs blocking this bean
  createdAt: Date;
  updatedAt: Date;
  etag: string; // For optimistic concurrency
}

export type BeanStatus = 'todo' | 'in-progress' | 'completed' | 'scrapped' | 'draft';
export type BeanType = 'milestone' | 'epic' | 'feature' | 'bug' | 'task';
export type BeanPriority = 'critical' | 'high' | 'normal' | 'low' | 'deferred';

export interface BeansConfig {
  path: string; // .beans/ directory
  prefix: string; // ID prefix
  id_length: number;
  default_status: BeanStatus;
  default_type: BeanType;
  types?: BeanType[]; // Custom types
  statuses?: BeanStatus[]; // Custom statuses
  priorities?: BeanPriority[];
}
```

### Error Types

```typescript
// src/beans/model/errors.ts
export abstract class BeansError extends Error {
  abstract readonly code: string;
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BeansCLINotFoundError extends BeansError {
  readonly code = 'CLI_NOT_FOUND';
}

export class BeansConfigMissingError extends BeansError {
  readonly code = 'CONFIG_MISSING';
}

export class BeansJSONParseError extends BeansError {
  readonly code = 'JSON_PARSE_ERROR';
  constructor(message: string, public readonly output: string, cause?: Error) {
    super(message, cause);
  }
}

export class BeansIntegrityCheckFailedError extends BeansError {
  readonly code = 'INTEGRITY_CHECK_FAILED';
}

export class BeansConcurrencyError extends BeansError {
  readonly code = 'CONCURRENCY_ERROR';
  constructor(message: string, public readonly currentEtag: string) {
    super(message);
  }
}
```

---

## Package.json Manifest Structure

### Complete Contributions Schema

```json
{
  "name": "beans-vscode",
  "displayName": "Beans",
  "version": "0.1.0",
  "engines": { "vscode": "^1.109.0" },
  "categories": ["Other"],
  "extensionKind": ["workspace"],
  "activationEvents": [
    "onStartupFinished",
    "workspaceContains:.beans",
    "workspaceContains:.beans.yml"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "beans",
          "title": "Beans",
          "icon": "$(notebook)"
        }
      ]
    },
    "views": {
      "beans": [
        { "id": "beans.active", "name": "Active", "when": "beans.initialized" },
        { "id": "beans.completed", "name": "Completed", "when": "beans.initialized" },
        { "id": "beans.draft", "name": "Draft", "when": "beans.initialized" },
        { "id": "beans.scrapped", "name": "Scrapped", "when": "beans.initialized" },
        { "id": "beans.archived", "name": "Archived", "when": "beans.initialized" }
      ]
    },
    "commands": [
      { "command": "beans.refresh", "title": "Refresh", "category": "Beans", "icon": "$(refresh)" },
      { "command": "beans.create", "title": "Create Bean", "category": "Beans", "icon": "$(add)" },
      { "command": "beans.view", "title": "View Bean", "category": "Beans" },
      { "command": "beans.edit", "title": "Edit Bean", "category": "Beans", "icon": "$(edit)" },
      { "command": "beans.setStatus", "title": "Set Status", "category": "Beans" },
      { "command": "beans.setType", "title": "Set Type", "category": "Beans" },
      { "command": "beans.setPriority", "title": "Set Priority", "category": "Beans" },
      { "command": "beans.setParent", "title": "Set Parent", "category": "Beans" },
      { "command": "beans.removeParent", "title": "Remove Parent", "category": "Beans" },
      { "command": "beans.editBlocking", "title": "Edit Blocking Links", "category": "Beans" },
      { "command": "beans.copyId", "title": "Copy Bean ID", "category": "Beans", "icon": "$(copy)" },
      { "command": "beans.delete", "title": "Delete Bean", "category": "Beans", "icon": "$(trash)" },
      { "command": "beans.filter", "title": "Filter Beans", "category": "Beans", "icon": "$(filter)" },
      { "command": "beans.tagFilter", "title": "Filter by Tag", "category": "Beans" },
      { "command": "beans.clearFilter", "title": "Clear Filters", "category": "Beans", "icon": "$(clear-all)" },
      { "command": "beans.sort", "title": "Change Sort Order", "category": "Beans" },
      { "command": "beans.init", "title": "Initialize Beans in Workspace", "category": "Beans" },
      { "command": "beans.openConfig", "title": "Open Configuration", "category": "Beans" }
    ],
    "menus": {
      "view/title": [
        { "command": "beans.refresh", "when": "view =~ /^beans\\./, "group": "navigation@1" },
        { "command": "beans.create", "when": "view =~ /^beans\\./, "group": "navigation@2" },
        { "command": "beans.filter", "when": "view == beans.active", "group": "navigation@3" },
        { "command": "beans.sort", "when": "view =~ /^beans\\./, "group": "2_workspace" }
      ],
      "view/item/context": [
        { "command": "beans.view", "when": "viewItem =~ /^bean/, "group": "1_view@1" },
        { "command": "beans.edit", "when": "viewItem =~ /^bean/, "group": "1_view@2" },
        { "command": "beans.setStatus", "when": "viewItem =~ /^bean/, "group": "2_edit@1" },
        { "command": "beans.setType", "when": "viewItem =~ /^bean/, "group": "2_edit@2" },
        { "command": "beans.setPriority", "when": "viewItem =~ /^bean/, "group": "2_edit@3" },
        { "command": "beans.setParent", "when": "viewItem =~ /^bean/, "group": "3_relation@1" },
        { "command": "beans.editBlocking", "when": "viewItem =~ /^bean/, "group": "3_relation@2" },
        { "command": "beans.copyId", "when": "viewItem =~ /^bean/, "group": "4_util@1" },
        { "command": "beans.delete", "when": "viewItem =~ /^bean-(scrapped|draft)$/, "group": "5_danger@1" }
      ],
      "commandPalette": [
        { "command": "beans.view", "when": "beans.initialized" },
        { "command": "beans.edit", "when": "beans.initialized" },
        { "command": "beans.delete", "when": "false" }
      ]
    },
    "keybindings": [
      { "command": "beans.view", "key": "enter", "when": "focusedView =~ /^beans\\./ && listFocus" },
      { "command": "beans.create", "key": "c", "when": "focusedView =~ /^beans\\./" },
      { "command": "beans.edit", "key": "e", "when": "focusedView =~ /^beans\\./ && listFocus" },
      { "command": "beans.setStatus", "key": "s", "when": "focusedView =~ /^beans\\./ && listFocus" },
      { "command": "beans.setType", "key": "t", "when": "focusedView =~ /^beans\\./ && listFocus" },
      { "command": "beans.setPriority", "key": "p", "when": "focusedView =~ /^beans\\./ && listFocus" },
      { "command": "beans.copyId", "key": "y", "when": "focusedView =~ /^beans\\./ && listFocus" },
      { "command": "beans.filter", "key": "/", "when": "focusedView == beans.active" }
    ],
    "configuration": {
      "title": "Beans",
      "properties": {
        "beans.cliPath": {
          "type": "string",
          "default": "beans",
          "markdownDescription": "Path to `beans` CLI executable. Defaults to `beans` in PATH."
        },
        "beans.autoInit.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Show initialization prompt when opening a workspace without Beans."
        },
        "beans.defaultSortMode": {
          "type": "string",
          "enum": ["status-priority-type-title", "updated", "created", "id"],
          "default": "status-priority-type-title",
          "enumDescriptions": [
            "Sort by status, then priority, then type, then title (TUI default)",
            "Sort by last updated time",
            "Sort by creation time",
            "Sort by bean ID/code"
          ]
        },
        "beans.hideClosedInQuickPick": {
          "type": "boolean",
          "default": true,
          "description": "Hide completed and scrapped beans from command palette quick picks (except explicit reopen commands)."
        },
        "beans.logging.level": {
          "type": "string",
          "enum": ["debug", "info", "warn", "error"],
          "default": "info",
          "description": "Logging verbosity for Beans extension output channel."
        }
      }
    }
  }
}
```

---

## Implementation Steps

### M1: Foundation and Architecture (Week 1-2)

#### Step 1.1: TypeScript Configuration and Build Setup

**Acceptance Criteria:**

- Strict TypeScript compilation with no implicit any
- esbuild produces optimized bundle
- Source maps work for debugging

**Implementation:**

```typescript
// Update tsconfig.json
{
  "compilerOptions": {
    "module": "Node16",
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "sourceMap": true,
    "rootDir": "src",
    "outDir": "out",
    "paths": {
      "@beans/*": ["./src/beans/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "out", "dist"]
}
```

#### Step 1.2: Core Data Models and Types

**Create model files** (see Data Models section above):

- `src/beans/model/Bean.ts` - Core bean interface
- `src/beans/model/config.ts` - Configuration types
- `src/beans/model/errors.ts` - Typed error hierarchy
- `src/beans/model/index.ts` - Barrel export

**Validation:**

```bash
pnpm run check-types  # Must pass with no errors
```

#### Step 1.3: Logging Infrastructure

```typescript
// src/beans/logging/BeansOutput.ts
import * as vscode from 'vscode';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class BeansOutput {
  private static instance: BeansOutput;
  private outputChannel: vscode.OutputChannel;
  private level: LogLevel = 'info';

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Beans', { log: true });
    this.updateLevel();
  }

  static getInstance(): BeansOutput {
    if (!BeansOutput.instance) {
      BeansOutput.instance = new BeansOutput();
    }
    return BeansOutput.instance;
  }

  private updateLevel() {
    const config = vscode.workspace.getConfiguration('beans');
    this.level = config.get<LogLevel>('logging.level', 'info');
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      this.outputChannel.appendLine(`[DEBUG] ${message} ${JSON.stringify(args)}`);
    }
  }

  info(message: string) {
    if (this.shouldLog('info')) {
      this.outputChannel.appendLine(`[INFO] ${message}`);
    }
  }

  warn(message: string, error?: Error) {
    if (this.shouldLog('warn')) {
      this.outputChannel.appendLine(`[WARN] ${message}${error ? ` - ${error.message}` : ''}`);
    }
  }

  error(message: string, error?: Error) {
    if (this.shouldLog('error')) {
      this.outputChannel.appendLine(`[ERROR] ${message}`);
      if (error) {
        this.outputChannel.appendLine(`  ${error.stack || error.message}`);
      }
    }
  }

  show() {
    this.outputChannel.show();
  }

  dispose() {
    this.outputChannel.dispose();
  }
}
```

#### Step 1.4: BeansService - CLI Wrapper

```typescript
// src/beans/service/BeansService.ts
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Bean, BeansConfig } from '../model';
import { BeansCLINotFoundError, BeansJSONParseError, BeansConfigMissingError } from '../model/errors';
import { BeansOutput } from '../logging/BeansOutput';

const execAsync = promisify(exec);

export class BeansService {
  private readonly logger = BeansOutput.getInstance();
  private cliPath: string;

  constructor(private readonly workspaceRoot: string) {
    const config = vscode.workspace.getConfiguration('beans');
    this.cliPath = config.get<string>('cliPath', 'beans');
  }

  /**
   * Check if beans CLI is available in PATH
   */
  async checkCLIAvailable(): Promise<boolean> {
    try {
      await execAsync(`${this.cliPath} --version`, {
        cwd: this.workspaceRoot,
        timeout: 5000
      });
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false;
      }
      // Other errors might mean CLI is there but something else wrong
      return true;
    }
  }

  /**
   * Execute beans CLI command with JSON output
   * Security: Uses argument array to prevent shell injection
   */
  private async execute<T>(args: string[]): Promise<T> {
    const command = `${this.cliPath} ${args.join(' ')}`;
    this.logger.debug('Executing:', command);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workspaceRoot,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 30000 // 30s
      });

      if (stderr && !stderr.includes('[INFO]')) {
        this.logger.warn('CLI stderr:', new Error(stderr));
      }

      try {
        return JSON.parse(stdout) as T;
      } catch (parseError) {
        throw new BeansJSONParseError('Failed to parse beans CLI JSON output', stdout, parseError as Error);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new BeansCLINotFoundError(
          `Beans CLI not found at: ${this.cliPath}. Please install beans or configure beans.cliPath setting.`
        );
      }
      throw error;
    }
  }

  async checkInitialized(): Promise<boolean> {
    try {
      await this.execute<{ initialized: boolean }>(['check', '--json']);
      return true;
    } catch {
      return false;
    }
  }

  async getConfig(): Promise<BeansConfig> {
    const result = await this.execute<{ config: BeansConfig }>(['config', '--json']);
    if (!result.config) {
      throw new BeansConfigMissingError('.beans.yml not found or invalid');
    }
    return result.config;
  }

  async listBeans(options?: { status?: string[]; type?: string[]; search?: string }): Promise<Bean[]> {
    const args = ['list', '--json'];
    if (options?.status) {
      args.push('--status', options.status.join(','));
    }
    if (options?.type) {
      args.push('--type', options.type.join(','));
    }
    if (options?.search) {
      args.push('--search', options.search);
    }
    const result = await this.execute<{ beans: Bean[] }>(args);
    return result.beans || [];
  }

  async showBean(id: string): Promise<Bean> {
    const result = await this.execute<{ bean: Bean }>(['show', '--json', id]);
    return result.bean;
  }

  async createBean(data: {
    title: string;
    type: string;
    status?: string;
    priority?: string;
    description?: string;
  }): Promise<Bean> {
    const args = ['create', '--json', data.title, '-t', data.type];
    if (data.status) args.push('-s', data.status);
    if (data.priority) args.push('-p', data.priority);
    if (data.description) args.push('-d', data.description);

    const result = await this.execute<{ bean: Bean }>(args);
    return result.bean;
  }

  async updateBean(
    id: string,
    updates: {
      status?: string;
      type?: string;
      priority?: string;
      parent?: string;
    }
  ): Promise<Bean> {
    const args = ['update', '--json', id];
    if (updates.status) args.push('-s', updates.status);
    if (updates.type) args.push('-t', updates.type);
    if (updates.priority) args.push('-p', updates.priority);
    if (updates.parent) args.push('--parent', updates.parent);

    const result = await this.execute<{ bean: Bean }>(args);
    return result.bean;
  }

  async deleteBean(id: string): Promise<void> {
    await this.execute<{}>(['delete', '--json', id]);
  }

  async init(): Promise<void> {
    await this.execute<{}>(['init']);
  }
}
```

#### Step 1.5: Extension Activation and Service Registration

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { BeansService } from './beans/service/BeansService';
import { BeansOutput } from './beans/logging/BeansOutput';
import { BeansCLINotFoundError } from './beans/model/errors';

let beansService: BeansService | undefined;
let logger: BeansOutput;

export async function activate(context: vscode.ExtensionContext) {
  logger = BeansOutput.getInstance();
  logger.info('Activating Beans extension...');

  // Get workspace root
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    logger.warn('No workspace folder open');
    return;
  }

  try {
    beansService = new BeansService(workspaceFolder.uri.fsPath);

    // Check if beans CLI is available
    const cliAvailable = await beansService.checkCLIAvailable();
    if (!cliAvailable) {
      await promptForCLIInstallation();
      return; // Don't proceed with activation if CLI not found
    }

    const isInitialized = await beansService.checkInitialized();
    await vscode.commands.executeCommand('setContext', 'beans.initialized', isInitialized);

    if (!isInitialized) {
      await promptForInitialization(beansService);
    } else {
      logger.info('Beans workspace detected and initialized');
    }

    // Register commands
    registerCommands(context, beansService);

    logger.info('Beans extension activated successfully');
  } catch (error) {
    logger.error('Failed to activate Beans extension', error as Error);

    // Handle CLI not found error specifically
    if (error instanceof BeansCLINotFoundError) {
      await promptForCLIInstallation();
    } else {
      vscode.window.showErrorMessage(`Beans extension activation failed: ${(error as Error).message}`);
    }
  }
}

async function promptForCLIInstallation() {
  const result = await vscode.window.showErrorMessage(
    'Beans CLI is not installed or not found in PATH. Please install it to use this extension.',
    'Install Instructions',
    'Configure Path',
    'Dismiss'
  );

  if (result === 'Install Instructions') {
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/jfcantinz/beans#installation'));
  } else if (result === 'Configure Path') {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'beans.cliPath');
  }
}

async function promptForInitialization(service: BeansService) {
  const config = vscode.workspace.getConfiguration('beans');
  if (!config.get<boolean>('autoInit.enabled', true)) {
    return;
  }

  const result = await vscode.window.showInformationMessage(
    'Beans is not initialized in this workspace. Would you like to initialize it now?',
    'Initialize',
    'Learn More',
    'Not Now'
  );

  if (result === 'Initialize') {
    try {
      await service.init();
      await vscode.commands.executeCommand('setContext', 'beans.initialized', true);
      vscode.window.showInformationMessage('Beans initialized successfully!');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to initialize Beans: ${(error as Error).message}`);
    }
  } else if (result === 'Learn More') {
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/jfcantinz/beans'));
  }
}

function registerCommands(context: vscode.ExtensionContext, service: BeansService) {
  // Placeholder - will be expanded in M2
  context.subscriptions.push(
    vscode.commands.registerCommand('beans.init', async () => {
      await service.init();
      await vscode.commands.executeCommand('setContext', 'beans.initialized', true);
    })
  );
}

export function deactivate() {
  logger?.dispose();
}
```

**Validation:**

- Extension activates without errors
- Init prompt appears in non-beans workspaces
- Context `beans.initialized` is set correctly
- Logging output visible in "Beans" output channel

1. **Manifest contributions: views, commands, menus, keybindings, settings, AI**

   - Expand `[package.json](package.json)` `contributes`:
     - `viewsContainers.activitybar` for Beans container icon/title.
     - `views` for panes: active/completed/draft/scrapped/archived.
     - `commands` grouped under category “Beans”.
     - `menus.view/title`, `menus.view/item/context`, `menus.commandPalette` with strict `when` clauses.
     - `keybindings` for TUI-parity interactions (`enter`, `b`, `c`, `e`, `p`, `P`, `s`, `t`, `y`, `/`, plus chord strategy).
     - `configuration` keys (auto-init prompt, default sort, pane defaults, command scope, CLI path, verbosity, preview behavior, hideClosedInQuickPick).
     - `chatParticipants` and `mcpServerDefinitionProviders`.
   - Set `extensionKind` to prefer workspace execution for CLI access in remote environments.

2. **Implement Beans CLI integration and robust error mapping**

   - In `BeansService`, execute processes with argument arrays only (no shell string building).
   - Resolve CLI path from setting + PATH fallback.
   - Add typed failures: command-not-found, JSON-parse, config-missing, integrity-check-failed, permission, timeout.
   - Add guards for `beans --json` support and fallback error messages with “Open Logs”/“Retry”.

3. **Tree data model + multi-pane providers**

   - Implement `[src/beans/tree/BeansTreeDataProvider.ts](src/beans/tree/BeansTreeDataProvider.ts)`:
     - Build hierarchical nodes by type + parent relations.
     - Render labels/descriptions/tooltips with code/id, type, status, priority.
     - Implement sort modes: default (`status/priority/type/title`), `updated_at`, `created_at`, `id/code`.
   - Add pane-specific wrappers or parameterized providers:
     - `[src/beans/tree/providers/ActiveBeansProvider.ts](src/beans/tree/providers/ActiveBeansProvider.ts)` and peers for completed/draft/scrapped/archived.
   - Persist expansion/collapse and selection state via workspace/global state.

4. **Tree item semantics, icons, context values, and accessibility**

   - Set `TreeItem.contextValue` for command scoping (single, multi, closable, reopenable, hasParent, etc.).
   - Use product icons (`ThemeIcon`) for status/type/priority cues with text redundancy (not color-only).
   - Ensure accessible labels and predictable keyboard focus behavior.

5. **Implement core commands (TUI parity baseline)**

   - Add `[src/beans/commands/BeansCommands.ts](src/beans/commands/BeansCommands.ts)` registering:
     - View details, create, edit in editor, set parent, set priority, set status, set type, manage blocking, copy ID, refresh, filter, clear filter.
   - Implement batch semantics where multi-select exists.
   - Wire Enter on tree selection to open details/editor path.

6. **Command palette + quick pick flows**

   - Add command handlers in `[src/beans/commands/quickpick/*.ts](src/beans/commands/quickpick)`:
     - Create bean flow.
     - Update status/type/priority/parent/blocking.
     - Filter/tag filter flow.
   - Exclude completed/scrapped from default quick picks unless explicit reopen/revive commands are used.
   - Add reopen/revive commands scoped to completed/scrapped panes and explicit quick pick modes.

7. **Detail/preview experience in editor**

   - Implement markdown/details provider in `[src/beans/preview/BeansPreviewProvider.ts](src/beans/preview/BeansPreviewProvider.ts)`.
   - Support opening bean markdown in editor and command-driven “view details”.
   - Add status badges/metadata rendering conventions inspired by Beads but visually distinct.
   - Document tree double-click limitation and provide single-click + Enter/context command alternatives.

8. **Relationship workflows (parent, blocking, drag/drop)**

   - Add parent and blocking management flows with validation (prevent cycles where applicable).
   - Implement tree drag/drop to re-parent via `TreeDragAndDropController` in `[src/beans/tree/BeansTreeDragDrop.ts](src/beans/tree/BeansTreeDragDrop.ts)`.
   - Add confirmation and rollback-safe refresh behavior on mutation failures.

9. **Filtering system**

   - Implement global/stateful filter model in `[src/beans/filter/BeansFilterState.ts](src/beans/filter/BeansFilterState.ts)`.
   - Support:
     - Text filter (`/` pattern equivalent),
     - Tag filter (`g t` equivalent exposed as command/keybinding),
     - Optional hide/show completed + scrapped in active pane view logic.
   - Reflect active filters in view title/description.

10. **Workspace init detection + controlled notifications**

    - Add startup check for missing `.beans` or `.beans.yml`.
    - Show actionable notification: Initialize now / Learn more / Dismiss.
    - Respect setting to disable prompt and session-level dismissal memory.
    - Add no-spam guard (single root-cause notification strategy).

11. **Settings-backed `.beans.yml` editing support**

    - Provide commands to open/update project beans config via `BeansConfigManager`.
    - Keep VS Code settings as UX controls; avoid custom settings webview.
    - Add helper commands linking directly to extension setting IDs.

12. **Copilot MCP integration**

    - Add `[src/ai/mcp/BeansMcpIntegration.ts](src/ai/mcp/BeansMcpIntegration.ts)`:
      - Register MCP server definition provider.
      - Return stdio definition for Beans MCP command wrapper (or extension-managed local server command).
      - Add change event handling and resolve-time validation.
    - Add troubleshooting commands: list/config/open logs/reset guidance.

13. **Copilot chat participant + prompt-tsx**

    - Add `[src/ai/chat/BeansChatIntegration.ts](src/ai/chat/BeansChatIntegration.ts)`:
      - One participant focused on Beans workflow.
      - Slash commands (e.g., summarize status, next work, create/update bean intent).
      - Follow-up provider and structured responses.
    - Add prompt composition with `[src/ai/chat/prompts/*.tsx](src/ai/chat/prompts)` using prompt-tsx prioritization.
    - Scope tool usage to Beans operations and add guardrails for destructive actions.

14. **Remote compatibility hardening**

    - Detect runtime environment (`uiKind`, `remoteName`, extension kind) and ensure workspace-host execution for CLI.
    - Use VS Code APIs for clipboard/external open/logging; avoid remote-host pitfalls.
    - Add clear install/help messages when Beans CLI is unavailable in remote host.

15. **Testing strategy implementation**

    - Unit tests:
      - tree shaping/sorting/filtering,
      - command argument mapping,
      - config parsing/defaults,
      - error mapping.
    - Integration tests:
      - activation + command registration,
      - pane population from fixture Beans workspaces,
      - create/edit/status/type/priority/blocking/parent flows,
      - init prompt behavior,
      - command palette scope rules.
    - AI integration tests:
      - MCP provider registration/update/resolve,
      - chat prompt assembly and command routing.
    - Expand from `[src/test/extension.test.ts](src/test/extension.test.ts)` into modular suites under `[src/test](src/test)`.

16. **CI workflows and quality gates**

    - Add GitHub Actions in `[.github/workflows/ci.yml](.github/workflows/ci.yml)`:
      - lint, typecheck, unit, integration tests (with xvfb on Linux where needed).
    - Add artifacts/log upload on failures.
    - Optional release workflow for packaging/publishing once stable.

17. **Documentation and polish**

    - Rewrite `[README.md](README.md)` with setup, required Beans CLI, commands, keybindings, troubleshooting, remote notes.
    - Add architecture doc and user docs:
      - `[docs/architecture.md](docs/architecture.md)`,
      - `[docs/commands.md](docs/commands.md)`,
      - `[docs/testing.md](docs/testing.md)`.
    - Update `[CHANGELOG.md](CHANGELOG.md)` with milestone rollout entries.

18. **Phased rollout/milestones in `docs/plans`**
    - Track delivery slices as plan checkpoints:
      - M1 Foundation + tree shell,
      - M2 Core command parity,
      - M3 Advanced relationships + filtering,
      - M4 AI integrations,
      - M5 Remote hardening + full test/CI completion.

**Verification**

- Static checks: run typecheck and lint from `[package.json](package.json)` scripts.
- Extension integration: run extension tests with the existing `vscode-test` setup.
- Manual acceptance matrix:
  - Tree panes exist and persist state independently.
  - Sorting modes switch correctly.
  - Enter/context/command opens bean details; edit opens in editor.
  - TUI-parity commands available via sidebar and command palette.
  - Completed/scrapped excluded from default quick picks; present in reopen flows.
  - Init notification appears only when needed and respects dismiss/setting.
  - MCP server appears/loads and logs are discoverable.
  - Chat participant responds with scoped Beans operations.
  - Remote scenarios (SSH/WSL/devcontainer/Codespaces) can find and run Beans CLI.

**Decisions**

- **Tree UX structure:** Use one Beans activity bar container with five panes (active/completed/draft/scrapped/archived) to satisfy non-negotiable UX requirements.
- **Open behavior:** Because true tree-item double-click is not reliably first-class, support Enter, context action, and command palette; document click semantics.
- **Sorting default:** Match TUI intent and your spec with `status > priority > type > title` default.
- **Closed item visibility:** Hide completed/scrapped in default quick picks; expose explicit reopen/revive command paths.
- **Data source:** Beans CLI (`--json`) as source of truth; GraphQL usage only via Beans CLI pathways where appropriate.
- **Security model:** Process execution via argument arrays, never shell interpolation; workspace inputs treated as untrusted.
- **Remote model:** Prefer workspace extension execution for CLI access and cross-environment consistency.
- **AI model:** Implement both MCP provider and single Beans-focused chat participant with prompt-tsx prompts.

---

If you want, I can now produce a **second pass “execution-ready version”** of this same plan that is split into week-by-week milestones with effort/risk estimates and dependency graph notation for parallel implementation.
