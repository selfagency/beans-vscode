# Architecture Documentation

## Overview

The Beans VS Code extension follows a layered architecture with clear separation of concerns. The extension runs in the workspace extension host to support remote development scenarios and integrates deeply with GitHub Copilot through MCP (Model Context Protocol) and chat participant APIs.

## Architecture Principles

1. **Remote-First Design**: All operations work seamlessly in SSH, WSL, Dev Containers, and Codespaces
2. **Security-First**: No shell injection, secure process execution, minimal permissions
3. **AI-Optimized**: MCP server for tool access, chat participant for conversational workflows
4. **Testability**: Clear module boundaries enable comprehensive unit and integration testing
5. **Extension Host Compatibility**: Designed to run in workspace extension host (`extensionKind: workspace`)

## Module Boundaries

### Core Layers

```text
┌─────────────────────────────────────────────────────────────┐
│                      Extension Entry                        │
│                    (src/extension.ts)                       │
│  - Activation lifecycle                                     │
│  - Service initialization                                   │
│  - Command registration orchestration                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌─────────┐  ┌─────────┐  ┌──────────┐
│ UI Layer│  │AI Layer │  │Config    │
│         │  │         │  │Layer     │
└─────────┘  └─────────┘  └──────────┘
    │              │              │
    └──────────────┼──────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │  Service Layer   │
         │ (BeansService)   │
         └─────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │   Beans CLI      │
         │ (External)       │
         └─────────────────┘
```

### Module Structure

#### 1. **Extension Entry** (`src/extension.ts`)

- **Responsibility**: Extension lifecycle management, initialization, and cleanup
- **Dependencies**: All major subsystems
- **Key Functions**:
  - `activate()`: Initialize services, register commands, set up tree views
  - `deactivate()`: Cleanup resources
  - Prompt handling for uninitialized workspaces
  - AI feature toggle management

#### 2. **Service Layer** (`src/beans/service/`)

- **Module**: `BeansService`
- **Responsibility**: Type-safe wrapper around Beans CLI operations
- **Security Features**:
  - Argument-based process execution (no shell injection)
  - Timeout protection
  - JSON parsing with error handling
- **Key Operations**:
  - `listBeans()`: Fetch all beans with optional filtering
  - `getBean()`: Get single bean details
  - `createBean()`: Create new bean with metadata
  - `updateBean()`: Update bean status, type, priority, relationships
  - `deleteBean()`: Delete draft/scrapped beans only
  - `initWorkspace()`: Initialize `.beans.yml` in workspace

#### 3. **UI Layer** (`src/beans/tree/`, `src/beans/details/`, `src/beans/preview/`)

##### Tree Views (`src/beans/tree/`)

- **Providers**:
  - `ActiveBeansProvider`: Beans with status=todo or in-progress
  - `CompletedBeansProvider`: Beans with status=completed
  - `DraftBeansProvider`: Beans with status=draft
  - `ScrappedBeansProvider`: Beans with status=scrapped
- **Core Components**:
  - `BeansTreeDataProvider`: Base class for tree rendering and hierarchical display
  - `BeanTreeItem`: VS Code TreeItem representation of a bean
  - `BeansFilterManager`: Centralized filter state management
  - `BeansDragAndDropController`: Drag-and-drop for parent relationship management
- **Features**:
  - Hierarchical tree with parent-child relationships
  - Multi-select support for batch operations
  - Customizable sorting (status/priority/type/title, updated, created, id)
  - Search and tag filtering
  - Context menu actions

##### Details View (`src/beans/details/`)

- **Module**: `BeansDetailsViewProvider`
- **Responsibility**: WebView panel for displaying bean markdown content with metadata
- **Features**:
  - Markdown rendering with syntax highlighting
  - Action buttons for common operations
  - Metadata display (status, type, priority, dates)
  - Relationship visualization (parent, children, blocking)

##### Preview Provider (`src/beans/preview/`)

- **Module**: `BeansPreviewProvider`
- **Responsibility**: Virtual document provider for bean markdown
- **Use Case**: Enable VS Code markdown preview features for bean files

##### Search View (`src/beans/search/`)

- **Module**: `BeansSearchViewProvider`
- **Responsibility**: WebView for advanced search and filtering
- **Features**: Full-text search, multi-field filtering, saved searches

#### 4. **AI Layer** (`src/beans/chat/`, `src/beans/mcp/`)

##### Chat Integration (`src/beans/chat/`)

- **Module**: `BeansChatIntegration`
- **Responsibility**: GitHub Copilot chat participant (`@beans`)
- **Slash Commands**:
  - `/summary`: Current status overview
  - `/priority`: Top-priority active issues
  - `/stale`: Stale issues by age
  - `/create`: Issue creation guidance
  - `/search`: Find issues by text
  - `/commit`: Issue-related commit guidance
- **Prompt Templates**: Structured prompts in `prompts.ts`
- **Tool Access**: Reads bean data via BeansService

##### MCP Integration (`src/beans/mcp/`)

- **Modules**:
  - `BeansMcpIntegration`: VS Code MCP provider registration
  - `BeansMcpServer`: Standalone stdio MCP server
- **Responsibility**: Expose Beans operations as MCP tools for any AI client
- **Tools Exposed**:
  - Workspace: `init`, `refresh`
  - Read: `view`, `list`, `search`, `filter`, `sort`
  - Write: `create`, `edit`, `set_status`, `set_type`, `set_priority`
  - Relationships: `set_parent`, `remove_parent`, `edit_blocking`
  - Utilities: `copy_id`, `delete`, `open_config`, `show_output`
- **Server Architecture**:
  - Standalone stdio server bundled as `dist/beans-mcp-server.js`
  - Dynamically contributed via `mcp.mcpServers` API
  - Uses remote Node.js (`process.execPath`) for remote compatibility

#### 5. **Commands Layer** (`src/beans/commands/`)

- **Module**: `BeansCommands`
- **Responsibility**: Command palette and context menu command registration
- **Command Categories**:
  - Workspace: Init, refresh
  - Navigation: View, open preview, show in tree
  - Creation: Create bean, create child bean
  - Editing: Edit bean, set status/type/priority
  - Relationships: Set/remove parent, edit blocking
  - Utilities: Copy ID, delete, show output
  - Filtering: Filter, clear filter, tag filter
- **Integration**: Delegates to BeansService and triggers UI refreshes

#### 6. **Configuration Layer** (`src/beans/config/`)

- **Modules**:
  - `BeansConfigManager`: Read/write `.beans.yml` workspace config
  - `CopilotInstructions`: Generate `.github/copilot-instructions.md`
  - `CopilotSkill`: Generate `.github/skills/beans/SKILL.md`
- **Responsibility**: Manage workspace configuration and AI integration files
- **Auto-Generation**: When `beans.ai.enabled=true`, generates skill and instructions
- **Auto-Cleanup**: When `beans.ai.enabled=false`, removes generated files

#### 7. **Model Layer** (`src/beans/model/`)

- **Files**:
  - `Bean.ts`: Core Bean type interface
  - `config.ts`: BeansConfig type for `.beans.yml`
  - `errors.ts`: Typed error classes
- **Types**:
  - `Bean`: id, title, status, type, priority, body, relationships, timestamps
  - `BeanStatus`: todo, in-progress, draft, completed, scrapped
  - `BeanType`: milestone, epic, feature, task, bug
  - `BeanPriority`: critical, high, normal, low, deferred
- **Error Types**:
  - `BeansCLINotFoundError`: CLI not in PATH
  - `BeansJSONParseError`: Invalid JSON from CLI
  - `BeansTimeoutError`: CLI operation timeout

#### 8. **Logging Layer** (`src/beans/logging/`)

- **Module**: `BeansOutput`
- **Responsibility**: Centralized logging with output channel and file mirroring
- **Features**:
  - Log levels: trace, debug, info, warn, error
  - File mirroring to `.beans/.vscode/beans-output.log` for MCP tool access
  - Singleton pattern for global access

## Data Flow

### Bean Read Flow

```text
User Action (Tree View, Command)
    │
    ▼
BeansCommands.viewBean()
    │
    ▼
BeansService.getBean(id)
    │
    ▼
execAsync(['beans', 'show', '--json', id])
    │
    ▼
Beans CLI (reads .beans/*.md)
    │
    ▼
JSON Response
    │
    ▼
BeansService parses & validates
    │
    ▼
Returns Bean object
    │
    ▼
BeansDetailsViewProvider.show(bean)
    │
    ▼
WebView renders bean markdown + metadata
```

### Bean Write Flow

```text
User Action (Command, Context Menu)
    │
    ▼
BeansCommands.updateBeanStatus(id, status)
    │
    ▼
BeansService.updateBean(id, { status })
    │
    ▼
execAsync(['beans', 'update', '--json', id, '-s', status])
    │
    ▼
Beans CLI (writes to .beans/*.md)
    │
    ▼
JSON Response
    │
    ▼
BeansService parses & validates
    │
    ▼
Fire tree refresh event
    │
    ▼
All tree providers re-fetch data
    │
    ▼
Tree views update UI
```

### MCP Tool Call Flow

```text
Copilot Chat or MCP Client
    │
    ▼
MCP Tool Request (e.g., beans_vscode_create)
    │
    ▼
BeansMcpServer.handleToolCall()
    │
    ▼
BeansService.createBean(params)
    │
    ▼
execAsync(['beans', 'create', '--json', ...args])
    │
    ▼
Beans CLI (creates .beans/*.md)
    │
    ▼
JSON Response
    │
    ▼
BeansMcpServer formats response
    │
    ▼
MCP Tool Response to AI client
```

### Chat Participant Flow

```text
User: "@beans /summary"
    │
    ▼
BeansChatIntegration.handleChatRequest()
    │
    ▼
Parse slash command
    │
    ▼
BeansService.listBeans({ excludeStatus: ['completed', 'scrapped'] })
    │
    ▼
Beans CLI returns active beans JSON
    │
    ▼
Format response with bean counts and priorities
    │
    ▼
Return ChatResponseStream
    │
    ▼
Copilot displays formatted summary
```

## Design Decisions

### 1. Why Separate Tree Providers per Status?

**Decision**: Four separate tree providers (Active, Completed, Draft, Scrapped) instead of one tree with grouping.

**Rationale**:

- Clear mental model: each pane has single responsibility
- User control: independently expandable/collapsible panes
- Performance: only fetch needed data for visible panes
- VS Code UX: matches native experience (Problems, Test Explorer)

**Trade-off**: More code, but better UX and flexibility.

### 2. Why Wrap Beans CLI Instead of Direct File Access?

**Decision**: All operations go through BeansService → Beans CLI, not direct `.beans/*.md` file manipulation.

**Rationale**:

- Single source of truth: Beans CLI handles file format, locking, validation
- GraphQL access: Beans CLI provides efficient query engine
- Future-proof: CLI changes don't break extension
- Safety: CLI handles edge cases (conflicts, malformed files)

**Trade-off**: Dependency on external CLI, but gains reliability and maintainability.

### 3. Why Both MCP Server and Chat Participant?

**Decision**: Implement both MCP tools and a dedicated chat participant.

**Rationale**:

- MCP tools: Atomic operations for any AI client (Claude Desktop, Cline, etc.)
- Chat participant: Conversational workflows specific to Copilot Chat
- Different use cases: MCP for programmatic access, chat for human interaction
- Complementary: MCP provides primitives, chat provides guided workflows

**Trade-off**: More surface area to maintain, but serves diverse user needs.

### 4. Why Workspace Extension Host?

**Decision**: Set `"extensionKind": ["workspace"]` to run in remote extension host.

**Rationale**:

- Remote compatibility: Extension runs where files and CLI exist
- Security: No local-to-remote tunneling of file operations
- Simplicity: One execution model for local and remote
- Performance: Reduced latency for file operations

**Trade-off**: Can't run UI-only commands without workspace, but this is the right trade-off for a workspace-centric tool.

### 5. Why Drag-and-Drop for Parent Relationships?

**Decision**: Implement drag-and-drop controller for setting parent relationships.

**Rationale**:

- Intuitive: Visual representation of hierarchy
- Efficient: No multi-step command palette workflow
- Discovery: Users naturally explore dragging beans
- VS Code native: Leverages TreeView drag-and-drop APIs

**Trade-off**: Additional complexity, but significant UX improvement for common operation.

### 6. Why Separate BeansFilterManager?

**Decision**: Centralized filter state in BeansFilterManager instead of per-provider state.

**Rationale**:

- Consistency: Same filter applies across all tree views
- Simplicity: One source of truth for filter state
- Commands: Easy to expose "clear filter" command
- Future: Enables saved filters, filter history

**Trade-off**: Less flexibility for per-view filtering, but clearer UX.

### 7. Why Generate Copilot Skill File?

**Decision**: Dynamically generate `.github/skills/beans/SKILL.md` when AI features enabled.

**Rationale**:

- Context injection: Provides Beans-specific guidance to Copilot
- Discoverability: Users see skill file, understand integration
- Maintainability: Extension keeps skill updated with capabilities
- Toggle: Clean removal when AI features disabled

**Trade-off**: Generated files in repo, but gitignore prevents commit noise.

### 8. Why Timeout Protection on CLI Calls?

**Decision**: All CLI operations have 30-second timeout (configurable).

**Rationale**:

- Responsiveness: Don't hang VS Code on slow operations
- Error handling: Explicit timeout error vs indefinite wait
- Remote scenarios: Network issues shouldn't freeze UI
- Resource protection: Prevent runaway processes

**Trade-off**: Might timeout legitimately slow operations, but better than hanging.

## Testing Strategy

### Unit Tests

- Location: `src/test/beans/`
- Coverage: Business logic, formatting utilities, config parsing
- Tools: Vitest, mocked VS Code API
- Examples:
  - `prompts.test.ts`: Chat participant prompt formatting
  - `sorting.test.ts`: Bean sorting algorithms
  - `CopilotSkill.test.ts`: Skill generation logic

### Integration Tests

- Location: `src/test/integration/`
- Coverage: Extension activation, command registration, tree population
- Tools: `@vscode/test-electron`, Vitest
- Examples:
  - `extension-activation.test.ts`: Full activation lifecycle
  - `tree-population.test.ts`: Tree provider data flow
  - `mcp-integration.test.ts`: MCP server startup

### AI Integration Tests

- Location: `src/test/integration/ai/`
- Coverage: MCP tool definitions, chat participant registration
- Examples:
  - `mcp-integration.test.ts`: MCP provider registration
  - `chat-integration.test.ts`: Chat participant lifecycle
  - `prompt-assembly.test.ts`: Slash command routing

## Remote Compatibility

### Key Remote Patterns

1. **Path Resolution**: Always use `workspaceFolder.uri.fsPath` (remote-aware)
2. **CLI Execution**: Use `beans.cliPath` config, default to `beans` in remote PATH
3. **Process Spawning**: Use `process.execPath` for Node.js (resolves to remote Node)
4. **File Access**: Use `vscode.workspace.fs` APIs for remote filesystem compatibility

### Remote Testing Checklist

- [ ] SSH: Test with remote Linux/macOS machine
- [ ] WSL: Test with Ubuntu on Windows
- [ ] Dev Container: Test with `.devcontainer/devcontainer.json`
- [ ] Codespaces: Test with GitHub Codespaces
- [ ] Verify beans CLI installation in each scenario
- [ ] Verify MCP server starts with remote Node.js
- [ ] Verify tree views populate from remote filesystem
- [ ] Verify commands execute in remote context

## Extension Points for Future Development

### Potential Additions

1. **Archive View**: Separate tree provider for archived beans
2. **Timeline View**: Show bean history and changes over time
3. **Dependency Graph**: Visual representation of blocking relationships
4. **Bulk Operations**: Multi-select actions for batch status/type/priority changes
5. **Saved Filters**: Persist user-defined filter configurations
6. **Bean Templates**: Pre-filled templates for common bean types
7. **Rich Edit Mode**: In-extension editor for bean markdown body
8. **Conflict Resolution**: UI for handling merge conflicts in bean files
9. **Export/Import**: Bulk export/import of beans in various formats
10. **Metrics Dashboard**: Visualize bean lifecycle metrics (cycle time, throughput)

### Architecture for Extensions

- **New Tree Providers**: Extend `BeansTreeDataProvider` base class
- **New Commands**: Register in `BeansCommands`, delegate to `BeansService`
- **New MCP Tools**: Add to `BeansMcpServer` tool definitions
- **New Chat Commands**: Add to `BeansChatIntegration` slash command router
- **New Views**: Implement `vscode.WebviewViewProvider` or `vscode.TreeDataProvider`

## Performance Considerations

### Current Optimizations

1. **Lazy Loading**: Tree items load children on expand
2. **Caching**: BeansService doesn't cache (CLI is fast enough)
3. **Debouncing**: File watcher debounces rapid changes
4. **Filtered Queries**: Each tree provider only fetches its status filter
5. **JSON Parsing**: Single-pass parsing with typed validation

### Future Optimizations

1. **Incremental Updates**: Update tree items instead of full refresh
2. **Virtual Scrolling**: For workspaces with 1000+ beans
3. **Background Indexing**: Pre-build search index for faster filtering
4. **Cached GraphQL**: Cache frequently-used GraphQL query results
5. **Parallel Fetches**: Fetch multiple tree providers simultaneously

## Troubleshooting Guide

### Common Issues

1. **"Beans CLI not found"**

   - Check `beans.cliPath` setting
   - Verify CLI in PATH: `which beans`
   - Install beans: `brew install hmans/beans/beans`

2. **MCP tools not showing**

   - Check `beans.ai.enabled` setting
   - Run "Beans: MCP: Refresh Server Definitions"
   - Check MCP logs: "Beans: MCP: Open Logs"

3. **Tree view not populating**

   - Check workspace has `.beans.yml`
   - Run "Beans: Initialize Beans in Workspace"
   - Check output channel: "Beans" for errors

4. **Remote extension not activating**
   - Verify beans CLI on remote machine
   - Check remote extension host logs
   - Reload window: "Developer: Reload Window"

## References

- [Beans CLI Repository](https://github.com/hmans/beans)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview)
