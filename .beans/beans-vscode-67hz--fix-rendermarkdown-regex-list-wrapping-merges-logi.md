---
# beans-vscode-67hz
title: 'fix: renderMarkdown regex list-wrapping merges logically separate lists'
status: in-progress
type: bug
priority: normal
created_at: 2026-02-24T13:49:37Z
updated_at: 2026-02-24T15:15:22Z
---

## Problem

`renderMarkdown` in `BeansDetailsViewProvider` wraps all list items with a single regex:

```typescript
// src/beans/details/BeansDetailsViewProvider.ts:983
html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
```

The `s` (dotAll) flag makes `.` match newlines, so this matches from the **first** `<li>` to the **last** `</li>` in the entire document. If a bean body contains multiple logically-separate lists (e.g. a bulleted list, then some prose, then a second list), all list items are merged into a single `<ul>`, losing the separation between them.

## Affected File

- `src/beans/details/BeansDetailsViewProvider.ts:983`

## Recommendation

Use a proper Markdown-to-HTML library (e.g. `marked`, already available as a VS Code built-in) instead of regex-based rendering, or rewrite the list-wrapping logic to group consecutive `<li>` elements and insert `<ul>` tags around each contiguous run.
