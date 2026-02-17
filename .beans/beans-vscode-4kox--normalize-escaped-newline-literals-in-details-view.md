---
# beans-vscode-4kox
title: Normalize escaped newline literals in details view body rendering
status: completed
type: task
priority: normal
created_at: 2026-02-17T23:46:35Z
updated_at: 2026-02-17T23:47:33Z
---

When opening a bean in details view, detect literal \n sequences outside fenced code blocks and render them as actual line breaks. Keep \n intact inside fenced code blocks. Add tests and commit.
