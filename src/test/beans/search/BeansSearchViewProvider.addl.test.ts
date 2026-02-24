import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansSearchViewProvider } from '../../../../src/beans/search/BeansSearchViewProvider';

function makeBean(overrides: any = {}) {
  return {
    id: 'B-1',
    code: 'B1',
    title: 'My Bean',
    body: 'some body',
    status: 'todo',
    type: 'task',
    priority: 'normal',
    tags: ['front', 'api'],
    ...overrides,
  } as any;
}

describe('BeansSearchViewProvider additional coverage', () => {
  it('matchesQuery across fields', () => {
    const svc: any = {};
    const prov = new BeansSearchViewProvider(vscode.Uri.file('/'), svc as any);
    const b = makeBean({ id: 'ABC-123', title: 'Find Me', body: 'hello world', tags: ['zxy'] });
    expect((prov as any).matchesQuery(b, 'abc')).toBe(true);
    expect((prov as any).matchesQuery(b, 'find')).toBe(true);
    expect((prov as any).matchesQuery(b, 'hello')).toBe(true);
    expect((prov as any).matchesQuery(b, 'zxy')).toBe(true);
    expect((prov as any).matchesQuery(b, 'nomatch')).toBe(false);
  });

  it('scoreRelevance gives precedence to id/code and title', () => {
    const svc: any = {};
    const prov = new BeansSearchViewProvider(vscode.Uri.file('/'), svc as any);
    const exact = makeBean({ id: 'match' });
    const titleOnly = makeBean({ id: 'x', title: 'match' });
    const bodyOnly = makeBean({ id: 'x', title: 'y', body: 'match' });

    const sExact = (prov as any).scoreRelevance(exact, 'match');
    const sTitle = (prov as any).scoreRelevance(titleOnly, 'match');
    const sBody = (prov as any).scoreRelevance(bodyOnly, 'match');

    expect(sExact).toBeGreaterThan(sTitle);
    expect(sTitle).toBeGreaterThan(sBody);
  });

  it('sortByRelevance sorts by score then status/priority/title', () => {
    const svc: any = {};
    const prov = new BeansSearchViewProvider(vscode.Uri.file('/'), svc as any);
    const a = makeBean({ id: 'a', title: 'A', status: 'in-progress', priority: 'normal' });
    const b = makeBean({ id: 'b', title: 'B', status: 'todo', priority: 'critical' });
    const c = makeBean({ id: 'c', title: 'C', status: 'todo', priority: 'normal' });

    // no query -> order by status then priority then title
    const ordered = (prov as any).sortByRelevance([a, b, c], '');
    // in-progress (a) should come first
    expect(ordered[0].id).toBe('a');
    // then critical priority (b)
    expect(ordered[1].id).toBe('b');
    expect(ordered[2].id).toBe('c');
  });

  it('beanToResult falls back for unknown icons', () => {
    const svc: any = {};
    const prov = new BeansSearchViewProvider(vscode.Uri.file('/'), svc as any);
    const b = makeBean({ status: 'wxyz', type: 'unknown', priority: undefined });
    const r = (prov as any).beanToResult(b);
    expect(r.statusIcon).toBe('');
    expect(r.typeIcon).toBe('');
    expect(r.priorityIcon).toBe('');
  });

  it('handleSearch error posts empty results with error', async () => {
    const svc: any = { listBeans: vi.fn().mockRejectedValue(new Error('boom')) };
    const prov = new BeansSearchViewProvider(vscode.Uri.file('/'), svc as any);
    const posted: any[] = [];
    prov['_view'] = { webview: { postMessage: (m: any) => posted.push(m) } } as any;
    await (prov as any).handleSearch('q', { statuses: [], types: [], priorities: [] });
    expect(posted.length).toBe(1);
    expect(posted[0].beans).toEqual([]);
    expect(posted[0].error).toBeDefined();
  });
});
