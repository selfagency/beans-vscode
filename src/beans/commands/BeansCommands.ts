import * as vscode from 'vscode';
import { BeansService } from '../service';
import { BeansOutput } from '../logging';
import { Bean } from '../model';

const logger = BeansOutput.getInstance();

/**
 * Core commands for Beans extension matching TUI parity
 */
export class BeansCommands {
	constructor(
		private readonly service: BeansService,
		private readonly context: vscode.ExtensionContext
	) {}

	/**
	 * Register all commands with VS Code
	 */
	public registerAll(): void {
		// View and navigation commands
		this.registerCommand('beans.view', this.viewBean.bind(this));
		this.registerCommand('beans.create', this.createBean.bind(this));
		this.registerCommand('beans.edit', this.editBean.bind(this));

		// Status management
		this.registerCommand('beans.setStatus', this.setStatus.bind(this));

		// Type management
		this.registerCommand('beans.setType', this.setType.bind(this));

		// Priority management
		this.registerCommand('beans.setPriority', this.setPriority.bind(this));

		// Parent/relationship management
		this.registerCommand('beans.setParent', this.setParent.bind(this));
		this.registerCommand('beans.removeParent', this.removeParent.bind(this));
		this.registerCommand('beans.editBlocking', this.editBlocking.bind(this));

		// Utility commands
		this.registerCommand('beans.copyId', this.copyId.bind(this));
		this.registerCommand('beans.delete', this.deleteBean.bind(this));

		// Tree refresh and filtering
		this.registerCommand('beans.refresh',() => {
			vscode.commands.executeCommand('beans.refreshAll');
		});
		this.registerCommand('beans.filter', this.filter.bind(this));
		this.registerCommand('beans.sort', this.sort.bind(this));

		logger.info('All Beans commands registered');
	}

	/**
	 * Helper to register command with disposable tracking
	 */
	private registerCommand(command: string, callback: (...args: any[]) => any): void {
		const disposable = vscode.commands.registerCommand(command, callback);
		this.context.subscriptions.push(disposable);
	}

	/**
	 * View bean in markdown preview
	 */
	private async viewBean(bean?: Bean): Promise<void> {
		try {
			if (!bean) {
				bean = await this.pickBean('Select bean to view');
				if (!bean) {
					return;
				}
			}

			// TODO: Open bean in preview/editor (will be implemented in detail/preview task)
			vscode.window.showInformationMessage(`Viewing bean: ${bean.title} (${bean.code})`);
			logger.info(`Viewed bean ${bean.code}`);
		} catch (error) {
			const message = `Failed to view bean: ${(error as Error).message}`;
			logger.error(message, error as Error);
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Create new bean
	 */
	private async createBean(): Promise<void> {
		try {
			// Get bean title
			const title = await vscode.window.showInputBox({
				prompt: 'Bean title',
				placeHolder: 'Enter bean title',
				validateInput: (value) => {
					if (!value || value.trim().length === 0) {
						return 'Title is required';
					}
					return undefined;
				}
			});

			if (!title) {
				return;
			}

			// Get bean type
			const type = await vscode.window.showQuickPick(
				['milestone', 'epic', 'feature', 'bug', 'task'],
				{
					placeHolder: 'Select type',
					title: 'Bean Type'
				}
			);

			if (!type) {
				return;
			}

			// Get bean description (optional)
			const description = await vscode.window.showInputBox({
				prompt: 'Bean description (optional)',
				placeHolder: 'Enter description'
			});

			// Create bean
			const bean = await this.service.createBean({
				title: title.trim(),
				type: type as any,
				description: description || undefined
			});

			vscode.window.showInformationMessage(`Created bean: ${bean.code}`);
			logger.info(`Created bean ${bean.code}: ${bean.title}`);

			// Refresh trees
			await vscode.commands.executeCommand('beans.refreshAll');
		} catch (error) {
			const message = `Failed to create bean: ${(error as Error).message}`;
			logger.error(message, error as Error);
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Edit bean (open in editor)
	 */
	private async editBean(bean?: Bean): Promise<void> {
		try {
			if (!bean) {
				bean = await this.pickBean('Select bean to edit');
				if (!bean) {
					return;
				}
			}

			// TODO: Open bean file in editor (will be enhanced in detail/preview task)
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders) {
				throw new Error('No workspace folder open');
			}

			const beanPath = vscode.Uri.joinPath(workspaceFolders[0].uri, '.beans', bean.path);
			const document = await vscode.workspace.openTextDocument(beanPath);
			await vscode.window.showTextDocument(document);

			logger.info(`Opened bean ${bean.code} for editing`);
		} catch (error) {
			const message = `Failed to edit bean: ${(error as Error).message}`;
			logger.error(message, error as Error);
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Set bean status
	 */
	private async setStatus(bean?: Bean): Promise<void> {
		try {
			if (!bean) {
				bean = await this.pickBean('Select bean to update status');
				if (!bean) {
					return;
				}
			}

			const config = await this.service.getConfig();
			const statuses = config.statuses || ['todo', 'in-progress', 'completed', 'scrapped', 'draft'];

			const status = await vscode.window.showQuickPick(statuses, {
				placeHolder: `Current: ${bean.status}`,
				title: `Set Status for ${bean.code}`
			});

			if (!status || status === bean.status) {
				return;
			}

			await this.service.updateBean(bean.id, { status: status as any });
			vscode.window.showInformationMessage(`Updated ${bean.code} status to ${status}`);
			logger.info(`Updated bean ${bean.code} status to ${status}`);

			// Refresh trees
			await vscode.commands.executeCommand('beans.refreshAll');
		} catch (error) {
			const message = `Failed to set status: ${(error as Error).message}`;
			logger.error(message, error as Error);
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Set bean type
	 */
	private async setType(bean?: Bean): Promise<void> {
		try {
			if (!bean) {
				bean = await this.pickBean('Select bean to update type');
				if (!bean) {
					return;
				}
			}

			const config = await this.service.getConfig();
			const types = config.types || ['milestone', 'epic', 'feature', 'bug', 'task'];

			const type = await vscode.window.showQuickPick(types, {
				placeHolder: `Current: ${bean.type}`,
				title: `Set Type for ${bean.code}`
			});

			if (!type || type === bean.type) {
				return;
			}

			await this.service.updateBean(bean.id, { type: type as any });
			vscode.window.showInformationMessage(`Updated ${bean.code} type to ${type}`);
			logger.info(`Updated bean ${bean.code} type to ${type}`);

			// Refresh trees
			await vscode.commands.executeCommand('beans.refreshAll');
		} catch (error) {
			const message = `Failed to set type: ${(error as Error).message}`;
			logger.error(message, error as Error);
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Set bean priority
	 */
	private async setPriority(bean?: Bean): Promise<void> {
		try {
			if (!bean) {
				bean = await this.pickBean('Select bean to update priority');
				if (!bean) {
					return;
				}
			}

			const config = await this.service.getConfig();
			const priorities = config.priorities || ['critical', 'high', 'normal', 'low', 'deferred'];

			const priority = await vscode.window.showQuickPick(priorities, {
				placeHolder: bean.priority ? `Current: ${bean.priority}` : 'No priority set',
				title: `Set Priority for ${bean.code}`
			});

			if (!priority || priority === bean.priority) {
				return;
			}

			await this.service.updateBean(bean.id, { priority: priority as any });
			vscode.window.showInformationMessage(`Updated ${bean.code} priority to ${priority}`);
			logger.info(`Updated bean ${bean.code} priority to ${priority}`);

			// Refresh trees
			await vscode.commands.executeCommand('beans.refreshAll');
		} catch (error) {
			const message = `Failed to set priority: ${(error as Error).message}`;
			logger.error(message, error as Error);
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Set bean parent
	 */
	private async setParent(bean?: Bean): Promise<void> {
		try {
			if (!bean) {
				bean = await this.pickBean('Select bean to set parent');
				if (!bean) {
					return;
				}
			}

			// Get list of potential parents (exclude self and descendants)
			const allBeans = await this.service.listBeans();
			const potentialParents = allBeans.filter(b => {
				// Can't be own parent
				if (b.id === bean!.id) {
					return false;
				}
				// Can't be a descendant
				if (b.parent === bean!.id) {
					return false;
				}
				return true;
			});

			const parentItems = potentialParents.map(b => ({
				label: `${b.code}: ${b.title}`,
				description: `${b.type} • ${b.status}`,
				bean: b
			}));

			const selected = await vscode.window.showQuickPick(parentItems, {
				placeHolder: bean.parent ? `Current parent: ${bean.parent}` : 'No parent set',
				title: `Set Parent for ${bean.code}`
			});

			if (!selected) {
				return;
			}

			await this.service.updateBean(bean.id, { parent: selected.bean.id });
			vscode.window.showInformationMessage(
				`Set ${bean.code} parent to ${selected.bean.code}`
			);
			logger.info(`Set bean ${bean.code} parent to ${selected.bean.code}`);

			// Refresh trees
			await vscode.commands.executeCommand('beans.refreshAll');
		} catch (error) {
			const message = `Failed to set parent: ${(error as Error).message}`;
			logger.error(message, error as Error);
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Remove bean parent
	 */
	private async removeParent(bean?: Bean): Promise<void> {
		try {
			if (!bean) {
				bean = await this.pickBean('Select bean to remove parent');
				if (!bean) {
					return;
				}
			}

			if (!bean.parent) {
				vscode.window.showInformationMessage(`${bean.code} has no parent`);
				return;
			}

			const result = await vscode.window.showInformationMessage(
				`Remove parent from ${bean.code}?`,
				{ modal: true },
				'Yes',
				'No'
			);

			if (result !== 'Yes') {
				return;
			}

			await this.service.updateBean(bean.id, { parent: undefined });
			vscode.window.showInformationMessage(`Removed parent from ${bean.code}`);
			logger.info(`Removed parent from bean ${bean.code}`);

			// Refresh trees
			await vscode.commands.executeCommand('beans.refreshAll');
		} catch (error) {
			const message = `Failed to remove parent: ${(error as Error).message}`;
			logger.error(message, error as Error);
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Edit blocking relationships
	 */
	private async editBlocking(bean?: Bean): Promise<void> {
		try {
			if (!bean) {
				bean = await this.pickBean('Select bean to edit blocking');
				if (!bean) {
					return;
				}
			}

			// TODO: Implement blocking/blocked-by management UI
			vscode.window.showInformationMessage(
				`Blocking management for ${bean.code} - Coming soon!`
			);
			logger.info(`Opened blocking management for bean ${bean.code}`);
		} catch (error) {
			const message = `Failed to edit blocking: ${(error as Error).message}`;
			logger.error(message, error as Error);
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Copy bean ID to clipboard
	 */
	private async copyId(bean?: Bean): Promise<void> {
		try {
			if (!bean) {
				bean = await this.pickBean('Select bean to copy ID');
				if (!bean) {
					return;
				}
			}

			await vscode.env.clipboard.writeText(bean.id);
			vscode.window.showInformationMessage(`Copied ${bean.code} ID to clipboard`);
			logger.info(`Copied bean ${bean.code} ID to clipboard`);
		} catch (error) {
			const message = `Failed to copy ID: ${(error as Error).message}`;
			logger.error(message, error as Error);
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Delete bean (only for scrapped and draft)
	 */
	private async deleteBean(bean?: Bean): Promise<void> {
		try {
			if (!bean) {
				bean = await this.pickBean('Select bean to delete', ['scrapped', 'draft']);
				if (!bean) {
					return;
				}
			}

			// Verify bean can be deleted
			if (bean.status !== 'scrapped' && bean.status !== 'draft') {
				vscode.window.showWarningMessage(
					`Only scrapped and draft beans can be deleted. ${bean.code} is ${bean.status}.`
				);
				return;
			}

			const result = await vscode.window.showWarningMessage(
				`Delete bean ${bean.code}: ${bean.title}?`,
				{ modal: true },
				'Delete',
				'Cancel'
			);

			if (result !== 'Delete') {
				return;
			}

			await this.service.deleteBean(bean.id);
			vscode.window.showInformationMessage(`Deleted bean ${bean.code}`);
			logger.info(`Deleted bean ${bean.code}`);

			// Refresh trees
			await vscode.commands.executeCommand('beans.refreshAll');
		} catch (error) {
			const message = `Failed to delete bean: ${(error as Error).message}`;
			logger.error(message, error as Error);
			vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * Filter beans (placeholder for now)
	 */
	private async filter(): Promise<void> {
		// TODO: Implement filtering UI (will be done in filtering task)
		vscode.window.showInformationMessage('Filter command - Coming soon!');
		logger.info('Filter command invoked');
	}

	/**
	 * Sort beans (placeholder for now)
	 */
	private async sort(): Promise<void> {
		// TODO: Implement sort mode selection UI
		vscode.window.showInformationMessage('Sort command - Coming soon!');
		logger.info('Sort command invoked');
	}

	/**
	 * Helper to pick a bean from quick pick
	 */
	private async pickBean(
		prompt: string,
		statusFilter?: string[]
	): Promise<Bean | undefined> {
		const beans = await this.service.listBeans();
		
		const filteredBeans = statusFilter
			? beans.filter(b => statusFilter.includes(b.status))
			: beans;

		if (filteredBeans.length === 0) {
			vscode.window.showInformationMessage('No beans available');
			return undefined;
		}

		const items = filteredBeans.map(bean => ({
			label: `${bean.code}: ${bean.title}`,
			description: `${bean.type} • ${bean.status}${bean.priority ? ` • ${bean.priority}` : ''}`,
			bean
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: prompt,
			matchOnDescription: true
		});

		return selected?.bean;
	}
}
