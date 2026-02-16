---
# beans-vscode-ryoa
title: Align generated Copilot instructions with new extension-first policy
status: completed
type: task
priority: normal
created_at: 2026-02-16T16:53:57Z
updated_at: 2026-02-16T16:54:45Z
---

Update CopilotInstructions generator so extension-produced beans.instructions.md matches the new extension/chat/MCP-first guidance and planning mode.

## Summary of Changes

- Replaced the Copilot instructions generator template with the new extension-first workflow style.
- Added interface priority (extension → chat → MCP → CLI fallback), generated-artifact guidance, planning mode, and fallback CLI section.
- Added unit test `CopilotInstructions.test.ts` to keep generated output aligned.
- Verified compile and tests pass (46 tests).
