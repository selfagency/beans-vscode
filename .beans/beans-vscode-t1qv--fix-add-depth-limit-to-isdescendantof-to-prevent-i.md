---
# beans-vscode-t1qv
title: 'fix: add depth limit to isDescendantOf to prevent infinite loop on corrupt bean cycles'
status: todo
type: bug
priority: normal
created_at: 2026-02-24T13:49:30Z
updated_at: 2026-02-24T13:49:30Z
---

## Problem

`BeansDragAndDropController.isDescendantOf` traverses the bean parent chain with no depth limit:

```typescript
// src/beans/tree/BeansDragAndDropController.ts:130-148
private async isDescendantOf(bean: Bean, potentialAncestor: Bean): Promise<boolean> {
  let current: Bean | undefined = bean;
  while (current?.parent) {
    if (current.parent === potentialAncestor.id) return true;
    try {
      current = await this.service.showBean(current.parent);
    } catch (error) {
```

If the bean graph contains a cycle (which the CLI should prevent but corrupted state could create), this loop runs indefinitely, hanging the drag-and-drop operation and blocking the extension.

## Affected File

- `src/beans/tree/BeansDragAndDropController.ts:130`

## Recommendation

Add a depth counter capped at a reasonable limit (e.g. 50) with an early return:

```typescript
let depth = 0;
const MAX_DEPTH = 50;
while (current?.parent) {
  if (++depth > MAX_DEPTH) return false; // abort on suspected cycle
  // ...
}
```
