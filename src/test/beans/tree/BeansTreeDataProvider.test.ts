import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { Bean, BeanStatus, BeanType } from '../../../beans/model';
import { BeansService } from '../../../beans/service/BeansService';
import { BeansTreeDataProvider } from '../../../beans/tree/BeansTreeDataProvider';
import { BeanTreeItem } from '../../../beans/tree/BeanTreeItem';

// Mock vscode
vi.mock('vscode');

// Mock BeansService
vi.mock('../../../beans/service/BeansService');

// Mock BeansOutput
vi.mock('../../../beans/logging/BeansOutput', () => ({
  BeansOutput: {
    getInstance: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe('BeansTreeDataProvider', () => {
  let service: BeansService;
  let provider: BeansTreeDataProvider;
  let mockBeans: Bean[];

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock workspace configuration
    (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
    });

    // Create mock service
    service = new BeansService('/mock/workspace');
    mockBeans = [];
    (service.listBeans as ReturnType<typeof vi.fn>) = vi.fn(async () => mockBeans);
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default sort mode from config', () => {
      const config = {
        get: vi.fn((_key: string, _defaultValue: unknown) => 'updated'),
      };
      (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue(config);

      provider = new BeansTreeDataProvider(service);

      expect(config.get).toHaveBeenCalledWith('defaultSortMode', 'status-priority-type-title');
    });

    it('should use provider-specific default sort over config', () => {
      const config = {
        get: vi.fn((_key: string, _defaultValue: unknown) => 'updated'),
      };
      (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue(config);

      provider = new BeansTreeDataProvider(service, undefined, false, 'priority-status-type-title');

      // Provider default takes precedence, so sortMode should be 'priority-status-type-title'
      expect((provider as any).sortMode).toBe('priority-status-type-title');
    });

    it('should accept status filter in constructor', () => {
      provider = new BeansTreeDataProvider(service, ['in-progress' as BeanStatus]);
      expect(provider).toBeDefined();
    });

    it('should accept flat list mode in constructor', () => {
      provider = new BeansTreeDataProvider(service, undefined, true);
      expect(provider).toBeDefined();
    });
  });

  describe('Tree Data Provider Interface', () => {
    beforeEach(() => {
      provider = new BeansTreeDataProvider(service);
    });

    it('should return tree item unchanged', () => {
      const bean: Bean = {
        id: 'bean-1',
        code: 'ABC',
        slug: 'test-bean',
        path: '.beans/bean-1--test-bean.md',
        title: 'Test Bean',
        body: '',
        status: 'todo' as BeanStatus,
        type: 'task' as BeanType,
        priority: 'normal',
        tags: [],
        blocking: [],
        blockedBy: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        etag: 'etag1',
      };
      const treeItem = { bean } as unknown as BeanTreeItem;

      const result = provider.getTreeItem(treeItem);

      expect(result).toBe(treeItem);
    });

    it('should fire event when refresh is called', () => {
      const fireSpy = vi.fn();
      (provider as any)._onDidChangeTreeData.fire = fireSpy;

      provider.refresh();

      expect(fireSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Sort Mode', () => {
    beforeEach(() => {
      provider = new BeansTreeDataProvider(service);
    });

    it('should set sort mode and refresh', () => {
      const fireSpy = vi.fn();
      (provider as any)._onDidChangeTreeData.fire = fireSpy;

      provider.setSortMode('updated');

      expect(fireSpy).toHaveBeenCalledOnce();
      expect((provider as any).sortMode).toBe('updated');
    });

    it('should sort by updated timestamp', async () => {
      mockBeans = [
        createBean('bean-1', 'Old', 'todo', new Date(Date.UTC(2024, 0, 1))),
        createBean('bean-2', 'New', 'todo', new Date(Date.UTC(2024, 11, 1))),
      ];

      provider.setSortMode('updated');
      const children = await provider.getChildren();

      expect(children[0].bean.id).toBe('bean-2'); // Newer first
      expect(children[1].bean.id).toBe('bean-1');
    }, 15000);

    it('should sort by created timestamp', async () => {
      mockBeans = [
        {
          ...createBean('bean-1', 'Later', 'todo', new Date()),
          createdAt: new Date('2024-12-01'),
        },
        {
          ...createBean('bean-2', 'Earlier', 'todo', new Date()),
          createdAt: new Date('2024-01-01'),
        },
      ];

      provider.setSortMode('created');
      const children = await provider.getChildren();

      expect(children[0].bean.id).toBe('bean-1'); // Later created first
      expect(children[1].bean.id).toBe('bean-2');
    });

    it('should sort by id', async () => {
      mockBeans = [createBean('bean-z', 'Z', 'todo'), createBean('bean-a', 'A', 'todo')];

      provider.setSortMode('id');
      const children = await provider.getChildren();

      expect(children[0].bean.id).toBe('bean-a');
      expect(children[1].bean.id).toBe('bean-z');
    });

    it('should sort by status-priority-type-title', async () => {
      mockBeans = [
        createBean('bean-1', 'A', 'todo', undefined, 'task', 'low'),
        createBean('bean-2', 'B', 'in-progress', undefined, 'bug', 'critical'),
        createBean('bean-3', 'C', 'completed', undefined, 'feature', 'normal'),
      ];

      provider.setSortMode('status-priority-type-title');
      const children = await provider.getChildren();

      // in-progress comes before todo comes before completed
      expect(children[0].bean.id).toBe('bean-2');
      expect(children[1].bean.id).toBe('bean-1');
      expect(children[2].bean.id).toBe('bean-3');
    });

    it('should sort by priority-status-type-title', async () => {
      mockBeans = [
        createBean('bean-1', 'A', 'todo', undefined, 'task', 'low'),
        createBean('bean-2', 'B', 'in-progress', undefined, 'bug', 'critical'),
        createBean('bean-3', 'C', 'todo', undefined, 'feature', 'high'),
      ];

      provider.setSortMode('priority-status-type-title');
      const children = await provider.getChildren();

      // critical > high > low
      expect(children[0].bean.id).toBe('bean-2');
      expect(children[1].bean.id).toBe('bean-3');
      expect(children[2].bean.id).toBe('bean-1');
    });

    it('should handle unknown sort mode gracefully', async () => {
      mockBeans = [createBean('bean-1', 'A', 'todo'), createBean('bean-2', 'B', 'todo')];

      (provider as any).sortMode = 'invalid-mode';
      const children = await provider.getChildren();

      // Should return unsorted (in original order)
      expect(children).toHaveLength(2);
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      provider = new BeansTreeDataProvider(service);
    });

    it('should apply status filter', async () => {
      mockBeans = [
        createBean('bean-1', 'Todo', 'todo'),
        createBean('bean-2', 'Done', 'completed'),
        createBean('bean-3', 'InProgress', 'in-progress'),
      ];

      provider.setFilter({ statusFilter: ['in-progress' as BeanStatus] });
      await provider.getChildren();

      expect(service.listBeans).toHaveBeenCalledWith({ status: ['in-progress'] });
    });

    it('should apply type filter', async () => {
      provider.setFilter({ typeFilter: ['bug' as BeanType] });
      await provider.getChildren();

      expect(service.listBeans).toHaveBeenCalledWith({ type: ['bug'] });
    });

    it('should apply search filter', async () => {
      provider.setFilter({ searchFilter: 'authentication' });
      await provider.getChildren();

      expect(service.listBeans).toHaveBeenCalledWith({ search: 'authentication' });
    });

    it('should apply tag filter client-side', async () => {
      mockBeans = [
        { ...createBean('bean-1', 'A', 'todo'), tags: ['frontend', 'ui'] },
        { ...createBean('bean-2', 'B', 'todo'), tags: ['backend', 'api'] },
        { ...createBean('bean-3', 'C', 'todo'), tags: ['frontend', 'api'] },
      ];

      provider.setFilter({ tagFilter: ['frontend'] });
      const children = await provider.getChildren();

      expect(children).toHaveLength(2);
      expect(children[0].bean.id).toBe('bean-1');
      expect(children[1].bean.id).toBe('bean-3');
    });

    it('should combine multiple filters', async () => {
      mockBeans = [
        { ...createBean('bean-1', 'A', 'todo', undefined, 'bug'), tags: ['frontend'] },
        { ...createBean('bean-2', 'B', 'in-progress', undefined, 'bug'), tags: ['backend'] },
      ];

      provider.setFilter({
        statusFilter: ['todo' as BeanStatus],
        typeFilter: ['bug' as BeanType],
        tagFilter: ['frontend'],
      });
      await provider.getChildren();

      expect(service.listBeans).toHaveBeenCalledWith({
        status: ['todo'],
        type: ['bug'],
      });
    });

    it('should clear all filters', async () => {
      const fireSpy = vi.fn();
      (provider as any)._onDidChangeTreeData.fire = fireSpy;

      provider.setFilter({ statusFilter: ['todo' as BeanStatus] });
      provider.clearFilter();

      expect((provider as any).filterOptions).toEqual({});
      expect(fireSpy).toHaveBeenCalledTimes(2); // Once for set, once for clear
    });

    it('should use constructor status filter over filter options', async () => {
      provider = new BeansTreeDataProvider(service, ['in-progress' as BeanStatus]);

      provider.setFilter({ statusFilter: ['todo' as BeanStatus] });
      await provider.getChildren();

      // Constructor filter takes precedence
      expect(service.listBeans).toHaveBeenCalledWith({ status: ['in-progress'] });
    });
  });

  describe('Hierarchical Tree Building', () => {
    beforeEach(() => {
      provider = new BeansTreeDataProvider(service);
    });

    it('should build flat list when flatList is true', async () => {
      provider = new BeansTreeDataProvider(service, undefined, true);
      mockBeans = [
        createBean('bean-1', 'Parent', 'todo'),
        { ...createBean('bean-2', 'Child', 'todo'), parent: 'bean-1' },
      ];

      const children = await provider.getChildren();

      // Both beans at root level in flat mode
      expect(children).toHaveLength(2);
    });

    it('should build hierarchical tree', async () => {
      mockBeans = [
        createBean('bean-1', 'Parent', 'todo'),
        { ...createBean('bean-2', 'Child', 'todo'), parent: 'bean-1' },
      ];

      const rootChildren = await provider.getChildren();

      expect(rootChildren).toHaveLength(1);
      expect(rootChildren[0].bean.id).toBe('bean-1');
      expect(rootChildren[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    });

    it('should get children of a bean', async () => {
      mockBeans = [
        createBean('bean-1', 'Parent', 'todo'),
        { ...createBean('bean-2', 'Child1', 'todo'), parent: 'bean-1' },
        { ...createBean('bean-3', 'Child2', 'todo'), parent: 'bean-1' },
      ];

      const rootChildren = await provider.getChildren();
      const parentItem = rootChildren[0];
      const childrenItems = await provider.getChildren(parentItem);

      expect(childrenItems).toHaveLength(2);
      expect(childrenItems[0].bean.id).toBe('bean-2');
      expect(childrenItems[1].bean.id).toBe('bean-3');
    });

    it('should only show beans at root if parent not in set', async () => {
      mockBeans = [
        { ...createBean('bean-1', 'Child', 'todo'), parent: 'bean-missing' },
        createBean('bean-2', 'Root', 'todo'),
      ];

      const children = await provider.getChildren();

      // Both show at root (bean-1 has missing parent, bean-2 has no parent)
      expect(children).toHaveLength(2);
    });
  });

  describe('In-Progress Descendants Cache', () => {
    beforeEach(() => {
      provider = new BeansTreeDataProvider(service);
    });

    it('should rebuild hasChildren cache on each tree build', async () => {
      mockBeans = [
        createBean('bean-1', 'Parent', 'todo'),
        { ...createBean('bean-2', 'Child', 'todo'), parent: 'bean-1' },
      ];

      let rootChildren = await provider.getChildren();
      expect(rootChildren[0].hasChildren).toBe(true);
      expect(rootChildren[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);

      // Remove child and rebuild
      mockBeans = [createBean('bean-1', 'Parent', 'todo')];
      provider.refresh();

      rootChildren = await provider.getChildren();
      expect(rootChildren[0].hasChildren).toBe(false);
      expect(rootChildren[0].collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
    });

    it('should mark ancestors of in-progress beans', async () => {
      mockBeans = [
        createBean('bean-1', 'Grandparent', 'todo'),
        { ...createBean('bean-2', 'Parent', 'todo'), parent: 'bean-1' },
        { ...createBean('bean-3', 'Child', 'in-progress'), parent: 'bean-2' },
      ];

      const rootChildren = await provider.getChildren();

      // Grandparent should have in-progress descendant
      expect(rootChildren[0].hasInProgressChildren).toBe(true);

      const parentChildren = await provider.getChildren(rootChildren[0]);
      // Parent should have in-progress child
      expect(parentChildren[0].hasInProgressChildren).toBe(true);
    });

    it('should not mark beans without in-progress descendants', async () => {
      mockBeans = [
        createBean('bean-1', 'Parent', 'todo'),
        { ...createBean('bean-2', 'Child', 'completed'), parent: 'bean-1' },
      ];

      const children = await provider.getChildren();

      expect(children[0].hasInProgressChildren).toBe(false);
    });

    it('should rebuild cache on each tree build', async () => {
      mockBeans = [
        createBean('bean-1', 'Parent', 'todo'),
        { ...createBean('bean-2', 'Child', 'todo'), parent: 'bean-1' },
      ];

      await provider.getChildren();
      const firstItem = (await provider.getChildren())[0];
      expect(firstItem.hasInProgressChildren).toBe(false);

      // Change child to in-progress
      mockBeans[1].status = 'in-progress' as BeanStatus;
      provider.refresh();

      await provider.getChildren();
      const secondItem = (await provider.getChildren())[0];
      expect(secondItem.hasInProgressChildren).toBe(true);
    });
  });

  describe('getParent', () => {
    beforeEach(() => {
      provider = new BeansTreeDataProvider(service);
    });

    it('should return undefined for root beans', async () => {
      mockBeans = [createBean('bean-1', 'Root', 'todo')];

      await provider.getChildren();
      const rootItem = (await provider.getChildren())[0];
      const parent = await provider.getParent(rootItem);

      expect(parent).toBeUndefined();
    });

    it('should return parent tree item for child beans', async () => {
      mockBeans = [
        createBean('bean-1', 'Parent', 'todo'),
        { ...createBean('bean-2', 'Child', 'todo'), parent: 'bean-1' },
      ];

      await provider.getChildren();
      const rootItem = (await provider.getChildren())[0];
      const childItems = await provider.getChildren(rootItem);
      const parentItem = await provider.getParent(childItems[0]);

      expect(parentItem).toBeDefined();
      expect(parentItem!.bean.id).toBe('bean-1');
    });

    it('should return undefined if parent not found', async () => {
      mockBeans = [{ ...createBean('bean-1', 'Orphan', 'todo'), parent: 'bean-missing' }];

      await provider.getChildren();
      const item = (await provider.getChildren())[0];
      const parent = await provider.getParent(item);

      expect(parent).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      provider = new BeansTreeDataProvider(service);
      // Reset static deduplication state between tests
      (BeansTreeDataProvider as unknown as { lastFetchErrorMessage: string }).lastFetchErrorMessage = '';
      (BeansTreeDataProvider as unknown as { lastFetchErrorTime: number }).lastFetchErrorTime = 0;
    });

    it('should handle fetch errors gracefully', async () => {
      const showErrorSpy = vi.fn();
      (vscode.window.showErrorMessage as ReturnType<typeof vi.fn>) = showErrorSpy;
      (service.listBeans as ReturnType<typeof vi.fn>) = vi.fn(async () => {
        throw new Error('Network error');
      });

      const children = await provider.getChildren();

      expect(children).toEqual([]);
      expect(showErrorSpy).toHaveBeenCalledWith('Failed to fetch beans: Network error');
    });

    it('should deduplicate identical error toasts within the same refresh cycle', async () => {
      const showErrorSpy = vi.fn();
      (vscode.window.showErrorMessage as ReturnType<typeof vi.fn>) = showErrorSpy;
      (service.listBeans as ReturnType<typeof vi.fn>) = vi.fn(async () => {
        throw new Error('CLI not found');
      });

      const provider1 = new BeansTreeDataProvider(service, ['todo']);
      const provider2 = new BeansTreeDataProvider(service, ['draft']);

      await provider1.getChildren();
      await provider2.getChildren();

      // Same error message for both — only one toast shown
      expect(showErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should show error toast for distinct error messages', async () => {
      const showErrorSpy = vi.fn();
      (vscode.window.showErrorMessage as ReturnType<typeof vi.fn>) = showErrorSpy;

      let callCount = 0;
      (service.listBeans as ReturnType<typeof vi.fn>) = vi.fn(async () => {
        callCount++;
        throw new Error(callCount === 1 ? 'Error A' : 'Error B');
      });

      const provider1 = new BeansTreeDataProvider(service, ['todo']);
      const provider2 = new BeansTreeDataProvider(service, ['draft']);

      await provider1.getChildren();
      await provider2.getChildren();

      expect(showErrorSpy).toHaveBeenCalledTimes(2);
    });

    it('should fall back to un-augmented beans when augmentBeans fails', async () => {
      class FailingAugmentProvider extends BeansTreeDataProvider {
        protected override async augmentBeans(_beans: Bean[]): Promise<Bean[]> {
          throw new Error('Augmentation network failure');
        }
      }

      const failProvider = new FailingAugmentProvider(service, ['todo']);
      mockBeans = [createBean('bean-1', 'Still visible', 'todo')];

      const children = await failProvider.getChildren();

      // Bean is still returned despite augmentation failure
      expect(children).toHaveLength(1);
      expect(children[0].bean.id).toBe('bean-1');
    });

    it('should return empty array when service returns no beans', async () => {
      mockBeans = [];

      const children = await provider.getChildren();

      expect(children).toEqual([]);
    });
  });

  describe('Subclass Hooks', () => {
    class TestProvider extends BeansTreeDataProvider {
      protected postFetchFilter(beans: Bean[]): Bean[] {
        // Filter out completed beans
        return beans.filter(b => b.status !== 'completed');
      }

      protected async augmentBeans(beans: Bean[]): Promise<Bean[]> {
        // Add an extra bean
        return [...beans, createBean('bean-extra', 'Extra', 'todo')];
      }
    }

    it('should call postFetchFilter hook', async () => {
      provider = new TestProvider(service);
      mockBeans = [createBean('bean-1', 'Todo', 'todo'), createBean('bean-2', 'Done', 'completed')];

      const children = await provider.getChildren();

      // Completed bean should be filtered out
      expect(children).toHaveLength(2); // bean-1 + extra
      expect(children.find(c => c.bean.id === 'bean-2')).toBeUndefined();
    });

    it('should call augmentBeans hook', async () => {
      provider = new TestProvider(service);
      mockBeans = [createBean('bean-1', 'Todo', 'todo')];

      const children = await provider.getChildren();

      // Should include original + extra
      expect(children).toHaveLength(2);
      expect(children.find(c => c.bean.id === 'bean-extra')).toBeDefined();
    });
  });

  describe('Complex Sorting Scenarios', () => {
    beforeEach(() => {
      provider = new BeansTreeDataProvider(service);
    });

    it('should sort by status then priority in status-priority mode', async () => {
      mockBeans = [
        createBean('bean-1', 'A', 'todo', undefined, 'task', 'critical'),
        createBean('bean-2', 'B', 'in-progress', undefined, 'task', 'low'),
        createBean('bean-3', 'C', 'todo', undefined, 'task', 'high'),
      ];

      provider.setSortMode('status-priority-type-title');
      const children = await provider.getChildren();

      // in-progress (low) > todo (critical) > todo (high)
      expect(children[0].bean.id).toBe('bean-2');
      expect(children[1].bean.id).toBe('bean-1');
      expect(children[2].bean.id).toBe('bean-3');
    });

    it('should sort by priority then status in priority-status mode', async () => {
      mockBeans = [
        createBean('bean-1', 'A', 'todo', undefined, 'task', 'high'),
        createBean('bean-2', 'B', 'completed', undefined, 'task', 'critical'),
        createBean('bean-3', 'C', 'in-progress', undefined, 'task', 'high'),
      ];

      provider.setSortMode('priority-status-type-title');
      const children = await provider.getChildren();

      // critical > high (in-progress) > high (todo)
      expect(children[0].bean.id).toBe('bean-2');
      expect(children[1].bean.id).toBe('bean-3');
      expect(children[2].bean.id).toBe('bean-1');
    });

    it('should treat undefined priority as normal', async () => {
      mockBeans = [
        createBean('bean-1', 'A', 'todo', undefined, 'task', undefined),
        createBean('bean-2', 'B', 'todo', undefined, 'task', 'high'),
        createBean('bean-3', 'C', 'todo', undefined, 'task', 'low'),
      ];

      provider.setSortMode('priority-status-type-title');
      const children = await provider.getChildren();

      // high > normal (undefined) > low
      expect(children[0].bean.id).toBe('bean-2');
      expect(children[1].bean.id).toBe('bean-1');
      expect(children[2].bean.id).toBe('bean-3');
    });

    it('should sort by type when status and priority equal', async () => {
      mockBeans = [
        createBean('bean-1', 'A', 'todo', undefined, 'task', 'normal'),
        createBean('bean-2', 'B', 'todo', undefined, 'bug', 'normal'),
        createBean('bean-3', 'C', 'todo', undefined, 'epic', 'normal'),
      ];

      provider.setSortMode('status-priority-type-title');
      const children = await provider.getChildren();

      // epic > bug > task
      expect(children[0].bean.id).toBe('bean-3');
      expect(children[1].bean.id).toBe('bean-2');
      expect(children[2].bean.id).toBe('bean-1');
    });

    it('should sort by title when all else equal', async () => {
      mockBeans = [
        createBean('bean-1', 'Zebra', 'todo', undefined, 'task', 'normal'),
        createBean('bean-2', 'Apple', 'todo', undefined, 'task', 'normal'),
        createBean('bean-3', 'Mango', 'todo', undefined, 'task', 'normal'),
      ];

      provider.setSortMode('status-priority-type-title');
      const children = await provider.getChildren();

      expect(children[0].bean.title).toBe('Apple');
      expect(children[1].bean.title).toBe('Mango');
      expect(children[2].bean.title).toBe('Zebra');
    });
  });
});

// Helper function to create test beans
function createBean(
  id: string,
  title: string,
  status: BeanStatus,
  updatedAt?: Date,
  type: BeanType = 'task',
  priority?: 'critical' | 'high' | 'normal' | 'low' | 'deferred'
): Bean {
  const slug = title.toLowerCase().replace(/\s+/g, '-');
  return {
    id,
    code: id.substring(5).toUpperCase(),
    slug,
    path: `.beans/${id}--${slug}.md`,
    title,
    body: '',
    status,
    type,
    priority,
    tags: [],
    blocking: [],
    blockedBy: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: updatedAt || new Date('2024-01-01'),
    etag: `etag-${id}`,
  };
}
