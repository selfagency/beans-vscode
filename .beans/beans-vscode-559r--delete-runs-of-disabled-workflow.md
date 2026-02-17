---
# beans-vscode-559r
title: Delete runs of disabled workflow
status: completed
type: task
priority: high
created_at: 2026-02-17T16:21:59Z
updated_at: 2026-02-17T16:32:52Z
---

Find disabled GitHub Actions workflows and remove all their workflow runs from the repository.

## Summary of Changes

- Verified CodeQL-related workflows via GitHub API.
- Confirmed duplicate dynamic CodeQL workflow no longer appears in workflow list.
- Confirmed only one CodeQL workflow remains active: .github/workflows/codeql.yml.
- Cleaned up dynamic CodeQL run history during verification.
