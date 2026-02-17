# Beans VS Code Extension - AI Features

Comprehensive guide to using Beans with AI assistants and Copilot.

## Table of Contents

- [Overview](#overview)
- [MCP Integration](#mcp-integration)
- [Chat Participant](#chat-participant)
- [Copilot Skills](#copilot-skills)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Overview

The Beans VS Code extension integrates deeply with GitHub Copilot and other AI assistants through multiple channels:

- **MCP Tools**: Expose Beans operations as structured tools for AI agents
- **Chat Participant**: Conversational interface via `@beans` in Copilot Chat
- **Copilot Skills**: Auto-generated workflow guidance for AI planning

All AI features can be toggled via the `beans.ai.enabled` setting.

## MCP Integration

### What is MCP?

The Model Context Protocol (MCP) is a standard for connecting AI assistants to external tools and data sources. The Beans extension provides an MCP server that exposes all Beans operations as callable tools.

### Available MCP Tools

When `beans.ai.enabled` is `true`, the following tools are available to AI clients:

#### Initialization & Management

- `beans_vscode_init` - Initialize Beans in workspace
- `beans_vscode_refresh` - Refresh all tree views

#### Viewing & Listing

- `beans_vscode_view` - View details of specific beans
- `beans_vscode_list` - List beans with filters
- `beans_vscode_search` - Full-text search across beans

#### Creating & Editing

- `beans_vscode_create` - Create new beans
- `beans_vscode_edit` - Edit bean content

#### Metadata Updates

- `beans_vscode_set_status` - Update bean status
- `beans_vscode_set_type` - Update bean type
- `beans_vscode_set_priority` - Update bean priority

#### Relationships

- `beans_vscode_set_parent` - Set parent-child relationship
- `beans_vscode_remove_parent` - Remove parent relationship
- `beans_vscode_edit_blocking` - Manage blocking dependencies

#### Organization

- `beans_vscode_filter` - Apply filters to beans
- `beans_vscode_sort` - Change sort order
- `beans_vscode_copy_id` - Copy bean ID to clipboard
- `beans_vscode_delete` - Delete beans (draft/scrapped only)

### MCP Commands

Control the MCP server from the Command Palette:

- **`Beans: MCP: Refresh Server Definitions`** - Update MCP server registration
- **`Beans: MCP: Show Server Info`** - Display server configuration
- **`Beans: MCP: Open MCP Settings`** - Open VS Code MCP settings
- **`Beans: MCP: Open Logs`** - View MCP server logs

### Using MCP Tools

MCP tools are called automatically by AI assistants. You don't call them directly—instead, you interact with your AI assistant naturally, and it uses the tools as needed.

**Example workflow:**

```text
You: "Show me all high-priority bugs that are in-progress"

AI: [Calls beans_vscode_list with filters]
    Here are your 3 high-priority in-progress bugs:
    - bean-abc: "Fix login timeout"
    - bean-def: "Resolve memory leak"
    - bean-ghi: "Fix crash on startup"
```

## Chat Participant

### Using `@beans` in Copilot Chat

The `@beans` chat participant provides a conversational interface to Beans functionality.

### Available Slash Commands

#### `/summary`

Get a high-level overview of workspace status.

```text
You: @beans /summary

Copilot: You have 15 beans across 4 statuses:
- In Progress: 3 beans (1 critical, 2 high)
- Todo: 8 beans (2 high, 6 normal)
- Draft: 2 beans
- Completed: 2 beans

Top priority: "Fix authentication timeout" (bean-abc, critical bug)
```

#### `/priority`

Show top-priority issues that need attention.

```text
You: @beans /priority

Copilot: Top 5 priority beans:
1. [CRITICAL] bean-abc: "Fix authentication timeout" (bug, in-progress)
2. [HIGH] bean-def: "Implement OAuth login" (feature, todo)
3. [HIGH] bean-ghi: "Add password reset" (feature, todo)
4. [HIGH] bean-jkl: "Fix memory leak" (bug, in-progress)
5. [NORMAL] bean-mno: "Refactor user model" (task, todo)
```

#### `/stale`

List beans that haven't been updated recently.

```text
You: @beans /stale

Copilot: 4 beans haven't been updated in over 7 days:
- bean-pqr: "Update documentation" (task, todo) - 14 days old
- bean-stu: "Add unit tests" (task, todo) - 12 days old
- bean-vwx: "Refactor API" (epic, draft) - 21 days old
- bean-yz: "Setup CI/CD" (task, draft) - 18 days old

Consider reviewing these beans.
```

#### `/create [description]`

Create a new bean with AI guidance.

```text
You: @beans /create Add dark mode support to the application

Copilot: I'll help you create a bean for dark mode support.

Suggested configuration:
- Type: feature
- Priority: normal
- Status: todo
- Description: Implement dark mode theme with toggle in settings

Would you like me to create this bean? [Yes/No]
```

#### `/next`

Get a suggestion for the next bean to work on.

```text
You: @beans /next

Copilot: Based on priority and dependencies, I suggest working on:

bean-def: "Implement OAuth login" (feature, high priority, todo)

This bean:
- Is high priority
- Has no blocking dependencies
- Is part of the "User Authentication" epic
- Should take approximately 2-3 hours

Would you like to start this bean? [Yes/No]
```

#### `/search [query]`

Search beans by text content.

```text
You: @beans /search authentication

Copilot: Found 5 beans matching "authentication":
1. bean-abc: "Fix authentication timeout" (bug, in-progress)
2. bean-def: "Implement OAuth login" (feature, todo)
3. bean-ghi: "Add 2FA authentication" (feature, draft)
4. bean-jkl: "Update auth documentation" (task, todo)
5. bean-mno: "Refactor auth middleware" (task, todo)
```

#### `/commit [bean-id]`

Get commit message guidance for a bean.

```text
You: @beans /commit bean-abc

Copilot: Suggested commit message for bean-abc:

fix: resolve authentication timeout issue

- Increase session timeout from 30s to 5m
- Add retry logic for token refresh
- Log timeout events for monitoring

Resolves: bean-abc
Type: bug
Priority: critical
```

### Natural Language Queries

You can also ask questions naturally without slash commands:

```text
You: @beans what bugs need fixing?

Copilot: [Uses beans_vscode_list with type=bug filter]
    You have 4 open bugs:
    - 2 critical priority
    - 1 high priority
    - 1 normal priority

    Most urgent: "Fix authentication timeout" (bean-abc)
```

## Copilot Skills

### Auto-Generated Skill Files

When `beans.ai.enabled` is `true`, the extension automatically generates:

**`.github/skills/beans/SKILL.md`**

This file contains:

- Planning-mode guidance for epic decomposition
- Instructions for creating and linking child issues
- Best practices for Beans workflow with AI
- Example workflows and command patterns

### Using Copilot Skills

Copilot automatically reads skill files and uses them to provide better suggestions. You don't need to do anything special—just work normally and Copilot will reference the skill as needed.

**Example:**

```text
You: Help me break down this epic into tasks

Copilot: [References Beans skill guidance]
    I'll help you decompose this epic using the Beans workflow.

    First, let's create the epic bean, then break it into features,
    and finally create tasks for each feature...
```

## Configuration

### Enable/Disable AI Features

```json
{
  "beans.ai.enabled": true, // Master switch
  "beans.mcp.enabled": true // MCP server specifically
}
```

To disable all AI features: Set `beans.ai.enabled` to `false`.

To disable only MCP server: Set `beans.mcp.enabled` to `false`.

### MCP Server Configuration

The MCP server is automatically configured. To customize:

1. Open MCP settings: `Beans: MCP: Open MCP Settings`
2. Locate the `beans-vscode` server entry
3. Modify as needed (advanced)

## Troubleshooting

### MCP Tools Not Available

**Check**:

- Is `beans.ai.enabled` set to `true`?
- Is the MCP server running?
- Are you using an MCP-compatible AI client?

**Solutions**:

1. Enable AI features: Settings → `beans.ai.enabled` → `true`
2. Refresh MCP server: `Beans: MCP: Refresh Server Definitions`
3. View server info: `Beans: MCP: Show Server Info`
4. Check logs: `Beans: MCP: Open Logs`

### Chat Participant Not Responding

**Check**:

- Is GitHub Copilot activated?
- Is `beans.ai.enabled` set to `true`?
- Is `@beans` recognized in Chat?

**Solutions**:

1. Check Copilot status in status bar
2. Enable AI features in extension settings
3. Reload window: `Developer: Reload Window`
4. Try a simple command: `@beans /summary`

### Copilot Skill Not Being Used

**Check**:

- Is `.github/skills/beans/SKILL.md` present?
- Is file content up to date?

**Solutions**:

1. Verify skill file exists in workspace
2. Refresh skill: `Beans: Generate Copilot Skill`
3. Copilot may need time to index the file
4. Try explicitly mentioning Beans in your prompt

### MCP Server Crashes

**Check**:

- View error messages in Output channel
- Check logs: `Beans: MCP: Open Logs`

**Solutions**:

1. Check workspace is initialized: `beans init`
2. Verify Beans CLI is working: `beans --version`
3. Reload window: `Developer: Reload Window`
4. Check for extension updates
5. Report issue with logs

## Best Practices

### Working with AI and Beans

1. **Use descriptive bean titles**: Helps AI understand context
2. **Add detailed descriptions**: More context = better AI suggestions
3. **Keep beans focused**: One issue/task per bean
4. **Use proper types**: bug, feature, task, epic, milestone
5. **Set priorities**: Helps AI suggest next work
6. **Update status regularly**: Keeps AI suggestions accurate

### Epic Decomposition with AI

```text
You: @beans I need to build user authentication. Help me break this down.

Copilot: I'll help you create an epic with child beans:

1. Create epic: "User Authentication System"
2. Create features:
   - Login flow
   - Registration
   - Password reset
   - OAuth integration
3. Create tasks for each feature
4. Set dependencies
5. Prioritize by implementation order

Shall I create these beans? [Yes/No]
```

### Commit Workflow with AI

```text
You: @beans /commit bean-abc

Copilot: [Generates commit message]

You: [Make changes, then commit using suggested message]
```

---

For general usage instructions, see [user-guide.md](./user-guide.md).
