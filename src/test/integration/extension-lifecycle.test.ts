import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansCLINotFoundError } from '../../beans/model';
import { activate, deactivate } from '../../extension';

/** Minimal shape satisfied by the mocked tree providers in this test file. */
interface MockBeansTreeProvider {
  refresh: () => void;
  setFilter: (filter: unknown) => void;
}

// TODO(beans-vscode-y4k2): Add lower-mock integration tests that exercise
// real provider/service implementations during activate() to validate wiring,
// command registration side-effects, and watcher/selection behavior end-to-end.
const state = vi.hoisted(() => ({
  cliAvailable: true,
  checkCliThrows: undefined as unknown,
  initialized: true,
  checkInitializedThrows: undefined as unknown,
  initThrows: undefined as unknown,
  primeOutput: 'prime output',
  detailsShouldReject: false,
  filters: new Map<string, any>(),
  filterListener: undefined as ((viewId: string) => void) | undefined,
  showInfoQueue: [] as Array<string | undefined>,
  showErrorQueue: [] as Array<string | undefined>,
  showWarningQueue: [] as Array<string | undefined>,
  registeredCommands: new Map<string, (...args: any[]) => any>(),
  selectionHandlers: new Map<string, (e: any) => void>(),
  watcherCallbacks: [] as Array<() => void>,
  configChangeHandler: undefined as ((e: { affectsConfiguration: (key: string) => boolean }) => void) | undefined,
  providerInstances: {
    active: undefined as MockBeansTreeProvider | undefined,
    completed: undefined as MockBeansTreeProvider | undefined,
    draft: undefined as MockBeansTreeProvider | undefined,
  },
}));

const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  show: vi.fn(),
  dispose: vi.fn(),
  setMirrorFilePath: vi.fn(),
  refreshConfig: vi.fn(),
}));

const configFns = vi.hoisted(() => ({
  buildBeansCopilotInstructions: vi.fn((prime: string) => `instructions:${prime}`),
  writeBeansCopilotInstructions: vi.fn(async () => '/ws/.github/instructions/tasks.instructions.md'),
  buildBeansCopilotSkill: vi.fn((prime: string) => `skill:${prime}`),
  writeBeansCopilotSkill: vi.fn(async () => '/ws/.github/skills/beans/SKILL.md'),
  removeBeansCopilotSkill: vi.fn(async () => undefined),
}));

vi.mock('../../beans/logging', () => ({
  BeansOutput: {
    getInstance: vi.fn(() => logger),
  },
}));

vi.mock('../../beans/config', () => ({
  BeansConfigManager: class BeansConfigManager {
    async open(): Promise<void> {}
  },
  COPILOT_INSTRUCTIONS_RELATIVE_PATH: '.github/instructions/tasks.instructions.md',
  COPILOT_SKILL_RELATIVE_PATH: '.github/skills/beans/SKILL.md',
  ...configFns,
}));

vi.mock('../../beans/service', () => ({
  BeansService: class BeansService {
    async checkCLIAvailable(): Promise<boolean> {
      if (state.checkCliThrows !== undefined) {
        throw state.checkCliThrows;
      }
      return state.cliAvailable;
    }
    async checkInitialized(): Promise<boolean> {
      if (state.checkInitializedThrows !== undefined) {
        throw state.checkInitializedThrows;
      }
      return state.initialized;
    }
    async init(): Promise<void> {
      if (state.initThrows !== undefined) {
        throw state.initThrows;
      }
    }
    async prime(): Promise<string> {
      return state.primeOutput;
    }
  },
}));

vi.mock('../../beans/mcp', () => ({
  BeansMcpIntegration: class BeansMcpIntegration {
    register = vi.fn();
  },
}));

vi.mock('../../beans/chat', () => ({
  BeansChatIntegration: class BeansChatIntegration {
    register = vi.fn();
  },
}));

vi.mock('../../beans/preview', () => ({
  BeansPreviewProvider: class BeansPreviewProvider {},
}));

vi.mock('../../beans/search', () => ({
  BeansSearchViewProvider: class BeansSearchViewProvider {
    static viewType = 'beans.search';
  },
}));

vi.mock('../../beans/details', () => ({
  BeansDetailsViewProvider: class BeansDetailsViewProvider {
    static viewType = 'beans.details';
    async showBean(): Promise<void> {
      if (state.detailsShouldReject) {
        throw new Error('details failed');
      }
    }
  },
}));

vi.mock('../../beans/commands', () => ({
  BeansCommands: class BeansCommands {
    registerAll = vi.fn();
  },
}));

vi.mock('../../beans/tree', () => ({
  BeansDragAndDropController: class BeansDragAndDropController {},
  BeansFilterManager: class BeansFilterManager {
    getFilter(viewId: string): any {
      return state.filters.get(viewId);
    }
    setFilter = vi.fn();
    showFilterUI = vi.fn(async (f: any) => f);
    onDidChangeFilter = (listener: (viewId: string) => void) => {
      state.filterListener = listener;
      return { dispose: vi.fn() };
    };
  },
}));

vi.mock('../../beans/tree/providers', () => {
  class BaseProvider {
    refresh = vi.fn();
    setFilter = vi.fn();
  }
  class ActiveBeansProvider extends BaseProvider {
    constructor() {
      super();
      state.providerInstances.active = this;
    }
  }
  class CompletedBeansProvider extends BaseProvider {
    constructor() {
      super();
      state.providerInstances.completed = this;
    }
  }
  class DraftBeansProvider extends BaseProvider {
    constructor() {
      super();
      state.providerInstances.draft = this;
    }
  }
  return { ActiveBeansProvider, CompletedBeansProvider, DraftBeansProvider };
});

function makeContext(): any {
  return {
    subscriptions: [],
    extensionUri: vscode.Uri.file('/ext'),
    extensionPath: '/ext',
    extension: { packageJSON: { version: '1.0.0' } },
    workspaceState: {
      get: vi.fn(() => undefined),
      update: vi.fn(async () => undefined),
    },
  };
}

describe('Extension lifecycle coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    state.cliAvailable = true;
    state.checkCliThrows = undefined;
    state.initialized = true;
    state.checkInitializedThrows = undefined;
    state.initThrows = undefined;
    state.primeOutput = 'prime output';
    state.detailsShouldReject = false;
    state.filters = new Map();
    state.filterListener = undefined;
    state.showInfoQueue = [];
    state.showErrorQueue = [];
    state.showWarningQueue = [];
    state.registeredCommands = new Map();
    state.selectionHandlers = new Map();
    state.watcherCallbacks = [];
    state.configChangeHandler = undefined;
    state.providerInstances = { active: undefined, completed: undefined, draft: undefined };

    vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue([
      { uri: vscode.Uri.file('/ws'), name: 'ws', index: 0 } as vscode.WorkspaceFolder,
    ]);
    vi.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([]);

    vi.spyOn(vscode.workspace, 'getConfiguration').mockImplementation((_section?: string) => {
      return {
        get: (key: string, defaultValue?: unknown) => {
          if (key === 'enableOnlyIfInitialized') {
            return false;
          }
          if (key === 'ai.enabled') {
            return true;
          }
          if (key === 'cliPath') {
            return 'beans';
          }
          if (key === 'autoInit.enabled') {
            return true;
          }
          if (key === 'fileWatcher.debounceMs') {
            return 25;
          }
          return defaultValue;
        },
        update: vi.fn(async () => undefined),
      } as any;
    });

    vi.spyOn(vscode.commands, 'registerCommand').mockImplementation((name: string, cb: (...args: any[]) => any) => {
      state.registeredCommands.set(name, cb);
      return { dispose: vi.fn() };
    });
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

    vi.spyOn(vscode.window, 'showInformationMessage').mockImplementation(
      async () => state.showInfoQueue.shift() as any
    );
    vi.spyOn(vscode.window, 'showErrorMessage').mockImplementation(async () => state.showErrorQueue.shift() as any);
    vi.spyOn(vscode.window, 'showWarningMessage').mockImplementation(async () => state.showWarningQueue.shift() as any);

    (vscode.window as any).createTreeView = vi.fn((id: string) => {
      return {
        onDidChangeSelection: (cb: (e: any) => void) => {
          state.selectionHandlers.set(id, cb);
          return { dispose: vi.fn() };
        },
        dispose: vi.fn(),
      } as any;
    });
    vi.spyOn(vscode.window, 'registerWebviewViewProvider').mockReturnValue({ dispose: vi.fn() });

    vi.spyOn(vscode.workspace, 'createFileSystemWatcher').mockImplementation(() => {
      return {
        onDidCreate: (cb: () => void) => {
          state.watcherCallbacks.push(cb);
          return { dispose: vi.fn() };
        },
        onDidChange: (cb: () => void) => {
          state.watcherCallbacks.push(cb);
          return { dispose: vi.fn() };
        },
        onDidDelete: (cb: () => void) => {
          state.watcherCallbacks.push(cb);
          return { dispose: vi.fn() };
        },
        dispose: vi.fn(),
      } as any;
    });

    vi.spyOn(vscode.workspace, 'onDidChangeConfiguration').mockImplementation((cb: any) => {
      state.configChangeHandler = cb;
      return { dispose: vi.fn() } as any;
    });

    vi.spyOn(vscode.workspace, 'registerTextDocumentContentProvider').mockReturnValue({ dispose: vi.fn() } as any);
    vi.spyOn(vscode.env, 'openExternal').mockResolvedValue(true);
  });

  afterEach(async () => {
    // Vitest doesn't expose a way to check if timers are mocked,
    // so we try to run timer cleanup and catch if timers aren't mocked
    try {
      await vi.runAllTimersAsync();
    } catch {
      // Real timers are active, no need to advance
    }
    vi.useRealTimers();
  });

  it('covers successful activation wiring, filter routing, selection handlers, debounce, and deactivate', async () => {
    await activate(makeContext());

    expect(state.registeredCommands.has('beans.openBean')).toBe(true);
    expect(state.registeredCommands.has('beans.refreshAll')).toBe(true);

    state.filters.set('beans.active', { text: 'x', tags: ['t'], types: ['bug'] });
    state.filterListener?.('beans.active');
    state.filters.set('beans.completed', { text: 'y' });
    state.filterListener?.('beans.completed');
    state.filters.set('beans.draft', { text: 'z' });
    state.filterListener?.('beans.draft');

    expect(state.providerInstances.active!.setFilter).toHaveBeenCalled();
    expect(state.providerInstances.completed!.setFilter).toHaveBeenCalled();
    expect(state.providerInstances.draft!.setFilter).toHaveBeenCalled();

    state.detailsShouldReject = true;
    await state.registeredCommands.get('beans.openBean')?.({ id: 'bean-1' });
    for (const [id, cb] of state.selectionHandlers.entries()) {
      cb({ selection: [{ bean: { id: `${id}-bean` } }] });
    }
    expect(logger.error).toHaveBeenCalledWith('Failed to show bean details', expect.any(Error));

    state.watcherCallbacks.forEach(cb => cb());
    vi.advanceTimersByTime(30);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('beans.refreshAll');

    state.configChangeHandler?.({ affectsConfiguration: (key: string) => key === 'beans' });
    expect(logger.refreshConfig).toHaveBeenCalled();

    state.configChangeHandler?.({ affectsConfiguration: (key: string) => key === 'beans.ai.enabled' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'beans.aiEnabled', true);

    deactivate();
    expect(logger.dispose).toHaveBeenCalled();
  });

  it('prompts for CLI install when cli is unavailable and can open settings', async () => {
    state.cliAvailable = false;
    state.showErrorQueue.push('Configure Path');

    await activate(makeContext());

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.openSettings', 'beans.cliPath');
  });

  it('handles BeansCLINotFoundError in activation catch and opens install URL', async () => {
    state.checkCliThrows = new BeansCLINotFoundError('missing');
    state.showErrorQueue.push('Install Instructions');

    await activate(makeContext());

    expect(vscode.env.openExternal).toHaveBeenCalled();
  });

  it('handles generic and unknown activation errors with show-output path', async () => {
    state.checkInitializedThrows = new Error('boom');
    state.showErrorQueue.push('Show Output');
    await activate(makeContext());
    expect(logger.show).toHaveBeenCalled();

    state.checkInitializedThrows = 'weird';
    state.showErrorQueue.push('Show Output');
    await activate(makeContext());
    expect(logger.show).toHaveBeenCalledTimes(2);
  });

  it('covers init prompt initialize, not-now dismissal, and learn-more branches', async () => {
    // Use real timers for this test due to complex async flows
    vi.useRealTimers();

    state.initialized = false;

    vi.spyOn(vscode.window, 'showInformationMessage').mockImplementation(async (message: string) => {
      if (message.includes('Generate the Copilot instructions file for this workspace now?')) {
        return 'Generate now' as any;
      }
      return state.showInfoQueue.shift() as any;
    });

    // Test Initialize branch
    state.showInfoQueue.push('Initialize');
    await activate(makeContext());
    // Wait for async artifact generation to complete
    // The fire-and-forget async IIFE needs time to execute
    for (let i = 0; i < 50 && !configFns.buildBeansCopilotInstructions.mock.calls.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    expect(configFns.buildBeansCopilotInstructions).toHaveBeenCalled();
    expect(configFns.writeBeansCopilotSkill).toHaveBeenCalled();
    deactivate();

    // Test Learn More branch
    state.showInfoQueue.push('Learn More');
    await activate(makeContext());
    expect(vscode.env.openExternal).toHaveBeenCalled();
    deactivate();

    // Test Not Now branch
    state.showInfoQueue.push('Not Now');
    await activate(makeContext());
    expect(logger.info).toHaveBeenCalledWith('User dismissed initialization prompt');
    deactivate();
  });
});
