import * as vscode from 'vscode';
import { BeansService } from './beans/service';
import { BeansOutput } from './beans/logging';
import { BeansCLINotFoundError } from './beans/model';

let beansService: BeansService | undefined;
let logger: BeansOutput;

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
			await promptForInitialization(beansService);
		} else {
			logger.info('Beans workspace detected and initialized');
		}

		// Register commands
		registerCommands(context, beansService);

		// Watch for configuration changes
		context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration(e => {
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
async function promptForInitialization(service: BeansService): Promise<void> {
	const config = vscode.workspace.getConfiguration('beans');
	if (!config.get<boolean>('autoInit.enabled', true)) {
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
			vscode.window.showInformationMessage('Beans initialized successfully!');
			logger.info('Beans initialized in workspace');
		} catch (error) {
			const message = `Failed to initialize Beans: ${(error as Error).message}`;
			logger.error(message, error as Error);
			vscode.window.showErrorMessage(message);
		}
	} else if (result === 'Learn More') {
		vscode.env.openExternal(vscode.Uri.parse('https://github.com/jfcantinz/beans'));
	}
}

/**
 * Register extension commands
 */
function registerCommands(context: vscode.ExtensionContext, service: BeansService): void {
	// Init command
	context.subscriptions.push(
		vscode.commands.registerCommand('beans.init', async () => {
			try {
				await service.init();
				await vscode.commands.executeCommand('setContext', 'beans.initialized', true);
				vscode.window.showInformationMessage('Beans initialized successfully!');
				logger.info('Beans initialized via command');
			} catch (error) {
				const message = `Failed to initialize Beans: ${(error as Error).message}`;
				logger.error(message, error as Error);
				vscode.window.showErrorMessage(message);
			}
		})
	);

	// Refresh command (placeholder for tree refresh)
	context.subscriptions.push(
		vscode.commands.registerCommand('beans.refresh', () => {
			logger.info('Refresh command triggered');
			vscode.window.showInformationMessage('Beans refresh triggered');
		})
	);

	// Open config command
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

	logger.info('Commands registered');
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
	logger?.info('Deactivating Beans extension');
	logger?.dispose();
}

