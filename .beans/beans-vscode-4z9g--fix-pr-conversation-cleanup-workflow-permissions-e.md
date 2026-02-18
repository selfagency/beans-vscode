---
# beans-vscode-4z9g
title: Fix PR conversation cleanup workflow permissions error
status: in-progress
type: task
priority: high
created_at: 2026-02-18T06:02:19Z
updated_at: 2026-02-18T06:02:19Z
---

## Problem

The `copilot-pr-conversation-cleanup.yml` workflow was failing with:

```
GraphqlResponseError: Resource not accessible by integration
```

The `resolveReviewThread` GraphQL mutation was throwing a hard error when the GITHUB_TOKEN lacked permission to resolve threads authored by others, crashing the entire job.

## Changes

- Wrapped per-thread resolution in a try/catch block
- Failures emit a warning instead of crashing the job
- Summary reports resolved vs. failed thread counts
- Job completes successfully regardless of resolution failures; failed thread resolutions emit warnings and are included in the summary
