---
# beans-vscode-gamf
title: 'fix: BeansTreeDataProvider EventEmitter never disposed — memory leak'
status: completed
type: bug
priority: critical
created_at: 2026-02-24T13:48:56Z
updated_at: 2026-02-24T14:05:28Z
branch: fix/gamf-dispose-treeprovider
files:
	- src/test/beans/tree/disposeProviders.test.ts
pr: https://github.com/selfagency/beans-vscode/pull/82
---

## Problem

`BeansTreeDataProvider` creates a `vscode.EventEmitter` at line 38 but never disposes it. The class does not implement `vscode.Disposable`. The `TreeView` wrappers are added to `context.subscriptions` via `registerBeansTreeViews`, but the provider instances themselves are not disposed.

The EventEmitter's internal listener lists grow and are never freed, causing a memory leak for the extension's lifetime.

## Affected Files

- `src/beans/tree/BeansTreeDataProvider.ts:38` — `_onDidChangeTreeData` EventEmitter never disposed

## Contrast

`BeansFilterManager` at `src/beans/tree/BeansFilterManager.ts:212` correctly implements `dispose()` — use it as a reference.

## Recommendation

1. Have `BeansTreeDataProvider` implement `vscode.Disposable`
2. Dispose `this._onDidChangeTreeData` in `dispose()`
3. Register provider instances in `context.subscriptions` alongside their `TreeView` wrappers in `registerBeansTreeViews`
