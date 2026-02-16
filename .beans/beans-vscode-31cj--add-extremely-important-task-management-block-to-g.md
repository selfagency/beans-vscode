---
# beans-vscode-31cj
title: Add EXTREMELY_IMPORTANT task-management block to generated instructions
status: completed
type: task
priority: normal
created_at: 2026-02-16T16:56:04Z
updated_at: 2026-02-16T16:56:34Z
---

Update CopilotInstructions generator to include EXTREMELY_IMPORTANT section covering Beans task-management rules.

## Summary of Changes

- Added an explicit <EXTREMELY_IMPORTANT> section to generated Copilot instructions with strict Beans task-management rules.
- Preserved extension-first workflow guidance and planning mode content below the critical section.
- Updated CopilotInstructions unit test to assert the new critical block is generated.
- Verified compile and tests pass (46 tests).
