---
# beans-vscode-ryj0
title: 'perf: cache BeansConfigManager as instance field instead of re-instantiating on every getConfig() call'
status: todo
type: task
priority: high
created_at: 2026-02-24T13:49:17Z
updated_at: 2026-02-24T13:49:17Z
---

## Problem

`BeansService.getConfig()` instantiates a new `BeansConfigManager` and reads from disk on every call:

```typescript
// src/beans/service/BeansService.ts:480-481
async getConfig(): Promise<BeansConfig> {
  const configManager = new BeansConfigManager(this.workspaceRoot);
  const yamlConfig = await configManager.read();
```

`getConfig()` is called on every fetch cycle and in multiple hot paths:
- `detectOrphanedBeanFiles`
- `tryRepairMalformedBean`
- `clearDanglingParentReferences`

Each call opens a YAML file via `vscode.workspace.findFiles` + `openTextDocument`. This is unnecessary repeated I/O.

## Affected File

- `src/beans/service/BeansService.ts:480`

## Recommendation

Store `BeansConfigManager` as a private instance field, created once in the constructor. Optionally add a short TTL cache on the parsed config to avoid re-parsing on every call while still picking up file changes.
