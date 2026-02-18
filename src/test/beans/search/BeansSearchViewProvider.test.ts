import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import type { Bean } from '../../../beans/model';
import { BeansSearchViewProvider } from '../../../beans/search/BeansSearchViewProvider';

// TODO(beans-vscode-9q1k): Add DOM-level webview interaction tests for the
// inline script (debounce, keyboard interactions, message rendering, and
// accessibility behavior) instead of only unit-level handler coverage.
const executeCommand = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('vscode', () => {
  class Uri {
    constructor(
      public scheme: string,
      public authority: string,
      public path: string,
      public query: string,
      public fragment: string
    ) {}

    static file(path: string): Uri {
      return new Uri('file', '', path, '', '');
    }

    static joinPath(uri: Uri, ...segments: string[]): Uri {
      return new Uri(uri.scheme, uri.authority, [uri.path, ...segments].join('/'), uri.query, uri.fragment);
    }
  }

  return {
    Uri,
    commands: {
      executeCommand,
    },
  };
});

vi.mock('../../../beans/logging/BeansOutput', () => ({
  BeansOutput: {
    getInstance: vi.fn(() => mockLogger),
  },
}));

function bean(partial: Partial<Bean> & Pick<Bean, 'id' | 'title' | 'status' | 'type'>): Bean {
  return {
    code: partial.id.toUpperCase(),
    slug: partial.id,
    path: `.beans/${partial.id}.md`,
    body: '',
    priority: 'normal',
    tags: [],
    blocking: [],
    blockedBy: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    etag: `${partial.id}-etag`,
    ...partial,
  } as Bean;
}

describe('BeansSearchViewProvider', () => {
  let service: { listBeans: ReturnType<typeof vi.fn>; showBean: ReturnType<typeof vi.fn> };
  let provider: BeansSearchViewProvider;
  let postMessage: ReturnType<typeof vi.fn>;
  let receivedHandler: ((message: any) => Promise<void>) | undefined;
  let webview: any;

  beforeEach(() => {
    vi.clearAllMocks();

    service = {
      listBeans: vi.fn(),
      showBean: vi.fn(),
    };

    provider = new BeansSearchViewProvider(vscode.Uri.file('/ext') as any, service as any);

    postMessage = vi.fn();
    receivedHandler = undefined;
    webview = {
      options: undefined,
      html: '',
      postMessage,
      onDidReceiveMessage: (callback: (message: any) => Promise<void>) => {
        receivedHandler = callback;
      },
      asWebviewUri: (uri: { path: string }) => `webview:${uri.path}`,
    };
  });

  it('resolves webview, sets options/html, and logs debug', () => {
    const webviewView = { webview } as any;

    provider.resolveWebviewView(webviewView, {} as any, {} as any);

    expect(webview.options.enableScripts).toBe(true);
    expect(webview.options.localResourceRoots).toHaveLength(1);
    expect(webview.html).toContain('Search beans');
    expect(webview.html).toContain('Content-Security-Policy');
    expect(webview.html).toContain('filtersPanel');
    expect(webview.html).toContain('data-group="status"');
    expect(webview.html).toContain('class="search-icon"');
    expect(webview.html).toContain('<svg class="icon-svg"');
    expect(webview.html).toContain('--vscode-descriptionForeground');
    expect(mockLogger.debug).toHaveBeenCalledWith('Search view resolved');
    expect(receivedHandler).toBeTypeOf('function');
  });

  it('handles search with query/filters and posts sorted results', async () => {
    const b1 = bean({
      id: 'auth-1',
      title: 'Authentication issue',
      status: 'todo',
      type: 'bug',
      priority: 'high',
      body: 'login fails',
    });
    const b2 = bean({
      id: 'auth',
      title: 'Auth root',
      status: 'in-progress',
      type: 'bug',
      priority: 'critical',
    });
    const b3 = bean({
      id: 'other',
      title: 'Unrelated',
      status: 'todo',
      type: 'task',
      priority: 'low',
    });
    service.listBeans.mockResolvedValue([b1, b2, b3]);

    (provider as any)._view = { webview };
    await (provider as any).handleSearch('auth', {
      statuses: ['todo', 'in-progress'],
      types: ['bug'],
      priorities: ['high', 'critical'],
    });

    expect(service.listBeans).toHaveBeenCalledWith({ status: ['todo', 'in-progress'], type: ['bug'] });
    expect(postMessage).toHaveBeenCalledTimes(1);
    const message = postMessage.mock.calls[0][0];
    expect(message.command).toBe('results');
    expect(message.beans).toHaveLength(2);
    expect(message.beans[0].id).toBe('auth');
    expect(message.beans[0].statusIcon).toBe('play-circle');
    expect(message.beans[0].typeIcon).toBe('bug');
    expect(message.beans[0].priorityIcon).toBe('circle-large-filled');
  });

  it('handles empty query and no filters', async () => {
    const b1 = bean({ id: 'a', title: 'Alpha', status: 'todo', type: 'task', priority: 'normal' });
    service.listBeans.mockResolvedValue([b1]);

    (provider as any)._view = { webview };
    await (provider as any).handleSearch('', { statuses: [], types: [], priorities: [] });

    expect(service.listBeans).toHaveBeenCalledWith({});
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'results',
        beans: [expect.objectContaining({ id: 'a' })],
      })
    );
  });

  it('posts error payload when search fails', async () => {
    service.listBeans.mockRejectedValue(new Error('search exploded'));

    (provider as any)._view = { webview };
    await (provider as any).handleSearch('x', { statuses: [], types: [], priorities: [] });

    expect(mockLogger.error).toHaveBeenCalledWith('Search failed', expect.any(Error));
    expect(postMessage).toHaveBeenCalledWith({
      command: 'results',
      beans: [],
      error: 'search exploded',
    });
  });

  it('opens selected bean via command', async () => {
    const selected = bean({ id: 'bean-1', title: 'Open me', status: 'todo', type: 'task' });
    service.showBean.mockResolvedValue(selected);

    await (provider as any).handleOpenBean('bean-1');

    expect(service.showBean).toHaveBeenCalledWith('bean-1');
    expect(executeCommand).toHaveBeenCalledWith('beans.openBean', selected);
  });

  it('logs open-bean failures without throwing', async () => {
    service.showBean.mockRejectedValue(new Error('missing bean'));

    await expect((provider as any).handleOpenBean('missing')).resolves.toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to open bean from search', expect.any(Error));
  });

  it('dispatches received webview messages to search/open handlers', async () => {
    const webviewView = { webview } as any;
    const searchSpy = vi.spyOn(provider as any, 'handleSearch').mockResolvedValue(undefined);
    const openSpy = vi.spyOn(provider as any, 'handleOpenBean').mockResolvedValue(undefined);

    provider.resolveWebviewView(webviewView, {} as any, {} as any);
    await receivedHandler?.({
      command: 'search',
      query: 'q',
      filters: { statuses: [], types: [], priorities: [] },
    });
    await receivedHandler?.({
      command: 'openBean',
      beanId: 'bean-1',
    });
    await receivedHandler?.({ command: 'unknown' });

    expect(searchSpy).toHaveBeenCalledWith('q', { statuses: [], types: [], priorities: [] });
    expect(openSpy).toHaveBeenCalledWith('bean-1');
  });
});
