---
# beans-vscode-8qg3
title: Add date validation in normalizeBean
status: in-progress
type: task
priority: low
created_at: 2026-02-17T03:46:06Z
updated_at: 2026-02-17T04:06:57Z
---

normalizeBean converts date strings to Date objects but doesn't validate them. Invalid date strings result in 'Invalid Date' objects which could cause issues downstream.

Location: src/beans/service/BeansService.ts created_at/updated_at handling

## Solution
Add date validation and handle invalid dates gracefully (either throw error or log warning and use current date)
