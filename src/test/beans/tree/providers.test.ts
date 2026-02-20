import { describe, expect, it, vi } from 'vitest';
import type { Bean } from '../../../beans/model';
import { ActiveBeansProvider, CompletedBeansProvider, DraftBeansProvider } from '../../../beans/tree/providers';

function makeBean(overrides: Partial<Bean> = {}): Bean {
  return {
    id: 'bean-1',
    code: 'b1',
    slug: 'bean-1',
    path: '.beans/bean-1--bean-1.md',
    title: 'Bean 1',
    body: '',
    status: 'todo',
    type: 'task',
    priority: undefined,
    tags: [],
    parent: undefined,
    blocking: [],
    blockedBy: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    etag: 'etag',
    ...overrides,
  } as Bean;
}

describe('tree providers index', () => {
  it('ActiveBeansProvider excludes beans with direct or transitive draft parent', async () => {
    const draftRoot = makeBean({ id: 'd1', status: 'draft', type: 'epic' });
    const intermediate = makeBean({ id: 'i1', status: 'todo', parent: 'd1' });
    const transitiveChild = makeBean({ id: 'c1', status: 'in-progress', parent: 'i1' });
    const regularActive = makeBean({ id: 'a1', status: 'todo' });

    const service = {
      listBeans: vi.fn(async () => [draftRoot, intermediate, transitiveChild, regularActive]),
    } as any;

    const provider = new ActiveBeansProvider(service);
    const filtered = await (provider as any).augmentBeans([transitiveChild, regularActive]);

    expect(filtered.map((b: Bean) => b.id)).toEqual(['a1']);
  });

  it('DraftBeansProvider includes transitive descendants of draft roots', async () => {
    const draftRoot = makeBean({ id: 'd1', status: 'draft', type: 'epic' });
    const child = makeBean({ id: 'c1', status: 'todo', parent: 'd1' });
    const grandChild = makeBean({ id: 'g1', status: 'in-progress', parent: 'c1' });

    const service = {
      listBeans: vi.fn(async () => [child, grandChild]),
    } as any;

    const provider = new DraftBeansProvider(service);
    const augmented = await (provider as any).augmentBeans([draftRoot]);

    expect(augmented.map((b: Bean) => b.id)).toEqual(['d1', 'c1', 'g1']);
  });

  it('CompletedBeansProvider can be constructed', () => {
    const service = { listBeans: vi.fn(async () => []) } as any;
    const provider = new CompletedBeansProvider(service);
    expect(provider).toBeDefined();
  });
});
