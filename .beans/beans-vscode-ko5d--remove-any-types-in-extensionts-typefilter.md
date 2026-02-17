---
# beans-vscode-ko5d
title: Remove any types in extension.ts typeFilter
status: completed
type: task
priority: low
created_at: 2026-02-17T03:50:22Z
updated_at: 2026-02-17T04:06:52Z
parent: beans-vscode-3y36
---

Line uses 'as any' cast for typeFilter which defeats TypeScript safety.

Location: src/extension.ts typeFilter cast

Fix: Remove 'as any' and ensure proper typing

## Summary of Changes

Replaced unsafe 'as any' type cast with proper 'as BeanType[] | undefined' cast.
- Added BeanType import from ./beans/model
- Changed typeFilter assignment to use proper type assertion
- Maintains functionality while improving type safety

Commit: 141ef52
