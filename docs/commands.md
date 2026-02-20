# Commands Reference

This document provides a comprehensive reference for all Beans VS Code extension commands, including command palette access, keyboard shortcuts, context menu locations, and workflow examples.

## Overview

The Beans extension provides commands organized into the following categories:

- [Workspace Management](#workspace-management)
- [Bean Operations](#bean-operations)
- [Details View and AI](#details-view-and-ai)
- [Status Management](#status-management)
- [Type and Priority](#type-and-priority)
- [Relationships](#relationships)
- [Filtering and Search](#filtering-and-search)
- [Utilities](#utilities)
- [MCP Integration](#mcp-integration)
- [Chat Participant](#chat-participant)

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

---

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

---

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

---

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

---

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

---

### Open User Guide

**Command**: `beans.openUserGuide`
**Category**: Beans
**Icon**: `$(info)`

Open the Beans extension user guide documentation.

**Usage**:

1. Command Palette: "Beans: Open User Guide"

---

### Open AI Features Guide

**Command**: `beans.openAiFeaturesGuide`
**Category**: Beans
**Icon**: `$(sparkle)`

Open the Beans AI features documentation covering MCP tools, chat participant, and Copilot integration.

**Usage**:

1. Command Palette: "Beans: Open AI Features Guide"

---

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

---

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

---

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

**Editing Tips**:

- Use Markdown syntax for formatting
- Create task lists with `- [ ]` and `- [x]`
- Add code blocks, tables, links as normal Markdown
- Metadata changes via frontmatter require bean code knowledge

---

## Details View and AI

### Back to Previous Bean

**Command**: `beans.details.back`
**Category**: Beans
**Icon**: `$(arrow-left)`
**When**: Workspace initialized, bean selected, history available
**Context Menu**: Details view title bar

Navigate back in the Details view browsing history.

**Usage**:

- Click the back arrow in the Details view title bar

**What it does**:

- Returns to the previously viewed bean in the Details panel
- Maintains a navigation stack as you click between beans
- Only visible when there is history to navigate back to

**When to use**:

- After navigating through parent/child/blocking relationships in the Details view
- When you want to return to a bean you were viewing before

---

### Copilot: Start Work on Bean

**Command**: `beans.copilotStartWork`
**Category**: Beans
**Icon**: `$(comment-discussion)`
**When**: Workspace initialized, bean selected, AI enabled
**Context Menu**: Details view title bar

Open Copilot Chat with a pre-filled prompt template for working on the selected bean.

**Usage**:

1. View a bean in the Details panel
2. Click the chat icon in the Details title bar
3. Choose a workflow template:
   - **Assess current status** - Analyze progress
   - **Determine remaining steps** - Identify what's left
   - **Close and commit** - Complete the bean with a commit
   - **Export to GitHub issue** - Draft a GitHub issue
   - **Set in-progress** - Start working on the bean
   - **Flesh out specs** - Expand description and requirements

**What it does**:

- Opens Copilot Chat pre-filled with the selected bean's context
- Applies the chosen template to guide the AI interaction
- Provides structured starting points for common bean workflows

**When to use**:

- Starting work on a new bean
- Getting AI assistance with planning or completing a bean
- Exporting bean details to external systems

---

### Open First Malformed Bean

**Command**: `beans.openFirstMalformedBean`
**Category**: Beans
**Icon**: `$(warning)`
**When**: Workspace initialized, malformed beans detected
**Context Menu**: Draft view title bar (when malformed files exist)

Navigate to the first malformed bean file for correction.

**Usage**:

- Click the warning icon in the Drafts view title bar

**What it does**:

- Opens the first `.fixme` file detected in the `.beans/` directory
- Allows you to inspect and fix the malformed bean content

**When to use**:

- When the warning icon appears in the Drafts title bar
- After a Beans CLI operation produces malformed output

---

### Filter Search Results

**Command**: `beans.searchView.filter`
**Category**: Beans
**Icon**: `$(filter)`
**When**: Workspace initialized
**Context Menu**: Search view title bar

Apply additional filters to narrow down search results.

**Usage**:

- Click the filter icon in the Search view title bar

**What it does**:

- Opens filter quick pick for the search results view
- Allows filtering search results by status, type, priority, or tags

---

### Clear Search Filters

**Command**: `beans.searchView.clear`
**Category**: Beans
**Icon**: `$(circle-slash)`
**When**: Workspace initialized
**Context Menu**: Search view title bar

Remove all filters from search results and clear the search query.

**Usage**:

- Click the clear icon in the Search view title bar

---

## Status Management

### Set Status

**Command**: `beans.setStatus`
**Category**: Beans
**When**: Workspace initialized
**Context Menu**: Tree items

Change a bean's status with quick pick selection.

**Usage**:

- **Context Menu**: Right-click bean → "Set Status"
- **Command Palette**: "Beans: Set Status" → Select bean → Select new status

**Available Statuses** (default):

- **todo**: Ready to work on
- **in-progress**: Currently being worked on
- **draft**: Needs refinement before work can begin
- **completed**: Successfully finished
- **scrapped**: Decided not to do

**Workflow**:

```text
Select Bean → Choose New Status → Confirm → Tree Updates
```

**Status Transitions**:

- From **draft** → **todo** when ready to work
- From **todo** → **in-progress** when starting work
- From **in-progress** → **completed** when done
- From **in-progress** → **scrapped** if decided not to do
- From **completed/scrapped** → Use reopen commands

**Result**:

- Bean status updated in `.beans/<bean>.md`
- Bean moves to appropriate tree view
- Success notification displayed
- Parent and child beans remain unchanged

---

### Reopen Completed Bean

**Command**: `beans.reopenCompleted`
**Category**: Beans
**When**: Workspace initialized
**Access**: Command Palette only

Reopen a completed bean to change its status back to active.

**Usage**:

1. Command Palette: "Beans: Reopen Completed Bean"
2. Select completed bean from list
3. Choose new status (todo, in-progress, draft)
4. Confirm

**When to use**:

- Bug regression: Completed bug needs rework
- Additional requirements: Feature needs extension
- Incorrect closure: Bean marked complete prematurely

**Note**: This command specifically shows beans with `status: completed`, even though they don't appear in Active tree view.

---

### Reopen Scrapped Bean

**Command**: `beans.reopenScrapped`
**Category**: Beans
**When**: Workspace initialized
**Access**: Command Palette only

Reopen a scrapped bean to change its status back to active.

**Usage**:

1. Command Palette: "Beans: Reopen Scrapped Bean"
2. Select scrapped bean from list
3. Choose new status (todo, in-progress, draft)
4. Confirm

**When to use**:

- Changed priorities: Previously scrapped work now relevant
- New information: Makes previously infeasible work possible
- Mistake: Bean scrapped by error

**Note**: Provides explicit access to scrapped beans outside of Scrapped tree view.

---

## Type and Priority

### Set Type

**Command**: `beans.setType`
**Category**: Beans
**When**: Workspace initialized
**Context Menu**: Tree items

Change a bean's type classification.

**Usage**:

- **Context Menu**: Right-click bean → "Set Type"
- **Command Palette**: "Beans: Set Type" → Select bean → Select new type

**Available Types** (default):

- **milestone**: Release target or checkpoint
- **epic**: Large thematic container for related work
- **feature**: User-facing functionality
- **bug**: Something broken that needs fixing
- **task**: Concrete piece of work (chore, sub-task)

**Type Guidelines**:

- **milestone**: Groups work for a release, has child beans
- **epic**: Has child beans, not worked on directly
- **feature**: Delivers new capability for users
- **bug**: Fixes incorrect behavior
- **task**: Implementation work, often child of feature/epic

**Workflow**:

```text
Select Bean → Choose New Type → Confirm → Tree Updates
```

---

### Set Priority

**Command**: `beans.setPriority`
**Category**: Beans
**When**: Workspace initialized
**Context Menu**: Tree items

Change a bean's priority level.

**Usage**:

- **Context Menu**: Right-click bean → "Set Priority"
- **Command Palette**: "Beans: Set Priority" → Select bean → Select new priority

**Available Priorities** (default):

- **critical** `🔴`: Urgent, blocking work
- **high** `🟠`: Important, should be done before normal work
- **normal** `⚪`: Standard priority
- **low** `🔵`: Less important, can be delayed
- **deferred** `⚫`: Explicitly pushed back, avoid unless necessary

**Priority Sorting**:

- Tree views can sort by priority
- Higher priorities appear first
- Beans without priority treated as `normal`

**When to use priorities**:

- **Critical**: Production outage, security vulnerability
- **High**: Blocking another team, user-facing bug
- **Normal**: Regular development work
- **Low**: Nice-to-have improvements
- **Deferred**: Not now, maybe later

---

## Relationships

### Set Parent

**Command**: `beans.setParent`
**Category**: Beans
**When**: Workspace initialized
**Context Menu**: Tree items
**Drag & Drop**: Drag bean onto another bean in tree

Set a parent-child relationship between beans.

**Usage**:

- **Drag & Drop**: Drag child bean onto intended parent bean in tree
- **Context Menu**: Right-click bean → "Set Parent" → Select parent from list
- **Command Palette**: "Beans: Set Parent" → Select child bean → Select parent

**Parent-Child Hierarchy Examples**:

```text
Milestone
└── Epic
    ├── Feature
    │   ├── Task
    │   └── Task
    └── Feature

Epic
├── Bug
├── Feature
└── Task
```

**Rules**:

- Bean can have only one parent
- Parent can have many children
- Creates visual hierarchy in tree views
- Links beans logically (epic → features → tasks)

**Workflow**:

```text
Select Child Bean → Choose Parent Bean → Confirm → Hierarchy Updated
```

**Drag & Drop Workflow**:

1. Click and hold on child bean in tree
2. Drag over parent bean
3. Drop to set relationship
4. Tree auto-expands to show new hierarchy

---

### Remove Parent

**Command**: `beans.removeParent`
**Category**: Beans
**When**: Workspace initialized
**Context Menu**: Tree items (beans with parents only)

Remove parent-child relationship from a bean.

**Usage**:

- **Context Menu**: Right-click bean with parent → "Remove Parent"
- **Command Palette**: "Beans: Remove Parent" → Select bean

**What it does**:

- Removes `parent` field from bean frontmatter
- Bean becomes top-level in tree view
- Parent bean's children list auto-updates

**When to use**:

- Reorganizing bean hierarchy
- Promoting sub-task to standalone bean
- Breaking apart an epic

---

### Edit Blocking Relationships

**Command**: `beans.editBlocking`
**Category**: Beans
**When**: Workspace initialized
**Context Menu**: Tree items

Manage blocking and blocked-by relationships for dependency tracking.

**Usage**:

- **Context Menu**: Right-click bean → "Edit Blocking Relationships"
- **Command Palette**: "Beans: Edit Blocking Relationships" → Select bean

**Relationship Types**:

- **Blocking**: This bean blocks another bean (the other bean can't proceed until this is done)
- **Blocked-by**: This bean is blocked by another bean (this bean can't proceed until the other is done)

**Interactive Workflow**:

1. Choose "Blocking" or "Blocked-by"
2. Multi-select beans to link
3. Confirm selection
4. Relationships saved

**Blocking Example**:

```text
Bean A: "Set up database schema"
Bean B: "Implement user login"

If B is blocked by A:
- Bean A has `blocking: [B]`
- Bean B has `blocked_by: [A]`
```

**When to use**:

- Dependency tracking: Bean X can't start until Bean Y is complete
- Parallel work: Identify which beans can be worked on simultaneously
- Planning: Visualize critical path

---

## Filtering and Search

### Filter Beans

**Command**: `beans.filter`
**Category**: Beans
**Icon**: `$(filter)`
**When**: Workspace initialized
**Context Menu**: Tree title bar

Apply filters to narrow down visible beans in tree views.

**Usage**:

1. Click filter icon in tree title bar
2. Or Command Palette: "Beans: Filter Beans"
3. Select filter type:
   - Filter by status
   - Filter by type
   - Filter by tag
   - Clear filter

**Filter Options**:

- **By Status**: Show only beans with selected statuses
- **By Type**: Show only beans of selected types
- **By Tag**: Show only beans with matching tags
- **Clear**: Remove all active filters

**Filter Persistence**:

- Filters apply across all tree views
- Filters persist across refresh operations
- Filters cleared by "Clear Filter" command or extension reload

**Example Workflows**:

- Show only bugs: Filter by type → Select "bug"
- Show high-priority work: Filter by priority → Select "critical", "high"
- Show frontend work: Filter by tag → Enter "frontend"

---

### Search Beans

**Command**: `beans.search`
**Category**: Beans
**Icon**: `$(search)`
**When**: Workspace initialized
**Context Menu**: Tree title bar, Search view

Full-text search across all beans using the Search webview panel.

**Usage**:

1. Click search icon in tree title bar
2. Or open "Search" view in Beans sidebar
3. Enter search query
4. Results display with context snippets

**Search Webview Features**:

- **Full-text search**: Searches bean titles, bodies, and IDs
- **Result preview**: Shows matching snippets with context
- **Quick actions**: Click result to view bean details
- **Filter results**: Combine search with status/type filters
- **Syntax highlighting**: Code blocks in results

**Search Tips**:

- Use specific terms for better results
- Search body content includes markdown text
- Bean IDs and codes are searchable

---

### Change Sort Mode

**Command**: `beans.sort`
**Category**: Beans
**Icon**: `$(list-ordered)`
**When**: Workspace initialized
**Context Menu**: Tree title bar

Change the sort order for beans in tree views.

**Usage**:

1. Click sort icon in tree title bar
2. Or Command Palette: "Beans: Change Sort Mode"
3. Select sort mode

**Available Sort Modes**:

- **Status > Priority > Type > Title** (default): Grouped by status, then priority
- **Priority > Status > Type > Title**: Highest priority beans first
- **Updated Date**: Most recently updated first
- **Created Date**: Newest beans first
- **ID/Code**: Alphabetical by bean code

**Sort Persistence**:

- Sort mode persists across sessions
- Configurable default: `beans.defaultSortMode` setting
- Applies to all tree views simultaneously

**When to use**:

- **Status/Priority**: Standard workflow view
- **Updated**: See recent activity
- **Created**: Find new beans quickly
- **ID**: Predictable alphabetical order

---

## Utilities

### Copy Bean ID

**Command**: `beans.copyId`
**Category**: Beans
**When**: Workspace initialized
**Context Menu**: Tree items

Copy bean's full ID to clipboard for use in CLI, GraphQL queries, or linking.

**Usage**:

- **Context Menu**: Right-click bean → "Copy Bean ID"
- **Command Palette**: "Beans: Copy Bean ID" → Select bean

**What it copies**:

- Full bean ID (e.g., `beans-vscode-xyzw`)
- Not the short code or filename

**When to use**:

- Running CLI commands: `beans show beans-vscode-xyzw`
- GraphQL queries: `{ bean(id: "beans-vscode-xyzw") { ... } }`
- Linking beans: Setting parent/blocking relationships via CLI
- Committing: Including bean IDs in commit messages

---

### Delete Bean

**Command**: `beans.delete`
**Category**: Beans
**Icon**: `$(trash)`
**When**: Workspace initialized
**Context Menu**: Tree items (draft/scrapped only)

Delete a draft or scrapped bean permanently.

**Usage**:

- **Context Menu**: Right-click draft/scrapped bean → "Delete Bean"
- **Command Palette**: "Beans: Delete Bean" → Select bean
- **Confirmation**: Prompted to confirm deletion

**Safety Rules**:

- **Only** draft and scrapped beans can be deleted
- Active (todo, in-progress) beans cannot be deleted
- Completed beans cannot be deleted (use scrap first if needed)
- Requires explicit confirmation

**Workflow**:

```text
Select Draft/Scrapped Bean → Confirm Deletion → File Deleted
```

**What happens**:

- Bean markdown file deleted from `.beans/` folder
- Bean removed from all tree views
- Relationships to other beans are preserved (if any pointed to deleted bean)

**When to use**:

- Cleaning up drafts that will never be used
- Removing scrapped beans after archival
- Housekeeping: Delete test/duplicate beans

---

## MCP Integration

When `beans.ai.enabled` is `true`, the following MCP-specific commands are available:

### MCP: Refresh Server Definitions

**Command**: `beans.mcp.refreshDefinitions`
**Category**: Beans

Manually refresh the MCP server definition to re-register tools with AI clients.

**Usage**:

1. Command Palette: "Beans: MCP: Refresh Server Definitions"

**When to use**:

- After updating extension
- If MCP tools disappear from Copilot
- After changing `beans.ai.enabled` setting

---

### MCP: Show Server Info

**Command**: `beans.mcp.showServerInfo`
**Category**: Beans

Display information about the Beans MCP server configuration.

**Usage**:

1. Command Palette: "Beans: MCP: Show Server Info"

**Information shown**:

- Server name and version
- Server startup command and args
- Available MCP tools
- Server process status

---

### MCP: Open MCP Settings

**Command**: `beans.mcp.openConfig`
**Category**: Beans

Open VS Code MCP settings to view or modify MCP server configuration.

**Usage**:

1. Command Palette: "Beans: MCP: Open MCP Settings"

---

### MCP: Open Logs

**Command**: `beans.mcp.openLogs`
**Category**: Beans

Open MCP server logs for debugging tool calls and server issues.

**Usage**:

1. Command Palette: "Beans: MCP: Open Logs"

**When to use**:

- Troubleshooting MCP tool errors
- Verifying tool call parameters
- Debugging server startup issues

---

## Chat Participant

The `@beans` chat participant provides conversational access to Beans workflows within GitHub Copilot Chat.

### Invoking the Chat Participant

**Syntax**: `@beans [/command] [question or task]`

### Available Slash Commands

#### `/summary`

Get an overview of Beans status in the current workspace.

**Usage**: `@beans /summary`

**Response includes**:

- Total active beans
- Beans by status (todo, in-progress)
- Beans by priority (critical, high, normal, low)
- Top 5 priority beans

---

#### `/priority`

Show top-priority issues in the workspace.

**Usage**: `@beans /priority`

**Response includes**:

- All critical priority beans
- All high-priority beans
- Formatted list with bean codes and titles

---

#### `/stale`

List beans that haven't been updated recently and may need attention.

**Usage**: `@beans /stale`

**Response includes**:

- Beans not updated in last 7 days (configurable threshold)
- Sorted by oldest updated_at first
- Status and priority indicators

---

#### `/create`

Get guidance for creating a new bean with interactive prompts.

**Usage**: `@beans /create [description]`

**Workflow**:

1. Describe what you want to create
2. Copilot suggests title, type, priority
3. Confirm or modify
4. Bean created

---

#### `/next`

Ask Copilot to suggest the next bean to work on based on priority and context.

**Usage**: `@beans /next`

**Response includes**:

- Recommended bean to work on
- Rationale (priority, blocking relationships, current status)
- Quick action to start work

---

#### `/search`

Search beans by text across titles, bodies, and metadata.

**Usage**: `@beans /search [query]`

**Example**: `@beans /search authentication`

**Response includes**:

- Matching beans with context snippets
- Bean codes and titles
- Status and type indicators

---

#### `/commit`

Get guidance for creating issue-related commits with bean IDs.

**Usage**: `@beans /commit [bean-id]`

**Workflow**:

1. Specify bean or let Copilot infer from current work
2. Copilot suggests conventional commit message
3. Includes bean ID in commit message

**Example commit message**:

```text
feat: add user authentication (bean-xyzw)

- Implement JWT token generation
- Add login/logout endpoints
- Create user session management
```

---

## Workflow Examples

### Example 1: Creating a Feature and Breaking It Down

```text
1. Create parent epic:
   - Command Palette → "Beans: Create Bean"
   - Title: "User Authentication System"
   - Type: epic

2. Create child features:
   - Click "+" in Active tree
   - Title: "Login endpoint"
   - Type: feature
   - Right-click → "Set Parent" → Select epic

3. Repeat for other features:
   - "Password reset flow"
   - "Session management"

4. Create tasks under features:
   - Create tasks for login endpoint
   - Drag task onto "Login endpoint" feature
   - Task automatically becomes child
```

**Result**: Hierarchical structure: Epic → Features → Tasks

---

### Example 2: Working Through Priority Tasks

```text
1. Filter for high-priority work:
   - Click filter icon
   - Select "Priority" → "Critical", "High"

2. Sort by priority:
   - Click sort icon
   - Select "Priority > Status > Type > Title"

3. Pick top task:
   - View highest priority bean
   - Right-click → "Set Status" → "In Progress"

4. Work on task:
   - Click bean to view details
   - Click edit icon to open markdown
   - Make changes, check off subtasks

5. Complete task:
   - Right-click → "Set Status" → "Completed"
   - Bean moves to Completed view
```

---

### Example 3: Bug Triage Workflow

```text
1. Create bug:
   - Command Palette → "Beans: Create Bean"
   - Title: "Login fails with empty username"
   - Type: bug

2. Set priority:
   - Right-click bug → "Set Priority" → "Critical"

3. Set status:
   - Right-click → "Set Status" → "In Progress"

4. Link to related work:
   - Right-click → "Edit Blocking Relationships"
   - Select "Blocking" → Choose feature bean
   - Bug now blocks feature until fixed

5. Fix and complete:
   - Edit bean to add fix details
   - Mark status as completed
```

---

### Example 4: Using Chat Participant for Planning

```text
User: @beans /summary
Copilot: Shows 15 active beans, 3 critical, 5 high priority

User: @beans /priority
Copilot: Lists 3 critical bugs and 5 high-priority features

User: @beans /next
Copilot: Suggests working on "Fix login redirect" (critical bug)

User: @beans /commit bean-xyzw
Copilot: Suggests commit message for bug fix with bean ID
```

---

## Keyboard Shortcuts

Currently, the extension does not define default keyboard shortcuts. Users can configure custom keybindings in VS Code:

### Adding Custom Keybindings

1. Open Keyboard Shortcuts: `Cmd+K Cmd+S` (Mac) or `Ctrl+K Ctrl+S` (Windows/Linux)
2. Search for command (e.g., "Beans: Create Bean")
3. Click `+` icon to add keybinding
4. Press desired key combination

### Recommended Custom Keybindings

```json
// In keybindings.json (Cmd+K Cmd+S → Open Keyboard Shortcuts JSON)
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

---

## Context Menu Reference

### Tree Item Context Menu (All Beans)

- View Bean
- Edit Bean
- Set Status
- Set Type
- Set Priority
- Copy Bean ID

### Tree Item Context Menu (Beans with Parents)

- Remove Parent

### Tree Item Context Menu (Draft/Scrapped Beans)

- Delete Bean

### Tree Title Bar Context Menu

- Refresh
- Create Bean
- Filter Beans
- Search Beans
- Change Sort Mode

---

## Command Palette Tips

- **Filtering**: Type "Beans" to filter only Beans commands
- **Recently used**: Recent commands appear at top
- **Fuzzy search**: Type partial command names (e.g., "brcb" → "Beans: Reopen Completed Bean")
- **Context-aware**: Some commands only appear when workspace is initialized

---

## Troubleshooting Commands

### Command not appearing in palette

**Check**:

- Is workspace initialized? Run "Beans: Initialize Beans in Workspace"
- Is `beans.initialized` context true? Check with "Developer: Inspect Context Keys"

### Tree not updating after command

**Solutions**:

- Run "Beans: Refresh" manually
- Check "Beans" output channel for errors ("Beans: Show Output")
- Verify beans CLI is working: `beans list` in terminal

### Drag & drop not working

**Solutions**:

- Ensure source and target beans are compatible
- Check tree view is not filtered (child won't appear if filtered out)
- Try using "Set Parent" command as alternative

---

## See Also

- [User Guide](./user-guide.md)
- [AI Features](./ai-features.md)
- [Architecture Documentation](./architecture.md)
- [Testing Documentation](./testing.md)
- [README](../README.md)
