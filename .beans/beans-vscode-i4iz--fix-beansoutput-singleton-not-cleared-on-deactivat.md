---
# beans-vscode-i4iz
title: 'fix: BeansOutput singleton not cleared on deactivation — second activation gets disposed logger'
status: completed
type: bug
priority: critical
created_at: 2026-02-24T13:48:51Z
updated_at: 2026-02-24T14:05:09Z
---

## Problem

`BeansOutput` uses a module-level static singleton. When VS Code calls `deactivate()`, `src/extension.ts:852` disposes the logger via `logger?.dispose()`, but the static `BeansOutput.instance` field is never cleared.

On re-activation (e.g. workspace reload without full extension restart), `getInstance()` returns the already-disposed output channel. Subsequent calls to `logger.info(...)` write to a disposed VS Code output channel, producing silent failures or unhandled exceptions.

## Affected Files

- `src/beans/logging/BeansOutput.ts:15` — singleton never cleared
- `src/extension.ts:852` — `deactivate()` disposes but does not clear instance

## Recommendation

Add `BeansOutput.instance = undefined!` (or type the static field as `BeansOutput | undefined`) in `deactivate()`, before `logger?.dispose()`.

```typescript
// In deactivate():
BeansOutput.instance = undefined!;
logger?.dispose();
```
