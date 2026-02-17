---
# beans-vscode-23ed
title: Add test coverage for new BeansService features
status: todo
type: task
priority: normal
created_at: 2026-02-17T02:32:49Z
updated_at: 2026-02-17T02:32:49Z
---

New BeansService features lack unit test coverage:

**Missing tests for:**
- normalizeBean function (validation, date parsing, field mapping)
- Offline mode cache fallback behavior
- inProgressDescendantsCache algorithm in tree provider
- Retry logic with exponential backoff
- Request deduplication (inFlightRequests map)
- Batch operations

**Location:** src/test/beans/service/ (new tests needed)

**Goal:** Achieve >80% coverage for BeansService and BeansTreeDataProvider
