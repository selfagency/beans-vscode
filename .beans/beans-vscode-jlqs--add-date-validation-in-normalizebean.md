---
# beans-vscode-jlqs
title: Add date validation in normalizeBean
status: todo
type: task
priority: low
created_at: 2026-02-17T02:32:48Z
updated_at: 2026-02-17T02:32:48Z
---

The normalizeBean function doesn't validate date strings before parsing. Invalid dates become 'Invalid Date' objects which could cause issues downstream.

**Location:** src/beans/service/BeansService.ts normalizeBean function

**Current:** new Date(rawBean.createdAt) with no validation
**Better:** Validate date string or use try-catch, fallback to current time

**Edge case:** CLI could return invalid date formats
