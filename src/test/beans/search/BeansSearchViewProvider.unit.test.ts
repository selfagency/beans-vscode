import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansSearchViewProvider } from '../../../beans/search/BeansSearchViewProvider';

vi.mock('vscode');
vi.mock('../../../beans/logging/BeansOutput', () => ({
  BeansOutput: { getInstance: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));

describe('BeansSearchViewProvider', () => {
  let provider: BeansSearchViewProvider;
  let service: any;
  let posted: any = null;

  beforeEach(() => {
    vi.clearAllMocks();
    posted = null;
    service = {
      listBeans: vi.fn(async () => [
        { id: 'a', code: 'A', title: 'Alpha', status: 'todo', type: 'task', priority: 'normal', tags: [], body: '' },
        {
          id: 'b',
          code: 'B',
          title: 'Beta',
          status: 'in-progress',
          type: 'feature',
          priority: 'high',
          tags: ['x'],
          body: 'contains',
        },
      ]),
      showBean: vi.fn(async (id: string) => ({ id, code: id.toUpperCase(), title: 'T', status: 'todo', type: 'task' })),
    };

    provider = new BeansSearchViewProvider(vscode.Uri.file('/ext'), service as any);
    // assign fake view
    (provider as any)._view = {
      webview: {
        postMessage: (m: any) => {
          posted = m;
        },
      },
    } as any;
  });

  it('handleSearch posts results and respects filters and query', async () => {
    await (provider as any).handleSearch('alpha', { statuses: [], types: [], priorities: [] });
    expect(posted).toBeTruthy();
    expect(posted.command).toBe('results');
    expect(Array.isArray(posted.beans)).toBe(true);
    // query 'alpha' should match title 'Alpha'
    expect(posted.beans.some((b: any) => b.title === 'Alpha')).toBe(true);
  });

  it('handleSearch posts empty results when no matches and returns error when service throws', async () => {
    (service.listBeans as any).mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    await (provider as any).handleSearch('', { statuses: [], types: [], priorities: [] });
    expect(posted).toBeTruthy();
    expect(posted.command).toBe('results');
    expect(posted.beans).toEqual([]);

    // test handleOpenBean triggers command
    const exec = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined as any);
    await (provider as any).handleOpenBean('a');
    expect(exec).toHaveBeenCalled();
  });

  it('getHtml returns a string containing expected elements', () => {
    const fakeWebview: any = {
      asWebviewUri: (_u: any) => 'uri:dummy',
      cspSource: 'vscode-resource:',
    };
    const html = (provider as any).getHtml(fakeWebview);
    expect(html).toContain('Search beans');
    expect(html).toContain('searchInput');
    expect(html).toContain('resultsContainer');
  });
});
