import { describe, expect, it, vi } from 'vitest';
import { Bean } from '../../../../src/beans/model/Bean';
import { BeansSearchTreeProvider } from '../../../../src/beans/search/BeansSearchTreeProvider';

function makeBean(overrides: Partial<Bean> = {}): Bean {
  return Object.assign(
    {
      id: 'B',
      code: 'b',
      title: 'Title',
      body: '',
      status: 'todo',
      type: 'task',
      priority: 'normal',
      tags: [],
      blocking: [],
      blockedBy: [],
    } as Partial<Bean>,
    overrides
  ) as Bean;
}

describe('BeansSearchTreeProvider branch coverage', () => {
  it('sortBeans falls back to title localeCompare when priority and status equal', () => {
    const service: any = { listBeans: vi.fn().mockResolvedValue([]) };
    const p = new BeansSearchTreeProvider(service as any);
    const a = makeBean({ title: 'A', priority: 'normal', status: 'todo' });
    const b = makeBean({ title: 'B', priority: 'normal', status: 'todo' });
    const out = (p as any).sortBeans([b, a]);
    expect(out[0].title).toBe('A');
  });

  it('matchesQuery returns false for empty strings and undefined fields', () => {
    const service: any = { listBeans: vi.fn().mockResolvedValue([]) };
    const p = new BeansSearchTreeProvider(service as any);
    const b = makeBean({ title: undefined as any, id: undefined as any });
    expect((p as any).matchesQuery(b, 'x')).toBe(false);
  });
});
