import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { BeansChatIntegration } from './beans/chat';
import { BeansCommands } from './beans/commands';
import {
  BeansConfigManager,
  buildBeansCopilotInstructions,
  buildBeansCopilotSkill,
  COPILOT_INSTRUCTIONS_RELATIVE_PATH,
  COPILOT_SKILL_RELATIVE_PATH,
  removeBeansCopilotSkill,
  writeBeansCopilotInstructions,
  writeBeansCopilotSkill,
} from './beans/config';
import { BeansDetailsViewProvider } from './beans/details';
import { BeansOutput } from './beans/logging';
import { BeansMcpIntegration } from './beans/mcp';
import { BeansCLINotFoundError } from './beans/model';
import { BeansPreviewProvider } from './beans/preview';
import { BeansService } from './beans/service';
import { BeansFilterManager } from './beans/tree';
import { ActiveBeansProvider, CompletedBeansProvider, DraftBeansProvider } from './beans/tree/providers';
import { registerBeansTreeViews } from './beans/tree/registerBeansTreeViews';

let beansService: BeansService | undefined;
let logger: BeansOutput;
let activeProvider: ActiveBeansProvider | undefined;
let completedProvider: CompletedBeansProvider | undefined;
let draftProvider: DraftBeansProvider | undefined;
let filterManager: BeansFilterManager | undefined;
let detailsProvider: BeansDetailsViewProvider | undefined;
let mcpIntegration: BeansMcpIntegration | undefined;
let chatIntegration: BeansChatIntegration | undefined;
let initPromptDismissed = false; // Track if user dismissed init prompt in this session
let aiArtifactSyncInProgress = false;
const ARTIFACT_GENERATION_PREF_KEY = 'beans.ai.artifactsGenerationPreference';

/**
 * Extension activation entry point
 */
export async function activate(context: vscode.ExtensionContext) {
  logger = BeansOutput.getInstance();
  logger.info('Activating Beans extension...');

  // Get workspace root
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    logger.warn('No workspace folder open');
    return;
  }

  // Check if extension should only enable for initialized workspaces
  const config = vscode.workspace.getConfiguration('beans');
  const enableOnlyIfInitialized = config.get<boolean>('enableOnlyIfInitialized', false);
  const aiEnabled = config.get<boolean>('ai.enabled', true);

  await vscode.commands.executeCommand('setContext', 'beans.aiEnabled', aiEnabled);

  if (enableOnlyIfInitialized) {
    // Check for .beans.yml in workspace
    const configFiles = await vscode.workspace.findFiles('.beans.yml', null, 1);
    if (configFiles.length === 0) {
      logger.info('Extension set to enable only if initialized, but .beans.yml not found. Skipping activation.');
      return;
    }
  }

  try {
    // Mirror output channel logs to a file that MCP tools can read.
    const outputMirrorPath = path.join(workspaceFolder.uri.fsPath, '.beans', '.vscode', 'beans-output.log');
    logger.setMirrorFilePath(outputMirrorPath);

    beansService = new BeansService(workspaceFolder.uri.fsPath);
    const configuredCliPath = vscode.workspace.getConfiguration('beans').get<string>('cliPath', 'beans');

    // Register MCP integration provider and related troubleshooting commands only when AI features are enabled.
    if (aiEnabled) {
      mcpIntegration = new BeansMcpIntegration(context, workspaceFolder.uri.fsPath, configuredCliPath);
      mcpIntegration.register();

      chatIntegration = new BeansChatIntegration(context, beansService);
      chatIntegration.register();
    } else {
      logger.info('AI integrations are disabled via beans.ai.enabled=false');
    }

    // Check if beans CLI is available
    const cliAvailable = await beansService.checkCLIAvailable();
    if (!cliAvailable) {
      await promptForCLIInstallation();
      return; // Don't proceed with activation if CLI not found
    }

    // Register preview provider
    const previewProvider = new BeansPreviewProvider(beansService);
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('beans-preview', previewProvider));

    // Register details webview provider (needed before tree views)
    detailsProvider = new BeansDetailsViewProvider(context.extensionUri, beansService);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(BeansDetailsViewProvider.viewType, detailsProvider)
    );

    // NOTE: search previously used a webview view provider. The tree-based search view
    // is registered later with the other tree views (when workspace is initialized).

    // Register filter manager (needed before tree views)
    filterManager = new BeansFilterManager();
    context.subscriptions.push(filterManager);

    const isInitialized = await beansService.checkInitialized();
    await vscode.commands.executeCommand('setContext', 'beans.initialized', isInitialized);

    if (!isInitialized) {
      await promptForInitialization(context, beansService, workspaceFolder.uri.fsPath);
    } else {
      logger.info('Beans workspace detected and initialized');

      // Set context for views
      await vscode.commands.executeCommand('setContext', 'beans.initialized', true);

      // Register tree views when initialized
      registerTreeViews(context, beansService, filterManager, detailsProvider);
      triggerCopilotAiArtifactSync(context, beansService, workspaceFolder.uri.fsPath, aiEnabled);
    }

    // Register config manager
    const configManager = new BeansConfigManager(workspaceFolder.uri.fsPath);

    // Register commands
    const beansCommands = new BeansCommands(
      beansService,
      context,
      previewProvider,
      filterManager,
      configManager,
      detailsProvider
    );
    beansCommands.registerAll();
    // Register beans.showOutput command (always available)
    context.subscriptions.push(
      vscode.commands.registerCommand('beans.showOutput', () => {
        logger.show();
      })
    );
    context.subscriptions.push(
      vscode.commands.registerCommand('beans.details.back', async () => {
        if (!detailsProvider) {
          return;
        }
        await detailsProvider.goBackFromHistory();
      })
    );
    // Register beans.init command (special case - needed before initialization)
    context.subscriptions.push(
      vscode.commands.registerCommand('beans.init', async () => {
        if (!beansService) {
          vscode.window.showErrorMessage('Beans service not initialized');
          return;
        }

        try {
          await beansService.init();
          await vscode.commands.executeCommand('setContext', 'beans.initialized', true);

          // Register tree views after successful initialization
          // filterManager and detailsProvider are guaranteed to exist
          registerTreeViews(context, beansService, filterManager!, detailsProvider!);

          const aiEnabledNow = vscode.workspace.getConfiguration('beans').get<boolean>('ai.enabled', true);
          triggerCopilotAiArtifactSync(context, beansService, workspaceFolder.uri.fsPath, aiEnabledNow);

          vscode.window.showInformationMessage('Beans initialized successfully!');
          logger.info('Beans initialized via command');
        } catch (error) {
          const message = `Failed to initialize Beans: ${(error as Error).message}`;
          logger.error(message, error as Error);
          vscode.window.showErrorMessage(message);
        }
      })
    );

    // Register global refresh command that refreshes all providers
    context.subscriptions.push(
      vscode.commands.registerCommand('beans.refreshAll', () => {
        logger.info('Refreshing all tree views');
        activeProvider?.refresh();
        completedProvider?.refresh();
        draftProvider?.refresh();
      })
    );

    // Watch .beans folder for external changes (CLI, editor, git, etc.)
    const beansWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceFolder, '.beans/**')
    );
    const debounceMs = vscode.workspace.getConfiguration('beans').get<number>('fileWatcher.debounceMs', 20000);
    const debouncedRefresh = debounceRefresh(() => {
      logger.debug('File change detected in .beans/, refreshing');
      vscode.commands.executeCommand('beans.refreshAll');
    }, debounceMs);
    beansWatcher.onDidCreate(debouncedRefresh);
    beansWatcher.onDidChange(debouncedRefresh);
    beansWatcher.onDidDelete(debouncedRefresh);
    context.subscriptions.push(beansWatcher);

    // Watch for configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('beans')) {
          logger.refreshConfig();
          logger.info('Configuration updated');
        }

        if (e.affectsConfiguration('beans.ai.enabled')) {
          const aiEnabledNow = vscode.workspace.getConfiguration('beans').get<boolean>('ai.enabled', true);
          void vscode.commands.executeCommand('setContext', 'beans.aiEnabled', aiEnabledNow);
          logger.info(`AI feature visibility updated: beans.aiEnabled=${aiEnabledNow}`);
        }
      })
    );

    logger.info('Beans extension activated successfully');
  } catch (error) {
    logger.error('Failed to activate Beans extension', error as Error);

    // Handle CLI not found error specifically
    if (error instanceof BeansCLINotFoundError) {
      await promptForCLIInstallation();
    } else if (error instanceof Error) {
      vscode.window
        .showErrorMessage(`Beans extension activation failed: ${error.message}`, 'Show Output')
        .then(selection => {
          if (selection === 'Show Output') {
            logger.show();
          }
        });
    } else {
      vscode.window
        .showErrorMessage('Beans extension activation failed with an unknown error', 'Show Output')
        .then(selection => {
          if (selection === 'Show Output') {
            logger.show();
          }
        });
    }
  }
}

/**
 * Prompt user to install Beans CLI
 */
async function promptForCLIInstallation(): Promise<void> {
  const result = await vscode.window.showErrorMessage(
    'Beans CLI is not installed or not found in PATH. Please install it to use this extension.',
    'Install Instructions',
    'Configure Path',
    'Dismiss'
  );

  if (result === 'Install Instructions') {
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/hmans/beans#installation'));
  } else if (result === 'Configure Path') {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'beans.cliPath');
  }
}

/**
 * Prompt user to initialize Beans in workspace
 */
async function promptForInitialization(
  context: vscode.ExtensionContext,
  service: BeansService,
  workspaceRoot: string
): Promise<void> {
  const config = vscode.workspace.getConfiguration('beans');
  if (!config.get<boolean>('autoInit.enabled', true)) {
    return;
  }

  // Don't prompt again if user already dismissed in this session
  if (initPromptDismissed) {
    return;
  }

  const result = await vscode.window.showInformationMessage(
    'Beans is not initialized in this workspace. Would you like to initialize it now?',
    'Initialize',
    'Learn More',
    'Not Now'
  );

  if (result === 'Initialize') {
    try {
      await service.init();
      await vscode.commands.executeCommand('setContext', 'beans.initialized', true);

      // Register tree views after successful initialization
      // filterManager and detailsProvider are guaranteed to exist since they're created before this
      registerTreeViews(context, service, filterManager!, detailsProvider!);

      const aiEnabledNow = vscode.workspace.getConfiguration('beans').get<boolean>('ai.enabled', true);
      triggerCopilotAiArtifactSync(context, service, workspaceRoot, aiEnabledNow);

      vscode.window.showInformationMessage('Beans initialized successfully!');
      logger.info('Beans initialized in workspace');
    } catch (error) {
      if (error instanceof Error) {
        const message = `Failed to initialize Beans: ${error.message}`;
        logger.error(message, error);
        vscode.window.showErrorMessage(message, 'Show Output').then(selection => {
          if (selection === 'Show Output') {
            logger.show();
          }
        });
      } else {
        logger.error('Failed to initialize Beans with unknown error', new Error(String(error)));
        vscode.window.showErrorMessage('Failed to initialize Beans', 'Show Output').then(selection => {
          if (selection === 'Show Output') {
            logger.show();
          }
        });
      }
    }
  } else if (result === 'Learn More') {
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/hmans/beans'));
  } else if (result === 'Not Now') {
    // Remember dismissal for this session
    initPromptDismissed = true;
    logger.info('User dismissed initialization prompt');
  }
}

async function shouldGenerateCopilotInstructionsOnInit(
  context: vscode.ExtensionContext,
  aiEnabled: boolean,
  workspaceRoot: string
): Promise<boolean> {
  if (!aiEnabled) {
    return false;
  }

  const preference = context.workspaceState.get<'always' | 'never'>(ARTIFACT_GENERATION_PREF_KEY);
  if (preference === 'always') {
    logger.info('Using saved AI artifact generation preference: always');
    return true;
  }
  if (preference === 'never') {
    logger.info('Skipping AI artifact generation due to saved workspace preference');
    return false;
  }

  if (await hasCopilotArtifacts(workspaceRoot)) {
    logger.info('Copilot instruction and skill artifacts already exist; skipping generation prompt');
    return false;
  }

  const selection = await vscode.window.showInformationMessage(
    'Generate the Copilot instructions file for this workspace now? (Also refreshes the Beans Copilot skill file.)',
    'Generate now',
    'Not now',
    'Never for this workspace'
  );

  if (selection === 'Generate now') {
    logger.info('User opted in to generate AI artifacts for this workspace');
    return true;
  }

  if (selection === 'Never for this workspace') {
    await context.workspaceState.update(ARTIFACT_GENERATION_PREF_KEY, 'never');
    logger.info('User opted out of AI artifact generation for this workspace');
    return false;
  }

  logger.info('User skipped AI artifact generation for now');
  return false;
}

async function hasCopilotArtifacts(primaryWorkspaceRoot: string): Promise<boolean> {
  // Check the primary workspace root first.
  if (
    (await workspaceFileExists(primaryWorkspaceRoot, COPILOT_INSTRUCTIONS_RELATIVE_PATH)) &&
    (await workspaceFileExists(primaryWorkspaceRoot, COPILOT_SKILL_RELATIVE_PATH))
  ) {
    return true;
  }

  // In multi-root workspaces, artifacts may live in another folder root.
  const folderRoots = (vscode.workspace.workspaceFolders || []).map(folder => folder.uri.fsPath);
  for (const root of folderRoots) {
    if (root === primaryWorkspaceRoot) {
      continue;
    }
    const hasInstructions = await workspaceFileExists(root, COPILOT_INSTRUCTIONS_RELATIVE_PATH);
    if (!hasInstructions) {
      continue;
    }
    const hasSkill = await workspaceFileExists(root, COPILOT_SKILL_RELATIVE_PATH);
    if (hasSkill) {
      logger.info(`Found existing Copilot artifacts in workspace folder: ${root}`);
      return true;
    }
  }

  return false;
}

async function ensureCopilotAiArtifacts(
  service: BeansService,
  workspaceRoot: string,
  aiEnabled: boolean
): Promise<void> {
  try {
    if (!aiEnabled) {
      await removeBeansCopilotSkill(workspaceRoot);
      logger.info('AI disabled; removed Beans Copilot skill file if present');
      return;
    }

    const primeOutput = await service.prime();
    const instructionsContent = buildBeansCopilotInstructions(primeOutput);
    const instructionsPath = await writeBeansCopilotInstructions(workspaceRoot, instructionsContent);
    logger.info(`Generated Copilot instructions from beans prime at ${instructionsPath}`);

    const skillContent = buildBeansCopilotSkill(primeOutput);
    const skillPath = await writeBeansCopilotSkill(workspaceRoot, skillContent);
    logger.info(`Generated Copilot skill at ${skillPath}`);
  } catch (error) {
    logger.warn('Failed to synchronize Copilot AI artifacts from beans prime', error as Error);
  }
}

function triggerCopilotAiArtifactSync(
  context: vscode.ExtensionContext,
  service: BeansService,
  workspaceRoot: string,
  aiEnabled: boolean
): void {
  if (aiArtifactSyncInProgress) {
    logger.debug('AI artifact synchronization already in progress; skipping duplicate trigger');
    return;
  }

  aiArtifactSyncInProgress = true;
  void (async () => {
    try {
      if (await shouldGenerateCopilotInstructionsOnInit(context, aiEnabled, workspaceRoot)) {
        await ensureCopilotAiArtifacts(service, workspaceRoot, aiEnabled);
      }
    } catch (error) {
      logger.warn('AI artifact synchronization failed', error as Error);
    } finally {
      aiArtifactSyncInProgress = false;
    }
  })();
}

async function workspaceFileExists(workspaceRoot: string, relativePath: string): Promise<boolean> {
  const absolutePath = path.resolve(workspaceRoot, relativePath);

  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    // Fall through to workspace search to support virtual/remote workspaces.
  }

  try {
    const normalizedRelativePath = relativePath.replace(/\\/g, '/');
    const matches = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceRoot, normalizedRelativePath),
      null,
      1
    );
    return matches.length > 0;
  } catch {
    return false;
  }
}

/**
 * Register tree views for all bean panes
 */
function registerTreeViews(
  context: vscode.ExtensionContext,
  service: BeansService,
  manager: BeansFilterManager,
  details: BeansDetailsViewProvider
): void {
  const providers = registerBeansTreeViews(context, service, manager, details, logger);
  activeProvider = providers.activeProvider;
  completedProvider = providers.completedProvider;
  draftProvider = providers.draftProvider;
}

/**
 * Create a debounced version of a callback.
 * Collapses rapid successive calls into a single invocation
 * after the specified delay.
 */
function debounceRefresh(callback: () => void, delayMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      callback();
    }, delayMs);
  };
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  logger?.info('Deactivating Beans extension');
  mcpIntegration = undefined;
  chatIntegration = undefined;
  aiArtifactSyncInProgress = false;
  logger?.dispose();
}
