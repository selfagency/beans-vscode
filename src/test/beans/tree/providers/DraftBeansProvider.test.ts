import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { Bean, BeanStatus, BeanType } from '../../../../beans/model';
import { BeansService } from '../../../../beans/service/BeansService';
import { DraftBeansProvider } from '../../../../beans/tree/providers';

vi.mock('vscode');
vi.mock('../../../../beans/service/BeansService');
vi.mock('../../../../beans/logging/BeansOutput', () => ({
  BeansOutput: {
    getInstance: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

function createBean(
  id: string,
  title: string,
  status: BeanStatus,
  parent?: string,
  type: BeanType = 'task',
  priority?: 'critical' | 'high' | 'normal' | 'low' | 'deferred'
): Bean {
  const slug = title.toLowerCase().replace(/\s+/g, '-');
  return {
    id,
    code: id.split('-').pop() || '',
    slug,
    path: `.beans/${id}--${slug}.md`,
    title,
    body: '',
    status,
    type,
    priority,
    tags: [],
    parent,
    blocking: [],
    blockedBy: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    etag: `etag-${id}`,
  };
}

describe('DraftBeansProvider', () => {
  let service: BeansService;
  let provider: DraftBeansProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
    });

    service = new BeansService('/mock/workspace');
  });

  it('should include direct children of draft parents in the tree', async () => {
    const draftParent = createBean('draft-parent', 'Draft Parent', 'draft');
    const activeChild = createBean('active-child', 'Active Child', 'todo', 'draft-parent');

    (service.listBeans as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([draftParent]) // fetchBeans: status ['draft']
      .mockResolvedValueOnce([activeChild]); // augmentBeans: other statuses

    provider = new DraftBeansProvider(service);

    // Root level: only draft-parent (child nests under it)
    const roots = await provider.getChildren();
    expect(roots).toHaveLength(1);
    expect(roots[0].bean.id).toBe('draft-parent');

    // Child level: active-child under draft-parent
    const nested = await provider.getChildren(roots[0]);
    expect(nested).toHaveLength(1);
    expect(nested[0].bean.id).toBe('active-child');
  });

  it('should include transitive descendants of draft parents', async () => {
    const draftRoot = createBean('draft-root', 'Draft Root', 'draft');
    const activeChild = createBean('child-1', 'Child', 'todo', 'draft-root');
    const activeGrandchild = createBean('grandchild-1', 'Grandchild', 'in-progress', 'child-1');
    const activeGreatGrandchild = createBean('great-gc-1', 'Great Grandchild', 'todo', 'grandchild-1');

    (service.listBeans as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([draftRoot])
      .mockResolvedValueOnce([activeChild, activeGrandchild, activeGreatGrandchild]);

    provider = new DraftBeansProvider(service);

    // Root: draft-root only
    const roots = await provider.getChildren();
    expect(roots).toHaveLength(1);
    expect(roots[0].bean.id).toBe('draft-root');

    // Level 1: child-1
    const level1 = await provider.getChildren(roots[0]);
    expect(level1).toHaveLength(1);
    expect(level1[0].bean.id).toBe('child-1');

    // Level 2: grandchild-1
    const level2 = await provider.getChildren(level1[0]);
    expect(level2).toHaveLength(1);
    expect(level2[0].bean.id).toBe('grandchild-1');

    // Level 3: great-gc-1
    const level3 = await provider.getChildren(level2[0]);
    expect(level3).toHaveLength(1);
    expect(level3[0].bean.id).toBe('great-gc-1');
  });

  it('should not include beans with no draft ancestor', async () => {
    const draftParent = createBean('draft-parent', 'Draft', 'draft');
    const activeChild = createBean('child-1', 'Child', 'todo', 'draft-parent');
    const unrelatedBean = createBean('unrelated', 'Unrelated', 'todo');

    (service.listBeans as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([draftParent])
      .mockResolvedValueOnce([activeChild, unrelatedBean]);

    provider = new DraftBeansProvider(service);

    const roots = await provider.getChildren();
    // Only draft-parent at root (child-1 nests under it); unrelated excluded
    expect(roots).toHaveLength(1);
    expect(roots[0].bean.id).toBe('draft-parent');

    // Verify child is nested
    const nested = await provider.getChildren(roots[0]);
    expect(nested).toHaveLength(1);
    expect(nested[0].bean.id).toBe('child-1');
  });

  it('should handle multiple draft roots with independent hierarchies', async () => {
    const draftA = createBean('draft-a', 'Draft A', 'draft');
    const draftB = createBean('draft-b', 'Draft B', 'draft');
    const childA = createBean('child-a', 'Child A', 'todo', 'draft-a');
    const childB = createBean('child-b', 'Child B', 'in-progress', 'draft-b');
    const grandchildA = createBean('gc-a', 'GC A', 'todo', 'child-a');

    (service.listBeans as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([draftA, draftB])
      .mockResolvedValueOnce([childA, childB, grandchildA]);

    provider = new DraftBeansProvider(service);

    // Two draft roots
    const roots = await provider.getChildren();
    expect(roots).toHaveLength(2);
    const rootIds = roots.map(r => r.bean.id).sort();
    expect(rootIds).toEqual(['draft-a', 'draft-b']);

    // draft-a → child-a → gc-a
    const rootA = roots.find(r => r.bean.id === 'draft-a')!;
    const childrenA = await provider.getChildren(rootA);
    expect(childrenA).toHaveLength(1);
    expect(childrenA[0].bean.id).toBe('child-a');

    const gcA = await provider.getChildren(childrenA[0]);
    expect(gcA).toHaveLength(1);
    expect(gcA[0].bean.id).toBe('gc-a');

    // draft-b → child-b
    const rootB = roots.find(r => r.bean.id === 'draft-b')!;
    const childrenB = await provider.getChildren(rootB);
    expect(childrenB).toHaveLength(1);
    expect(childrenB[0].bean.id).toBe('child-b');
  });
});
