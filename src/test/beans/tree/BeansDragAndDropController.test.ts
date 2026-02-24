import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bean } from '../../../beans/model';
import { BeansDragAndDropController } from '../../../beans/tree/BeansDragAndDropController';

// TODO(beans-vscode-5p7n): Add tree-integration drag/drop tests that exercise
// real parent-chain lookups and concurrency conflicts against service mocks
// that model stale etag/update failure scenarios.
const showWarningMessage = vi.hoisted(() => vi.fn());
const showInformationMessage = vi.hoisted(() => vi.fn());
const showErrorMessage = vi.hoisted(() => vi.fn());

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

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
  };
});

vi.mock('../../../beans/logging/BeansOutput', () => ({
  BeansOutput: {
    getInstance: vi.fn(() => mockLogger),
  },
}));

function createBean(id: string, code: string, title: string, parent?: string, type: string = 'task'): Bean {
  return {
    id,
    code,
    slug: id,
    path: `.beans/${id}.md`,
    title,
    body: '',
    status: 'todo',
    type,
    priority: 'normal',
    parent,
    tags: [],
    blocking: [],
    blockedBy: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    etag: `${id}-etag`,
  } as Bean;
}

describe('BeansDragAndDropController', () => {
  let service: { updateBean: ReturnType<typeof vi.fn>; showBean: ReturnType<typeof vi.fn> };
  let controller: BeansDragAndDropController;

  beforeEach(() => {
    vi.resetAllMocks();

    service = {
      updateBean: vi.fn(),
      showBean: vi.fn(),
    };

    controller = new BeansDragAndDropController(service as any);
  });

  describe('cross-pane drop', () => {
    let completedController: BeansDragAndDropController;

    beforeEach(() => {
      completedController = new BeansDragAndDropController(service as any, 'completed', ['completed']);
    });

    it('updates status when dropped on pane background and user confirms', async () => {
      showInformationMessage.mockResolvedValueOnce('Set Status').mockResolvedValueOnce(undefined);

      const dragged = createBean('bean-1', 'ABC', 'Dragged');
      dragged.status = 'todo';
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      await completedController.handleDrop(undefined, dataTransfer as any, { isCancellationRequested: false } as any);

      expect(service.updateBean).toHaveBeenCalledWith('bean-1', { status: 'completed' });
    });

    it('does nothing when background drop is cancelled', async () => {
      showInformationMessage.mockResolvedValueOnce(undefined);

      const dragged = createBean('bean-1', 'ABC', 'Dragged');
      dragged.status = 'todo';
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      await completedController.handleDrop(undefined, dataTransfer as any, { isCancellationRequested: false } as any);

      expect(service.updateBean).not.toHaveBeenCalled();
    });

    it('shows prompt when dropped on a bean and updates status only on "Change Status Only"', async () => {
      showInformationMessage.mockResolvedValueOnce('Change Status Only').mockResolvedValueOnce(undefined);

      const dragged = createBean('bean-1', 'ABC', 'Dragged');
      dragged.status = 'todo';
      const target = createBean('bean-2', 'DEF', 'Target');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      const completedController = new BeansDragAndDropController(service as any, 'completed', ['completed']);
      await completedController.handleDrop(
        { bean: target } as any,
        dataTransfer as any,
        { isCancellationRequested: false } as any
      );

      expect(service.updateBean).toHaveBeenCalledWith('bean-1', { status: 'completed' });
    });

    it('shows prompt and updates status+parent on "Change Status & Move to"', async () => {
      showInformationMessage.mockResolvedValueOnce('Change Status & Move to DEF').mockResolvedValueOnce(undefined);

      const dragged = createBean('bean-1', 'ABC', 'Dragged');
      dragged.status = 'todo';
      const target = createBean('bean-2', 'DEF', 'Target', undefined, 'feature');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      const completedController = new BeansDragAndDropController(service as any, 'completed', ['completed']);
      await completedController.handleDrop(
        { bean: target } as any,
        dataTransfer as any,
        { isCancellationRequested: false } as any
      );

      expect(service.updateBean).toHaveBeenCalledWith('bean-1', { status: 'completed', parent: 'bean-2' });
    });

    it('does nothing when prompt is cancelled', async () => {
      showInformationMessage.mockResolvedValueOnce(undefined);

      const dragged = createBean('bean-1', 'ABC', 'Dragged');
      dragged.status = 'todo';
      const target = createBean('bean-2', 'DEF', 'Target');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      const completedController = new BeansDragAndDropController(service as any, 'completed', ['completed']);
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

      const completedController = new BeansDragAndDropController(service as any, 'completed', ['completed']);
      await completedController.handleDrop(
        { bean: dragged } as any,
        dataTransfer as any,
        { isCancellationRequested: false } as any
      );

      expect(showErrorMessage).toHaveBeenCalledWith('Cannot make a bean its own parent');
      expect(service.updateBean).not.toHaveBeenCalled();
    });

    it('shows error and does not update when "Change Status & Move" fails type hierarchy validation', async () => {
      showInformationMessage.mockResolvedValueOnce('Change Status & Move to DEF').mockResolvedValueOnce(undefined);

      const dragged = createBean('bean-1', 'ABC', 'Dragged');
      dragged.status = 'todo';
      // dragged is a task
      dragged.type = 'task' as any;
      // target is also a task, which is an invalid parent for a task
      const target = createBean('bean-2', 'DEF', 'Target', undefined, 'task');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      const completedController = new BeansDragAndDropController(service as any, 'completed', ['completed']);
      await completedController.handleDrop(
        { bean: target } as any,
        dataTransfer as any,
        { isCancellationRequested: false } as any
      );

      expect(showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('A task cannot have a task as parent'));
      expect(service.updateBean).not.toHaveBeenCalled();
    });
  });

  it('intra-pane drop when targetStatus is null uses reparent behavior', async () => {
    showInformationMessage.mockResolvedValueOnce('Move').mockResolvedValueOnce(undefined);

    const dragged = createBean('bean-1', 'ABC', 'Dragged', undefined, 'task');
    // status doesn't matter when targetStatus is null
    dragged.status = 'completed' as any;
    const target = createBean('bean-2', 'DEF', 'Target', undefined, 'feature');
    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

    await controller.handleDrop(
      { bean: target } as any,
      dataTransfer as any,
      { isCancellationRequested: false } as any
    );

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

  it('stores dragged bean in data transfer for single-item drags', async () => {
    const dragged = createBean('bean-1', 'ABC', 'Drag me');
    const dataTransfer = new (await import('vscode')).DataTransfer();

    await controller.handleDrag(
      [{ bean: dragged } as any],
      dataTransfer as any,
      { isCancellationRequested: false } as any
    );

    const transferItem = dataTransfer.get('application/vnd.code.tree.beans');
    expect(transferItem?.value).toEqual(dragged);
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Drag started for bean ABC'));
  });

  it('ignores cancelled or multi-item drag operations', async () => {
    const dragged = createBean('bean-1', 'ABC', 'Drag me');
    const dataTransfer = new (await import('vscode')).DataTransfer();

    await controller.handleDrag(
      [{ bean: dragged } as any],
      dataTransfer as any,
      { isCancellationRequested: true } as any
    );
    await controller.handleDrag(
      [{ bean: dragged } as any, { bean: dragged } as any],
      dataTransfer as any,
      { isCancellationRequested: false } as any
    );

    expect(dataTransfer.get('application/vnd.code.tree.beans')).toBeUndefined();
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });

  it('rejects dropping a bean onto itself', async () => {
    const bean = createBean('bean-1', 'ABC', 'Self');
    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(bean));

    await controller.handleDrop({ bean } as any, dataTransfer as any, { isCancellationRequested: false } as any);

    expect(showErrorMessage).toHaveBeenCalledWith('Cannot make a bean its own parent');
    expect(service.updateBean).not.toHaveBeenCalled();
  });

  it('uses default warning text when validation fails without a reason', async () => {
    const dragged = createBean('bean-1', 'ABC', 'Dragged');
    const target = createBean('bean-2', 'DEF', 'Target');
    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

    (controller as any).validateDrop = vi.fn().mockResolvedValue({ valid: false });

    await controller.handleDrop(
      { bean: target } as any,
      dataTransfer as any,
      { isCancellationRequested: false } as any
    );

    expect(showErrorMessage).toHaveBeenCalledWith('Invalid drop operation');
    expect(service.updateBean).not.toHaveBeenCalled();
  });

  it('rejects drops that would create a cycle', async () => {
    // dragged is a task, target is a feature (valid parent type for task) that already
    // has bean-1 as its parent — creating a cycle if we set bean-2 as parent of bean-1.
    const dragged = createBean('bean-1', 'ABC', 'Dragged', undefined, 'task');
    const target = createBean('bean-2', 'DEF', 'Target', 'bean-1', 'feature');
    service.showBean.mockResolvedValueOnce(dragged); // parent lookup returns the dragged bean
    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

    await controller.handleDrop(
      { bean: target } as any,
      dataTransfer as any,
      { isCancellationRequested: false } as any
    );

    expect(showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Cannot create cycle'));
    expect(service.updateBean).not.toHaveBeenCalled();
  });

  it('does not re-parent when user cancels confirmation', async () => {
    showInformationMessage.mockResolvedValueOnce(undefined);

    const dragged = createBean('bean-1', 'ABC', 'Dragged', undefined, 'task');
    const target = createBean('bean-2', 'DEF', 'Target', undefined, 'feature');
    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

    await controller.handleDrop(
      { bean: target } as any,
      dataTransfer as any,
      { isCancellationRequested: false } as any
    );

    expect(service.updateBean).not.toHaveBeenCalled();
  });

  it('re-parents successfully and notifies user', async () => {
    showInformationMessage.mockResolvedValueOnce('Move').mockResolvedValueOnce(undefined);

    const dragged = createBean('bean-1', 'ABC', 'Dragged', undefined, 'task');
    const target = createBean('bean-2', 'DEF', 'Target', undefined, 'feature');
    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

    await controller.handleDrop(
      { bean: target } as any,
      dataTransfer as any,
      { isCancellationRequested: false } as any
    );

    expect(service.updateBean).toHaveBeenCalledWith('bean-1', { parent: 'bean-2' });
    expect(showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('moved to Target'));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('moved to Target'));
  });

  it('supports dropping to root (no parent)', async () => {
    showInformationMessage.mockResolvedValueOnce('Move').mockResolvedValueOnce(undefined);

    const dragged = createBean('bean-1', 'ABC', 'Dragged');
    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

    await controller.handleDrop(undefined, dataTransfer as any, { isCancellationRequested: false } as any);

    expect(service.updateBean).toHaveBeenCalledWith('bean-1', { clearParent: true });
  });

  it('continues when ancestor lookup fails during cycle check', async () => {
    showInformationMessage.mockResolvedValueOnce('Move').mockResolvedValueOnce(undefined);
    service.showBean.mockRejectedValueOnce(new Error('parent lookup failed'));

    const dragged = createBean('bean-1', 'ABC', 'Dragged', undefined, 'task');
    const target = createBean('bean-2', 'DEF', 'Target', 'bean-parent', 'feature');
    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

    await controller.handleDrop(
      { bean: target } as any,
      dataTransfer as any,
      { isCancellationRequested: false } as any
    );

    expect(service.showBean).toHaveBeenCalledWith('bean-parent');
    expect(mockLogger.warn).toHaveBeenCalledWith('Failed to fetch parent bean bean-parent', expect.any(Error));
    expect(service.updateBean).toHaveBeenCalledWith('bean-1', { parent: 'bean-2' });
  });

  it('shows error when re-parent operation fails', async () => {
    showInformationMessage.mockResolvedValueOnce('Move');
    service.updateBean.mockRejectedValueOnce(new Error('update failed'));

    const dragged = createBean('bean-1', 'ABC', 'Dragged', undefined, 'task');
    const target = createBean('bean-2', 'DEF', 'Target', undefined, 'feature');
    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

    await controller.handleDrop(
      { bean: target } as any,
      dataTransfer as any,
      { isCancellationRequested: false } as any
    );

    expect(showErrorMessage).toHaveBeenCalledWith('Update failed');
    expect(mockLogger.error).toHaveBeenCalledWith('Update failed', expect.any(Error));
  });

  it('falls back to code/id names in re-parent logging and notifications', async () => {
    showInformationMessage.mockResolvedValueOnce('Move').mockResolvedValueOnce(undefined);

    const dragged = {
      ...createBean('bean-1', '', '', undefined, 'task'),
      title: '',
      code: '',
    };
    const target = {
      ...createBean('bean-2', '', '', undefined, 'feature'),
      title: '',
      code: '',
    };
    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();
    dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

    await controller.handleDrop(
      { bean: target } as any,
      dataTransfer as any,
      { isCancellationRequested: false } as any
    );

    expect(mockLogger.info).toHaveBeenCalledWith('Bean bean-1 moved to bean-2');
    expect(showInformationMessage).toHaveBeenCalledWith('bean-1 moved to ');
  });

  it('ignores drops when cancelled or without transferable bean', async () => {
    const vscode = await import('vscode');
    const dataTransfer = new vscode.DataTransfer();

    await controller.handleDrop(undefined, dataTransfer as any, { isCancellationRequested: true } as any);
    await controller.handleDrop(undefined, dataTransfer as any, { isCancellationRequested: false } as any);

    expect(service.updateBean).not.toHaveBeenCalled();
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  describe('parent type hierarchy validation', () => {
    it('rejects dropping a feature onto another feature', async () => {
      const dragged = createBean('bean-1', 'ABC', 'Feature A', undefined, 'feature');
      const target = createBean('bean-2', 'DEF', 'Feature B', undefined, 'feature');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      await controller.handleDrop(
        { bean: target } as any,
        dataTransfer as any,
        {
          isCancellationRequested: false,
        } as any
      );

      expect(showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('feature'));
      expect(service.updateBean).not.toHaveBeenCalled();
    });

    it('rejects dropping a feature onto a task', async () => {
      const dragged = createBean('bean-1', 'ABC', 'Feature A', undefined, 'feature');
      const target = createBean('bean-2', 'DEF', 'Task B', undefined, 'task');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      await controller.handleDrop(
        { bean: target } as any,
        dataTransfer as any,
        {
          isCancellationRequested: false,
        } as any
      );

      expect(showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('task'));
      expect(service.updateBean).not.toHaveBeenCalled();
    });

    it('rejects dropping a feature onto a bug', async () => {
      const dragged = createBean('bean-1', 'ABC', 'Feature A', undefined, 'feature');
      const target = createBean('bean-2', 'DEF', 'Bug B', undefined, 'bug');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      await controller.handleDrop(
        { bean: target } as any,
        dataTransfer as any,
        {
          isCancellationRequested: false,
        } as any
      );

      expect(showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('bug'));
      expect(service.updateBean).not.toHaveBeenCalled();
    });

    it('rejects dropping an epic onto a feature', async () => {
      const dragged = createBean('bean-1', 'ABC', 'Epic A', undefined, 'epic');
      const target = createBean('bean-2', 'DEF', 'Feature B', undefined, 'feature');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      await controller.handleDrop(
        { bean: target } as any,
        dataTransfer as any,
        {
          isCancellationRequested: false,
        } as any
      );

      expect(showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('feature'));
      expect(service.updateBean).not.toHaveBeenCalled();
    });

    it('allows dropping a feature onto an epic', async () => {
      showInformationMessage.mockResolvedValueOnce('Move').mockResolvedValueOnce(undefined);

      const dragged = createBean('bean-1', 'ABC', 'Feature A', undefined, 'feature');
      const target = createBean('bean-2', 'DEF', 'Epic B', undefined, 'epic');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      await controller.handleDrop(
        { bean: target } as any,
        dataTransfer as any,
        {
          isCancellationRequested: false,
        } as any
      );

      expect(service.updateBean).toHaveBeenCalledWith('bean-1', { parent: 'bean-2' });
    });

    it('allows dropping a feature onto a milestone', async () => {
      showInformationMessage.mockResolvedValueOnce('Move').mockResolvedValueOnce(undefined);

      const dragged = createBean('bean-1', 'ABC', 'Feature A', undefined, 'feature');
      const target = createBean('bean-2', 'DEF', 'Milestone B', undefined, 'milestone');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      await controller.handleDrop(
        { bean: target } as any,
        dataTransfer as any,
        {
          isCancellationRequested: false,
        } as any
      );

      expect(service.updateBean).toHaveBeenCalledWith('bean-1', { parent: 'bean-2' });
    });

    it('allows dropping a task onto a feature', async () => {
      showInformationMessage.mockResolvedValueOnce('Move').mockResolvedValueOnce(undefined);

      const dragged = createBean('bean-1', 'ABC', 'Task A', undefined, 'task');
      const target = createBean('bean-2', 'DEF', 'Feature B', undefined, 'feature');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      await controller.handleDrop(
        { bean: target } as any,
        dataTransfer as any,
        {
          isCancellationRequested: false,
        } as any
      );

      expect(service.updateBean).toHaveBeenCalledWith('bean-1', { parent: 'bean-2' });
    });

    it('allows dropping a bug onto a feature', async () => {
      showInformationMessage.mockResolvedValueOnce('Move').mockResolvedValueOnce(undefined);

      const dragged = createBean('bean-1', 'ABC', 'Bug A', undefined, 'bug');
      const target = createBean('bean-2', 'DEF', 'Feature B', undefined, 'feature');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      await controller.handleDrop(
        { bean: target } as any,
        dataTransfer as any,
        {
          isCancellationRequested: false,
        } as any
      );

      expect(service.updateBean).toHaveBeenCalledWith('bean-1', { parent: 'bean-2' });
    });

    it('allows dropping any type onto root (no target)', async () => {
      showInformationMessage.mockResolvedValueOnce('Move').mockResolvedValueOnce(undefined);

      const dragged = createBean('bean-1', 'ABC', 'Feature A', undefined, 'feature');
      const vscode = await import('vscode');
      const dataTransfer = new vscode.DataTransfer();
      dataTransfer.set('application/vnd.code.tree.beans', new vscode.DataTransferItem(dragged));

      await controller.handleDrop(
        undefined,
        dataTransfer as any,
        {
          isCancellationRequested: false,
        } as any
      );

      expect(service.updateBean).toHaveBeenCalledWith('bean-1', { clearParent: true });
    });
  });
});
