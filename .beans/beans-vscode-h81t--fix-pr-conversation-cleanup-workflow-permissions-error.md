---
# beans-vscode-h81t
title: Fix PR conversation cleanup workflow permissions error
status: completed
type: task
priority: high
created_at: 2026-02-18T06:02:47Z
updated_at: 2026-02-18T06:02:47Z
---

## Problem

The `copilot-pr-conversation-cleanup.yml` workflow was failing with:

```text
GraphqlResponseError: Resource not accessible by integration
```

The `resolveReviewThread` GraphQL mutation was throwing a hard error when the GITHUB_TOKEN lacked permission to resolve threads authored by others, crashing the entire job.

## Changes

- Wrapped per-thread resolution in a try/catch block
- Failures emit a warning instead of crashing the job
- Summary reports resolved vs. failed thread counts
- Job exits cleanly unless all threads fail

## Summary of Changes

Fixed `.github/workflows/copilot-pr-conversation-cleanup.yml`: wrapped the `resolveThread` call in a try/catch so individual `Resource not accessible by integration` errors surface as warnings rather than crashing the entire job. Results are logged and the job only fails hard if zero threads could be resolved.
