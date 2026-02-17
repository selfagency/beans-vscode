---
# beans-vscode-sywb
title: Eliminate duplicate CodeQL runs
status: completed
type: bug
priority: high
created_at: 2026-02-17T16:25:03Z
updated_at: 2026-02-17T16:34:58Z
---

Identify and remove the second CodeQL workflow/run source so only one CodeQL workflow executes.

## Summary of Changes

- Verified CodeQL workflow duplication sources via GitHub API.
- Confirmed repository workflow consolidation to a single CodeQL runner path.
- Removed dynamic/default duplicate run source visibility and validated only one active CodeQL workflow remains for ongoing runs.
