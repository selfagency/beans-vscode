/**
 * Module: beans/mcp
 *
 * Exposes an MCP (Model Context Protocol) server definition for the Beans
 * CLI. This integration allows external LLM-backed features (Copilot/MCP)
 * to connect to a local node-based MCP server that proxies requests to the
 * Beans CLI.
 *
 * Notes for contributors:
 * - The MCP server script lives in `dist/beans-mcp-server.js` and is launched
 *   via `process.execPath` to preserve Node resolution inside the extension
 * - `BEANS_VSCODE_MCP` and `BEANS_VSCODE_OUTPUT_LOG` env vars are set so the
 *   server can detect it runs inside the extension and mirror logs
 * - Provide unit tests that mock `vscode.workspace.getConfiguration` and the
 *   extension context to verify command/args/env composition
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { BeansOutput } from '../logging';

const MCP_PROVIDER_ID = 'beans.mcpServers';
const DEFAULT_MCP_PORT = 39173;

/**
 * Publishes the Beans MCP server definition to VS Code and exposes troubleshooting commands.
 */
export class BeansMcpIntegration implements vscode.McpServerDefinitionProvider<vscode.McpStdioServerDefinition> {
  private readonly logger = BeansOutput.getInstance();
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeMcpServerDefinitions = this.onDidChangeEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly workspaceRoot: string,
    private readonly cliPath: string
  ) {}

  register(): void {
    if (!vscode.lm?.registerMcpServerDefinitionProvider) {
      this.logger.warn('MCP server definition provider API is unavailable in this VS Code build');
      return;
    }

    this.context.subscriptions.push(vscode.lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, this));

    this.context.subscriptions.push(
      vscode.commands.registerCommand('beans.mcp.refreshDefinitions', () => {
        this.logger.info('Refreshing MCP server definitions');
        this.onDidChangeEmitter.fire();
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('beans.mcp.showServerInfo', async () => {
        const info = this.getServerInfo();
        await vscode.window
          .showInformationMessage(`Beans MCP: ${info.command} ${info.args.join(' ')}`, 'Copy command', 'Open logs')
          .then(async selection => {
            if (selection === 'Copy command') {
              await vscode.env.clipboard.writeText(`${info.command} ${info.args.join(' ')}`);
            } else if (selection === 'Open logs') {
              this.logger.show();
            }
          });
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('beans.mcp.openConfig', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'mcp');
      })
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand('beans.mcp.openLogs', () => {
        this.logger.show();
      })
    );

    this.context.subscriptions.push({ dispose: () => this.onDidChangeEmitter.dispose() });
  }

  provideMcpServerDefinitions(): vscode.ProviderResult<vscode.McpStdioServerDefinition[]> {
    const aiEnabled = vscode.workspace.getConfiguration('beans').get<boolean>('ai.enabled', true);
    if (!aiEnabled) {
      return [];
    }

    const mcpEnabled = vscode.workspace.getConfiguration('beans').get<boolean>('mcp.enabled', true);
    if (!mcpEnabled) {
      return [];
    }

    const info = this.getServerInfo();
    const definition = new vscode.McpStdioServerDefinition(
      'Beans Commands',
      info.command,
      info.args,
      info.env,
      info.version
    );
    return [definition];
  }

  resolveMcpServerDefinition(
    server: vscode.McpStdioServerDefinition
  ): vscode.ProviderResult<vscode.McpStdioServerDefinition> {
    // Allow users to override cli path at resolve-time before server launch.
    const configuredCliPath = vscode.workspace.getConfiguration('beans').get<string>('cliPath', this.cliPath);
    const info = this.getServerInfo(configuredCliPath);
    return new vscode.McpStdioServerDefinition(server.label, info.command, info.args, info.env, info.version);
  }

  private getServerInfo(cliPathOverride?: string): {
    command: string;
    args: string[];
    env: Record<string, string | number | null>;
    version: string;
  } {
    const config = vscode.workspace.getConfiguration('beans');
    const configuredPort = config.get<number>('mcp.port', DEFAULT_MCP_PORT);
    const mcpPort = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : DEFAULT_MCP_PORT;

    const command = process.execPath;
    const serverScript = path.join(this.context.extensionPath, 'dist', 'beans-mcp-server.js');
    const args = [
      serverScript,
      '--workspace',
      this.workspaceRoot,
      '--cli-path',
      cliPathOverride || this.cliPath,
      '--port',
      String(mcpPort),
    ];
    const outputLogPath = path.join(this.workspaceRoot, '.beans', '.vscode', 'beans-output.log');

    const version = (this.context.extension.packageJSON as { version?: string }).version || '0.1.0';

    return {
      command,
      args,
      env: {
        BEANS_VSCODE_MCP: '1',
        BEANS_VSCODE_OUTPUT_LOG: outputLogPath,
        BEANS_VSCODE_MCP_PORT: String(mcpPort),
        BEANS_MCP_PORT: String(mcpPort),
      },
      version,
    };
  }
}
