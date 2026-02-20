import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { Bean, BeanStatus, BeanType } from '../../../../beans/model';
import { BeansService } from '../../../../beans/service/BeansService';
import { ActiveBeansProvider } from '../../../../beans/tree/providers';

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

describe('ActiveBeansProvider', () => {
  let service: BeansService;
  let provider: ActiveBeansProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
    });

    service = new BeansService('/mock/workspace');
  });

  it('should exclude beans whose direct parent is a draft', async () => {
    const activeBeans = [
      createBean('bean-1', 'Independent', 'todo'),
      createBean('bean-2', 'Child of draft', 'todo', 'draft-parent'),
    ];
    const allBeans = [...activeBeans, createBean('draft-parent', 'Draft', 'draft')];

    (service.listBeans as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(activeBeans) // status: ['todo', 'in-progress']
      .mockResolvedValueOnce(allBeans); // augmentBeans: all beans

    provider = new ActiveBeansProvider(service);
    const children = await provider.getChildren();

    expect(children).toHaveLength(1);
    expect(children[0].bean.id).toBe('bean-1');
  });

  it('should exclude beans whose transitive ancestor is a draft', async () => {
    const activeChild = createBean('child', 'Child', 'todo', 'middle');
    const activeBeans = [activeChild];
    const allBeans = [
      activeChild,
      createBean('middle', 'Middle', 'todo', 'draft-root'),
      createBean('draft-root', 'Draft Root', 'draft'),
    ];

    (service.listBeans as ReturnType<typeof vi.fn>).mockResolvedValueOnce(activeBeans).mockResolvedValueOnce(allBeans);

    provider = new ActiveBeansProvider(service);
    const children = await provider.getChildren();

    expect(children).toHaveLength(0);
  });

  it('should keep beans whose ancestors are all non-draft', async () => {
    const activeChild = createBean('child', 'Child', 'todo', 'active-parent');
    const activeBeans = [createBean('active-parent', 'Parent', 'in-progress'), activeChild];

    (service.listBeans as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(activeBeans)
      .mockResolvedValueOnce(activeBeans); // augmentBeans: all same

    provider = new ActiveBeansProvider(service);
    const children = await provider.getChildren();

    // Both should be present: parent at root, child nested
    expect(children).toHaveLength(1); // Only root appears at top level
    expect(children[0].bean.id).toBe('active-parent');
  });
});
