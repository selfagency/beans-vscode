---
# beans-vscode-a3fa
title: Investigate blockedBy property mapping
status: completed
type: bug
priority: high
created_at: 2026-02-17T02:32:46Z
updated_at: 2026-02-17T07:16:23Z
---

The normalizeBean function may not be mapping the blockedBy property from CLI output. Need to verify if this is a regression or if CLI uses different field name (blocked_by vs blockedBy).

**Location:** src/beans/service/BeansService.ts normalizeBean function

**Investigation needed:**
- Check if CLI returns 'blocked_by' or 'blockedBy'
- Verify RawBeanFromCLI interface includes this field
- Check integration tests for evidence of blockedBy usage
- Add mapping if missing

## Summary of Changes
- Verified blockedBy normalization supports blockedBy, blockedByIds, blocked_by_ids, and blocked_by.
- Confirmed canonical precedence behavior in service normalization.
- Added and validated regression coverage in BeansService tests.
