# Cross-Pane Drag Status Change Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to change a bean's status by dragging it from one sidebar pane to another (e.g., drag from Active to Completed).

**Architecture:** Add `targetStatus` and `nativeStatuses` constructor params to `BeansDragAndDropController`. Each tree view gets its own controller instance. Cross-pane drops trigger a status update; intra-pane drops keep the existing re-parent behavior. When a bean is dropped on another bean cross-pane, a modal prompt lets the user choose status-only or status+re-parent.

**Tech Stack:** TypeScript, VS Code Extension API (`vscode.TreeDragAndDropController`), Vitest

---

## Setup

### Task 1: Create branch and set bean to in-progress

**Step 1: Create the feature branch**

```bash
git checkout -b feature/beans-vscode-0b3q-drag-status-change
```

**Step 2: Set the bean to in-progress via MCP or extension command**

Use `beans.setStatus` command or MCP tool to set `beans-vscode-0b3q` status to `in-progress`.

**Step 3: Commit the bean update**

```bash
git add .beans/beans-vscode-0b3q--change-issue-status-by-dragging-between-panes.md
git commit -m "chore(beans-vscode-0b3q): set to in-progress"
```

---

## Implementation

### Task 2: Add constructor params (TDD)

**Files:**

- Modify: `src/beans/tree/BeansDragAndDropController.ts`
- Test: `src/test/beans/tree/BeansDragAndDropController.test.ts`

**Step 1: Write the failing tests**

Add these two tests inside the `describe('BeansDragAndDropController', ...)` block, after the existing `beforeEach`:

```typescript
it('intra-pane drop when targetStatus is null uses reparent behavior', async () => {
  // When targetStatus is null (default), any drop is treated as a reparent —
  // even if the bean's status is not in nativeStatuses.
  showInformationMessage.mockResolvedValueOnce('Move').mockResolvedValueOnce(undefined);

  const dragged = createBean('bean-1', 'ABC', 'Dragged', undefined, 'task');
  dragged.status = 'completed'; // status doesn't matter when targetStatus is null
  const target = createBean('bean-2', 'DEF', 'Target', undefined, 'feature');
  const vscode = await import('vscode');
  const dataTransfer = new vscode.DataTransfer();
  dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

  await controller.handleDrop({ bean: target } as any, dataTransfer as any, { isCancellationRequested: false } as any);

  expect(service.updateBean).toHaveBeenCalledWith('bean-1', { parent: 'bean-2' });
});

it('intra-pane drop when bean status is native to pane uses reparent behavior', async () => {
  showInformationMessage.mockResolvedValueOnce('Move').mockResolvedValueOnce(undefined);

  const dragged = createBean('bean-1', 'ABC', 'Dragged', undefined, 'task');
  dragged.status = 'todo';
  const target = createBean('bean-2', 'DEF', 'Target', undefined, 'feature');
  const vscode = await import('vscode');
  const dataTransfer = new vscode.DataTransfer();
  dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

  // Active pane controller: 'todo' is native, so this is intra-pane
  const activeController = new BeansDragAndDropController(service as any, 'todo', ['todo', 'in-progress']);
  await activeController.handleDrop(
    { bean: target } as any,
    dataTransfer as any,
    { isCancellationRequested: false } as any
  );

  expect(service.updateBean).toHaveBeenCalledWith('bean-1', { parent: 'bean-2' });
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm run test -- --reporter=verbose src/test/beans/tree/BeansDragAndDropController.test.ts
```

Expected: Both new tests FAIL — `BeansDragAndDropController` constructor doesn't accept `targetStatus`/`nativeStatuses` yet.

**Step 3: Add constructor params and BeanStatus import**

In `src/beans/tree/BeansDragAndDropController.ts`, change the import line:

```typescript
import { Bean, VALID_PARENT_TYPES, getUserMessage } from '../model';
```

to:

```typescript
import { Bean, BeanStatus, VALID_PARENT_TYPES, getUserMessage } from '../model';
```

Change the class constructor:

```typescript
constructor(
  private readonly service: BeansService,
  private readonly targetStatus: BeanStatus | null = null,
  private readonly nativeStatuses: BeanStatus[] = []
) {}
```

**Step 4: Run tests to confirm they pass**

```bash
pnpm run test -- --reporter=verbose src/test/beans/tree/BeansDragAndDropController.test.ts
```

Expected: All tests PASS (the two new tests pass because `targetStatus` is null on the default controller, keeping existing behavior; or because the bean's status is native).

**Step 5: Commit**

```bash
git add src/beans/tree/BeansDragAndDropController.ts src/test/beans/tree/BeansDragAndDropController.test.ts
git commit -m "feat(beans-vscode-0b3q): add targetStatus/nativeStatuses params to drag controller"
```

---

### Task 3: Cross-pane drop on pane background (TDD)

**Files:**

- Modify: `src/beans/tree/BeansDragAndDropController.ts`
- Test: `src/test/beans/tree/BeansDragAndDropController.test.ts`

**Step 1: Add `commands` to the vscode mock**

The vscode mock in the test file is missing `commands`. Update the `vi.mock('vscode', () => { ... })` factory to add it:

```typescript
vi.mock('vscode', () => {
  class DataTransferItem {
    constructor(public readonly value: unknown) {}
  }

  class DataTransfer {
    private readonly map = new Map<string, DataTransferItem>();
    set(mimeType: string, value: DataTransferItem): void {
      this.map.set(mimeType, value);
    }
    get(mimeType: string): DataTransferItem | undefined {
      return this.map.get(mimeType);
    }
  }

  return {
    DataTransfer,
    DataTransferItem,
    window: {
      showWarningMessage,
      showInformationMessage,
      showErrorMessage,
    },
    commands: {
      executeCommand: vi.fn().mockResolvedValue(undefined),
    },
  };
});
```

**Step 2: Write the failing tests**

Add a `describe('cross-pane drop', ...)` block inside the top-level describe:

```typescript
describe('cross-pane drop', () => {
  let completedController: BeansDragAndDropController;

  beforeEach(() => {
    completedController = new BeansDragAndDropController(service as any, 'completed', ['completed']);
  });

  it('updates status when dropped on pane background and user confirms', async () => {
    showInformationMessage.mockResolvedValueOnce('Set Status').mockResolvedValueOnce(undefined);

    const dragged = createBean('bean-1', 'ABC', 'Fix login bug');
    dragged.status = 'todo'; // not native to completed pane

    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

    await completedController.handleDrop(undefined, dataTransfer as any, { isCancellationRequested: false } as any);

    expect(showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Fix login bug'),
      { modal: true },
      'Set Status'
    );
    expect(service.updateBean).toHaveBeenCalledWith('bean-1', { status: 'completed' });
  });

  it('does nothing when background drop is cancelled', async () => {
    showInformationMessage.mockResolvedValueOnce(undefined);

    const dragged = createBean('bean-1', 'ABC', 'Fix login bug');
    dragged.status = 'todo';

    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

    await completedController.handleDrop(undefined, dataTransfer as any, { isCancellationRequested: false } as any);

    expect(service.updateBean).not.toHaveBeenCalled();
  });
});
```

**Step 3: Run tests to confirm they fail**

```bash
pnpm run test -- --reporter=verbose src/test/beans/tree/BeansDragAndDropController.test.ts
```

Expected: The two new cross-pane tests FAIL — `handleDrop` doesn't detect cross-pane drops yet.

**Step 4: Extract existing handleDrop body into handleReparentDrop**

In `src/beans/tree/BeansDragAndDropController.ts`, rename the body of `handleDrop` to a private method and add the cross-pane branch:

```typescript
public async handleDrop(
  target: BeanTreeItem | undefined,
  dataTransfer: vscode.DataTransfer,
  token: vscode.CancellationToken
): Promise<void> {
  if (token.isCancellationRequested) return;

  const transferItem = dataTransfer.get('application/vnd.code.tree.beans');
  if (!transferItem) return;

  const draggedBean = transferItem.value as Bean;
  const targetBean = target?.bean;

  const isCrossPaneDrop = this.targetStatus !== null && !this.nativeStatuses.includes(draggedBean.status as BeanStatus);

  if (isCrossPaneDrop) {
    await this.handleCrossPaneDrop(draggedBean, targetBean);
  } else {
    await this.handleReparentDrop(draggedBean, targetBean);
  }
}

/**
 * Handle intra-pane drop — re-parent the bean (existing behavior, renamed from handleDrop body)
 */
private async handleReparentDrop(draggedBean: Bean, targetBean: Bean | undefined): Promise<void> {
  const validation = await this.validateDrop(draggedBean, targetBean);
  if (!validation.valid) {
    vscode.window.showErrorMessage(validation.reason || 'Invalid drop operation');
    return;
  }

  const confirmed = await this.confirmReparent(draggedBean, targetBean);
  if (!confirmed) return;

  try {
    await this.reparentBean(draggedBean, targetBean);
    const draggedName = draggedBean.title || draggedBean.code || draggedBean.id;
    const targetName = targetBean ? targetBean.title : 'root';
    vscode.window.showInformationMessage(`${draggedName} moved to ${targetName}`);
    await vscode.commands.executeCommand('beans.refreshAll');
  } catch (error) {
    const message = getUserMessage(error);
    logger.error(message, error as Error);
    vscode.window.showErrorMessage(message);
  }
}

/**
 * Handle cross-pane drop — change status (and optionally re-parent)
 */
private async handleCrossPaneDrop(draggedBean: Bean, targetBean: Bean | undefined): Promise<void> {
  const draggedName = draggedBean.title || draggedBean.code || draggedBean.id;

  if (!targetBean) {
    // Dropped on pane background — status-only update
    const confirmed = await vscode.window.showInformationMessage(
      `Set "${draggedName}" to ${this.targetStatus}?`,
      { modal: true },
      'Set Status'
    );
    if (confirmed !== 'Set Status') return;
    await this.applyStatusChange(draggedBean, undefined);
    return;
  }

  // Dropped on another bean — show prompt (Task 4)
  // Placeholder: fall through to status-only for now
  await this.applyStatusChange(draggedBean, undefined);
}

/**
 * Apply status change, with optional re-parent
 */
private async applyStatusChange(bean: Bean, newParent: Bean | undefined): Promise<void> {
  const updates: { status: string; parent?: string } = { status: this.targetStatus! };
  if (newParent) {
    updates.parent = newParent.id;
  }

  try {
    await this.service.updateBean(bean.id, updates);
    const beanName = bean.title || bean.code || bean.id;
    const msg = newParent
      ? `${beanName} moved to ${newParent.code || newParent.id} and set to ${this.targetStatus}`
      : `${beanName} set to ${this.targetStatus}`;
    vscode.window.showInformationMessage(msg);
    logger.info(msg);
    await vscode.commands.executeCommand('beans.refreshAll');
  } catch (error) {
    const message = getUserMessage(error);
    logger.error(message, error as Error);
    vscode.window.showErrorMessage(message);
  }
}
```

**Step 5: Run tests to confirm they pass**

```bash
pnpm run test -- --reporter=verbose src/test/beans/tree/BeansDragAndDropController.test.ts
```

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add src/beans/tree/BeansDragAndDropController.ts src/test/beans/tree/BeansDragAndDropController.test.ts
git commit -m "feat(beans-vscode-0b3q): cross-pane drop on background changes status"
```

---

### Task 4: Cross-pane drop on a bean — prompt (TDD)

**Files:**

- Modify: `src/beans/tree/BeansDragAndDropController.ts`
- Test: `src/test/beans/tree/BeansDragAndDropController.test.ts`

**Step 1: Write the failing tests**

Add these inside the `describe('cross-pane drop', ...)` block:

```typescript
it('shows prompt when dropped on a bean and updates status only on "Change Status Only"', async () => {
  showInformationMessage.mockResolvedValueOnce('Change Status Only').mockResolvedValueOnce(undefined);

  const dragged = createBean('bean-1', 'ABC', 'Fix login bug');
  dragged.status = 'todo';
  const target = createBean('bean-2', 'DEF', 'Auth epic', undefined, 'epic');

  const vscode = await import('vscode');
  const dataTransfer = new vscode.DataTransfer();
  dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

  await completedController.handleDrop(
    { bean: target } as any,
    dataTransfer as any,
    { isCancellationRequested: false } as any
  );

  expect(showInformationMessage).toHaveBeenCalledWith(
    expect.stringContaining('Fix login bug'),
    { modal: true },
    'Change Status Only',
    'Change Status & Move to DEF'
  );
  expect(service.updateBean).toHaveBeenCalledWith('bean-1', { status: 'completed' });
});

it('shows prompt and updates status+parent on "Change Status & Move to"', async () => {
  showInformationMessage.mockResolvedValueOnce('Change Status & Move to DEF').mockResolvedValueOnce(undefined);

  const dragged = createBean('bean-1', 'ABC', 'Fix login bug', undefined, 'task');
  dragged.status = 'todo';
  const target = createBean('bean-2', 'DEF', 'Auth epic', undefined, 'epic');

  const vscode = await import('vscode');
  const dataTransfer = new vscode.DataTransfer();
  dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

  await completedController.handleDrop(
    { bean: target } as any,
    dataTransfer as any,
    { isCancellationRequested: false } as any
  );

  expect(service.updateBean).toHaveBeenCalledWith('bean-1', { status: 'completed', parent: 'bean-2' });
});

it('does nothing when prompt is cancelled', async () => {
  showInformationMessage.mockResolvedValueOnce(undefined);

  const dragged = createBean('bean-1', 'ABC', 'Fix login bug');
  dragged.status = 'todo';
  const target = createBean('bean-2', 'DEF', 'Auth epic', undefined, 'epic');

  const vscode = await import('vscode');
  const dataTransfer = new vscode.DataTransfer();
  dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

  await completedController.handleDrop(
    { bean: target } as any,
    dataTransfer as any,
    { isCancellationRequested: false } as any
  );

  expect(service.updateBean).not.toHaveBeenCalled();
});

it('rejects cross-pane drop on self', async () => {
  const dragged = createBean('bean-1', 'ABC', 'Fix login bug');
  dragged.status = 'todo';

  const vscode = await import('vscode');
  const dataTransfer = new vscode.DataTransfer();
  dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

  await completedController.handleDrop(
    { bean: dragged } as any,
    dataTransfer as any,
    { isCancellationRequested: false } as any
  );

  expect(showErrorMessage).toHaveBeenCalledWith('Cannot make a bean its own parent');
  expect(service.updateBean).not.toHaveBeenCalled();
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm run test -- --reporter=verbose src/test/beans/tree/BeansDragAndDropController.test.ts
```

Expected: The four new tests FAIL — `handleCrossPaneDrop` with a target bean uses a placeholder that skips the prompt.

**Step 3: Implement the full prompt logic in handleCrossPaneDrop**

Replace the "Dropped on another bean" section (the placeholder comment block) in `handleCrossPaneDrop`:

```typescript
// Dropped on another bean — show prompt
if (draggedBean.id === targetBean.id) {
  vscode.window.showErrorMessage('Cannot make a bean its own parent');
  return;
}

const targetCode = targetBean.code || targetBean.id;
const moveLabel = `Change Status & Move to ${targetCode}`;
const choice = await vscode.window.showInformationMessage(
  `Set "${draggedName}" to ${this.targetStatus}?`,
  { modal: true },
  'Change Status Only',
  moveLabel
);

if (!choice) return;

if (choice === moveLabel) {
  // Validate re-parent before applying
  const validation = await this.validateDrop(draggedBean, targetBean);
  if (!validation.valid) {
    vscode.window.showErrorMessage(validation.reason || 'Invalid drop operation');
    return;
  }
  await this.applyStatusChange(draggedBean, targetBean);
} else {
  await this.applyStatusChange(draggedBean, undefined);
}
```

**Step 4: Run tests to confirm they pass**

```bash
pnpm run test -- --reporter=verbose src/test/beans/tree/BeansDragAndDropController.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/beans/tree/BeansDragAndDropController.ts src/test/beans/tree/BeansDragAndDropController.test.ts
git commit -m "feat(beans-vscode-0b3q): cross-pane drop on bean shows status/move prompt"
```

---

### Task 5: Validation for "Change Status & Move" option (TDD)

**Files:**

- Test: `src/test/beans/tree/BeansDragAndDropController.test.ts`

The `validateDrop` method is already called in `handleCrossPaneDrop` when the user picks "Change Status & Move". This task adds tests for the validation path.

**Step 1: Write the failing test**

Add inside `describe('cross-pane drop', ...)`:

```typescript
it('shows error and does not update when "Change Status & Move" fails type hierarchy validation', async () => {
  // task cannot have a task as parent; type hierarchy validation blocks the re-parent
  const moveLabel = 'Change Status & Move to DEF';
  showInformationMessage.mockResolvedValueOnce(moveLabel);

  const dragged = createBean('bean-1', 'ABC', 'Task A', undefined, 'feature');
  dragged.status = 'todo';
  const target = createBean('bean-2', 'DEF', 'Another Feature', undefined, 'feature'); // feature can't parent feature

  const vscode = await import('vscode');
  const dataTransfer = new vscode.DataTransfer();
  dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

  await completedController.handleDrop(
    { bean: target } as any,
    dataTransfer as any,
    { isCancellationRequested: false } as any
  );

  expect(showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('feature'));
  expect(service.updateBean).not.toHaveBeenCalled();
});
```

**Step 2: Run test to confirm it fails**

```bash
pnpm run test -- --reporter=verbose src/test/beans/tree/BeansDragAndDropController.test.ts
```

Expected: FAIL — the label check in `handleCrossPaneDrop` doesn't match `'Change Status & Move to DEF'` because the code is `'DEF'` but `moveLabel` is built from `targetBean.code` which equals `'DEF'`. Wait — actually this should pass already since `validateDrop` is already wired. Run the test and see.

If it passes already (validation logic was already in place), skip to Step 4.

**Step 3: If it fails, verify the issue and fix**

Check whether `validateDrop` is being called when choice matches `moveLabel`. The string comparison `choice === moveLabel` is the key — `moveLabel` is built as `` `Change Status & Move to ${targetCode}` `` and the mock returns `'Change Status & Move to DEF'`. Confirm `targetBean.code === 'DEF'` in the test (`createBean('bean-2', 'DEF', ...)` sets code to `'DEF'`).

**Step 4: Run full test suite**

```bash
pnpm run test
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/test/beans/tree/BeansDragAndDropController.test.ts
git commit -m "test(beans-vscode-0b3q): add validation test for cross-pane status+move"
```

---

### Task 6: Wire per-pane controllers in registerBeansTreeViews

**Files:**

- Modify: `src/beans/tree/registerBeansTreeViews.ts`

No new tests needed for this task — it is wiring only, and the behavior is covered by the controller unit tests.

**Step 1: Replace the single shared controller with per-pane instances**

In `registerBeansTreeViews.ts`, find:

```typescript
const dragAndDropController = new BeansDragAndDropController(service);
```

Replace with:

```typescript
const activeDragController = new BeansDragAndDropController(service, 'todo', ['todo', 'in-progress']);
const completedDragController = new BeansDragAndDropController(service, 'completed', ['completed']);
const scrappedDragController = new BeansDragAndDropController(service, 'scrapped', ['scrapped']);
const draftDragController = new BeansDragAndDropController(service, 'draft', ['draft']);
```

**Step 2: Update each createTreeView call**

Change `dragAndDropController` references to the appropriate per-pane variable:

```typescript
const activeTreeView = vscode.window.createTreeView<BeanTreeItem>('beans.active', {
  treeDataProvider: activeProvider,
  showCollapseAll: true,
  dragAndDropController: activeDragController,
});

const completedTreeView = vscode.window.createTreeView<BeanTreeItem>('beans.completed', {
  treeDataProvider: completedProvider,
  showCollapseAll: true,
  dragAndDropController: completedDragController,
});

const scrappedTreeView = vscode.window.createTreeView<BeanTreeItem>('beans.scrapped', {
  treeDataProvider: scrappedProvider,
  showCollapseAll: true,
  dragAndDropController: scrappedDragController,
});

const draftTreeView = vscode.window.createTreeView<BeanTreeItem>('beans.draft', {
  treeDataProvider: draftProvider,
  showCollapseAll: true,
  dragAndDropController: draftDragController,
});
```

The search pane does not use a drag controller — leave it unchanged.

**Step 3: Compile**

```bash
pnpm run compile
```

Expected: No type errors.

**Step 4: Run full test suite**

```bash
pnpm run test
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/beans/tree/registerBeansTreeViews.ts
git commit -m "feat(beans-vscode-0b3q): wire per-pane drag controllers for cross-pane status change"
```

---

### Task 7: Update bean and close

**Step 1: Update the bean body with a summary**

Add to `.beans/beans-vscode-0b3q--change-issue-status-by-dragging-between-panes.md`:

```markdown
## Summary of Changes

- Added `targetStatus` and `nativeStatuses` constructor params to `BeansDragAndDropController`
- Cross-pane drops detected when `targetStatus !== null && bean.status not in nativeStatuses`
- Background drop: modal confirm → `updateBean({ status })`
- Drop on bean: modal prompt with "Change Status Only" and "Change Status & Move to [code]" options; re-parent path runs full type/cycle validation
- Each tree view pane now has its own controller instance with the correct target status
- All new behavior covered by unit tests; existing tests unchanged
```

Set status to `completed`.

**Step 2: Commit**

```bash
git add .beans/beans-vscode-0b3q--change-issue-status-by-dragging-between-panes.md
git commit -m "chore(beans-vscode-0b3q): mark completed with summary of changes"
```

---

## Quick Reference

| Command                                      | Purpose                          |
| -------------------------------------------- | -------------------------------- |
| `pnpm run test`                              | Run all tests                    |
| `pnpm run test -- --reporter=verbose <file>` | Run single test file with output |
| `pnpm run compile`                           | Type-check + bundle              |

**Key files:**

- Controller: `src/beans/tree/BeansDragAndDropController.ts`
- Tree view registration: `src/beans/tree/registerBeansTreeViews.ts`
- Tests: `src/test/beans/tree/BeansDragAndDropController.test.ts`
- `BeanStatus` type: `src/beans/model/Bean.ts:57`
