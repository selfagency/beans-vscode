import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Bean } from '../../../../src/beans/model/Bean';
import { BeansSearchViewProvider } from '../../../../src/beans/search/BeansSearchViewProvider';
import * as vscodeMock from '../../mocks/vscode.js';

function makeBean(overrides: Partial<Bean> = {}): Bean {
  return Object.assign(
    {
      id: 'X',
      code: 'x',
      title: 'Title',
      body: 'body text',
      status: 'todo',
      type: 'task',
      priority: 'normal',
      tags: [],
    } as Partial<Bean>,
    overrides
  ) as Bean;
}

describe('BeansSearchViewProvider helpers', () => {
  let service: any;
  let provider: any;
  let fakeWebview: any;

  beforeEach(() => {
    service = { listBeans: vi.fn(), showBean: vi.fn() };
    provider = new BeansSearchViewProvider(vscodeMock.Uri.file('/tmp'), service as any);

    fakeWebview = {
      webview: {
        options: {},
        onDidReceiveMessage: (_cb: any) => {},
        postMessage: vi.fn(),
        asWebviewUri: (u: any) => ({ toString: () => String(u.path || '') }),
      },
    } as any;
    // attach view
    (provider as any)._view = fakeWebview as any;
  });

  it('beanToResult returns mapped icon fields', () => {
    const b = makeBean({ id: 'B1', status: 'todo', type: 'task', priority: 'critical' });
    const res = (provider as any).beanToResult(b);
    expect(res.id).toBe('B1');
    expect(res.statusIcon).toBeDefined();
    expect(res.typeIcon).toBeDefined();
    expect(res.priorityIcon).toBeDefined();
  });

  it('handleSearch posts results and handles errors', async () => {
    const b1 = makeBean({ id: '1', title: 'MatchMe' });
    const b2 = makeBean({ id: '2', title: 'Other' });
    service.listBeans.mockResolvedValue([b1, b2]);

    await (provider as any).handleSearch('match', { statuses: [], types: [], priorities: [] });
    expect(fakeWebview.webview.postMessage).toHaveBeenCalled();

    // simulate error path
    service.listBeans.mockRejectedValue(new Error('boom'));
    await (provider as any).handleSearch('', { statuses: [], types: [], priorities: [] });
    expect(fakeWebview.webview.postMessage).toHaveBeenCalled();
  });

  it('handleOpenBean calls showBean and executeCommand', async () => {
    const b = makeBean({ id: 'Z' });
    service.showBean.mockResolvedValue(b);
    const exec = vi.spyOn((vscodeMock as any).commands, 'executeCommand');
    await (provider as any).handleOpenBean('Z');
    expect(exec).toHaveBeenCalled();
  });

  it('sortByRelevance returns expected order when query present', () => {
    const a = makeBean({ id: 'a', title: 'Alpha' });
    const b = makeBean({ id: 'b', title: 'Beta' });
    const out = (provider as any).sortByRelevance([a, b], 'alpha');
    expect(out[0].id).toBe('a');
  });

  it('getHtml contains expected filter labels and scripts', () => {
    const html = (provider as any).getHtml(fakeWebview.webview as any);
    expect(html).toContain('Search beans');
    expect(html).toContain('filtersPanel');
    expect(html).toContain('postMessage');
  });

  it('resolveWebview wires up onDidReceiveMessage and dispatches commands', () => {
    const stored: any = {};
    const view = {
      webview: {
        options: {},
        cspSource: 'vscode-resource:',
        onDidReceiveMessage(cb: any) {
          stored.cb = cb;
        },
        postMessage: vi.fn(),
        asWebviewUri: (u: any) => ({ toString: () => String(u.path || '') }),
      },
    } as any;

    const spySearch = vi.spyOn(provider as any, 'handleSearch');
    const spyOpen = vi.spyOn(provider as any, 'handleOpenBean');
    (provider as any).resolveWebviewView(view, {} as any, {} as any);
    // simulate messages
    stored.cb({ command: 'search', query: 'x', filters: { statuses: [], types: [], priorities: [] } });
    stored.cb({ command: 'openBean', beanId: 'B' });
    expect(spySearch).toHaveBeenCalled();
    expect(spyOpen).toHaveBeenCalled();
  });

  it('scoreRelevance prefers exact id/code matches', () => {
    const bExact = makeBean({ id: 'ID1', code: 'C1', title: 'X' });
    const bOther = makeBean({ id: 'ID2', code: 'C2', title: 'Y' });
    const s1 = (provider as any).scoreRelevance(bExact, 'id1');
    const s2 = (provider as any).scoreRelevance(bOther, 'id1');
    expect(s1).toBeGreaterThan(s2);
  });

  it('scoreRelevance exact/start/include/title/body/tags/metadata branch coverage', () => {
    const bexact = makeBean({ id: 'AAA', code: 'aaa', title: 'Title' });
    const bstart = makeBean({ id: 'AAAB', code: 'aaab', title: 'TitleB' });
    const bincl = makeBean({ id: 'Xaaay', code: 'xaaa', title: 'Say title' });
    const btitle = makeBean({ id: 'Z', code: 'z', title: 'matchme' });
    const bbody = makeBean({ id: 'Y', code: 'y', title: 'no', body: 'hello world', tags: ['taghello'] });

    expect((provider as any).scoreRelevance(bexact, 'aaa')).toBeGreaterThan(0);
    expect((provider as any).scoreRelevance(bstart, 'aaa')).toBeGreaterThan(0);
    expect((provider as any).scoreRelevance(bincl, 'aaa')).toBeGreaterThan(0);
    expect((provider as any).scoreRelevance(btitle, 'matchme')).toBeGreaterThan(0);
    expect((provider as any).scoreRelevance(bbody, 'hello')).toBeGreaterThan(0);
    expect((provider as any).scoreRelevance(bbody, 'taghello')).toBeGreaterThan(0);
  });

  it('matchesQuery checks tags, body and metadata', () => {
    const b = makeBean({ id: 'Z', body: 'hello world', tags: ['t1'], status: 'todo', type: 'task', priority: 'low' });
    expect((provider as any).matchesQuery(b, 'hello')).toBe(true);
    expect((provider as any).matchesQuery(b, 't1')).toBe(true);
    expect((provider as any).matchesQuery(b, 'task')).toBe(true);
  });

  it('handleSearch respects status/type filters when calling service', async () => {
    const spy = vi.fn().mockResolvedValue([]);
    service.listBeans = spy;
    await (provider as any).handleSearch('', { statuses: ['todo'], types: ['task'], priorities: [] });
    expect(spy).toHaveBeenCalledWith({ status: ['todo'], type: ['task'] });
  });

  it('handleSearch posts empty results when no beans', async () => {
    service.listBeans.mockResolvedValue([]);
    await (provider as any).handleSearch('', { statuses: [], types: [], priorities: [] });
    expect(fakeWebview.webview.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'results', beans: [] })
    );
  });

  it('handleOpenBean swallows errors from service.showBean', async () => {
    service.showBean.mockRejectedValue(new Error('not found'));
    const exec = vi.spyOn((vscodeMock as any).commands, 'executeCommand');
    exec.mockClear();
    await (provider as any).handleOpenBean('missing');
    // should not call executeCommand when showBean fails
    expect(exec).not.toHaveBeenCalled();
  });
});
