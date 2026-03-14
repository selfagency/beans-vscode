---
# beans-vscode-z627
title: Add regression tests for parity updates
status: completed
type: task
priority: high
created_at: 2026-03-14T02:20:18Z
updated_at: 2026-03-14T02:21:50Z
---

Ensure new parity functionality has explicit automated coverage.

## Todo

- [x] Add tests for updated MCP guidance wording in Copilot templates
- [x] Add tests guarding against stale beans_vscode tool naming in docs
- [x] Run compile and targeted tests
- [x] Summarize and close

## Summary of Changes

- Added regression assertions in `CopilotInstructions.test.ts` to verify generated instructions include `beans_query` llm_context guidance and exclude stale `beans_vscode_llm_context` wording.
- Added regression assertions in `CopilotSkill.test.ts` for the same MCP guidance transition.
- Added a new docs guard test file `src/test/readme/mcp-tool-naming-parity.test.ts` to ensure user docs (`ai.md`, `mcp-integration.md`, `commands.md`) use `beans_*` tool names and do not reintroduce `beans_vscode_*` references.
- Added GraphQL-source guard assertion in MCP integration docs test (`"sourceCommand": "beans graphql --schema"`) to protect the intentional GraphQL-first policy.
- Validated by running targeted tests plus full compile.
