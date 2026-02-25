import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansOutput } from '../../../beans/logging';
import { BeansMcpIntegration } from '../../../beans/mcp/BeansMcpIntegration';

describe('MCP Integration', () => {
  let mockContext: vscode.ExtensionContext;
  let mcpIntegration: BeansMcpIntegration;
  let registeredProviders: Map<string, vscode.McpServerDefinitionProvider<vscode.McpStdioServerDefinition>>;
  let registeredCommands: Map<string, (...args: any[]) => any>;

  beforeEach(() => {
    registeredProviders = new Map();
    registeredCommands = new Map();

    mockContext = {
      subscriptions: [],
      extensionPath: '/mock/extension/path',
      extensionUri: vscode.Uri.file('/mock/extension/path'),
      logUri: vscode.Uri.file('/mock/logs'),
      extension: {
        packageJSON: { version: '0.1.0' },
      },
    } as unknown as vscode.ExtensionContext;

    // Mock vscode.lm API
    (vscode as unknown as { lm: unknown }).lm = {
      registerMcpServerDefinitionProvider: vi.fn((id: string, provider: any) => {
        registeredProviders.set(id, provider);
        return { dispose: vi.fn() };
      }),
    };

    // Mock vscode.commands API
    vi.spyOn(vscode.commands, 'registerCommand').mockImplementation((command: string, callback: any) => {
      registeredCommands.set(command, callback);
      return { dispose: vi.fn() };
    });

    // Mock vscode.workspace.getConfiguration
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'ai.enabled') {
          return true;
        }
        if (key === 'mcp.enabled') {
          return true;
        }
        if (key === 'mcp.port') {
          return 39173;
        }
        if (key === 'cliPath') {
          return 'beans';
        }
        return defaultValue;
      }),
    } as unknown as vscode.WorkspaceConfiguration);

    mcpIntegration = new BeansMcpIntegration(mockContext, '/workspace/root', 'beans');

    if (!(vscode.env as any).clipboard) {
      (vscode.env as any).clipboard = { writeText: vi.fn() };
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Provider Registration', () => {
    it('should register MCP provider when lm API is available', () => {
      mcpIntegration.register();

      expect(vscode.lm.registerMcpServerDefinitionProvider).toHaveBeenCalledWith('beans.mcpServers', mcpIntegration);
      expect(registeredProviders.has('beans.mcpServers')).toBe(true);
      expect(mockContext.subscriptions.length).toBeGreaterThan(0);
    });

    it('should register MCP-related commands', () => {
      mcpIntegration.register();

      expect(registeredCommands.has('beans.mcp.refreshDefinitions')).toBe(true);
      expect(registeredCommands.has('beans.mcp.showServerInfo')).toBe(true);
      expect(registeredCommands.has('beans.mcp.openConfig')).toBe(true);
      expect(registeredCommands.has('beans.mcp.openLogs')).toBe(true);
    });

    it('should not register when lm API is unavailable', () => {
      (vscode as unknown as { lm: unknown }).lm = undefined;

      mcpIntegration.register();

      expect(registeredProviders.size).toBe(0);
    });
  });

  describe('provideMcpServerDefinitions', () => {
    beforeEach(() => {
      mcpIntegration.register();
    });

    it('should show startup notification when definitions are provided', () => {
      const showInfoMessageSpy = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined as any);

      mcpIntegration.provideMcpServerDefinitions();

      expect(showInfoMessageSpy).toHaveBeenCalledWith(
        'Beans MCP server started on port 39173.',
        'Open Settings',
        "Don't Show Again"
      );
    });

    it('should provide server definition when ai.enabled and mcp.enabled are true', () => {
      const definitions = mcpIntegration.provideMcpServerDefinitions() as vscode.McpStdioServerDefinition[];

      expect(definitions).toBeDefined();
      expect(Array.isArray(definitions)).toBe(true);
      expect(definitions.length).toBe(1);

      const definition = definitions[0];
      expect(definition.label).toBe('Beans Commands');
      expect(definition.command).toBe(process.execPath);
      expect(definition.args.length).toBeGreaterThan(0);
      expect(definition.args).toContain('--workspace');
      expect(definition.args).toContain('/workspace/root');
      expect(definition.args).toContain('--port');
      expect(definition.args).toContain('39173');
      expect(definition.env).toBeDefined();
      expect(definition.env?.BEANS_VSCODE_MCP).toBe('1');
      expect(definition.env?.BEANS_VSCODE_MCP_PORT).toBe('39173');
      expect(definition.env?.BEANS_MCP_PORT).toBe('39173');
    });

    it('should return empty array when ai.enabled is false', () => {
      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'ai.enabled') {
            return false;
          }
          if (key === 'mcp.enabled') {
            return true;
          }
          if (key === 'mcp.port') {
            return 39173;
          }
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const definitions = mcpIntegration.provideMcpServerDefinitions();

      expect(definitions).toEqual([]);
    });

    it('should return empty array when mcp.enabled is false', () => {
      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'ai.enabled') {
            return true;
          }
          if (key === 'mcp.enabled') {
            return false;
          }
          if (key === 'mcp.port') {
            return 39173;
          }
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const definitions = mcpIntegration.provideMcpServerDefinitions();

      expect(definitions).toEqual([]);
    });

    it('should include version from package.json', () => {
      const definitions = mcpIntegration.provideMcpServerDefinitions() as vscode.McpStdioServerDefinition[];
      const definition = definitions[0];

      expect(definition.version).toBe('0.1.0');
    });

    it('should include server script path in args', () => {
      const definitions = mcpIntegration.provideMcpServerDefinitions() as vscode.McpStdioServerDefinition[];
      const definition = definitions[0];

      expect(definition.args[0]).toContain('beans-mcp-server.js');
    });
  });

  describe('resolveMcpServerDefinition', () => {
    beforeEach(() => {
      mcpIntegration.register();
    });

    it('should show startup notification with MCP port when enabled', async () => {
      const inputDefinition = new vscode.McpStdioServerDefinition('Beans Commands', process.execPath, [], {}, '0.1.0');

      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'ai.enabled') {
            return true;
          }
          if (key === 'mcp.enabled') {
            return true;
          }
          if (key === 'cliPath') {
            return '/custom/beans/path';
          }
          if (key === 'mcp.port') {
            return 49731;
          }
          if (key === 'mcp.showStartupNotification') {
            return true;
          }
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const showInfoMessageSpy = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined as any);

      await mcpIntegration.resolveMcpServerDefinition(inputDefinition);

      expect(showInfoMessageSpy).toHaveBeenCalledWith(
        'Beans MCP server started on port 49731.',
        'Open Settings',
        "Don't Show Again"
      );
    });

    it('should not show startup notification when disabled in settings', async () => {
      const inputDefinition = new vscode.McpStdioServerDefinition('Beans Commands', process.execPath, [], {}, '0.1.0');
      const showInfoMessageSpy = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined as any);

      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'ai.enabled') {
            return true;
          }
          if (key === 'mcp.enabled') {
            return true;
          }
          if (key === 'cliPath') {
            return '/custom/beans/path';
          }
          if (key === 'mcp.port') {
            return 49731;
          }
          if (key === 'mcp.showStartupNotification') {
            return false;
          }
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      await mcpIntegration.resolveMcpServerDefinition(inputDefinition);

      expect(showInfoMessageSpy).not.toHaveBeenCalled();
    });

    it('should not show startup notification when ai.enabled is false', async () => {
      const inputDefinition = new vscode.McpStdioServerDefinition('Beans Commands', process.execPath, [], {}, '0.1.0');
      const showInfoMessageSpy = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined as any);

      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'ai.enabled') {
            return false;
          }
          if (key === 'mcp.enabled') {
            return true;
          }
          if (key === 'cliPath') {
            return '/custom/beans/path';
          }
          if (key === 'mcp.port') {
            return 49731;
          }
          if (key === 'mcp.showStartupNotification') {
            return true;
          }
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      await mcpIntegration.resolveMcpServerDefinition(inputDefinition);

      expect(showInfoMessageSpy).not.toHaveBeenCalled();
    });

    it('should not show startup notification when mcp.enabled is false', async () => {
      const inputDefinition = new vscode.McpStdioServerDefinition('Beans Commands', process.execPath, [], {}, '0.1.0');
      const showInfoMessageSpy = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined as any);

      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'ai.enabled') {
            return true;
          }
          if (key === 'mcp.enabled') {
            return false;
          }
          if (key === 'cliPath') {
            return '/custom/beans/path';
          }
          if (key === 'mcp.port') {
            return 49731;
          }
          if (key === 'mcp.showStartupNotification') {
            return true;
          }
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      await mcpIntegration.resolveMcpServerDefinition(inputDefinition);

      expect(showInfoMessageSpy).not.toHaveBeenCalled();
    });

    it('should only show startup notification once per session', async () => {
      const inputDefinition = new vscode.McpStdioServerDefinition('Beans Commands', process.execPath, [], {}, '0.1.0');
      const showInfoMessageSpy = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined as any);

      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'ai.enabled') {
            return true;
          }
          if (key === 'mcp.enabled') {
            return true;
          }
          if (key === 'cliPath') {
            return '/custom/beans/path';
          }
          if (key === 'mcp.port') {
            return 49731;
          }
          if (key === 'mcp.showStartupNotification') {
            return true;
          }
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      await mcpIntegration.resolveMcpServerDefinition(inputDefinition);
      await mcpIntegration.resolveMcpServerDefinition(inputDefinition);

      expect(showInfoMessageSpy).toHaveBeenCalledTimes(1);
    });

    it('should disable startup notification when user selects the disable action', async () => {
      const inputDefinition = new vscode.McpStdioServerDefinition('Beans Commands', process.execPath, [], {}, '0.1.0');
      const configUpdateSpy = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'ai.enabled') {
            return true;
          }
          if (key === 'mcp.enabled') {
            return true;
          }
          if (key === 'cliPath') {
            return '/custom/beans/path';
          }
          if (key === 'mcp.port') {
            return 49731;
          }
          if (key === 'mcp.showStartupNotification') {
            return true;
          }
          return defaultValue;
        }),
        update: configUpdateSpy,
      } as unknown as vscode.WorkspaceConfiguration);

      vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue("Don't Show Again" as any);

      await mcpIntegration.resolveMcpServerDefinition(inputDefinition);

      expect(configUpdateSpy).toHaveBeenCalledWith(
        'mcp.showStartupNotification',
        false,
        vscode.ConfigurationTarget.Workspace
      );
    });

    it('should open startup notification setting when user selects Open Settings', async () => {
      const inputDefinition = new vscode.McpStdioServerDefinition('Beans Commands', process.execPath, [], {}, '0.1.0');
      const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'ai.enabled') {
            return true;
          }
          if (key === 'mcp.enabled') {
            return true;
          }
          if (key === 'cliPath') {
            return '/custom/beans/path';
          }
          if (key === 'mcp.port') {
            return 49731;
          }
          if (key === 'mcp.showStartupNotification') {
            return true;
          }
          return defaultValue;
        }),
        update: vi.fn().mockResolvedValue(undefined),
      } as unknown as vscode.WorkspaceConfiguration);

      vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Open Settings' as any);

      await mcpIntegration.resolveMcpServerDefinition(inputDefinition);

      expect(executeCommandSpy).toHaveBeenCalledWith(
        'workbench.action.openSettings',
        'beans.mcp.showStartupNotification'
      );
    });

    it('should silently ignore Canceled error when user dismisses notification', async () => {
      const inputDefinition = new vscode.McpStdioServerDefinition('Beans Commands', process.execPath, [], {}, '0.1.0');
      const loggerSpy = vi.spyOn(BeansOutput.getInstance(), 'warn');

      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'ai.enabled') {
            return true;
          }
          if (key === 'mcp.enabled') {
            return true;
          }
          if (key === 'cliPath') {
            return '/custom/beans/path';
          }
          if (key === 'mcp.port') {
            return 49731;
          }
          if (key === 'mcp.showStartupNotification') {
            return true;
          }
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const canceledError = new Error('Canceled');
      vi.spyOn(vscode.window, 'showInformationMessage').mockRejectedValue(canceledError);

      await mcpIntegration.resolveMcpServerDefinition(inputDefinition);

      // Canceled errors should not be logged as warnings
      expect(loggerSpy).not.toHaveBeenCalledWith(expect.stringContaining('Canceled'));
    });

    it('should log warning when startup notification encounters non-Canceled error', async () => {
      const inputDefinition = new vscode.McpStdioServerDefinition('Beans Commands', process.execPath, [], {}, '0.1.0');
      const loggerSpy = vi.spyOn(BeansOutput.getInstance(), 'warn');

      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'ai.enabled') {
            return true;
          }
          if (key === 'mcp.enabled') {
            return true;
          }
          if (key === 'cliPath') {
            return '/custom/beans/path';
          }
          if (key === 'mcp.port') {
            return 49731;
          }
          if (key === 'mcp.showStartupNotification') {
            return true;
          }
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const testError = new Error('Something went wrong');
      vi.spyOn(vscode.window, 'showInformationMessage').mockRejectedValue(testError);

      await mcpIntegration.resolveMcpServerDefinition(inputDefinition);

      // Non-Canceled errors should be logged
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to handle MCP startup notification action')
      );
    });

    it('should resolve server definition with configured CLI path', () => {
      const inputDefinition = new vscode.McpStdioServerDefinition('Beans Commands', process.execPath, [], {}, '0.1.0');

      vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'cliPath') {
            return '/custom/beans/path';
          }
          if (key === 'mcp.port') {
            return 49731;
          }
          return defaultValue;
        }),
      } as unknown as vscode.WorkspaceConfiguration);

      const resolved = mcpIntegration.resolveMcpServerDefinition(inputDefinition) as vscode.McpStdioServerDefinition;

      expect(resolved).toBeDefined();
      expect(resolved.args).toContain('--cli-path');
      expect(resolved.args).toContain('/custom/beans/path');
      expect(resolved.args).toContain('--port');
      expect(resolved.args).toContain('49731');
    });

    it('should preserve label and version from input definition', () => {
      const inputDefinition = new vscode.McpStdioServerDefinition('Custom Label', process.execPath, [], {}, '1.2.3');

      const resolved = mcpIntegration.resolveMcpServerDefinition(inputDefinition) as vscode.McpStdioServerDefinition;

      expect(resolved.label).toBe('Custom Label');
      expect(resolved.version).toBe('0.1.0'); // Uses extension version, not input version
    });

    it('should include workspace root in resolved args', () => {
      const inputDefinition = new vscode.McpStdioServerDefinition('Beans Commands', process.execPath, [], {}, '0.1.0');

      const resolved = mcpIntegration.resolveMcpServerDefinition(inputDefinition) as vscode.McpStdioServerDefinition;

      expect(resolved.args).toContain('--workspace');
      expect(resolved.args).toContain('/workspace/root');
    });
  });

  describe('MCP Commands', () => {
    beforeEach(() => {
      mcpIntegration.register();
    });

    it('should fire onDidChange event when refreshDefinitions is called', () => {
      let eventFired = false;
      mcpIntegration.onDidChangeMcpServerDefinitions(() => {
        eventFired = true;
      });

      const refreshCommand = registeredCommands.get('beans.mcp.refreshDefinitions');
      refreshCommand?.();

      expect(eventFired).toBe(true);
    });

    it('should show server info when showServerInfo is called', async () => {
      const showInfoMessageSpy = vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue(undefined as any);

      const showServerInfo = registeredCommands.get('beans.mcp.showServerInfo');
      await showServerInfo?.();

      expect(showInfoMessageSpy).toHaveBeenCalled();
      const message = showInfoMessageSpy.mock.calls[0][0] as string;
      expect(message).toContain('Beans MCP');
      expect(message).toContain(process.execPath);
    });

    it('should copy command when showServerInfo returns "Copy command"', async () => {
      const writeTextSpy = vi.spyOn((vscode.env as any).clipboard, 'writeText').mockResolvedValue(undefined);
      vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Copy command' as any);

      const showServerInfo = registeredCommands.get('beans.mcp.showServerInfo');
      await showServerInfo?.();

      expect(writeTextSpy).toHaveBeenCalledTimes(1);
      expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining('beans-mcp-server.js'));
    });

    it('should show logs when showServerInfo returns "Open logs"', async () => {
      const loggerShowSpy = vi.spyOn(BeansOutput.getInstance(), 'show');
      vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Open logs' as any);

      const showServerInfo = registeredCommands.get('beans.mcp.showServerInfo');
      await showServerInfo?.();

      expect(loggerShowSpy).toHaveBeenCalledTimes(1);
    });

    it('should open settings when openConfig is called', async () => {
      const executeCommandSpy = vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

      const openConfig = registeredCommands.get('beans.mcp.openConfig');
      await openConfig?.();

      expect(executeCommandSpy).toHaveBeenCalledWith('workbench.action.openSettings', 'mcp');
    });

    it('should show logs when openLogs command is called', () => {
      const loggerShowSpy = vi.spyOn(BeansOutput.getInstance(), 'show');

      const openLogs = registeredCommands.get('beans.mcp.openLogs');
      openLogs?.();

      expect(loggerShowSpy).toHaveBeenCalledTimes(1);
    });
  });
});
