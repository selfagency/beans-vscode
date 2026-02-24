---
title: MCP Integration Reference
---

This page documents the compact, consolidated MCP (Model Context Protocol) tool surface exposed by the Beans VS Code extension and provides example request/response payloads for each tool. Use these examples when integrating LLM agents or when writing automated workflows that call the MCP tools directly.

Summary of public MCP tools

- `beans_vscode_init` — Initialize the workspace (optional `prefix`).
- `beans_vscode_view` — Fetch full bean details by `beanId`.
- `beans_vscode_create` — Create a new bean (title/type + optional fields).
- `beans_vscode_update` — Consolidated metadata updates (status/type/priority/parent/clearParent/blocking/blockedBy).
- `beans_vscode_delete` — Delete a bean (`beanId`, optional `force`).
- `beans_vscode_reopen` — Reopen a completed or scrapped bean to an active status.
- `beans_vscode_query` — Unified list/search/filter/sort/llm_context/open_config operations.
- `beans_vscode_bean_file` — Read/edit/create/delete files under `.beans`.
- `beans_vscode_output` — Read extension output logs or show guidance.

Notes

- The `beans_vscode_query` tool is intentionally broad: prefer it for listing, searching, filtering or sorting beans, and for generating Copilot instructions (`operation: 'llm_context'`).
- All file and log operations validate paths to keep them within the workspace or the VS Code log directory.
- `beans_vscode_update` replaces many fine-grained update tools; callers should use it to keep the public tool surface small and predictable.

## Examples

### beans_vscode_init

Request:

```json
{ "prefix": "project" }
```

Response (structuredContent):

```json
{ "initialized": true }
```

### beans_vscode_view

Request:

```json
{ "beanId": "bean-abc" }
```

Response (structuredContent):

```json
{
  "bean": {
    "id": "bean-abc",
    "title": "Fix login timeout",
    "status": "todo",
    "type": "bug",
    "priority": "critical",
    "body": "...markdown...",
    "createdAt": "2025-12-01T12:00:00Z",
    "updatedAt": "2025-12-02T08:00:00Z"
  }
}
```

### beans_vscode_create

Request:

```json
{
  "title": "Add dark mode",
  "type": "feature",
  "status": "todo",
  "priority": "normal",
  "description": "Implement theme toggle and styles"
}
```

Response (structuredContent):

```json
{ "bean": { "id": "new-1", "title": "Add dark mode", "status": "todo", "type": "feature" } }
```

### beans_vscode_update

Request (change status and add blocking):

```json
{
  "beanId": "bean-abc",
  "status": "in-progress",
  "blocking": ["bean-def"]
}
```

Response (structuredContent):

```json
{ "bean": { "id": "bean-abc", "status": "in-progress", "blockingIds": ["bean-def"] } }
```

### beans_vscode_delete

Request:

```json
{ "beanId": "bean-old", "force": false }
```

Response:

```json
{ "deleted": true, "beanId": "bean-old" }
```

### beans_vscode_reopen

Request:

```json
{
  "beanId": "bean-closed",
  "requiredCurrentStatus": "completed",
  "targetStatus": "todo"
}
```

Response:

```json
{ "bean": { "id": "bean-closed", "status": "todo" } }
```

### beans_vscode_query — examples

Refresh (list all beans):

```json
{ "operation": "refresh" }
```

Response (partial):

```json
{ "count": 12, "beans": [] }
```

Filter (statuses/types/tags):

```json
{
  "operation": "filter",
  "statuses": ["in-progress","todo"],
  "types": ["bug","feature"],
  "tags": ["auth"]
}
```

Search (full-text):

```json
{ "operation": "search", "search": "authentication", "includeClosed": false }
```

Sort (modes: `status-priority-type-title`, `updated`, `created`, `id`):

```json
{ "operation": "sort", "mode": "updated" }
```

LLM context (generate Copilot instructions; optional write-to-workspace):

```json
{ "operation": "llm_context", "writeToWorkspaceInstructions": true }
```

Response (structuredContent):

```json
{
  "graphqlSchema": "...",
  "generatedInstructions": "...",
  "instructionsPath": "/workspace/.github/instructions/tasks.instructions.md"
}
```

### beans_vscode_bean_file

Request (read):

```json
{ "operation": "read", "path": "beans-vscode-123--title.md" }
```

Response:

```json
{
  "path": "/workspace/.beans/beans-vscode-123--title.md",
  "content": "---\n...frontmatter...\n---\n# Title\n"
}
```

### beans_vscode_output

Request (read last 200 lines):

```json
{ "operation": "read", "lines": 200 }
```

Response:

```json
{ "path": "/workspace/.vscode/logs/beans-output.log", "content": "...log lines...", "linesReturned": 200 }
```

Security & Best Practices

- Do not rely on the MCP tools for privileged file system access — all paths are validated to stay within the workspace (or VS Code logs directory) and will error if the path is invalid.
- Prefer the consolidated tools (`beans_vscode_query`, `beans_vscode_update`, `beans_vscode_bean_file`) over any private/internal helpers — they are the supported public surface.

If you need more example payloads for a specific tool or an SDK snippet for a language, tell me which one and I'll add it.
