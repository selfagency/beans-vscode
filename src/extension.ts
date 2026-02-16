import * as vscode from 'vscode';
import { BeansCommands } from './beans/commands';
import { BeansOutput } from './beans/logging';
import { BeansCLINotFoundError } from './beans/model';
import { BeansPreviewProvider } from './beans/preview';
import { BeansService } from './beans/service';
import { BeansDragAndDropController, BeansFilterManager } from './beans/tree';
import {
  ActiveBeansProvider,
  ArchivedBeansProvider,
  CompletedBeansProvider,
  DraftBeansProvider,
  ScrappedBeansProvider
} from './beans/tree/providers';

let beansService: BeansService | undefined;
let logger: BeansOutput;
let activeProvider: ActiveBeansProvider | undefined;
let completedProvider: CompletedBeansProvider | undefined;
let draftProvider: DraftBeansProvider | undefined;
let scrappedProvider: ScrappedBeansProvider | undefined;
let archivedProvider: ArchivedBeansProvider | undefined;
let filterManager: BeansFilterManager | undefined;
let initPromptDismissed = false; // Track if user dismissed init prompt in this session

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

  if (enableOnlyIfInitialized) {
    // Check for .beans.yml in workspace
    const configFiles = await vscode.workspace.findFiles('.beans.yml', null, 1);
    if (configFiles.length === 0) {
      logger.info('Extension set to enable only if initialized, but .beans.yml not found. Skipping activation.');
      return;
    }
  }

  try {
    beansService = new BeansService(workspaceFolder.uri.fsPath);

    // Check if beans CLI is available
    const cliAvailable = await beansService.checkCLIAvailable();
    if (!cliAvailable) {
      await promptForCLIInstallation();
      return; // Don't proceed with activation if CLI not found
    }

    const isInitialized = await beansService.checkInitialized();
    await vscode.commands.executeCommand('setContext', 'beans.initialized', isInitialized);

    if (!isInitialized) {
      await promptForInitialization(context, beansService);
    } else {
      logger.info('Beans workspace detected and initialized');

      // Set context for views
      await vscode.commands.executeCommand('setContext', 'beans.initialized', true);

      // Register tree views when initialized
      if (filterManager) {
        registerTreeViews(context, beansService, filterManager);
      }
    }

    // Register preview provider
    const previewProvider = new BeansPreviewProvider(beansService);
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('beans-preview', previewProvider));

    // Register filter manager
    filterManager = new BeansFilterManager();
    context.subscriptions.push(filterManager);

    // Register commands
    const beansCommands = new BeansCommands(beansService, context, previewProvider, filterManager);
    beansCommands.registerAll();
    // Register beans.showOutput command (always available)
    context.subscriptions.push(
      vscode.commands.registerCommand('beans.showOutput', () => {
        logger.show();
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
          if (filterManager) {
            registerTreeViews(context, beansService, filterManager);
          }

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
        scrappedProvider?.refresh();
        archivedProvider?.refresh();
      })
    );

    // Register beans.openConfig command
    context.subscriptions.push(
      vscode.commands.registerCommand('beans.openConfig', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          return;
        }
        const configPath = vscode.Uri.joinPath(workspaceFolder.uri, '.beans.yml');
        try {
          const doc = await vscode.workspace.openTextDocument(configPath);
          await vscode.window.showTextDocument(doc);
        } catch (error) {
          vscode.window.showErrorMessage('Could not open .beans.yml: ' + (error as Error).message);
        }
      })
    );

    // Watch for configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('beans')) {
          logger.refreshConfig();
          logger.info('Configuration updated');
        }
      })
    );

    logger.info('Beans extension activated successfully');
  } catch (error) {
    logger.error('Failed to activate Beans extension', error as Error);

    // Handle CLI not found error specifically
    if (error instanceof BeansCLINotFoundError) {
      await promptForCLIInstallation();
    } else {
      vscode.window.showErrorMessage(`Beans extension activation failed: ${(error as Error).message}`);
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
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/jfcantinz/beans#installation'));
  } else if (result === 'Configure Path') {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'beans.cliPath');
  }
}

/**
 * Prompt user to initialize Beans in workspace
 */
async function promptForInitialization(context: vscode.ExtensionContext, service: BeansService): Promise<void> {
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
      if (filterManager) {
        registerTreeViews(context, service, filterManager);
      }

      vscode.window.showInformationMessage('Beans initialized successfully!');
      logger.info('Beans initialized in workspace');
    } catch (error) {
      const message = `Failed to initialize Beans: ${(error as Error).message}`;
      logger.error(message, error as Error);
      vscode.window.showErrorMessage(message);
    }
  } else if (result === 'Learn More') {
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/jfcantinz/beans'));
  } else if (result === 'Not Now') {
    // Remember dismissal for this session
    initPromptDismissed = true;
    logger.info('User dismissed initialization prompt');
  }
}

/**
 * Register tree views for all bean panes
 */
function registerTreeViews(context: vscode.ExtensionContext, service: BeansService, manager: BeansFilterManager): void {
  // Create drag and drop controller
  const dragAndDropController = new BeansDragAndDropController(service);

  // Create providers and store in module variables for refresh
  activeProvider = new ActiveBeansProvider(service);
  completedProvider = new CompletedBeansProvider(service);
  draftProvider = new DraftBeansProvider(service);
  scrappedProvider = new ScrappedBeansProvider(service);
  archivedProvider = new ArchivedBeansProvider(service);

  // Subscribe to filter changes
  context.subscriptions.push(
    manager.onDidChangeFilter((viewId) => {
      const filter = manager.getFilter(viewId);
      const filterOptions = filter
        ? {
            searchFilter: filter.text,
            tagFilter: filter.tags,
            typeFilter: filter.types as any
            // Note: priorities not yet supported in TreeFilterOptions
          }
        : {};

      // Apply filter to the appropriate provider
      switch (viewId) {
        case 'beans.active':
          activeProvider?.setFilter(filterOptions);
          break;
        case 'beans.completed':
          completedProvider?.setFilter(filterOptions);
          break;
        case 'beans.draft':
          draftProvider?.setFilter(filterOptions);
          break;
        case 'beans.scrapped':
          scrappedProvider?.setFilter(filterOptions);
          break;
        case 'beans.archived':
          archivedProvider?.setFilter(filterOptions);
          break;
      }
    })
  );

  // Register tree views with drag and drop support
  const activeTreeView = vscode.window.createTreeView('beans.active', {
    treeDataProvider: activeProvider,
    showCollapseAll: true,
    dragAndDropController
  });

  const completedTreeView = vscode.window.createTreeView('beans.completed', {
    treeDataProvider: completedProvider,
    showCollapseAll: true,
    dragAndDropController
  });

  const draftTreeView = vscode.window.createTreeView('beans.draft', {
    treeDataProvider: draftProvider,
    showCollapseAll: true,
    dragAndDropController
  });

  const scrappedTreeView = vscode.window.createTreeView('beans.scrapped', {
    treeDataProvider: scrappedProvider,
    showCollapseAll: true,
    dragAndDropController
  });

  const archivedTreeView = vscode.window.createTreeView('beans.archived', {
    treeDataProvider: archivedProvider,
    showCollapseAll: true,
    dragAndDropController
  });

  // Add disposables
  context.subscriptions.push(activeTreeView, completedTreeView, draftTreeView, scrappedTreeView, archivedTreeView);

  logger.info('Tree views registered with drag-and-drop support');
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  logger?.info('Deactivating Beans extension');
  logger?.dispose();
}
