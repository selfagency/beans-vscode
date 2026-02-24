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

describe('BeansSearchViewProvider branch coverage', () => {
  let service: any;
  let provider: any;
  let fakeWebview: any;

  beforeEach(() => {
    service = { listBeans: vi.fn(), showBean: vi.fn() };
    provider = new BeansSearchViewProvider(
      vscodeMock.Uri.file('/tmp') as unknown as import('vscode').Uri,
      service as any
    );
    fakeWebview = {
      webview: {
        options: {},
        onDidReceiveMessage: (_cb: any) => {},
        postMessage: vi.fn(),
        asWebviewUri: (u: any) => ({ toString: () => String(u.path || '') }),
      },
    } as any;
    (provider as any)._view = fakeWebview as any;
  });

  it('handleSearch applies client-side priority filter when priorities provided', async () => {
    const a = makeBean({ id: '1', priority: 'critical' });
    const b = makeBean({ id: '2', priority: 'low' });
    service.listBeans.mockResolvedValue([a, b]);
    await (provider as any).handleSearch('', { statuses: [], types: [], priorities: ['critical'] });
    expect(fakeWebview.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'results' }));
    const posted = (fakeWebview.webview.postMessage as any).mock.calls.pop()[0];
    expect(posted.beans.length).toBe(1);
    expect(posted.beans[0].id).toBe('1');
  });

  it('handleSearch with query sorts by relevance and returns results', async () => {
    const a = makeBean({ id: '1', title: 'MatchMe' });
    const b = makeBean({ id: '2', title: 'Other' });
    service.listBeans.mockResolvedValue([a, b]);
    await (provider as any).handleSearch('match', { statuses: [], types: [], priorities: [] });
    const posted = (fakeWebview.webview.postMessage as any).mock.calls.pop()[0];
    expect(posted.beans[0].id).toBe('1');
  });

  it('beanToResult covers missing priority -> empty priorityIcon branch', () => {
    const b = makeBean({ id: '3', priority: undefined as any });
    const r = (provider as any).beanToResult(b);
    expect(r.priorityIcon).toBe('');
  });
});
