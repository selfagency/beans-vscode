import * as vscode from 'vscode';
import { Bean, BeanStatus, BeanType } from '../model';
import { BeansService } from '../service';
import { BeansOutput } from '../logging';
import { BeanTreeItem } from './BeanTreeItem';

/**
 * Sort mode for bean tree
 */
export type SortMode = 'status-priority-type-title' | 'updated' | 'created' | 'id';

/**
 * Filter options for bean tree
 */
export interface TreeFilterOptions {
	statusFilter?: BeanStatus[];
	typeFilter?: BeanType[];
	searchFilter?: string;
	tagFilter?: string[];
}

/**
 * Tree data provider for beans with hierarchical display and sorting
 */
export class BeansTreeDataProvider implements vscode.TreeDataProvider<BeanTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<BeanTreeItem | undefined | null | void> = 
		new vscode.EventEmitter<BeanTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<BeanTreeItem | undefined | null | void> = 
		this._onDidChangeTreeData.event;

	private beans: Bean[] = [];
	private sortMode: SortMode;
	private filterOptions: TreeFilterOptions = {};
	private logger = BeansOutput.getInstance();

	constructor(
		private readonly service: BeansService,
		private readonly statusFilter?: BeanStatus[]
	) {
		// Get sort mode from configuration
		const config = vscode.workspace.getConfiguration('beans');
		this.sortMode = config.get<SortMode>('defaultSortMode', 'status-priority-type-title');
	}

	/**
	 * Refresh the tree view
	 */
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	/**
	 * Set sort mode and refresh
	 */
	setSortMode(mode: SortMode): void {
		this.sortMode = mode;
		this.refresh();
	}

	/**
	 * Set filter options and refresh
	 */
	setFilter(options: TreeFilterOptions): void {
		this.filterOptions = options;
		this.refresh();
	}

	/**
	 * Clear all filters and refresh
	 */
	clearFilter(): void {
		this.filterOptions = {};
		this.refresh();
	}

	/**
	 * Get tree item for a bean
	 */
	getTreeItem(element: BeanTreeItem): vscode.TreeItem {
		return element;
	}

	/**
	 * Get children for a tree element
	 */
	async getChildren(element?: BeanTreeItem): Promise<BeanTreeItem[]> {
		if (!element) {
			// Root level - fetch all beans and build tree
			await this.fetchBeans();
			return this.buildTree();
		} else {
			// Child level - find beans with this parent
			const children = this.beans.filter(bean => bean.parent === element.bean.id);
			return this.sortBeans(children).map(bean => this.createTreeItem(bean));
		}
	}

	/**
	 * Fetch beans from service
	 */
	private async fetchBeans(): Promise<void> {
		try {
			const options: { status?: string[]; type?: string[]; search?: string } = {};

			// Apply status filter (from constructor or filter options)
			if (this.statusFilter) {
				options.status = this.statusFilter;
			} else if (this.filterOptions.statusFilter) {
				options.status = this.filterOptions.statusFilter;
			}

			// Apply type filter
			if (this.filterOptions.typeFilter) {
				options.type = this.filterOptions.typeFilter;
			}

			// Apply search filter
			if (this.filterOptions.searchFilter) {
				options.search = this.filterOptions.searchFilter;
			}

			this.beans = await this.service.listBeans(options);

			// Apply tag filter (client-side since CLI might not support it)
			if (this.filterOptions.tagFilter && this.filterOptions.tagFilter.length > 0) {
				this.beans = this.beans.filter(bean =>
					this.filterOptions.tagFilter!.some(tag => bean.tags.includes(tag))
				);
			}

			this.logger.debug(`Fetched ${this.beans.length} beans`);
		} catch (error) {
			this.logger.error('Failed to fetch beans', error as Error);
			vscode.window.showErrorMessage(`Failed to fetch beans: ${(error as Error).message}`);
			this.beans = [];
		}
	}

	/**
	 * Build hierarchical tree from flat bean list
	 */
	private buildTree(): BeanTreeItem[] {
		// Find root beans (no parent)
		const rootBeans = this.beans.filter(bean => !bean.parent);
		
		// Sort and create tree items
		return this.sortBeans(rootBeans).map(bean => this.createTreeItem(bean));
	}

	/**
	 * Create tree item for a bean
	 */
	private createTreeItem(bean: Bean): BeanTreeItem {
		const hasChildren = this.beans.some(b => b.parent === bean.id);
		const collapsibleState = hasChildren 
			? vscode.TreeItemCollapsibleState.Collapsed 
			: vscode.TreeItemCollapsibleState.None;
		
		return new BeanTreeItem(bean, collapsibleState, hasChildren);
	}

	/**
	 * Sort beans according to current sort mode
	 */
	private sortBeans(beans: Bean[]): Bean[] {
		const sorted = [...beans];

		switch (this.sortMode) {
			case 'status-priority-type-title':
				return this.sortByStatusPriorityTypeTitle(sorted);
			case 'updated':
				return sorted.sort((a, b) => 
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
				);
			case 'created':
				return sorted.sort((a, b) => 
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
			case 'id':
				return sorted.sort((a, b) => a.id.localeCompare(b.id));
			default:
				return sorted;
		}
	}

	/**
	 * Sort by status, then priority, then type, then title (TUI default)
	 */
	private sortByStatusPriorityTypeTitle(beans: Bean[]): Bean[] {
		const statusOrder: Record<BeanStatus, number> = {
			'in-progress': 0,
			'todo': 1,
			'draft': 2,
			'completed': 3,
			'scrapped': 4
		};

		const priorityOrder: Record<string, number> = {
			'critical': 0,
			'high': 1,
			'normal': 2,
			'low': 3,
			'deferred': 4
		};

		const typeOrder: Record<BeanType, number> = {
			'milestone': 0,
			'epic': 1,
			'feature': 2,
			'bug': 3,
			'task': 4
		};

		return beans.sort((a, b) => {
			// First: status
			const statusDiff = statusOrder[a.status] - statusOrder[b.status];
			if (statusDiff !== 0) {
				return statusDiff;
			}

			// Second: priority (treat undefined as 'normal')
			const aPriority = a.priority || 'normal';
			const bPriority = b.priority || 'normal';
			const priorityDiff = priorityOrder[aPriority] - priorityOrder[bPriority];
			if (priorityDiff !== 0) {
				return priorityDiff;
			}

			// Third: type
			const typeDiff = typeOrder[a.type] - typeOrder[b.type];
			if (typeDiff !== 0) {
				return typeDiff;
			}

			// Fourth: title (alphabetical)
			return a.title.localeCompare(b.title);
		});
	}

	/**
	 * Get parent of a tree item (for reveal operations)
	 */
	async getParent(element: BeanTreeItem): Promise<BeanTreeItem | undefined> {
		if (!element.bean.parent) {
			return undefined;
		}

		const parentBean = this.beans.find(b => b.id === element.bean.parent);
		if (!parentBean) {
			return undefined;
		}

		return this.createTreeItem(parentBean);
	}
}
