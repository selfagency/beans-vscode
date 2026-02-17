---
# beans-vscode-ko5d
title: Remove any types in extension.ts typeFilter
status: in-progress
type: task
priority: low
created_at: 2026-02-17T03:50:22Z
updated_at: 2026-02-17T04:05:30Z
parent: beans-vscode-3y36
---

Line uses 'as any' cast for typeFilter which defeats TypeScript safety.

Location: src/extension.ts typeFilter cast

Fix: Remove 'as any' and ensure proper typing
