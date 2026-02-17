---
# beans-vscode-twe8
title: Replace any types with unknown in mocks and service
status: completed
type: task
priority: low
created_at: 2026-02-17T03:33:54Z
updated_at: 2026-02-17T03:37:44Z
---

Multiple uses of 'any' type that should be 'unknown' for better type safety:

**Locations:**
- src/beans/service/BeansService.ts: inFlightRequests Map<string, Promise<any>>
- src/extension.ts: typeFilter as any
- src/test/mocks/vscode.ts: executeCommand Promise<any>, RelativePattern base: any

**Fix:** Replace with 'unknown' or proper types
