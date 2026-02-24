import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansCommands } from '../../../beans/commands/BeansCommands';
import { BeansCLINotFoundError, type Bean } from '../../../beans/model';

const buildBeansCopilotInstructions = vi.hoisted(() => vi.fn(() => 'instructions content'));
const writeBeansCopilotInstructions = vi.hoisted(() =>
  vi.fn(async () => '/ws/.github/instructions/tasks.instructions.md')
);
const buildBeansCopilotSkill = vi.hoisted(() => vi.fn(() => 'skill content'));
const writeBeansCopilotSkill = vi.hoisted(() => vi.fn(async () => '/ws/.github/skills/beans/SKILL.md'));

vi.mock('../../../beans/config', () => ({
  BeansConfigManager: vi.fn(() => ({ open: vi.fn(async () => undefined) })),
  buildBeansCopilotInstructions,
  writeBeansCopilotInstructions,
  buildBeansCopilotSkill,
  writeBeansCopilotSkill,
  COPILOT_INSTRUCTIONS_RELATIVE_PATH: '.github/instructions/tasks.instructions.md',
  COPILOT_SKILL_RELATIVE_PATH: '.github/skills/beans/SKILL.md',
  removeBeansCopilotSkill: vi.fn(async () => undefined),
}));

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
const createWebviewPanel = vi.hoisted(() => vi.fn());
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

vi.mock('vscode', () => {
  class Uri {
    constructor(
      public scheme: string,
      public authority: string,
      public path: string,
      public query: string,
      public fragment: string
    ) {}
    get fsPath(): string {
      return this.path;
    }
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
    ViewColumn: { One: 1 },
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
      createWebviewPanel,
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
    createQuickPickMock.mockImplementation(() => {
      let hideHandler: (() => void) | undefined;
      const qp: any = {
        title: '',
        placeholder: '',
        matchOnDescription: false,
        items: [],
        buttons: [],
        selectedItems: [],
        onDidTriggerButton: vi.fn(),
        onDidAccept: vi.fn(),
        onDidHide: vi.fn((cb: () => void) => {
          hideHandler = cb;
        }),
        show: vi.fn(() => {
          hideHandler?.();
        }),
        dispose: vi.fn(),
      };
      return qp;
    });

    createWebviewPanel.mockImplementation(() => {
      const panel: any = {
        webview: { html: '' },
        dispose: vi.fn(),
      };
      return panel;
    });

    service = {
      listBeans: vi.fn(async () => []),
      showBean: vi.fn(async (id: string) => makeBean({ id })),
      createBean: vi.fn(async () => makeBean({ code: '9999' })),
      updateBean: vi.fn(async (id: string, updates: any) => makeBean({ id, ...updates })),
      deleteBean: vi.fn(async () => undefined),
      getConfig: vi.fn(async () => ({
        default_status: 'draft',
        statuses: ['todo', 'in-progress', 'completed', 'scrapped', 'draft'],
        types: ['milestone', 'epic', 'feature', 'bug', 'task'],
        priorities: ['critical', 'high', 'normal', 'low', 'deferred'],
      })),
      graphqlSchema: vi.fn(async () => 'type Query { beans: [Bean] }'),
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
      context as unknown as vscode.ExtensionContext,
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
    showQuickPick.mockResolvedValueOnce({ description: 'task' });

    await (commands as any).createBean();

    expect(service.createBean).toHaveBeenCalledWith({
      title: 'My bean',
      type: 'task',
      status: 'draft',
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

  it('shows iconized status labels in status picker', async () => {
    const bean = makeBean({ status: 'todo' });
    showQuickPick.mockResolvedValueOnce(undefined);

    await (commands as any).setStatus(bean);

    const items = showQuickPick.mock.calls[0][0] as Array<{ label: string; description?: string }>;
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '$(issues) Todo', description: 'todo' }),
        expect.objectContaining({ label: '$(play-circle) In Progress', description: 'in-progress' }),
        expect.objectContaining({ label: '$(issue-closed) Completed', description: 'completed' }),
        expect.objectContaining({ label: '$(issue-draft) Draft', description: 'draft' }),
        expect.objectContaining({ label: '$(stop) Scrapped', description: 'scrapped' }),
      ])
    );
  });

  it('shows iconized type labels in type picker', async () => {
    const bean = makeBean({ type: 'task' });
    showQuickPick.mockResolvedValueOnce(undefined);

    await (commands as any).setType(bean);

    const items = showQuickPick.mock.calls[0][0] as Array<{ label: string; description?: string }>;
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '$(milestone) Milestone', description: 'milestone' }),
        expect.objectContaining({ label: '$(zap) Epic', description: 'epic' }),
        expect.objectContaining({ label: '$(lightbulb) Feature', description: 'feature' }),
        expect.objectContaining({ label: '$(bug) Bug', description: 'bug' }),
        expect.objectContaining({ label: '$(list-unordered) Task', description: 'task' }),
      ])
    );
  });

  it('shows standardized priority labels in priority picker', async () => {
    const bean = makeBean({ priority: 'normal' });
    showQuickPick.mockResolvedValueOnce(undefined);

    await (commands as any).setPriority(bean);

    const items = showQuickPick.mock.calls[0][0] as Array<{ label: string; description?: string }>;
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '① Critical', description: 'critical' }),
        expect.objectContaining({ label: '② High', description: 'high' }),
        expect.objectContaining({ label: '③ Normal', description: 'normal' }),
        expect.objectContaining({ label: '④ Low', description: 'low' }),
        expect.objectContaining({ label: '⑤ Deferred', description: 'deferred' }),
      ])
    );
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

  it('deletes parent and all children when user selects Delete All', async () => {
    const parent = makeBean({ id: 'parent-1', code: 'P1', status: 'draft', title: 'Parent' });
    const child1 = makeBean({ id: 'child-1', code: 'C1', parent: 'parent-1', status: 'todo' });
    const child2 = makeBean({ id: 'child-2', code: 'C2', parent: 'parent-1', status: 'todo' });
    service.listBeans.mockResolvedValueOnce([parent, child1, child2]);
    showWarningMessage.mockResolvedValueOnce('Delete All');

    await (commands as any).deleteBean(parent);

    expect(service.deleteBean).toHaveBeenCalledWith('child-1');
    expect(service.deleteBean).toHaveBeenCalledWith('child-2');
    expect(service.deleteBean).toHaveBeenCalledWith('parent-1');
    expect(executeCommand).toHaveBeenCalledWith('beans.refreshAll');
  });

  it('aborts parent delete when at least one child delete fails', async () => {
    const parent = makeBean({ id: 'parent-2', code: 'P2', status: 'scrapped', title: 'Parent' });
    const child1 = makeBean({ id: 'child-3', code: 'C3', parent: 'parent-2', status: 'todo' });
    const child2 = makeBean({ id: 'child-4', code: 'C4', parent: 'parent-2', status: 'todo' });
    service.listBeans.mockResolvedValueOnce([parent, child1, child2]);
    showWarningMessage.mockResolvedValueOnce('Delete All');
    service.deleteBean.mockImplementation(async (id: string) => {
      if (id === 'child-4') {
        throw new Error('delete failed');
      }
      return undefined;
    });
    showErrorMessage.mockResolvedValueOnce('Show Output');

    await (commands as any).deleteBean(parent);
    await Promise.resolve();

    expect(showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Parent delete aborted'), 'Show Output');
    expect(logger.show).toHaveBeenCalled();
    expect(service.deleteBean).not.toHaveBeenCalledWith('parent-2');
  });

  it('orphans children then deletes parent when user selects Delete Parent Only', async () => {
    const parent = makeBean({ id: 'parent-3', code: 'P3', status: 'draft', title: 'Parent' });
    const child = makeBean({ id: 'child-5', code: 'C5', parent: 'parent-3', status: 'todo' });
    service.listBeans.mockResolvedValueOnce([parent, child]);
    showWarningMessage.mockResolvedValueOnce('Delete Parent Only');

    await (commands as any).deleteBean(parent);

    expect(service.updateBean).toHaveBeenCalledWith('child-5', { clearParent: true });
    expect(service.deleteBean).toHaveBeenCalledWith('parent-3');
    expect(executeCommand).toHaveBeenCalledWith('beans.refreshAll');
  });

  it('aborts parent delete when child orphaning fails', async () => {
    const parent = makeBean({ id: 'parent-4', code: 'P4', status: 'scrapped', title: 'Parent' });
    const child = makeBean({ id: 'child-6', code: 'C6', parent: 'parent-4', status: 'todo' });
    service.listBeans.mockResolvedValueOnce([parent, child]);
    showWarningMessage.mockResolvedValueOnce('Delete Parent Only');
    service.updateBean.mockRejectedValueOnce(new Error('orphan failed'));
    showErrorMessage.mockResolvedValueOnce('Show Output');

    await (commands as any).deleteBean(parent);
    await Promise.resolve();

    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed to orphan child beans'),
      'Show Output'
    );
    expect(logger.show).toHaveBeenCalled();
    expect(service.deleteBean).not.toHaveBeenCalledWith('parent-4');
  });

  it('cancels child handling prompt when modal is dismissed', async () => {
    const parent = makeBean({ id: 'parent-5', code: 'P5', status: 'draft', title: 'Parent' });
    const child = makeBean({ id: 'child-7', code: 'C7', parent: 'parent-5', status: 'todo' });
    service.listBeans.mockResolvedValueOnce([parent, child]);
    showWarningMessage.mockResolvedValueOnce(undefined);

    await (commands as any).deleteBean(parent);

    expect(service.deleteBean).not.toHaveBeenCalledWith('parent-5');
  });

  it('uses delete confirmation flow when bean has no children', async () => {
    const parent = makeBean({ id: 'parent-7', code: 'P7', status: 'draft', title: 'No Children Parent' });
    service.listBeans.mockResolvedValueOnce([parent]);
    showWarningMessage.mockResolvedValueOnce('Delete');

    await (commands as any).deleteBean(parent);

    expect(showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('Delete bean P7: No Children Parent?'),
      { modal: true },
      'Delete'
    );
    expect(service.deleteBean).toHaveBeenCalledWith('parent-7');
  });

  it('aborts no-children delete when modal is dismissed', async () => {
    const parent = makeBean({ id: 'parent-8', code: 'P8', status: 'scrapped', title: 'No Children Parent' });
    service.listBeans.mockResolvedValueOnce([parent]);
    showWarningMessage.mockResolvedValueOnce(undefined);

    await (commands as any).deleteBean(parent);

    expect(service.deleteBean).not.toHaveBeenCalledWith('parent-8');
  });

  it('applies search text to search pane only', async () => {
    showInputBox.mockResolvedValueOnce('auth');
    filterManager.getFilter.mockReturnValue({});

    await (commands as any).search();

    expect(executeCommand).toHaveBeenCalledWith('workbench.view.extension.beans');
    expect(filterManager.setFilter).toHaveBeenCalledWith('beans.search', { text: 'auth' });
  });

  it('clears search text from search pane when empty', async () => {
    showInputBox.mockResolvedValueOnce('');
    filterManager.getFilter.mockReturnValue({ text: 'old', tags: ['x'] });

    await (commands as any).search();

    expect(executeCommand).toHaveBeenCalledWith('workbench.view.extension.beans');
    expect(filterManager.setFilter).toHaveBeenCalledWith('beans.search', { tags: ['x'] });
  });

  it('changes sort mode via configuration update', async () => {
    const config = {
      update: vi.fn(async () => undefined),
    };
    (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      config as unknown as vscode.WorkspaceConfiguration
    );
    showQuickPick.mockResolvedValueOnce({ label: 'Bean ID', value: 'id' });

    await (commands as unknown as { sort(): Promise<void> }).sort();

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

  it('renders issue picker with type icon (or in-progress icon) and code description', async () => {
    const todoTask = makeBean({ id: 'task-1', code: 'T1', title: 'Todo task', type: 'task', status: 'todo' });
    const inProgressBug = makeBean({
      id: 'bug-1',
      code: 'B1',
      title: 'In-progress bug',
      type: 'bug',
      status: 'in-progress',
    });

    service.listBeans.mockResolvedValueOnce([todoTask, inProgressBug]);
    showQuickPick.mockResolvedValueOnce({ bean: todoTask });

    await (commands as any).pickBean('Pick issue', undefined, true);

    const items = showQuickPick.mock.calls[0][0] as Array<{ label: string; description?: string; bean: Bean }>;

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bean: expect.objectContaining({ id: 'task-1' }),
          label: '$(list-unordered) Todo task',
          description: 'T1',
        }),
        expect.objectContaining({
          bean: expect.objectContaining({ id: 'bug-1' }),
          label: '$(play-circle) In-progress bug',
          description: 'B1',
        }),
      ])
    );
  });

  it('opens user guide in a webview panel', async () => {
    await (commands as any).openUserGuide();

    expect(createWebviewPanel).toHaveBeenCalledWith(
      'beans.docs',
      'Beans — User Guide',
      expect.anything(),
      expect.anything()
    );
    // Ensure the webview HTML was populated with the docs URL
    const panel = (createWebviewPanel as any).mock.results[0].value;
    expect(panel.webview.html).toContain('beans.self.agency');
  });

  it('opens extension settings filtered to this extension', async () => {
    commands.registerAll();

    const handler = commandHandlers.get('beans.openExtensionSettings');
    expect(handler).toBeDefined();

    await handler?.();

    expect(executeCommand).toHaveBeenCalledWith('workbench.action.openSettings', '@ext:selfagency.beans-vscode');
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

  it('opens Copilot chat using selected prompt template', async () => {
    const bean = makeBean({ id: 'beans-vscode-55', code: '55', title: 'Fix details action' });
    service.showBean.mockResolvedValueOnce(bean);
    showQuickPick.mockResolvedValueOnce({
      template: {
        prompt: 'Help me start implementing this bean in the current codebase.',
      },
    });

    await (commands as any).copilotStartWork(bean);

    expect(showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: "What's the status of this issue?" }),
        expect.objectContaining({ label: 'Set to in-progress and begin work' }),
      ]),
      expect.objectContaining({ title: 'Copilot Prompt' })
    );
    expect(executeCommand).toHaveBeenCalledWith('workbench.action.chat.open', {
      query: 'Help me start implementing this bean in the current codebase.',
    });
    expect(writeClipboardText).not.toHaveBeenCalled();
  });

  it('builds Copilot prompts without @beans participant target', () => {
    const templates = (commands as any).buildCopilotPromptTemplates(makeBean({ code: '5555' })) as Array<{
      prompt: string;
    }>;

    expect(templates.length).toBeGreaterThan(0);
    templates.forEach(template => {
      expect(template.prompt).not.toContain('@beans');
    });
  });

  it('does nothing when Copilot prompt selection is canceled', async () => {
    const bean = makeBean({ id: 'beans-vscode-88', code: '88' });
    service.showBean.mockResolvedValueOnce(bean);
    showQuickPick.mockResolvedValueOnce(undefined);

    await (commands as any).copilotStartWork(bean);

    expect(executeCommand).not.toHaveBeenCalledWith('workbench.action.chat.open', expect.anything());
    expect(writeClipboardText).not.toHaveBeenCalled();
  });

  describe('reinitializeCopilotArtifacts', () => {
    it('registers the beans.reinitializeCopilotArtifacts command', () => {
      commands.registerAll();
      expect(commandHandlers.has('beans.reinitializeCopilotArtifacts')).toBe(true);
    });

    it('writes instruction and skill files after user confirms', async () => {
      commands.registerAll();
      showInformationMessage.mockResolvedValueOnce('Reinitialize');

      await commandHandlers.get('beans.reinitializeCopilotArtifacts')!();

      expect(service.graphqlSchema).toHaveBeenCalled();
      expect(buildBeansCopilotInstructions).toHaveBeenCalledWith('type Query { beans: [Bean] }');
      expect(writeBeansCopilotInstructions).toHaveBeenCalled();
      expect(buildBeansCopilotSkill).toHaveBeenCalledWith('type Query { beans: [Bean] }');
      expect(writeBeansCopilotSkill).toHaveBeenCalled();
      expect(showInformationMessage).toHaveBeenLastCalledWith(
        'Copilot instructions and skills regenerated successfully.'
      );
    });

    it('does nothing when user cancels the confirmation dialog', async () => {
      commands.registerAll();
      showInformationMessage.mockResolvedValueOnce(undefined);

      await commandHandlers.get('beans.reinitializeCopilotArtifacts')!();

      expect(service.graphqlSchema).not.toHaveBeenCalled();
      expect(writeBeansCopilotInstructions).not.toHaveBeenCalled();
      expect(writeBeansCopilotSkill).not.toHaveBeenCalled();
    });

    it('shows an error notification when regeneration fails', async () => {
      commands.registerAll();
      showInformationMessage.mockResolvedValueOnce('Reinitialize');
      service.graphqlSchema.mockRejectedValueOnce(new Error('CLI error'));

      await commandHandlers.get('beans.reinitializeCopilotArtifacts')!();

      expect(showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Failed to regenerate Copilot artifacts'));
    });
  });
    
  describe('setParent', () => {
    const milestone = makeBean({
      id: 'ms-1',
      code: 'ms-1',
      type: 'milestone',
      status: 'in-progress',
      title: 'Milestone A',
    });
    const epic = makeBean({ id: 'ep-1', code: 'ep-1', type: 'epic', status: 'in-progress', title: 'Epic A' });
    const feature = makeBean({ id: 'ft-1', code: 'ft-1', type: 'feature', status: 'in-progress', title: 'Feature A' });
    const task = makeBean({ id: 'tk-1', code: 'tk-1', type: 'task', status: 'todo', title: 'Task A' });
    const bug = makeBean({ id: 'bg-1', code: 'bg-1', type: 'bug', status: 'todo', title: 'Bug A' });
    const allBeans = [milestone, epic, feature, task, bug];

    async function runSetParentAndCaptureItems(bean: Bean, beans: Bean[]): Promise<vscode.QuickPickItem[]> {
      service.listBeans.mockResolvedValueOnce(beans);
      let capturedItems: vscode.QuickPickItem[] = [];
      createQuickPickMock.mockImplementationOnce(() => {
        const qp: any = {
          title: '',
          placeholder: '',
          matchOnDescription: false,
          _items: [] as vscode.QuickPickItem[],
          get items() {
            return this._items;
          },
          set items(v: vscode.QuickPickItem[]) {
            this._items = v;
            capturedItems = v;
          },
          buttons: [],
          selectedItems: [],
          onDidTriggerButton: vi.fn(),
          onDidAccept: vi.fn(),
          onDidHide: vi.fn((cb: () => void) => {
            cb();
          }),
          show: vi.fn(),
          dispose: vi.fn(),
        };
        return qp;
      });
      await (commands as any).setParent(bean);
      return capturedItems;
    }

    beforeEach(() => {
      commands.registerAll();
    });

    it('shows only milestone/epic/feature for a bug bean', async () => {
      const items = await runSetParentAndCaptureItems(bug, allBeans);
      const labels = items.map((i: any) => i.bean?.type ?? i.bean?.id);
      expect(labels).toContain('milestone');
      expect(labels).toContain('epic');
      expect(labels).toContain('feature');
      expect(labels).not.toContain('task');
      expect(labels).not.toContain('bug');
    });

    it('shows only milestone/epic/feature for a task bean', async () => {
      const items = await runSetParentAndCaptureItems(task, allBeans);
      const labels = items.map((i: any) => i.bean?.type ?? i.bean?.id);
      expect(labels).toContain('milestone');
      expect(labels).toContain('epic');
      expect(labels).toContain('feature');
      expect(labels).not.toContain('task');
      expect(labels).not.toContain('bug');
    });

    it('shows only milestone for an epic bean', async () => {
      const items = await runSetParentAndCaptureItems(epic, allBeans);
      const labels = items.map((i: any) => i.bean?.type ?? i.bean?.id);
      expect(labels).toContain('milestone');
      expect(labels).not.toContain('epic');
      expect(labels).not.toContain('feature');
      expect(labels).not.toContain('task');
    });

    it('shows a warning and no quick pick when no valid parents exist', async () => {
      // Only beans of types that are invalid for an epic (non-milestone)
      service.listBeans.mockResolvedValueOnce([epic, feature, task, bug]);
      await (commands as any).setParent(epic);
      expect(showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('epic can only be moved to: milestone'));
      expect(createQuickPickMock).not.toHaveBeenCalled();
    });

    it('placeholder shows valid parent types', async () => {
      service.listBeans.mockResolvedValueOnce(allBeans);
      let capturedPlaceholder = '';
      createQuickPickMock.mockImplementationOnce(() => {
        const qp: any = {
          title: '',
          get placeholder() {
            return capturedPlaceholder;
          },
          set placeholder(v: string) {
            capturedPlaceholder = v;
          },
          matchOnDescription: false,
          _items: [] as vscode.QuickPickItem[],
          get items() {
            return this._items;
          },
          set items(v: vscode.QuickPickItem[]) {
            this._items = v;
          },
          buttons: [],
          selectedItems: [],
          onDidTriggerButton: vi.fn(),
          onDidAccept: vi.fn(),
          onDidHide: vi.fn((cb: () => void) => {
            cb();
          }),
          show: vi.fn(),
          dispose: vi.fn(),
        };
        return qp;
      });
      await (commands as any).setParent(bug);
      expect(capturedPlaceholder).toMatch(/milestone.*epic.*feature/);
    });
  });
});
