import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Bean } from '../../../../src/beans/model/Bean';
import { BeansSearchTreeProvider } from '../../../../src/beans/search/BeansSearchTreeProvider';

function makeBean(overrides: Partial<Bean> = {}): Bean {
  return Object.assign(
    {
      id: 'B1',
      code: 'b1',
      title: 'Test bean',
      body: 'some content',
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

describe('BeansSearchTreeProvider helpers', () => {
  let service: any;
  let provider: any;

  beforeEach(() => {
    service = { listBeans: vi.fn() };
    provider = new BeansSearchTreeProvider(service as any);
  });

  it('matchesQuery checks id, code, title, tags and blocking fields', () => {
    const b = makeBean({ id: 'ID-123', code: 'C1', title: 'FindMe', tags: ['alpha'], blocking: ['X'] });
    expect(provider.matchesQuery(b, 'id-123')).toBe(true);
    expect(provider.matchesQuery(b, 'c1')).toBe(true);
    expect(provider.matchesQuery(b, 'findme')).toBe(true);
    expect(provider.matchesQuery(b, 'alpha')).toBe(true);
    expect(provider.matchesQuery(b, 'x')).toBe(true);
    expect(provider.matchesQuery(b, 'nomatch')).toBe(false);
  });

  it('scoreIdentityMatch and scoreTitleMatch produce expected ordering', () => {
    const a = makeBean({ id: 'A', code: 'a', title: 'Alpha' });
    const b = makeBean({ id: 'B', code: 'b', title: 'Beta' });
    const q = 'a';
    const sa = provider.scoreRelevance(a, q);
    const sb = provider.scoreRelevance(b, q);
    expect(sa).toBeGreaterThan(sb);
  });

  it('sortBeans respects relevance, priority and status ordering', async () => {
    const high = makeBean({ id: '1', title: 'High', priority: 'high', status: 'todo' });
    const critical = makeBean({ id: '2', title: 'Critical', priority: 'critical', status: 'todo' });
    const inprogress = makeBean({ id: '3', title: 'InProgress', priority: 'normal', status: 'in-progress' });
    service.listBeans.mockResolvedValue([high, critical, inprogress]);

    // clear any text filter so priority/status ordering is applied
    provider.setFilter(undefined);
    const children = await provider.getChildren();
    // expected ordering by priority (critical, high, normal)
    expect(children.map((c: any) => c.bean.id)).toEqual(['2', '1', '3']);
  });

  it('fetchBeans filters by priorities, tags and text', async () => {
    const a = makeBean({ id: 'a', priority: 'high', tags: ['one'], title: 'Alpha' });
    const b = makeBean({ id: 'b', priority: 'low', tags: ['two'], title: 'Beta' });
    service.listBeans.mockResolvedValue([a, b]);
    provider.setFilter({ priorities: ['high'] } as any);
    await provider.refreshCount();
    expect(provider.getVisibleCount()).toBe(1);

    provider.setFilter({ tags: ['two'] } as any);
    await provider.refreshCount();
    expect(provider.getVisibleCount()).toBe(1);

    provider.setFilter({ text: 'beta' } as any);
    await provider.refreshCount();
    expect(provider.getVisibleCount()).toBe(1);
  });

  it('dispose is safe to call', () => {
    expect(() => provider.dispose()).not.toThrow();
  });

  it('scoreIdentityMatch covers exact, startsWith and includes cases', () => {
    const equal = makeBean({ id: 'XYZ', code: 'xyz' });
    const starts = makeBean({ id: 'XYZ1', code: 'x1' });
    const incl = makeBean({ id: 'AxyzB', code: 'ax' });
    expect(provider.scoreRelevance(equal, 'xyz')).toBeGreaterThan(0);
    expect(provider.scoreRelevance(starts, 'xyz')).toBeGreaterThan(0);
    expect(provider.scoreRelevance(incl, 'xyz')).toBeGreaterThan(0);
  });

  it('scoreIdentityMatch returns exact expected scores', () => {
    const equal = makeBean({ id: 'ID', code: 'id' });
    const starts = makeBean({ id: 'ID12', code: 'id12' });
    const incl = makeBean({ id: 'AIDB', code: 'aidb' });
    const none = makeBean({ id: 'Z', code: 'z' });
    const sEqual = (provider as any).scoreIdentityMatch(equal, 'id');
    const sStarts = (provider as any).scoreIdentityMatch(starts, 'id');
    const sIncl = (provider as any).scoreIdentityMatch(incl, 'id');
    const sNone = (provider as any).scoreIdentityMatch(none, 'id');
    expect(sEqual).toBe(1000);
    expect(sStarts).toBe(500);
    expect(sIncl).toBe(300);
    expect(sNone).toBe(0);
  });

  it('scoreTitleMatch returns expected values', () => {
    const tExact = makeBean({ title: 'Hello' });
    const tStart = makeBean({ title: 'HelloWorld' });
    const tIncl = makeBean({ title: 'Say Hello' });
    expect((provider as any).scoreTitleMatch(tExact, 'hello')).toBe(200);
    expect((provider as any).scoreTitleMatch(tStart, 'hello')).toBe(150);
    expect((provider as any).scoreTitleMatch(tIncl, 'hello')).toBe(100);
  });

  it('scoreContentMatch and scoreMetadataMatch cover branches', () => {
    const b = makeBean({
      body: 'contains foo',
      tags: ['tag1'],
      status: 'in-progress',
      type: 'task',
      priority: 'critical',
    });
    expect((provider as any).scoreContentMatch(b, 'foo')).toBeGreaterThanOrEqual(20);
    expect((provider as any).scoreContentMatch(b, 'tag1')).toBeGreaterThanOrEqual(15);
    expect((provider as any).scoreMetadataMatch(b, 'in-progress')).toBe(10);
    expect((provider as any).scoreMetadataMatch(b, 'nosuch')).toBe(0);
  });

  it('toLower returns empty string for non-strings', () => {
    expect((provider as any).toLower(123)).toBe('');
  });

  it('scoreTitleMatch and content/meta scoring produce non-zero scores for matches', () => {
    const t = makeBean({
      title: 'ExactTitle',
      body: 'body contains foo',
      tags: ['tagfoo'],
      status: 'todo',
      type: 'task',
      priority: 'high',
    });
    expect(provider.scoreRelevance(t, 'exacttitle')).toBeGreaterThan(0);
    expect(provider.scoreRelevance(t, 'foo')).toBeGreaterThan(0);
    expect(provider.scoreRelevance(t, 'todo')).toBeGreaterThan(0);
  });

  it('fetchBeans handles service errors gracefully', async () => {
    service.listBeans.mockRejectedValue(new Error('network'));
    provider.setFilter(undefined);
    const children = await provider.getChildren();
    expect(children).toEqual([]);
  });

  it('fetchBeans passes types and statuses options to service.listBeans', async () => {
    const spy = vi.fn().mockResolvedValue([]);
    service.listBeans = spy;
    provider.setFilter({ types: ['task'], statuses: ['todo'] } as any);
    await provider.refreshCount();
    expect(spy).toHaveBeenCalledWith({ type: ['task'], status: ['todo'] });
  });
});
