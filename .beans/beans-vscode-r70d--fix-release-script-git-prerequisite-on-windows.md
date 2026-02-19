---
# beans-vscode-r70d
title: Fix release script git prerequisite on Windows
status: completed
type: bug
priority: high
branch: feature/beans-vscode-t4hi-init-ai-prompts-view-order
pr: 46
created_at: 2026-02-19T15:39:16Z
updated_at: 2026-02-19T15:39:16Z
---

## Todo
- [x] Replace non-portable `which git` check in release script
- [x] Ensure error output remains clear when git truly missing
- [x] Commit and push fix to current PR branch

## Summary of Changes
- Replaced `which git` with `git --version` in the release prerequisite check to support Windows PowerShell/Git Bash environments.
- Kept existing error message path unchanged when git is truly unavailable.
