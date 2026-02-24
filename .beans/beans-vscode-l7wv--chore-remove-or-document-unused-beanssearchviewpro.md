---
# beans-vscode-l7wv
title: 'chore: remove or document unused BeansSearchViewProvider (superseded by tree-based search)'
status: todo
type: task
priority: normal
created_at: 2026-02-24T13:49:41Z
updated_at: 2026-02-24T13:49:41Z
---

## Problem

`BeansSearchViewProvider` (`src/beans/search/BeansSearchViewProvider.ts`) is never instantiated anywhere in the extension activation path.

The inline comment at `src/extension.ts:184` explains: "NOTE: search previously used a webview view provider. The tree-based search view is registered later." The class still exists, has tests, and is exported from its barrel index, but is dead code.

## Affected Files

- `src/beans/search/BeansSearchViewProvider.ts`
- `src/beans/search/index.ts`
- `src/test/beans/search/BeansSearchViewProvider.test.ts`

## Recommendation

If this class is genuinely superseded by the tree-based search:
1. Delete `BeansSearchViewProvider.ts` and its test file
2. Remove the export from `src/beans/search/index.ts`

If it is intentionally preserved for future use, add a clear comment explaining why it is kept and what would trigger its re-activation.
