import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansCommands } from '../../beans/commands';
import { BeansConfigManager } from '../../beans/config';
import { BeansDetailsViewProvider } from '../../beans/details';
import { BeansService } from '../../beans/service';
import { BeansFilterManager } from '../../beans/tree';

/**
 * Integration tests for BeansCommands registration and execution
 */

describe('Command Registration', () => {
  let mockContext: vscode.ExtensionContext;
  let mockService: BeansService;
  let mockFilterManager: BeansFilterManager;
  let mockConfigManager: BeansConfigManager;
  let mockDetailsProvider: BeansDetailsViewProvider;
  let commands: BeansCommands;
  let registeredCommands: Map<string, Function>;

  beforeEach(() => {
    registeredCommands = new Map();

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
      extensionMode: 3,
      extension: {} as any,
      environmentVariableCollection: {} as any,
      languageModelAccessInformation: {} as any,
      asAbsolutePath: (path: string) => `/mock/extension/${path}`,
      storagePath: '/mock/storage',
      globalStoragePath: '/mock/globalStorage',
      logPath: '/mock/log',
    };

    // Mock vscode.commands.registerCommand to track registered commands
    vi.spyOn(vscode.commands, 'registerCommand').mockImplementation((command: string, callback: Function) => {
      registeredCommands.set(command, callback);
      return { dispose: vi.fn() };
    });

    // Create mocks
    mockService = new BeansService('/mock/workspace');
    mockFilterManager = new BeansFilterManager();
    mockConfigManager = new BeansConfigManager('/mock/workspace');
    mockDetailsProvider = new BeansDetailsViewProvider(vscode.Uri.file('/mock/extension'), mockService);

    // Create commands instance
    commands = new BeansCommands(mockService, mockContext, mockFilterManager, mockConfigManager, mockDetailsProvider);
  });

  afterEach(() => {
    vi.clearAllMocks();
    registeredCommands.clear();
  });

  it('should register all core commands', () => {
    commands.registerAll();

    const expectedCommands = [
      'beans.view',
      'beans.create',
      'beans.edit',
      'beans.copilotStartWork',
      'beans.setStatus',
      'beans.reopenCompleted',
      'beans.reopenScrapped',
      'beans.setType',
      'beans.setPriority',
      'beans.setParent',
      'beans.removeParent',
      'beans.editBlocking',
      'beans.copyId',
      'beans.delete',
      'beans.refresh',
      'beans.filter',
      'beans.search',
      'beans.sort',
      'beans.openConfig',
      'beans.openExtensionSettings',
    ];

    for (const cmd of expectedCommands) {
      expect(registeredCommands.has(cmd)).toBe(true);
    }
  });

  it('should register commands with disposables in context', () => {
    const initialCount = mockContext.subscriptions.length;
    commands.registerAll();

    // Should have added disposables for each registered command
    expect(mockContext.subscriptions.length).toBeGreaterThan(initialCount);
  });

  it('should register view command', () => {
    commands.registerAll();
    expect(registeredCommands.has('beans.view')).toBe(true);
  });

  it('should register create command', () => {
    commands.registerAll();
    expect(registeredCommands.has('beans.create')).toBe(true);
  });

  it('should register edit command', () => {
    commands.registerAll();
    expect(registeredCommands.has('beans.edit')).toBe(true);
  });

  it('should register copilot start-work command', () => {
    commands.registerAll();
    expect(registeredCommands.has('beans.copilotStartWork')).toBe(true);
  });

  it('should register status management commands', () => {
    commands.registerAll();
    expect(registeredCommands.has('beans.setStatus')).toBe(true);
    expect(registeredCommands.has('beans.reopenCompleted')).toBe(true);
    expect(registeredCommands.has('beans.reopenScrapped')).toBe(true);
  });

  it('should register type and priority commands', () => {
    commands.registerAll();
    expect(registeredCommands.has('beans.setType')).toBe(true);
    expect(registeredCommands.has('beans.setPriority')).toBe(true);
  });

  it('should register relationship commands', () => {
    commands.registerAll();
    expect(registeredCommands.has('beans.setParent')).toBe(true);
    expect(registeredCommands.has('beans.removeParent')).toBe(true);
    expect(registeredCommands.has('beans.editBlocking')).toBe(true);
  });

  it('should register utility commands', () => {
    commands.registerAll();
    expect(registeredCommands.has('beans.copyId')).toBe(true);
    expect(registeredCommands.has('beans.delete')).toBe(true);
  });

  it('should register tree and filter commands', () => {
    commands.registerAll();
    expect(registeredCommands.has('beans.refresh')).toBe(true);
    expect(registeredCommands.has('beans.filter')).toBe(true);
    expect(registeredCommands.has('beans.search')).toBe(true);
    expect(registeredCommands.has('beans.sort')).toBe(true);
  });

  it('should register configuration command', () => {
    commands.registerAll();
    expect(registeredCommands.has('beans.openConfig')).toBe(true);
    expect(registeredCommands.has('beans.openExtensionSettings')).toBe(true);
  });
});
