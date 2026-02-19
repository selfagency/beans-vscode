import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansService } from '../../beans/service/BeansService';
import { activate } from '../../extension';

/**
 * Integration tests for extension activation flow
 */

describe('Extension Activation', () => {
  let mockContext: vscode.ExtensionContext;
  let mockWorkspaceFolder: vscode.WorkspaceFolder;

  beforeEach(() => {
    // Mock BeansService CLI availability check
    vi.spyOn(BeansService.prototype, 'checkCLIAvailable').mockResolvedValue(true);
    vi.spyOn(BeansService.prototype, 'checkInitialized').mockResolvedValue(true);
    // Mock extension context
    mockContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.file('/mock/extension'),
      extensionPath: '/mock/extension',
      globalState: {
        get: vi.fn(),
        update: vi.fn(),
        keys: vi.fn(() => []),
        setKeysForSync: vi.fn(),
      },
      workspaceState: {
        get: vi.fn(),
        update: vi.fn(),
        keys: vi.fn(() => []),
      },
      secrets: {} as any,
      storageUri: vscode.Uri.file('/mock/storage'),
      globalStorageUri: vscode.Uri.file('/mock/globalStorage'),
      logUri: vscode.Uri.file('/mock/log'),
      extensionMode: 3, // ExtensionMode.Test
      extension: {} as any,
      environmentVariableCollection: {} as any,
      languageModelAccessInformation: {} as any,
      asAbsolutePath: (path: string) => `/mock/extension/${path}`,
      storagePath: '/mock/storage',
      globalStoragePath: '/mock/globalStorage',
      logPath: '/mock/log',
    };

    // Mock workspace folder
    mockWorkspaceFolder = {
      uri: vscode.Uri.file('/mock/workspace'),
      name: 'test-workspace',
      index: 0,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should activate without errors when workspace folder exists', async () => {
    vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue([mockWorkspaceFolder]);
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'enableOnlyIfInitialized') {
          return false;
        }
        if (key === 'ai.enabled') {
          return true;
        }
        if (key === 'cliPath') {
          return 'beans';
        }
        return defaultValue;
      }),
      has: vi.fn(),
      inspect: vi.fn(),
      update: vi.fn(),
    } as any);

    // Mock file system operations
    vi.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([vscode.Uri.file('/mock/workspace/.beans.yml')]);

    await expect(activate(mockContext)).resolves.toBeUndefined();

    // Verify context subscriptions were added
    expect(mockContext.subscriptions.length).toBeGreaterThan(0);
  });

  it('should not activate when no workspace folder is open', async () => {
    vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue(undefined);

    await activate(mockContext);

    // Should return early without adding subscriptions
    expect(mockContext.subscriptions.length).toBe(0);
  });

  it('should skip activation when enableOnlyIfInitialized is true and .beans.yml not found', async () => {
    vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue([mockWorkspaceFolder]);
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'enableOnlyIfInitialized') {
          return true;
        }
        if (key === 'ai.enabled') {
          return true;
        }
        return defaultValue;
      }),
      has: vi.fn(),
      inspect: vi.fn(),
      update: vi.fn(),
    } as any);

    // Mock no .beans.yml found
    vi.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([]);

    await activate(mockContext);

    expect(vscode.workspace.findFiles).toHaveBeenCalledWith('.beans.yml', null, 1);
  });

  it('should proceed with activation when enableOnlyIfInitialized is true and .beans.yml is found', async () => {
    vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue([mockWorkspaceFolder]);
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'enableOnlyIfInitialized') {
          return true;
        }
        if (key === 'ai.enabled') {
          return true;
        }
        if (key === 'cliPath') {
          return 'beans';
        }
        return defaultValue;
      }),
      has: vi.fn(),
      inspect: vi.fn(),
      update: vi.fn(),
    } as any);

    // Mock .beans.yml found
    vi.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([vscode.Uri.file('/mock/workspace/.beans.yml')]);

    await activate(mockContext);

    // Should proceed with activation
    expect(mockContext.subscriptions.length).toBeGreaterThan(0);
  });

  it('should disable AI integrations when ai.enabled is false', async () => {
    vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue([mockWorkspaceFolder]);
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'enableOnlyIfInitialized') {
          return false;
        }
        if (key === 'ai.enabled') {
          return false; // AI disabled
        }
        if (key === 'cliPath') {
          return 'beans';
        }
        return defaultValue;
      }),
      has: vi.fn(),
      inspect: vi.fn(),
      update: vi.fn(),
    } as any);

    vi.spyOn(vscode.workspace, 'findFiles').mockImplementation(async (pattern: any) => {
      const patternValue = typeof pattern === 'string' ? pattern : pattern?.pattern;
      if (typeof patternValue === 'string' && patternValue.includes('.beans.yml')) {
        return [vscode.Uri.file('/mock/workspace/.beans.yml')];
      }
      return [];
    });

    await activate(mockContext);

    // Should still activate but without AI components
    expect(mockContext.subscriptions.length).toBeGreaterThan(0);
  });

  it('should not block activation on copilot artifact prompt', async () => {
    vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue([mockWorkspaceFolder]);
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'enableOnlyIfInitialized') {
          return false;
        }
        if (key === 'ai.enabled') {
          return true;
        }
        if (key === 'cliPath') {
          return 'beans';
        }
        return defaultValue;
      }),
      has: vi.fn(),
      inspect: vi.fn(),
      update: vi.fn(),
    } as any);

    vi.spyOn(vscode.workspace, 'findFiles').mockImplementation(async (pattern: any) => {
      const patternValue = typeof pattern === 'string' ? pattern : pattern?.pattern;
      if (typeof patternValue === 'string' && patternValue.includes('.beans.yml')) {
        return [vscode.Uri.file('/mock/workspace/.beans.yml')];
      }
      return [];
    });

    // Simulate user not responding to "Generate now / Not now" prompt yet.
    vi.spyOn(vscode.window, 'showInformationMessage').mockImplementation((() => new Promise(() => {})) as any);

    const outcome = await Promise.race([
      activate(mockContext).then(() => 'resolved'),
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 100)),
    ]);

    expect(outcome).toBe('resolved');
    expect(mockContext.subscriptions.length).toBeGreaterThan(0);
  });
});
