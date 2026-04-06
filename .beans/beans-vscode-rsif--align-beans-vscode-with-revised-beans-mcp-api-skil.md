---
# beans-vscode-rsif
title: align beans vscode with revised beans mcp api skil
status: completed
type: task
priority: normal
created_at: 2026-04-06T13:31:53Z
updated_at: 2026-04-06T13:50:51Z
branch: feat/rsif-revised-beans-mcp-alignment
pr: 128
---

Review upstream changes in `selfagency/beans-mcp` and update this extension's MCP integration, generated skill/instructions guidance, chat participant behavior, and docs to properly match the revised MCP surface.

## Todo
- [x] Review upstream beans-mcp changes and release notes
- [x] Inspect local MCP integration, skill templates, chat prompts, and docs
- [x] Update code to match revised MCP behavior and versioning
- [x] Update skill/chat/docs to prefer the new MCP tool surface and guidance
- [x] Run compile/tests and summarize changes

## Summary of Changes
- Updated the extension MCP launcher to use the revised workspace-root/positional CLI style and pass `--log-dir` when launching the bundled wrapper around `@selfagency/beans-mcp`.
- Aligned chat guidance and system prompt language with the consolidated MCP surface (`beans_query`, `beans_view`, `beans_create`, `beans_bulk_create`, `beans_update`, `beans_bulk_update`, `beans_delete`, `beans_reopen`, `beans_bean_file`, `beans_output`).
- Updated generated Copilot instruction and skill templates to describe the revised MCP usage patterns, body-first create semantics, best-effort bulk operations, and separate `beans-prime.instructions.md` output for MCP `llm_context`.
- Refreshed user/developer docs to document the revised tool surface, positional workspace invocation, `--log-dir`, batch operations, path normalization, and warning-only CLI/package version mismatches.
- Updated MCP/chat/docs guard tests and fixed the MCP integration reference markdown so it renders/builds correctly.
- Kept the dependency on the installable published package version `@selfagency/beans-mcp@^0.5.0` currently present in this workspace.

## Validation
- `pnpm run compile`
- `pnpm test`
- `pnpm run docs:build`
