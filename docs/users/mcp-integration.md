---
title: MCP Integration Reference
---

This page documents the compact, consolidated MCP (Model Context Protocol) tool surface exposed by the Beans VS Code extension and provides example request/response payloads for each tool. Use these examples when integrating LLM agents or when writing automated workflows that call the MCP tools directly.

Summary of public MCP tools

- `beans_init` — Initialize the workspace (optional `prefix`).
- `beans_view` — Fetch full bean details by `beanId` or `beanIds`.
- `beans_create` — Create a new bean (title/type + optional fields).
- `beans_bulk_create` — Create multiple beans in one call, optionally under a shared parent.
- `beans_update` — Consolidated metadata + body updates (`status`/`type`/`priority`/`parent`/`clearParent`/`blocking`/`blockedBy`/`body`/`bodyAppend`/`bodyReplace`) plus optional `ifMatch`.
- `beans_bulk_update` — Update multiple beans in one call, optionally reassigning them to a shared parent.
- `beans_delete` — Delete one or more beans (`beanId` or `beanIds`, optional `force`).
- `beans_reopen` — Reopen a completed or scrapped bean to an active status.
- `beans_query` — Unified list/search/filter/sort/ready/llm_context/open_config operations.
- `beans_bean_file` — Read/edit/create/delete files under `.beans`.
- `beans_output` — Read extension output logs or show guidance.

Notes

- The `beans_query` tool is intentionally broad: prefer it for listing, searching, filtering or sorting beans, and for generating Copilot instructions (`operation: 'llm_context'`).
- All file and log operations validate paths to keep them within the workspace or the VS Code log directory. The `.beans/` prefix is normalized automatically for `beans_bean_file` paths.
- `beans_update` replaces many fine-grained update tools; callers should use it to keep the public tool surface small and predictable.
- `beans_bulk_create` and `beans_bulk_update` are best-effort: partial failures are returned per item instead of aborting atomically.
- `beans_create` prefers `body`; `description` is accepted only as a deprecated alias.
- Frontmatter `title:` values are automatically quoted on write.
- Version mismatches between `beans-mcp` and the installed Beans CLI are warning-only and non-blocking.

## Examples

### beans_init

Request:

```json
{ "prefix": "project" }
```

Response (structuredContent):

```json
{ "initialized": true }
```

### beans_view

Request:

```json
{ "beanId": "bean-abc" }
```

Request (multiple beans):

```json
{ "beanIds": ["bean-abc", "bean-def"] }
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

### beans_create

Request:

```json
{
  "title": "Add dark mode",
  "type": "feature",
  "status": "todo",
  "priority": "normal",
  "body": "Implement theme toggle and styles"
}
```

> `description` is still accepted as a deprecated alias for `body`.

Response (structuredContent):

```json
{ "bean": { "id": "new-1", "title": "Add dark mode", "status": "todo", "type": "feature" } }
```

### beans_bulk_create

Request:

```json
{
  "parent": "epic-123",
  "beans": [
    { "title": "Design mockups", "type": "task" },
    { "title": "Implement API", "type": "task", "priority": "high" },
    { "title": "Write tests", "type": "task", "parent": "epic-456" }
  ]
}
```

The top-level `parent` is applied as a default to any bean that does not specify its own `parent`.

Response (structuredContent):

```json
{
  "requestedCount": 3,
  "successCount": 3,
  "failedCount": 0,
  "results": [
    { "bean": { "id": "task-1", "title": "Design mockups" } },
    { "bean": { "id": "task-2", "title": "Implement API" } },
    { "bean": { "id": "task-3", "title": "Write tests" } }
  ]
}
```

### beans_update

Request (change status and add blocking):

```json
{
  "beanId": "bean-abc",
  "status": "in-progress",
  "blocking": ["bean-def"],
  "ifMatch": "etag-value"
}
```

Response (structuredContent):

```json
{ "bean": { "id": "bean-abc", "status": "in-progress", "blockingIds": ["bean-def"] } }
```

Request (atomic body modifications):

```json
{
  "beanId": "bean-abc",
  "bodyReplace": [
    { "old": "- [ ] Task 1", "new": "- [x] Task 1" },
    { "old": "- [ ] Task 2", "new": "- [x] Task 2" }
  ],
  "bodyAppend": "## Summary\n\nAll checklist items completed."
}
```

> `body` cannot be combined with `bodyAppend` or `bodyReplace` in the same request.

### beans_bulk_update

Request:

```json
{
  "parent": "epic-123",
  "beans": [
    { "beanId": "task-1", "status": "in-progress" },
    { "beanId": "task-2", "status": "in-progress" },
    { "beanId": "task-3", "status": "in-progress", "parent": "epic-456" }
  ]
}
```

Response (structuredContent):

```json
{
  "requestedCount": 3,
  "successCount": 3,
  "failedCount": 0,
  "results": [
    { "beanId": "task-1", "bean": { "id": "task-1", "status": "in-progress" } },
    { "beanId": "task-2", "bean": { "id": "task-2", "status": "in-progress" } },
    { "beanId": "task-3", "bean": { "id": "task-3", "status": "in-progress" } }
  ]
}
```

> Bulk tools are best-effort and may report partial failures.

### beans_delete

Request:

```json
{ "beanId": "bean-old", "force": false }
```

Response:

```json
{ "deleted": true, "beanId": "bean-old" }
```

### beans_reopen

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

### beans_query — examples

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
  "statuses": ["in-progress", "todo"],
  "types": ["bug", "feature"],
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

Ready (actionable beans only):

```json
{ "operation": "ready" }
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
  "instructionsPath": "/workspace/.github/instructions/beans-prime.instructions.md"
}
```

> Note: the extension's own initialization flow still generates `.github/instructions/tasks.instructions.md`; the MCP server's `llm_context` artifact path is separate.

### beans_bean_file

Request (read):

```json
{ "operation": "read", "path": "beans-vscode-123--title.md" }
```

You may also pass `.beans/beans-vscode-123--title.md`; the prefix is normalized automatically.

Response:

```json
{
  "path": "/workspace/.beans/beans-vscode-123--title.md",
  "content": "---\n...frontmatter...\n---\n# Title\n"
}
```

### beans_output

Request (read last 200 lines):

```json
{ "operation": "read", "lines": 200 }
```

Response:

```json
{ "path": "/path/to/vscode/logs/beans-output.log", "content": "...log lines...", "linesReturned": 200 }
```

Security & Best Practices

- Do not rely on the MCP tools for privileged file system access — all paths are validated to stay within the workspace (or VS Code logs directory) and will error if the path is invalid.
- Prefer the consolidated tools (`beans_query`, `beans_update`, `beans_bean_file`) over any private/internal helpers — they are the supported public surface.

If you need more example payloads for a specific tool or an SDK snippet for a language, tell me which one and I'll add it.
