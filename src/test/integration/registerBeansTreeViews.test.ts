import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { registerBeansTreeViews } from '../../beans/tree/registerBeansTreeViews';
import { BeansService } from '../../beans/service';
import { BeansFilterManager } from '../../beans/tree';
import { BeansDetailsViewProvider } from '../../beans/details';
import { BeansOutput } from '../../beans/logging';

describe('registerBeansTreeViews integration', () => {
  let mockContext: vscode.ExtensionContext;
  let service: BeansService;
  let manager: BeansFilterManager;
  let details: BeansDetailsViewProvider;

  beforeEach(() => {
    // Minimal mock extension context
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

    // Mock createTreeView used by registerBeansTreeViews
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
  });

  it('schedules periodic refresh when configuration enables it', () => {
    // Mock configuration to return a positive interval
    const origGetConfiguration = vscode.workspace.getConfiguration as any;
    (vscode.workspace as any).getConfiguration = (_section: string) => ({
      get: (_key: string, _defaultValue: any) => {
        // enable refresh interval
        return 15000;
      },
    });

    const infoSpy = vi.spyOn(BeansOutput.getInstance(), 'info').mockImplementation(() => undefined as any);

    const providers = registerBeansTreeViews(mockContext, service, manager, details, BeansOutput.getInstance());

    expect(infoSpy).toHaveBeenCalled();
    expect(providers.activeProvider).toBeDefined();

    // restore original
    (vscode.workspace as any).getConfiguration = origGetConfiguration;
    infoSpy.mockRestore();
  });

  it('registers providers and adds them to context.subscriptions', () => {
    const initial = mockContext.subscriptions.length;

    const providers = registerBeansTreeViews(mockContext, service, manager, details, BeansOutput.getInstance());

    // Ensure subscriptions increased
    expect(mockContext.subscriptions.length).toBeGreaterThan(initial);

    // The provider instances should have been pushed into subscriptions so they will be disposed
    expect(mockContext.subscriptions).toContain(providers.activeProvider);
    expect(mockContext.subscriptions).toContain(providers.completedProvider);
    expect(mockContext.subscriptions).toContain(providers.draftProvider);
    expect(mockContext.subscriptions).toContain(providers.scrappedProvider);
  });
});
