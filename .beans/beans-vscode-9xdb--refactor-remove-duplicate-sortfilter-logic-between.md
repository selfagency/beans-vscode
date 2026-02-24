---
# beans-vscode-9xdb
title: 'refactor: remove duplicate sort/filter logic between BeansMcpServer and queryHelpers'
status: completed
type: task
priority: high
created_at: 2026-02-24T13:49:09Z
updated_at: 2026-02-24T16:36:22Z
---

## Problem

Sort weights and filter logic are duplicated between two files:

1. `src/beans/mcp/BeansMcpServer.ts:356-412` — inline sort weight table and filter logic
2. `src/beans/mcp/internal/queryHelpers.ts` — `handleQueryOperation` with the same logic

The `beans_vscode_query` tool handler (lines 715-779 of `BeansMcpServer.ts`) duplicates logic already encapsulated in `queryHelpers.ts:handleQueryOperation`. The `sortBeans` function is independently exported from both files.

This is a DRY violation: updating sort order or filter logic in one place will silently leave the other stale, causing inconsistent behaviour between the two code paths.

## Affected Files

- `src/beans/mcp/BeansMcpServer.ts:356-412`, `715-779`
- `src/beans/mcp/internal/queryHelpers.ts`

## Note

The comment in `src/test/beans/mcp/too-many-mcp-commands.test.ts` references a "refactor" that appears related. The consolidation should be completed by routing the MCP tool handler through `handleQueryOperation` from `queryHelpers.ts` and deleting the duplicated inline logic from `BeansMcpServer.ts`.
