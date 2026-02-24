import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bean } from '../../../beans/model';
import { BeansSearchTreeProvider } from '../../../beans/search/BeansSearchTreeProvider';
import { BeansService } from '../../../beans/service/BeansService';

vi.mock('vscode');
vi.mock('../../../beans/logging/BeansOutput', () => ({
  BeansOutput: { getInstance: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));

function makeBean(id: string, title: string, opts: Partial<Bean> = {}): Bean {
  return {
    id,
    code: id.toUpperCase(),
    slug: id,
    path: `.beans/${id}.md`,
    title,
    body: opts.body ?? '',
    status: (opts.status as any) ?? 'todo',
    type: (opts.type as any) ?? 'task',
    priority: (opts.priority as any) ?? 'normal',
    tags: opts.tags ?? [],
    blocking: opts.blocking ?? [],
    blockedBy: opts.blockedBy ?? [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    etag: `${id}-etag`,
    parent: undefined,
  } as Bean;
}

describe('BeansSearchTreeProvider scoring, matching and sorting', () => {
  let svc: BeansService;
  let provider: BeansSearchTreeProvider;
  let beans: Bean[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    // Use a plain object rather than constructing BeansService to avoid vscode config access
    svc = { listBeans: async () => beans } as any;
    beans = [
      makeBean('a1', 'Alpha One', { priority: 'high', tags: ['red'], body: 'lorem' }),
      makeBean('b2', 'Beta Two', { priority: 'normal', tags: ['blue'], body: 'ipsum' }),
      makeBean('c3', 'Gamma', { priority: 'critical', tags: ['red'], body: 'contains' }),
    ];
    (svc.listBeans as any) = vi.fn(async () => beans);
    provider = new BeansSearchTreeProvider(svc);
  });

  it('matchesQuery finds text in various fields', async () => {
    expect((provider as any).matchesQuery(beans[0], 'alpha')).toBe(true);
    expect((provider as any).matchesQuery(beans[2], 'contains')).toBe(true);
    expect((provider as any).matchesQuery(beans[0], 'red')).toBe(true);
  });

  it('scoreIdentityMatch and title/content scoring produces expected ordering when text query set', async () => {
    // set filter text so sort uses relevance
    provider.setFilter({ text: 'gamma' } as any);
    const children = await provider.getChildren();
    expect(children.length).toBeGreaterThanOrEqual(1);
    // highest relevance should be Gamma
    const first = (children[0] as any).bean as Bean;
    expect(first.title.toLowerCase()).toContain('gamma');
  });

  it('sortBeans falls back to priority and status ordering', async () => {
    provider.setFilter(undefined);
    const sorted = (provider as any).sortBeans(beans.slice());
    // critical should come before high and normal
    expect(sorted[0].priority).toBe('critical');
  });

  it('getChildren returns BeanTreeItems and refreshCount updates visible count', async () => {
    const children = await provider.getChildren();
    expect(children.length).toBe(3);
    expect(provider.getVisibleCount()).toBe(3);
    await provider.refreshCount();
    expect(provider.getVisibleCount()).toBe(3);
  });

  it('dispose does not throw', () => {
    provider.dispose();
  });
});
