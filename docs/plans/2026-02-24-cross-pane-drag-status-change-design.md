# Design: Cross-Pane Drag to Change Issue Status

**Bean:** beans-vscode-0b3q
**Date:** 2026-02-24

## Problem

The existing `BeansDragAndDropController` handles drag-and-drop for re-parenting beans within the same pane. All five tree views share one controller instance. `handleDrop` has no way to know which pane received the drop, so cross-pane status changes are impossible.

## Approach

Add `targetStatus` and `nativeStatuses` constructor parameters to `BeansDragAndDropController`. Each pane gets its own controller instance. When a bean's status is not native to the drop target pane, it is a cross-pane drop and the bean's status is updated.

**Cross-pane detection:** `targetStatus !== null && !nativeStatuses.includes(draggedBean.status)`

When `targetStatus` is `null` (default), existing re-parent behavior is fully preserved — all existing tests pass unchanged.

## Constructor Signature

```typescript
constructor(
  service: BeansService,
  targetStatus: BeanStatus | null = null,
  nativeStatuses: BeanStatus[] = []
)
```

## Per-Pane Controller Configuration

| Pane      | `targetStatus` | `nativeStatuses`          |
| --------- | -------------- | ------------------------- |
| Active    | `'todo'`       | `['todo', 'in-progress']` |
| Completed | `'completed'`  | `['completed']`           |
| Scrapped  | `'scrapped'`   | `['scrapped']`            |
| Draft     | `'draft'`      | `['draft']`               |
| Search    | `null`         | `[]`                      |

Dragging any bean to the Active pane re-opens it as `todo`.

## handleDrop Decision Tree

### Intra-pane drop (bean status is in `nativeStatuses`)

Existing re-parent behavior: validate type hierarchy + cycle, confirm, call `updateBean(id, { parent })`.

### Cross-pane drop on pane background (`target === undefined`)

```
"Set 'Login bug' to completed?"
[Set Status]  [Cancel]
```

On confirm: `updateBean(id, { status: targetStatus })`

### Cross-pane drop on another bean

```
"Set 'Login bug' to completed?"
[Change Status Only]  [Change Status & Move to 0b3q]  [Cancel]
```

- **Change Status Only** → `updateBean(id, { status: targetStatus })`
- **Change Status & Move to [code]** → run full validation (type hierarchy + cycle check); on pass: `updateBean(id, { status: targetStatus, parent: target.id })`; on fail: show error, no update
- **Cancel / close** → no update

### Edge cases

- Drop on self → error: "Cannot make a bean its own parent"
- Invalid type hierarchy for re-parent → error with reason
- Cycle detected → error with reason

## Files Changed

1. `src/beans/tree/BeansDragAndDropController.ts` — new constructor params, updated `handleDrop`
2. `src/beans/tree/registerBeansTreeViews.ts` — five per-pane controller instances
3. `src/test/beans/tree/BeansDragAndDropController.test.ts` — new tests for cross-pane behavior

## New Tests

1. Cross-pane drop on background, confirm → `updateBean({ status })`
2. Cross-pane drop on background, cancel → no update
3. Cross-pane drop on bean, "Change Status Only" → `updateBean({ status })`
4. Cross-pane drop on bean, "Change Status & Move to X" → validates, `updateBean({ status, parent })`
5. Cross-pane drop on bean, "Change Status & Move to X", invalid type hierarchy → error, no update
6. Cross-pane drop on self → error, no update
7. `targetStatus = null` → existing re-parent behavior unchanged
