---
# beans-vscode-8wiv
title: Finish Beans 0.4.2 parity leftovers
status: completed
type: task
priority: high
created_at: 2026-03-14T02:14:05Z
updated_at: 2026-03-14T02:17:56Z
---

Complete remaining upstream-alignment work after the core migration: docs/tool naming consistency, stale local MCP shim cleanup, and regression tests for GraphQL-first instruction flow.

## Todo

- [x] Audit and patch remaining docs/tool naming drift
- [x] Remove or modernize stale local @selfagency/beans-mcp type shim
- [x] Add/update targeted regression tests for llm_context/source command and paths
- [x] Run compile + tests and summarize

## Summary of Changes

- Updated MCP docs and command references to current `beans_*` tool names (`beans_query`, `beans_update`, `beans_view`, `beans_delete`, etc.) and included 0.4.2 capabilities (`ready`, batch `beanIds`, `bodyAppend`/`bodyReplace`, optional `ifMatch`).
- Replaced stale `beans_vscode_llm_context` references in templates and generated instruction/skill files with `beans_query` + `operation: "llm_context"` guidance.
- Attempted removal of the local `@selfagency/beans-mcp` shim; compile proved it is still required in this TS setup, so restored and modernized the shim comments/intent.
- Validated with full compile and focused parity tests (which ran clean).
