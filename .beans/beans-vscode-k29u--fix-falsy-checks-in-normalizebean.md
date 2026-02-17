---
# beans-vscode-k29u
title: Fix falsy checks in normalizeBean
status: completed
type: bug
priority: high
created_at: 2026-02-17T04:57:43Z
updated_at: 2026-02-17T04:58:00Z
---

normalizeBean checks treat empty strings as missing. Bean.body can be empty. Use null/undefined checks instead.

Already fixed in current code - uses == null checks
