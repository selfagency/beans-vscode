import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BeansService } from '../../beans/service';
import { ActiveBeansProvider, CompletedBeansProvider, DraftBeansProvider } from '../../beans/tree/providers';
import { Bean } from '../../beans/model';

/**
 * Integration tests for tree data providers and bean list population
 */

describe('Tree Population', () => {
  let mockService: BeansService;
  let activeProvider: ActiveBeansProvider;

  const makeMockBean = (overrides: Partial<Bean> = {}): Bean => ({
    id: 'test-1',
    code: 't1',
    slug: 'test-bean',
    path: 'beans/test-1.md',
    title: 'Test Bean',
    body: '',
    status: 'todo',
    type: 'task',
    tags: [],
    blocking: [],
    blockedBy: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    etag: 'e1',
    ...overrides
  });

  beforeEach(() => {
    mockService = new BeansService('/mock/workspace');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create active beans provider', () => {
    activeProvider = new ActiveBeansProvider(mockService);
    expect(activeProvider).toBeDefined();
  });

  it('should create completed beans provider', () => {
    const completedProvider = new CompletedBeansProvider(mockService);
    expect(completedProvider).toBeDefined();
  });

  it('should create draft beans provider', () => {
    const draftProvider = new DraftBeansProvider(mockService);
    expect(draftProvider).toBeDefined();
  });

  it('should return empty array when no beans available', async () => {
    vi.spyOn(mockService, 'listBeans').mockResolvedValue([]);
    
    activeProvider = new ActiveBeansProvider(mockService);
    const items = await activeProvider.getChildren();
    
    expect(items).toEqual([]);
  });

  it('should populate tree with active beans', async () => {
    const mockBeans: Bean[] = [
      makeMockBean({ id: 'bean-1', title: 'Bean 1', status: 'todo' }),
      makeMockBean({ id: 'bean-2', title: 'Second Task', status: 'todo' })
    ];

    vi.spyOn(mockService, 'listBeans').mockResolvedValue(mockBeans);
    
    activeProvider = new ActiveBeansProvider(mockService);
    const items = await activeProvider.getChildren();
    
    expect(items).toHaveLength(2);
    expect(items[0].bean.id).toBe('bean-1');
    expect(items[1].bean.id).toBe('bean-2');
  });

  it('should show only active statuses in active provider', async () => {
    const mockBeans: Bean[] = [
      makeMockBean({ id: 'bean-1', status: 'todo' }),
      makeMockBean({ id: 'bean-2', status: 'in-progress' })
    ];

    vi.spyOn(mockService, 'listBeans').mockResolvedValue(mockBeans);
    
    activeProvider = new ActiveBeansProvider(mockService);
    const items = await activeProvider.getChildren();
    
    // ActiveBeansProvider should only show todo and in-progress beans
    const statuses = items.map(item => item.bean.status);
    expect(statuses.every(s => s === 'todo' || s === 'in-progress')).toBe(true);
  });

  it('should show only completed beans in completed provider', async () => {
    const mockBeans: Bean[] = [
      makeMockBean({ id: 'bean-1', status: 'completed' }),
      makeMockBean({ id: 'bean-2', status: 'completed' })
    ];

    vi.spyOn(mockService, 'listBeans').mockResolvedValue(mockBeans);
    
    const completedProvider = new CompletedBeansProvider(mockService);
    const items = await completedProvider.getChildren();
    
    // CompletedBeansProvider should only show completed beans
    const statuses = items.map(item => item.bean.status);
    expect(statuses.every(s => s === 'completed')).toBe(true);
  });

  it('should handle parent-child relationships in tree', async () => {
    const parent = makeMockBean({ 
      id: 'parent-1', 
      title: 'Parent Epic', 
      type: 'epic',
      status: 'in-progress'
    });
    
    const child = makeMockBean({ 
      id: 'child-1', 
      title: 'Child Task', 
      type: 'task',
      status: 'todo',
      parent: 'parent-1'
    });

    vi.spyOn(mockService, 'listBeans').mockResolvedValue([parent, child]);
    
    activeProvider = new ActiveBeansProvider(mockService);
    const topLevelItems = await activeProvider.getChildren();
    
    // Parent should be at top level
    const parentItem = topLevelItems.find(item => item.bean.id === 'parent-1');
    expect(parentItem).toBeDefined();
    
    // Child should be retrievable under parent
    if (parentItem) {
      const childItems = await activeProvider.getChildren(parentItem);
      expect(childItems).toHaveLength(1);
      expect(childItems[0].bean.id).toBe('child-1');
    }
  });

  it('should exclude active beans with draft parents from active view', async () => {
    const draftParent = makeMockBean({
      id: 'draft-parent',
      title: 'Draft Epic',
      type: 'epic',
      status: 'draft'
    });

    const activeChild = makeMockBean({
      id: 'active-child',
      title: 'Active Child',
      type: 'task',
      status: 'todo',
      parent: 'draft-parent'
    });

    const standaloneActive = makeMockBean({
      id: 'standalone',
      title: 'Standalone Task',
      type: 'task',
      status: 'todo'
    });

    // First call returns active beans, second call returns all beans for lookup
    vi.spyOn(mockService, 'listBeans')
      .mockResolvedValueOnce([activeChild, standaloneActive])
      .mockResolvedValueOnce([draftParent, activeChild, standaloneActive]);

    activeProvider = new ActiveBeansProvider(mockService);
    const items = await activeProvider.getChildren();

    // Should only show standalone active bean, not the child of the draft parent
    expect(items).toHaveLength(1);
    expect(items[0].bean.id).toBe('standalone');
  });

  it('should include non-draft children of drafts in draft view', async () => {
    const draftParent = makeMockBean({
      id: 'draft-parent',
      title: 'Draft Epic',
      type: 'epic',
      status: 'draft'
    });

    const activeChild = makeMockBean({
      id: 'active-child',
      title: 'Active Child',
      type: 'task',
      status: 'todo',
      parent: 'draft-parent'
    });

    // First call returns draft beans, second call returns other beans for augmentation
    vi.spyOn(mockService, 'listBeans')
      .mockResolvedValueOnce([draftParent])
      .mockResolvedValueOnce([activeChild]);

    const draftProvider = new DraftBeansProvider(mockService);
    const rootItems = await draftProvider.getChildren();

    // Should show draft parent at root level
    expect(rootItems).toHaveLength(1);
    expect(rootItems[0].bean.id).toBe('draft-parent');

    // Active child should be nested under the draft parent
    const childItems = await draftProvider.getChildren(rootItems[0]);
    expect(childItems).toHaveLength(1);
    expect(childItems[0].bean.id).toBe('active-child');
  });

  it('should refresh tree on demand', async () => {
    const initialBeans = [makeMockBean({ id: 'bean-1', title: 'Initial' })];
    const updatedBeans = [
      makeMockBean({ id: 'bean-1', title: 'Updated' }),
      makeMockBean({ id: 'bean-2', title: 'New Bean' })
    ];

    const listBeansSpy = vi.spyOn(mockService, 'listBeans')
      .mockResolvedValueOnce(initialBeans)
      .mockResolvedValueOnce(initialBeans) // Second call for augmentBeans
      .mockResolvedValueOnce(updatedBeans)
      .mockResolvedValueOnce(updatedBeans); // Second call for augmentBeans
    
    activeProvider = new ActiveBeansProvider(mockService);
    
    // First load
    await activeProvider.getChildren();
    
    // Refresh
    activeProvider.refresh();
    await activeProvider.getChildren();
    
    // Should have called listBeans multiple times (once per getChildren, plus augmentBeans calls)
    expect(listBeansSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('should apply filter options', async () => {
    const mockBeans: Bean[] = [
      makeMockBean({ id: 'bean-1', type: 'bug', status: 'todo' }),
      makeMockBean({ id: 'bean-2', type: 'task', status: 'todo' }),
      makeMockBean({ id: 'bean-3', type: 'feature', status: 'todo' })
    ];

    vi.spyOn(mockService, 'listBeans').mockResolvedValue(mockBeans);
    
    activeProvider = new ActiveBeansProvider(mockService);
    activeProvider.setFilter({ typeFilter: ['bug'] });
    
    await activeProvider.getChildren();
    
    // Service should have been called with type filter
    expect(mockService.listBeans).toHaveBeenCalledWith(
      expect.objectContaining({ type: ['bug'] })
    );
  });
});
