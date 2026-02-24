import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansDetailsViewProvider } from '../../../src/beans/details';
import { BeansOutput } from '../../../src/beans/logging';
import { BeansService } from '../../../src/beans/service';
import { BeansFilterManager } from '../../../src/beans/tree';
import { registerBeansTreeViews } from '../../../src/beans/tree/registerBeansTreeViews';

describe('Periodic pane refresh', () => {
  let mockContext: vscode.ExtensionContext;
  let service: BeansService;
  let manager: BeansFilterManager;
  let details: BeansDetailsViewProvider;

  beforeEach(() => {
    vi.useFakeTimers();

    mockContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/mock/ext'),
      extensionPath: '/mock/ext',
      globalState: { get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []), setKeysForSync: vi.fn() },
      workspaceState: { get: vi.fn(), update: vi.fn(), keys: vi.fn(() => []) },
      secrets: {} as any,
      storageUri: vscode.Uri.file('/mock/storage'),
      globalStorageUri: vscode.Uri.file('/mock/globalStorage'),
      logUri: vscode.Uri.file('/mock/log'),
      extensionMode: 3,
      extension: {} as any,
      environmentVariableCollection: {} as any,
      languageModelAccessInformation: {} as any,
      asAbsolutePath: (p: string) => `/mock/ext/${p}`,
      storagePath: '/mock/storage',
      globalStoragePath: '/mock/globalStorage',
      logPath: '/mock/log',
    } as unknown as vscode.ExtensionContext;

    service = new BeansService('/mock/workspace');
    manager = new BeansFilterManager();
    details = new BeansDetailsViewProvider(vscode.Uri.file('/mock/ext'), service);

    (vscode.window as any).createTreeView = (_id: string, _opts: any) => {
      return {
        title: '',
        reveal: vi.fn(),
        dispose: vi.fn(),
        onDidChangeSelection: vi.fn(),
        onDidChangeVisibility: vi.fn(),
        selection: [],
      } as any;
    };

    // Mock configuration to enable periodic refresh
    vi.spyOn(vscode.workspace, 'getConfiguration').mockImplementation(() => {
      return {
        get: (key: string, defaultVal: any) => {
          if (key === 'view.refreshIntervalMs') {
            return 100;
          }
          if (key === 'view.showCounts') {
            return true;
          }
          return defaultVal;
        },
      } as any;
    });
  });

  it('schedules beans.refreshAll at configured interval', async () => {
    const execSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined as any);

    registerBeansTreeViews(mockContext, service, manager, details, BeansOutput.getInstance());

    // advance timers to allow interval to fire a few times
    vi.advanceTimersByTime(350);

    expect(execSpy).toHaveBeenCalled();
    const calls = execSpy.mock.calls.filter(c => c[0] === 'beans.refreshAll');
    expect(calls.length).toBeGreaterThanOrEqual(2);

    execSpy.mockRestore();
  });
});
