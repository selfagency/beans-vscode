---
# beans-vscode-ozds
title: Add tests for rebuildInProgressCache behavior
status: scrapped
type: task
priority: normal
created_at: 2026-02-17T03:33:53Z
updated_at: 2026-02-17T04:04:05Z
---

The rebuildInProgressCache logic is new but has no unit tests covering the behavior of marking parent beans when descendants are in-progress.

**Location:** src/test/beans/tree/BeansTreeDataProvider.test.ts

**Needed tests:**
- Parent marked when child is in-progress
- Grandparent marked when grandchild is in-progress
- Cache cleared and rebuilt correctly
- Multiple in-progress descendants

**Impact:** Risk of regressions in tree rendering cues

## Reasons for Scrapping

Tests for rebuildInProgressCache already exist in PR #22 (improve-test-coverage branch). No need to duplicate this work in the code-review-improvements branch.
