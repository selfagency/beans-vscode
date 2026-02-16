---
# beans-vscode-ymx7
title: Refine chat search followup prompt
status: completed
type: task
priority: normal
created_at: 2026-02-16T16:33:22Z
updated_at: 2026-02-16T16:33:46Z
---

Remove hardcoded MCP follow-up search query and require user-provided search text in Beans chat participant.

## Summary of Changes

- Removed hardcoded MCP search default from Beans chat follow-up.
- Search follow-up now uses an empty query and prompts the user to provide `/search <term>`.
- Updated empty-search guidance text to explicitly ask for user input.
- Verified compile and tests pass (44 tests).
