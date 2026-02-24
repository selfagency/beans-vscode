---
# beans-vscode-42zk
title: 'fix: simplify escapeHtml — remove misleading dead-object pattern and spurious as any cast'
status: completed
type: task
priority: high
created_at: 2026-02-24T13:49:13Z
updated_at: 2026-02-24T13:49:13Z
branch: fix/42zk-simplify-escapehtml
files:
  - src/test/beans/details/escapeHtml.test.ts
pr: https://github.com/selfagency/beans-vscode/pull/83
---

## Problem

`escapeHtml` in `BeansDetailsViewProvider` uses a misleading dead-object pattern:

```typescript
// src/beans/details/BeansDetailsViewProvider.ts:1061-1068
private escapeHtml(text: string): string {
  const div = { textContent: text } as any;
  return div.textContent
    .replace(/&/g, '&amp;')
    // ...
```

The `div` is a plain JS object literal, not a DOM element. `div.textContent` is just `text`. The `as any` cast exists only to suppress TypeScript's complaint about accessing `textContent` on `{}`. The actual escaping is done entirely by the chained `.replace()` calls — the fake DOM object is unused.

This appears to be a remnant of a DOM-based `document.createElement('div')` approach adapted for a non-DOM context.

## Affected File

- `src/beans/details/BeansDetailsViewProvider.ts:1061`

## Recommendation

Simplify to a direct replace chain with no spurious object:

```typescript
private escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```
