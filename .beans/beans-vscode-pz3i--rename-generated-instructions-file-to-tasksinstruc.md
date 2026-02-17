---
# beans-vscode-pz3i
title: Rename generated instructions file to tasks.instructions.md
status: completed
type: task
priority: normal
created_at: 2026-02-17T14:05:24Z
updated_at: 2026-02-17T22:39:11Z
---

## Goal\nRename generated .github/instructions/beans.instructions.md to .github/instructions/tasks.instructions.md on init flows, update tests/docs, and record under Unreleased changelog.\n\n## Checklist\n- [x] Update generation path constant\n- [x] Update tests/mocks referencing old path\n- [x] Update checked-in tasks instructions reference\n- [x] Add Unreleased changelog entry\n- [x] Commit changes

## Summary of Changes

- Verified the generation path constant now points to `.github/instructions/tasks.instructions.md` in `src/beans/config/CopilotInstructions.ts`.
- Verified tests/mocks reference the new path (including MCP and integration tests).
- Verified checked-in instructions artifact exists at `.github/instructions/tasks.instructions.md`.
- Added the missing `Unreleased` changelog entry documenting this rename in `CHANGELOG.md`.
- Marked checklist complete and closed this bean.
