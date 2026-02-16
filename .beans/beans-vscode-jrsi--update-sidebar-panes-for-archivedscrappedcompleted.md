---
# beans-vscode-jrsi
title: Update sidebar panes for archived/scrapped/completed
status: completed
type: task
priority: normal
created_at: 2026-02-16T03:43:25Z
updated_at: 2026-02-16T03:44:44Z
---

## Goal\nUpdate copilot instructions so completed, scrapped, and archived are separate collapsible sidebar panes, and scrapped issues can be deleted.\n\n## Todo\n- [x] Review current copilot instructions file\n- [x] Update sidebar behavior requirements for separate collapsible panes\n- [x] Add delete-scrapped requirement in actions/commands\n- [x] Verify wording consistency and save

## Summary of Changes

- Updated .github/copilot-instructions.md to require dedicated collapsible sidebar panes for Active, Completed, Scrapped, and Archived beans.
- Added explicit requirement that scrapped issues can be deleted.
- Added guardrail that deletion flows should only allow deleting scrapped issues and require explicit confirmation.
- Updated settings guidance to include default expanded/collapsed state per pane.
