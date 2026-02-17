import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BeansFilterManager } from '../../../beans/tree/BeansFilterManager';

const { showQuickPick, showInputBox } = vi.hoisted(() => ({
  showQuickPick: vi.fn(),
  showInputBox: vi.fn(),
}));

vi.mock('vscode', () => ({
  EventEmitter: class MockEventEmitter<T> {
    private listeners: Array<(event: T) => void> = [];

    event = (listener: (event: T) => void) => {
      this.listeners.push(listener);
      return { dispose: vi.fn() };
    };

    fire(data: T): void {
      for (const listener of this.listeners) {
        listener(data);
      }
    }

    dispose(): void {
      this.listeners = [];
    }
  },
  window: {
    showQuickPick,
    showInputBox,
  },
}));

describe('BeansFilterManager', () => {
  let manager: BeansFilterManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new BeansFilterManager();
  });

  it('stores and retrieves filter state', () => {
    manager.setFilter('beans.active', { text: 'auth', tags: ['backend'] });

    expect(manager.getFilter('beans.active')).toEqual({ text: 'auth', tags: ['backend'] });
  });

  it('fires change event when filter is set and cleared', () => {
    const changed: string[] = [];
    manager.onDidChangeFilter(viewId => changed.push(viewId));

    manager.setFilter('beans.active', { text: 'a' });
    manager.clearFilter('beans.active');

    expect(changed).toEqual(['beans.active', 'beans.active']);
  });

  it('treats empty filters as cleared state', () => {
    manager.setFilter('beans.active', { text: 'hello' });
    manager.setFilter('beans.active', {});

    expect(manager.getFilter('beans.active')).toBeUndefined();
  });

  it('clears all filters and emits per view', () => {
    const changed: string[] = [];
    manager.onDidChangeFilter(viewId => changed.push(viewId));

    manager.setFilter('beans.active', { text: 'a' });
    manager.setFilter('beans.completed', { tags: ['qa'] });
    changed.length = 0;

    manager.clearAllFilters();

    expect(manager.getFilter('beans.active')).toBeUndefined();
    expect(manager.getFilter('beans.completed')).toBeUndefined();
    expect(changed).toEqual(expect.arrayContaining(['beans.active', 'beans.completed']));
  });

  it('builds human-readable filter description', () => {
    manager.setFilter('beans.active', {
      text: 'auth',
      tags: ['backend', 'security'],
      types: ['bug'],
      priorities: ['high'],
    });

    expect(manager.getFilterDescription('beans.active')).toBe(
      'text:"auth" tags:backend,security types:bug priority:high'
    );
  });

  it('returns undefined description when no filter is present', () => {
    expect(manager.getFilterDescription('beans.active')).toBeUndefined();
  });

  it('returns undefined when filter UI is cancelled', async () => {
    showQuickPick.mockResolvedValue(undefined);

    await expect(manager.showFilterUI()).resolves.toBeUndefined();
  });

  it('returns empty object when clear filter option is selected', async () => {
    showQuickPick.mockResolvedValueOnce({ label: 'Clear All Filters', value: 'clear' });

    await expect(manager.showFilterUI()).resolves.toEqual({});
  });

  it('updates text filter from input', async () => {
    showQuickPick.mockResolvedValueOnce({ label: 'Text Search', value: 'text' });
    showInputBox.mockResolvedValueOnce('new text');

    await expect(manager.showFilterUI({ text: 'old' })).resolves.toEqual({ text: 'new text' });
  });

  it('parses comma-separated tags', async () => {
    showQuickPick.mockResolvedValueOnce({ label: 'Filter by Tags', value: 'tags' });
    showInputBox.mockResolvedValueOnce('frontend, backend,  api ');

    await expect(manager.showFilterUI()).resolves.toEqual({ tags: ['frontend', 'backend', 'api'] });
  });

  it('sets selected types from multi-select', async () => {
    showQuickPick
      .mockResolvedValueOnce({ label: 'Filter by Type', value: 'types' })
      .mockResolvedValueOnce(['bug', 'task']);

    await expect(manager.showFilterUI()).resolves.toEqual({ types: ['bug', 'task'] });
  });

  it('handles empty priority selection as undefined', async () => {
    showQuickPick.mockResolvedValueOnce({ label: 'Filter by Priority', value: 'priorities' }).mockResolvedValueOnce([]);

    await expect(manager.showFilterUI()).resolves.toEqual({ priorities: undefined });
  });

  it('disposes internal resources', () => {
    expect(() => manager.dispose()).not.toThrow();
  });
});
