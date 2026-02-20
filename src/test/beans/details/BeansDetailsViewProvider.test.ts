import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansDetailsViewProvider } from '../../../beans/details/BeansDetailsViewProvider';
import type { Bean } from '../../../beans/model';
import type { BeansService } from '../../../beans/service';

/** Type helper for accessing private members of BeansDetailsViewProvider in tests. */
type ProviderPrivate = {
  _currentBean: Bean | undefined;
  renderMarkdown(md: string): string;
  escapeHtml(s: string): string;
  normalizeEscapedNewlinesOutsideCodeBlocks(input: string): string;
  getIconName(bean: Bean): string;
  getTypeIconName(type: string): string;
};

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
  const resolveContext = {} as vscode.WebviewViewResolveContext<unknown>;
  const cancellationToken = {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: () => {} }),
  } as vscode.CancellationToken;
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
    provider = new BeansDetailsViewProvider(
      vscode.Uri.file('/ext') as unknown as vscode.Uri,
      service as unknown as BeansService
    );

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
    provider.resolveWebviewView(view, resolveContext, cancellationToken);

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

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await provider.showBean(bean);

    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'beans.hasSelectedBean', true);
    expect(provider.currentBean?.id).toBe(bean.id);
    expect(webview.html).toContain('Bean title');
    expect(webview.html).toContain('Parent bean');
    expect(webview.html).toContain('class="bean-ref parent-ref"');
    expect(webview.html).toContain('data-bean-id="beans-vscode-parent"');
    expect(webview.html).toContain('role="img"');
    expect(webview.html).toContain('codicon codicon-list-unordered');
    expect(webview.html).toContain('class="parent-code">PARENT</span></a> <span class="parent-title"');
    expect(provider.canGoBack).toBe(false);
  });

  it('renders unresolved parent as clickable reference using parent id', async () => {
    const bean = makeBean({ parent: 'beans-vscode-parent' });
    service.showBean.mockResolvedValueOnce(bean).mockRejectedValueOnce(new Error('parent missing'));

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await provider.showBean(bean);

    expect(webview.html).toContain('class="bean-ref parent-ref"');
    expect(webview.html).toContain('data-bean-id="beans-vscode-parent"');
  });

  it('auto-links referenced bean ids in markdown body without mutating source markdown', async () => {
    const bean = makeBean({
      id: 'beans-vscode-100',
      code: '100',
      body: 'Depends on beans-vscode-200 and beans-vscode-300.',
    });
    service.showBean.mockResolvedValueOnce(bean);

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await provider.showBean(bean);

    expect(webview.html).toContain('class="bean-ref"');
    expect(webview.html).toContain('data-bean-id="beans-vscode-200"');
    expect(webview.html).toContain('data-bean-id="beans-vscode-300"');
    expect(webview.html).not.toContain('data-bean-id="beans-vscode-100"');
    expect(bean.body).toBe('Depends on beans-vscode-200 and beans-vscode-300.');
  });

  it('tracks navigation history after internal reference navigation and supports going back', async () => {
    const first = makeBean({ id: 'beans-vscode-10', code: '10', title: 'First bean', body: 'See beans-vscode-20' });
    const second = makeBean({ id: 'beans-vscode-20', code: '20', title: 'Second bean' });

    service.showBean.mockResolvedValueOnce(first).mockResolvedValueOnce(second).mockResolvedValueOnce(first);
    const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand');

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await provider.showBean(first);
    expect(webview.html).toContain('First bean');
    expect(provider.canGoBack).toBe(false);

    await receivedHandler?.({ command: 'openBeanFromReference', beanId: 'beans-vscode-20' });
    expect(webview.html).toContain('Second bean');
    expect(provider.canGoBack).toBe(true);
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'beans.detailsCanGoBack', true);

    await provider.goBackFromHistory();
    expect(webview.html).toContain('First bean');
    expect(provider.canGoBack).toBe(false);
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'beans.detailsCanGoBack', false);
  });

  it('navigates to parent from clickable header reference and supports going back', async () => {
    const child = makeBean({
      id: 'beans-vscode-child',
      code: 'CHILD',
      title: 'Child bean',
      parent: 'beans-vscode-parent',
    });
    const parent = makeBean({
      id: 'beans-vscode-parent',
      code: 'PARENT',
      title: 'Parent bean',
      body: 'Top level bean',
    });

    // showBean(child) -> child + resolved parent, open parent from link -> parent,
    // goBack -> child + resolved parent again
    service.showBean
      .mockResolvedValueOnce(child)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(child)
      .mockResolvedValueOnce(parent);

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await provider.showBean(child);

    expect(webview.html).toContain('Child bean');
    expect(webview.html).toContain('class="bean-ref parent-ref"');
    expect(webview.html).toContain('data-bean-id="beans-vscode-parent"');
    expect(provider.canGoBack).toBe(false);

    // Simulate clicking the parent link in the webview script by posting same message.
    await receivedHandler?.({ command: 'openBeanFromReference', beanId: 'beans-vscode-parent' });
    expect(webview.html).toContain('Parent bean');
    expect(provider.canGoBack).toBe(true);

    await provider.goBackFromHistory();
    expect(webview.html).toContain('Child bean');
    expect(provider.canGoBack).toBe(false);
  });

  it('falls back when full bean fetch fails', async () => {
    const partial = makeBean({ body: '', title: 'Fallback bean' });
    service.showBean.mockRejectedValue(new Error('load failed'));
    const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand');

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await provider.showBean(partial);

    expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch bean details', expect.any(Error));
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'beans.hasSelectedBean', true);
    expect(provider.currentBean?.title).toBe('Fallback bean');
    expect(webview.html).toContain('No description');
  });

  it('clears selected bean and resets html/context', async () => {
    const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand');
    provider.resolveWebviewView(view, resolveContext, cancellationToken);

    const providerWithPrivate = provider as unknown as { _currentBean: Bean | undefined };
    providerWithPrivate._currentBean = makeBean();
    provider.clear();

    await vi.waitFor(() => {
      expect(provider.currentBean).toBeUndefined();
      expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'beans.hasSelectedBean', false);
      expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'beans.detailsCanGoBack', false);
      expect(webview.html).toContain('Select a bean to view details');
    });
  });

  it('registers a details file watcher and disposes the previous watcher on bean switch', async () => {
    const beanOne = makeBean({ id: 'beans-vscode-watch-1', code: 'watch-1', path: 'beans-vscode-watch-1.md' });
    const beanTwo = makeBean({ id: 'beans-vscode-watch-2', code: 'watch-2', path: 'beans-vscode-watch-2.md' });

    service.showBean.mockResolvedValueOnce(beanOne).mockResolvedValueOnce(beanTwo);

    const firstWatcherDispose = vi.fn();
    const secondWatcherDispose = vi.fn();
    const createFileSystemWatcherSpy = vi
      .spyOn(vscode.workspace, 'createFileSystemWatcher')
      .mockReturnValueOnce({
        onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
        onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
        onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
        dispose: firstWatcherDispose,
      } as any)
      .mockReturnValueOnce({
        onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
        onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
        onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
        dispose: secondWatcherDispose,
      } as any);

    (
      vscode.workspace as unknown as { workspaceFolders?: Array<{ uri: vscode.Uri; name: string; index: number }> }
    ).workspaceFolders = [{ uri: vscode.Uri.file('/workspace') as unknown as vscode.Uri, name: 'workspace', index: 0 }];

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await provider.showBean(beanOne);
    await provider.showBean(beanTwo);

    expect(createFileSystemWatcherSpy).toHaveBeenCalledTimes(2);
    expect(firstWatcherDispose).toHaveBeenCalledTimes(1);
    expect(secondWatcherDispose).not.toHaveBeenCalled();
  });

  it('refreshes details after watched file changes for the active bean', async () => {
    vi.useFakeTimers();
    try {
      const initialBean = makeBean({
        id: 'beans-vscode-watch-refresh',
        code: 'watch-refresh',
        path: 'beans-vscode-watch-refresh.md',
        title: 'Before watch refresh',
      });
      const refreshedBean = makeBean({
        id: 'beans-vscode-watch-refresh',
        code: 'watch-refresh',
        path: 'beans-vscode-watch-refresh.md',
        title: 'After watch refresh',
      });

      service.showBean.mockResolvedValueOnce(initialBean).mockResolvedValueOnce(refreshedBean);

      let onDidChangeHandler: (() => void) | undefined;
      vi.spyOn(vscode.workspace, 'createFileSystemWatcher').mockReturnValue({
        onDidChange: vi.fn((handler: () => void) => {
          onDidChangeHandler = handler;
          return { dispose: vi.fn() };
        }),
        onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
        onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
        dispose: vi.fn(),
      } as any);

      (
        vscode.workspace as unknown as { workspaceFolders?: Array<{ uri: vscode.Uri; name: string; index: number }> }
      ).workspaceFolders = [
        { uri: vscode.Uri.file('/workspace') as unknown as vscode.Uri, name: 'workspace', index: 0 },
      ];

      provider.resolveWebviewView(view, resolveContext, cancellationToken);
      await provider.showBean(initialBean);

      expect(onDidChangeHandler).toBeTypeOf('function');
      onDidChangeHandler?.();

      vi.advanceTimersByTime(250);
      await vi.waitFor(() => {
        expect(service.showBean).toHaveBeenCalledTimes(2);
        expect(webview.html).toContain('After watch refresh');
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('updates bean via message handler and refreshes tree', async () => {
    const bean = makeBean({ id: 'beans-vscode-1', code: '1', title: 'Before' });
    const updated = makeBean({ id: 'beans-vscode-1', code: '1', title: 'After', status: 'in-progress', type: 'bug' });
    (provider as unknown as ProviderPrivate)._currentBean = bean;
    service.updateBean.mockResolvedValue(updated);

    const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand');
    const infoSpy = vi.spyOn(vscode.window, 'showInformationMessage');

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await receivedHandler?.({ command: 'updateBean', updates: { status: 'in-progress' } });

    expect(service.updateBean).toHaveBeenCalledWith(bean.id, { status: 'in-progress' });
    expect(provider.currentBean?.title).toBe('After');
    expect(executeCommandSpy).toHaveBeenCalledWith('beans.refreshAll');
    expect(infoSpy).toHaveBeenCalledWith('Bean updated successfully');
    expect(webview.html).toContain('After');
    expect(webview.html).toContain('codicon codicon-play-circle');
  });

  it('toggles checklist item via webview message and refreshes bean details', async () => {
    const bean = makeBean({
      id: 'beans-vscode-checklist',
      code: 'checklist',
      path: 'beans-vscode-checklist.md',
      body: '- [ ] first task\n- [x] second task',
    });
    (provider as unknown as ProviderPrivate)._currentBean = bean;
    service.showBean.mockResolvedValueOnce({
      ...bean,
      body: '- [x] first task\n- [x] second task',
    });

    const lineTexts = ['---', 'id: beans-vscode-checklist', '---', '- [ ] first task', '- [x] second task'];
    const saveSpy = vi.fn().mockResolvedValue(true);
    const openTextDocumentSpy = vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue({
      lineCount: lineTexts.length,
      getText: () => lineTexts.join('\n'),
      lineAt: (index: number) => ({
        text: lineTexts[index],
        range: {
          start: { line: index, character: 0 },
          end: { line: index, character: lineTexts[index].length },
        },
      }),
      save: saveSpy,
    } as any);
    const applyEditSpy = vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);
    const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand');

    (vscode.workspace as unknown as { workspaceFolders?: Array<{ uri: vscode.Uri }> }).workspaceFolders = [
      { uri: vscode.Uri.file('/workspace') as unknown as vscode.Uri },
    ];

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await receivedHandler?.({ command: 'toggleChecklist', lineIndex: 0, checked: true });

    expect(openTextDocumentSpy).toHaveBeenCalledTimes(1);
    expect(applyEditSpy).toHaveBeenCalledTimes(1);
    const workspaceEdit = applyEditSpy.mock.calls[0][0] as unknown as { edits?: Array<{ newText: string }> };
    expect(workspaceEdit.edits?.[0]?.newText).toBe('- [x] first task');
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(service.showBean).toHaveBeenCalledWith('beans-vscode-checklist');
    expect(executeCommandSpy).toHaveBeenCalledWith('beans.refreshAll');
    expect(webview.html).toContain('data-line-index="0"');
    expect(webview.html).toContain('checked><span class="checklist-label">first task</span>');
  });

  it('does not apply edits when checklist is already in the requested state', async () => {
    const bean = makeBean({
      id: 'beans-vscode-checklist-idempotent',
      code: 'checklist-idempotent',
      path: 'beans-vscode-checklist-idempotent.md',
      body: '- [x] already checked',
    });
    (provider as unknown as ProviderPrivate)._currentBean = bean;

    const lineTexts = ['---', 'id: beans-vscode-checklist-idempotent', '---', '- [x] already checked'];
    const saveSpy = vi.fn().mockResolvedValue(true);
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue({
      lineCount: lineTexts.length,
      getText: () => lineTexts.join('\n'),
      lineAt: (index: number) => ({
        text: lineTexts[index],
        range: {
          start: { line: index, character: 0 },
          end: { line: index, character: lineTexts[index].length },
        },
      }),
      save: saveSpy,
    } as any);
    const applyEditSpy = vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);
    const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand');

    (vscode.workspace as unknown as { workspaceFolders?: Array<{ uri: vscode.Uri }> }).workspaceFolders = [
      { uri: vscode.Uri.file('/workspace') as unknown as vscode.Uri },
    ];

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await receivedHandler?.({ command: 'toggleChecklist', lineIndex: 0, checked: true });

    expect(applyEditSpy).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
    expect(service.showBean).not.toHaveBeenCalled();
    expect(executeCommandSpy).not.toHaveBeenCalledWith('beans.refreshAll');
  });

  it('orders details select options for status/type and adds spacing on priority labels', async () => {
    const bean = makeBean({
      id: 'beans-vscode-ordering',
      code: 'ordering',
      path: 'beans-vscode-ordering.md',
    });
    service.showBean.mockResolvedValueOnce(bean);

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await provider.showBean(bean);

    const statusDraft = webview.html.indexOf('&quot;value&quot;:&quot;draft&quot;');
    const statusTodo = webview.html.indexOf('&quot;value&quot;:&quot;todo&quot;');
    expect(statusDraft).toBeGreaterThan(-1);
    expect(statusTodo).toBeGreaterThan(-1);
    expect(statusDraft).toBeLessThan(statusTodo);

    const typeMilestone = webview.html.indexOf('&quot;value&quot;:&quot;milestone&quot;');
    const typeTask = webview.html.indexOf('&quot;value&quot;:&quot;task&quot;');
    const typeBug = webview.html.indexOf('&quot;value&quot;:&quot;bug&quot;');
    expect(typeMilestone).toBeGreaterThan(-1);
    expect(typeTask).toBeGreaterThan(-1);
    expect(typeBug).toBeGreaterThan(-1);
    expect(typeMilestone).toBeLessThan(typeTask);
    expect(typeTask).toBeLessThan(typeBug);

    expect(webview.html).toContain('&quot;label&quot;:&quot;&amp;nbsp;① Critical&quot;');
    expect(webview.html).toContain('&quot;label&quot;:&quot;&amp;nbsp;③ Normal&quot;');
    expect(webview.html).toContain('&quot;label&quot;:&quot;&amp;nbsp;⑤ Deferred&quot;');
  });

  it('handles update errors from message handler', async () => {
    (provider as unknown as ProviderPrivate)._currentBean = makeBean({ id: 'beans-vscode-2' });
    service.updateBean.mockRejectedValue(new Error('update failed'));
    const errorSpy = vi.spyOn(vscode.window, 'showErrorMessage');

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await receivedHandler?.({ command: 'updateBean', updates: { status: 'completed' } });

    expect(mockLogger.error).toHaveBeenCalledWith('Failed to update bean', expect.any(Error));
    expect(errorSpy).toHaveBeenCalledWith('Failed to update bean: update failed');
  });

  it('updates visible view when visibility changes and bean exists', () => {
    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    (provider as unknown as ProviderPrivate)._currentBean = makeBean({ title: 'Visible bean' });

    visibilityHandler?.();

    expect(webview.html).toContain('Visible bean');
  });

  it('renders checklist markdown items as checkbox controls', () => {
    const markdown = ['- [ ] unchecked task', '- [x] checked task', '- plain bullet'].join('\n');

    const html = (provider as unknown as ProviderPrivate).renderMarkdown(markdown);

    expect(html).toContain('class="checklist-item"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('data-line-index="0"');
    expect(html).toContain('data-line-index="1"');
    expect(html).toContain('unchecked task');
    expect(html).toContain('checked task');
    expect(html).toContain('<li>plain bullet</li>');
  });

  it('renders indented and empty-label checklist items as checkbox controls', () => {
    const markdown = ['  - [ ] indented task', '- [x] ', '- [ ]'].join('\n');

    const html = (provider as unknown as ProviderPrivate).renderMarkdown(markdown);

    expect(html).toContain('data-line-index="0"');
    expect(html).toContain('data-line-index="1"');
    expect(html).toContain('indented task');
    expect(html).toContain('checked><span class="checklist-label"></span>');
    expect(html).not.toContain('data-line-index="2"');
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

    const html = (provider as unknown as ProviderPrivate).renderMarkdown(markdown);
    expect(html).toContain('<h1>H1</h1>');
    expect(html).toContain('<h2>H2</h2>');
    expect(html).toContain('<h3>H3</h3>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>inline</code>');
    expect(html).toContain('<pre><code>block</code></pre>');
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a>');
    expect(html).toContain('<ul><li>item</li></ul>');

    const escaped = (provider as unknown as ProviderPrivate).escapeHtml('<tag>"x"&\'y\'');
    expect(escaped).toBe('&lt;tag&gt;&quot;x&quot;&amp;&#039;y&#039;');
  });

  it('does not render unsafe javascript: markdown links', () => {
    const html = (provider as unknown as ProviderPrivate).renderMarkdown('[x](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<a href=');
    expect(html).toContain('x');
  });

  it('normalizes escaped newline literals outside fenced code blocks only', () => {
    const input = [
      'Goal\\nRename generated instructions.',
      '',
      '## Checklist\\n- [ ] Update path',
      '```md',
      'literal\\ninside code',
      '```',
      'Tail\\nline',
    ].join('\n');

    const normalized = (provider as unknown as ProviderPrivate).normalizeEscapedNewlinesOutsideCodeBlocks(input);

    expect(normalized).toContain('Goal\nRename generated instructions.');
    expect(normalized).toContain('## Checklist\n- [ ] Update path');
    expect(normalized).toContain('Tail\nline');
    expect(normalized).toContain('literal\\ninside code');
  });

  it('renders malformed issue text with proper line breaks in details view', async () => {
    const malformedBean = makeBean({
      body: 'Goal\\nRename generated file.\\n\\n## Checklist\\n- [ ] Update constant',
    });
    service.showBean.mockResolvedValueOnce(malformedBean);

    provider.resolveWebviewView(view, resolveContext, cancellationToken);
    await provider.showBean(malformedBean);

    expect(webview.html).toContain('Goal');
    expect(webview.html).toContain('<h2>Checklist</h2>');
    expect(webview.html).not.toContain('Goal\\nRename generated file');
  });

  it('returns expected icon names by type and status', () => {
    // For todo status, icon is type-based
    expect((provider as unknown as ProviderPrivate).getIconName(makeBean({ type: 'task' }))).toBe('list-unordered');
    expect((provider as unknown as ProviderPrivate).getIconName(makeBean({ type: 'bug' }))).toBe('bug');
    expect((provider as unknown as ProviderPrivate).getIconName(makeBean({ type: 'feature' }))).toBe('lightbulb');
    expect((provider as unknown as ProviderPrivate).getIconName(makeBean({ type: 'epic' }))).toBe('zap');
    expect((provider as unknown as ProviderPrivate).getIconName(makeBean({ type: 'milestone' }))).toBe('milestone');
    // For non-todo statuses, icon is status-based (matching BeanTreeItem)
    expect((provider as unknown as ProviderPrivate).getIconName(makeBean({ status: 'completed' }))).toBe(
      'issue-closed'
    );
    expect((provider as unknown as ProviderPrivate).getIconName(makeBean({ status: 'in-progress' }))).toBe(
      'play-circle'
    );
    expect((provider as unknown as ProviderPrivate).getIconName(makeBean({ status: 'scrapped' }))).toBe('stop');
    expect((provider as unknown as ProviderPrivate).getIconName(makeBean({ status: 'draft' }))).toBe('issue-draft');
    // getTypeIconName always returns type-based icon name
    expect((provider as unknown as ProviderPrivate).getTypeIconName('epic')).toBe('zap');
    expect((provider as unknown as ProviderPrivate).getTypeIconName('bug')).toBe('bug');
    expect((provider as unknown as ProviderPrivate).getTypeIconName('unknown')).toBe('list-unordered');
  });
});
