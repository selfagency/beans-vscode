import { describe, expect, it, vi } from 'vitest';
import { BeansSearchTreeProvider } from '../../../../src/beans/search/BeansSearchTreeProvider';

function makeBean(overrides: any = {}) {
  return {
    id: 'X-1',
    title: 'Alpha',
    body: 'content here',
    status: 'todo',
    type: 'task',
    priority: 'normal',
    tags: [],
    blocking: [],
    blockedBy: [],
    ...overrides,
  } as any;
}

describe('BeansSearchTreeProvider additional coverage', () => {
  it('matchesQuery searches tags and blocking arrays', () => {
    const svc: any = {};
    const prov = new BeansSearchTreeProvider(svc as any);
    const b = makeBean({ tags: ['ui'], blocking: ['B-2'], blockedBy: ['C-3'] });
    expect((prov as any).matchesQuery(b, 'ui')).toBe(true);
    expect((prov as any).matchesQuery(b, 'b-2')).toBe(true);
    expect((prov as any).matchesQuery(b, 'c-3')).toBe(true);
    expect((prov as any).matchesQuery(b, 'nomatch')).toBe(false);
  });

  it('scoreIdentityMatch and title/content/metadata scores', () => {
    const svc: any = {};
    const prov = new BeansSearchTreeProvider(svc as any);
    const bean = makeBean({
      id: 'ID-99',
      code: 'C99',
      title: 'FindMe',
      body: 'body match',
      tags: ['tagmatch'],
      status: 'todo',
      priority: 'high',
    });
    expect((prov as any).scoreIdentityMatch(bean, 'id-99')).toBeGreaterThan(0);
    expect((prov as any).scoreTitleMatch(bean, 'findme')).toBeGreaterThan(0);
    expect((prov as any).scoreContentMatch(bean, 'body')).toBeGreaterThan(0);
    expect((prov as any).scoreMetadataMatch(bean, 'todo')).toBeGreaterThan(0);
  });

  it('sortBeans uses relevance and then priority/status/title', () => {
    const svc: any = {};
    const prov = new BeansSearchTreeProvider(svc as any);
    // with query
    const a = makeBean({ id: 'a', title: 'A', priority: 'normal', status: 'todo', body: 'match' });
    const b = makeBean({ id: 'b', title: 'B', priority: 'critical', status: 'todo' });
    const c = makeBean({ id: 'c', title: 'C', priority: 'normal', status: 'in-progress' });
    (prov as any).currentFilter = { text: 'match' };
    const ordered = (prov as any).sortBeans([a, b, c]);
    // a should score highest due to body match
    expect(ordered[0].id).toBe('a');
    // without query, priority then status
    (prov as any).currentFilter = undefined;
    const ordered2 = (prov as any).sortBeans([a, b, c]);
    expect(ordered2[0].id).toBe('b');
  });

  it('fetchBeans handles service error by clearing beans', async () => {
    const svc: any = { listBeans: vi.fn().mockRejectedValue(new Error('nope')) };
    const prov = new BeansSearchTreeProvider(svc as any);
    await (prov as any).fetchBeans();
    expect((prov as any).beans).toEqual([]);
  });
});
