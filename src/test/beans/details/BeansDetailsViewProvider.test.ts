import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansDetailsViewProvider } from '../../../beans/details/BeansDetailsViewProvider';
import type { Bean } from '../../../beans/model';

// TODO(beans-vscode-1m8d): Add deeper webview integration tests for details
// panel interactions (real DOM script execution, select-change update flows,
// visibility lifecycle races, and markdown rendering snapshots).
const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('vscode', async () => {
  return await import('../../mocks/vscode.js');
});

vi.mock('../../../beans/logging/BeansOutput', () => ({
  BeansOutput: {
    getInstance: vi.fn(() => mockLogger),
  },
}));

function makeBean(overrides: Partial<Bean> = {}): Bean {
  return {
    id: 'beans-vscode-1234',
    code: '1234',
    slug: 'bean',
    path: '.beans/beans-vscode-1234.md',
    title: 'Bean title',
    body: 'Bean **body**',
    status: 'todo',
    type: 'task',
    priority: 'normal',
    tags: ['frontend'],
    blocking: [],
    blockedBy: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    etag: 'etag',
    ...overrides,
  } as Bean;
}

describe('BeansDetailsViewProvider', () => {
  let provider: BeansDetailsViewProvider;
  let service: { showBean: ReturnType<typeof vi.fn>; updateBean: ReturnType<typeof vi.fn> };
  let receivedHandler: ((message: any) => Promise<void>) | undefined;
  let visibilityHandler: (() => void) | undefined;
  let webview: any;
  let view: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = {
      showBean: vi.fn(),
      updateBean: vi.fn(),
    };
    provider = new BeansDetailsViewProvider(vscode.Uri.file('/ext') as any, service as any);

    webview = {
      options: undefined,
      html: '',
      asWebviewUri: (uri: { path: string }) => `webview:${uri.path}`,
      onDidReceiveMessage: (handler: (message: any) => Promise<void>) => {
        receivedHandler = handler;
      },
    };
    view = {
      visible: true,
      webview,
      onDidChangeVisibility: (handler: () => void) => {
        visibilityHandler = handler;
      },
    };
  });

  it('resolves view with empty html when no selected bean', () => {
    provider.resolveWebviewView(view, {} as any, {} as any);

    expect(webview.options.enableScripts).toBe(true);
    expect(webview.options.localResourceRoots).toHaveLength(1);
    expect(webview.html).toContain('Content-Security-Policy');
    expect(webview.html).toContain('Select a bean to view details');
    expect(mockLogger.debug).toHaveBeenCalledWith('Bean details view resolved');
    expect(receivedHandler).toBeTypeOf('function');
    expect(visibilityHandler).toBeTypeOf('function');
  });

  it('shows bean details and resolves parent when available', async () => {
    const bean = makeBean({ parent: 'beans-vscode-parent' });
    const parent = makeBean({ id: 'beans-vscode-parent', code: 'PARENT', title: 'Parent bean' });
    service.showBean.mockResolvedValueOnce(bean).mockResolvedValueOnce(parent);
    const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand');

    provider.resolveWebviewView(view, {} as any, {} as any);
    await provider.showBean(bean);

    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'beans.hasSelectedBean', true);
    expect(provider.currentBean?.id).toBe(bean.id);
    expect(webview.html).toContain('Bean title');
    expect(webview.html).toContain('Parent bean');
    expect(webview.html).toContain('role="img"');
    expect(webview.html).toContain('📋');
  });

  it('falls back when full bean fetch fails', async () => {
    const partial = makeBean({ body: '', title: 'Fallback bean' });
    service.showBean.mockRejectedValue(new Error('load failed'));
    const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand');

    provider.resolveWebviewView(view, {} as any, {} as any);
    await provider.showBean(partial);

    expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch bean details', expect.any(Error));
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'beans.hasSelectedBean', true);
    expect(provider.currentBean?.title).toBe('Fallback bean');
    expect(webview.html).toContain('No description');
  });

  it('clears selected bean and resets html/context', () => {
    const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand');
    provider.resolveWebviewView(view, {} as any, {} as any);

    (provider as any)._currentBean = makeBean();
    provider.clear();

    expect(provider.currentBean).toBeUndefined();
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'beans.hasSelectedBean', false);
    expect(webview.html).toContain('Select a bean to view details');
  });

  it('updates bean via message handler and refreshes tree', async () => {
    const bean = makeBean({ id: 'beans-vscode-1', code: '1', title: 'Before' });
    const updated = makeBean({ id: 'beans-vscode-1', code: '1', title: 'After', status: 'in-progress', type: 'bug' });
    (provider as any)._currentBean = bean;
    service.updateBean.mockResolvedValue(updated);

    const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand');
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');

    provider.resolveWebviewView(view, {} as any, {} as any);
    await receivedHandler?.({ command: 'updateBean', updates: { status: 'in-progress' } });

    expect(service.updateBean).toHaveBeenCalledWith(bean.id, { status: 'in-progress' });
    expect(provider.currentBean?.title).toBe('After');
    expect(executeCommandSpy).toHaveBeenCalledWith('beans.refreshAll');
    expect(infoSpy).toHaveBeenCalledWith('Bean updated successfully');
    expect(webview.html).toContain('After');
    expect(webview.html).toContain('🐛');
  });

  it('handles update errors from message handler', async () => {
    (provider as any)._currentBean = makeBean({ id: 'beans-vscode-2' });
    service.updateBean.mockRejectedValue(new Error('update failed'));
    const errorSpy = vi.spyOn(vscode.window, 'showErrorMessage');

    provider.resolveWebviewView(view, {} as any, {} as any);
    await receivedHandler?.({ command: 'updateBean', updates: { status: 'completed' } });

    expect(mockLogger.error).toHaveBeenCalledWith('Failed to update bean', expect.any(Error));
    expect(errorSpy).toHaveBeenCalledWith('Failed to update bean: update failed');
  });

  it('updates visible view when visibility changes and bean exists', () => {
    provider.resolveWebviewView(view, {} as any, {} as any);
    (provider as any)._currentBean = makeBean({ title: 'Visible bean' });

    visibilityHandler?.();

    expect(webview.html).toContain('Visible bean');
  });

  it('renders markdown features and html escaping', () => {
    const markdown = [
      '# H1',
      '## H2',
      '### H3',
      '',
      '**bold** *italic*',
      '`inline`',
      '```block```',
      '[link](https://example.com)',
      '- item',
    ].join('\n');

    const html = (provider as any).renderMarkdown(markdown);
    expect(html).toContain('<h1>H1</h1>');
    expect(html).toContain('<h2>H2</h2>');
    expect(html).toContain('<h3>H3</h3>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>inline</code>');
    expect(html).toContain('<pre><code>block</code></pre>');
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>');
    expect(html).toContain('<ul><li>item</li></ul>');

    const escaped = (provider as any).escapeHtml('<tag>"x"&\'y\'');
    expect(escaped).toBe('&lt;tag&gt;&quot;x&quot;&amp;&#039;y&#039;');
  });

  it('does not render unsafe javascript: markdown links', () => {
    const html = (provider as any).renderMarkdown('[x](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<a href=');
    expect(html).toContain('x');
  });

  it('returns expected icon names by status/type', () => {
    expect((provider as any).getIconName(makeBean({ status: 'completed' }))).toBe('issue-closed');
    expect((provider as any).getIconName(makeBean({ status: 'scrapped' }))).toBe('error');
    expect((provider as any).getIconName(makeBean({ status: 'draft' }))).toBe('issue-draft');
    expect((provider as any).getIconName(makeBean({ status: 'in-progress', type: 'feature' }))).toBe('lightbulb');
    expect((provider as any).getIconName(makeBean({ status: 'todo', type: 'milestone' }))).toBe('milestone');
    expect((provider as any).getTypeIconName('epic')).toBe('zap');
    expect((provider as any).getTypeIconName('bug')).toBe('bug');
    expect((provider as any).getTypeIconName('unknown')).toBe('issues');
  });
});
