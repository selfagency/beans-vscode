import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansCommands } from '../../../beans/commands/BeansCommands';
import { BeansCLINotFoundError, type Bean } from '../../../beans/model';

// TODO(beans-vscode-v2n7): Deepen BeansCommands coverage with command-palette
// integration flows, richer quick-pick interaction edge cases, and exhaustive
// error-type branches across all command handlers.
const commandHandlers = vi.hoisted(() => new Map<string, (...args: any[]) => any>());
const showInputBox = vi.hoisted(() => vi.fn());
const showQuickPick = vi.hoisted(() => vi.fn());
const showInformationMessage = vi.hoisted(() => vi.fn());
const showWarningMessage = vi.hoisted(() => vi.fn());
const showErrorMessage = vi.hoisted(() => vi.fn());
const showTextDocument = vi.hoisted(() => vi.fn());
const createQuickPickMock = vi.hoisted(() => vi.fn());
const executeCommand = vi.hoisted(() => vi.fn());
const openTextDocument = vi.hoisted(() => vi.fn());
const openExternal = vi.hoisted(() => vi.fn());
const writeClipboardText = vi.hoisted(() => vi.fn());
const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  show: vi.fn(),
}));

let nextQuickPickAcceptSelection: any;

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
    static parse(path: string): Uri {
      return new Uri('file', '', path, '', '');
    }
    static joinPath(uri: Uri, ...segments: string[]): Uri {
      return new Uri(uri.scheme, uri.authority, [uri.path, ...segments].join('/'), uri.query, uri.fragment);
    }
  }

  class ThemeIcon {
    constructor(public readonly id: string) {}
  }

  return {
    Uri,
    ThemeIcon,
    ConfigurationTarget: { Workspace: 2 },
    commands: {
      registerCommand: vi.fn((name: string, handler: (...args: any[]) => any) => {
        commandHandlers.set(name, handler);
        return { dispose: vi.fn() };
      }),
      executeCommand,
    },
    workspace: {
      workspaceFolders: [{ uri: Uri.file('/ws') }],
      openTextDocument,
      getConfiguration: vi.fn(() => ({
        get: vi.fn((key: string, defaultValue?: unknown) => {
          if (key === 'hideClosedInQuickPick') {
            return true;
          }
          return defaultValue;
        }),
        update: vi.fn(async () => {}),
      })),
    },
    window: {
      showInputBox,
      showQuickPick,
      showInformationMessage,
      showWarningMessage,
      showErrorMessage,
      showTextDocument,
      createQuickPick: createQuickPickMock,
    },
    env: {
      openExternal,
      clipboard: { writeText: writeClipboardText },
    },
  };
});

vi.mock('../../../beans/logging/BeansOutput', () => ({
  BeansOutput: {
    getInstance: vi.fn(() => logger),
  },
}));

function makeBean(overrides: Partial<Bean> = {}): Bean {
  return {
    id: 'beans-vscode-1234',
    code: '1234',
    slug: 'bean',
    path: 'beans-vscode-1234.md',
    title: 'Bean title',
    body: 'body',
    status: 'todo',
    type: 'task',
    priority: 'normal',
    tags: [],
    blocking: [],
    blockedBy: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    etag: 'etag',
    ...overrides,
  } as Bean;
}

describe('BeansCommands', () => {
  let service: any;
  let previewProvider: any;
  let filterManager: any;
  let configManager: any;
  let detailsProvider: any;
  let context: any;
  let commands: BeansCommands;

  beforeEach(() => {
    vi.clearAllMocks();
    commandHandlers.clear();
    nextQuickPickAcceptSelection = undefined;

    createQuickPickMock.mockImplementation(() => {
      let acceptHandler: (() => void) | undefined;
      let hideHandler: (() => void) | undefined;
      const qp: any = {
        title: '',
        placeholder: '',
        matchOnDescription: false,
        items: [],
        buttons: [],
        selectedItems: [],
        onDidTriggerButton: vi.fn(),
        onDidAccept: vi.fn((cb: () => void) => {
          acceptHandler = cb;
        }),
        onDidHide: vi.fn((cb: () => void) => {
          hideHandler = cb;
        }),
        show: vi.fn(() => {
          if (nextQuickPickAcceptSelection !== undefined) {
            qp.selectedItems = [nextQuickPickAcceptSelection];
            acceptHandler?.();
          } else {
            hideHandler?.();
          }
        }),
        dispose: vi.fn(),
      };
      return qp;
    });

    service = {
      listBeans: vi.fn(async () => []),
      showBean: vi.fn(async (id: string) => makeBean({ id })),
      createBean: vi.fn(async () => makeBean({ code: '9999' })),
      updateBean: vi.fn(async (id: string, updates: any) => makeBean({ id, ...updates })),
      deleteBean: vi.fn(async () => undefined),
      getConfig: vi.fn(async () => ({
        statuses: ['todo', 'in-progress', 'completed', 'scrapped', 'draft'],
        types: ['milestone', 'epic', 'feature', 'bug', 'task'],
        priorities: ['critical', 'high', 'normal', 'low', 'deferred'],
      })),
    };

    previewProvider = {
      getBeanPreviewUri: vi.fn((id: string) => ({ path: `beans-preview:${id}`, query: id })),
    };

    filterManager = {
      getFilter: vi.fn(() => undefined),
      showFilterUI: vi.fn(async () => ({ text: 'new' })),
      setFilter: vi.fn(),
    };

    configManager = { open: vi.fn(async () => undefined) };
    detailsProvider = { currentBean: undefined };
    context = { subscriptions: [], extensionUri: { path: '/ext' } };

    commands = new BeansCommands(
      service,
      context as any,
      previewProvider,
      filterManager,
      configManager,
      detailsProvider
    );
  });

  it('registers command handlers and tracks disposables', () => {
    commands.registerAll();

    expect(commandHandlers.has('beans.view')).toBe(true);
    expect(commandHandlers.has('beans.create')).toBe(true);
    expect(commandHandlers.has('beans.search')).toBe(true);
    expect(context.subscriptions.length).toBeGreaterThan(5);
  });

  it('views bean preview from direct bean argument', async () => {
    const bean = makeBean();
    openTextDocument.mockResolvedValueOnce({ uri: 'doc' });

    await (commands as any).viewBean(bean);

    expect(previewProvider.getBeanPreviewUri).toHaveBeenCalledWith(bean.id);
    expect(openTextDocument).toHaveBeenCalled();
    expect(showTextDocument).toHaveBeenCalled();
  });

  it('handles CLI-not-found errors through helper path', async () => {
    previewProvider.getBeanPreviewUri.mockImplementationOnce(() => {
      throw new BeansCLINotFoundError('missing cli');
    });
    showErrorMessage.mockResolvedValueOnce('Install Instructions');

    await (commands as any).viewBean(makeBean({ id: 'abc' }));

    expect(showErrorMessage).toHaveBeenCalledWith(
      'Beans CLI not installed. Please install it first.',
      'Install Instructions'
    );
    await Promise.resolve();
    expect(openExternal).toHaveBeenCalled();
  });

  it('creates bean and refreshes trees', async () => {
    showInputBox.mockResolvedValueOnce('My bean').mockResolvedValueOnce('desc');
    showQuickPick.mockResolvedValueOnce('task');

    await (commands as any).createBean();

    expect(service.createBean).toHaveBeenCalledWith({
      title: 'My bean',
      type: 'task',
      description: 'desc',
    });
    expect(executeCommand).toHaveBeenCalledWith('beans.refreshAll');
  });

  it('updates status via quick pick', async () => {
    const bean = makeBean({ status: 'todo' });
    showQuickPick.mockResolvedValueOnce({ description: 'in-progress' });

    await (commands as any).setStatus(bean);

    expect(service.updateBean).toHaveBeenCalledWith(bean.id, { status: 'in-progress' });
  });

  it('shows no-parent message when removing parent from root bean', async () => {
    const bean = makeBean({ parent: undefined });
    await (commands as any).removeParent(bean);
    expect(showInformationMessage).toHaveBeenCalledWith(`${bean.code} has no parent`);
  });

  it('removes parent using explicit clearParent semantics', async () => {
    const bean = makeBean({ parent: 'beans-vscode-parent', code: 'ABCD' });
    showInformationMessage.mockResolvedValueOnce('Yes').mockResolvedValueOnce(undefined);

    await (commands as any).removeParent(bean);

    expect(service.updateBean).toHaveBeenCalledWith(bean.id, { clearParent: true });
    expect(executeCommand).toHaveBeenCalledWith('beans.refreshAll');
  });

  it('warns when deleting non-draft/non-scrapped bean', async () => {
    const bean = makeBean({ status: 'in-progress' });
    await (commands as any).deleteBean(bean);
    expect(showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('Only scrapped and draft beans can be deleted.')
    );
  });

  it('applies search text to all panes', async () => {
    showInputBox.mockResolvedValueOnce('auth');
    filterManager.getFilter.mockReturnValue({});

    await (commands as any).search();

    expect(filterManager.setFilter).toHaveBeenCalledWith('beans.active', { text: 'auth' });
    expect(filterManager.setFilter).toHaveBeenCalledWith('beans.archived', { text: 'auth' });
  });

  it('clears search text from panes when empty', async () => {
    showInputBox.mockResolvedValueOnce('');
    filterManager.getFilter.mockReturnValue({ text: 'old', tags: ['x'] });

    await (commands as any).search();

    expect(filterManager.setFilter).toHaveBeenCalledWith('beans.active', { tags: ['x'] });
  });

  it('changes sort mode via configuration update', async () => {
    const config = {
      update: vi.fn(async () => undefined),
    };
    (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValueOnce(config as any);
    showQuickPick.mockResolvedValueOnce({ label: 'Bean ID', value: 'id' });

    await (commands as any).sort();

    expect(config.update).toHaveBeenCalledWith('defaultSortMode', 'id', (vscode as any).ConfigurationTarget.Workspace);
    expect(executeCommand).toHaveBeenCalledWith('beans.refreshAll');
  });

  it('picks bean while excluding closed items by config', async () => {
    service.listBeans.mockResolvedValueOnce([
      makeBean({ id: 'a', code: 'A', status: 'todo' }),
      makeBean({ id: 'b', code: 'B', status: 'completed' }),
    ]);
    showQuickPick.mockResolvedValueOnce({
      bean: makeBean({ id: 'a', code: 'A', status: 'todo' }),
    });

    const selected = await (commands as any).pickBean('Pick one');

    expect(selected?.id).toBe('a');
    const items = showQuickPick.mock.calls[0][0] as Array<{ bean: Bean }>;
    expect(items.map(i => i.bean.id)).toEqual(['a']);
  });

  it('opens user guide via preview and falls back to text editor', async () => {
    executeCommand.mockRejectedValueOnce(new Error('preview failed'));
    showTextDocument.mockResolvedValueOnce(undefined);

    await (commands as any).openUserGuide();

    expect(executeCommand).toHaveBeenCalledWith('markdown.showPreview', expect.anything());
    expect(showTextDocument).toHaveBeenCalled();
  });

  it('copies bean id to clipboard', async () => {
    const bean = makeBean({ id: 'beans-vscode-7777', code: '7777' });
    await (commands as any).copyId(bean);
    expect(writeClipboardText).toHaveBeenCalledWith('beans-vscode-7777');
  });

  it('adds/removes blocking and blocked-by relationships', async () => {
    const bean = makeBean({ id: 'root', code: 'ROOT', blocking: ['x'], blockedBy: ['y'] });
    const candidate = makeBean({ id: 'z', code: 'ZED', title: 'Candidate' });
    service.listBeans.mockResolvedValue([candidate]);
    showQuickPick
      .mockResolvedValueOnce([{ bean: candidate }])
      .mockResolvedValueOnce([{ bean: makeBean({ id: 'x', code: 'X' }) }])
      .mockResolvedValueOnce([{ bean: candidate }])
      .mockResolvedValueOnce([{ bean: makeBean({ id: 'y', code: 'Y' }) }]);

    await (commands as any).addBlocking(bean);
    await (commands as any).removeBlocking(makeBean({ ...bean, blocking: ['x'] }));
    await (commands as any).addBlockedBy(bean);
    await (commands as any).removeBlockedBy(makeBean({ ...bean, blockedBy: ['y'] }));

    expect(service.updateBean).toHaveBeenCalled();
    expect(executeCommand).toHaveBeenCalledWith('beans.refreshAll');
  });
});
