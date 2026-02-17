import * as vscode from 'vscode';
import { BeansOutput } from '../logging';
import { Bean, BeanStatus, BeanType } from '../model';
import { BeansService } from '../service';
import { BeanTreeItem } from './BeanTreeItem';

/**
 * Sort mode for bean tree
 */
export type SortMode = 'status-priority-type-title' | 'priority-status-type-title' | 'updated' | 'created' | 'id';

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
  private _onDidChangeTreeData: vscode.EventEmitter<BeanTreeItem | undefined | null | void> = new vscode.EventEmitter<
    BeanTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<BeanTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  protected beans: Bean[] = [];
  private sortMode: SortMode;
  private filterOptions: TreeFilterOptions = {};
  private logger = BeansOutput.getInstance();

  // Performance cache: tracks which beans have in-progress descendants
  private inProgressDescendantsCache = new Map<string, boolean>();

  constructor(
    protected readonly service: BeansService,
    protected readonly statusFilter?: BeanStatus[],
    private readonly flatList: boolean = false,
    defaultSort?: SortMode
  ) {
    // Use provider-specific default, then user config, then fallback
    const config = vscode.workspace.getConfiguration('beans');
    this.sortMode = defaultSort || config.get<SortMode>('defaultSortMode', 'status-priority-type-title');
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

      // Allow subclasses to augment the bean set (e.g., add children from other statuses)
      this.beans = await this.augmentBeans(this.beans);

      // Apply subclass post-fetch filter (e.g., archived beans path filtering)
      this.beans = this.postFetchFilter(this.beans);

      // Apply tag filter (client-side since CLI might not support it)
      if (this.filterOptions.tagFilter && this.filterOptions.tagFilter.length > 0) {
        this.beans = this.beans.filter(bean => this.filterOptions.tagFilter!.some(tag => bean.tags.includes(tag)));
      }

      this.logger.debug(`Fetched ${this.beans.length} beans`);
    } catch (error) {
      this.logger.error('Failed to fetch beans', error as Error);
      vscode.window.showErrorMessage(`Failed to fetch beans: ${(error as Error).message}`);
      this.beans = [];
    }
  }

  /**
   * Post-fetch filter hook for subclasses to override.
   * Default implementation is pass-through.
   */
  protected postFetchFilter(beans: Bean[]): Bean[] {
    return beans;
  }

  /**
   * Augmentation hook for subclasses to add or remove beans after initial fetch.
   * Called before postFetchFilter. Use to pull in beans from other statuses
   * (e.g., children of draft parents) or exclude beans that belong elsewhere.
   * Default implementation is pass-through.
   */
  protected async augmentBeans(beans: Bean[]): Promise<Bean[]> {
    return beans;
  }

  /**
   * Build hierarchical tree from flat bean list
   * When flatList is true, show all beans at root level (for status-filtered views
   * where parents may have a different status and wouldn't appear)
   */
  private buildTree(): BeanTreeItem[] {
    // Clear and rebuild performance cache
    this.rebuildInProgressCache();

    if (this.flatList) {
      // Flat list mode: show all beans at root level, no hierarchy
      return this.sortBeans(this.beans).map(bean => this.createTreeItem(bean));
    }

    // Hierarchical mode: only beans whose parent is also in the set (or no parent) at root
    const beanIds = new Set(this.beans.map(b => b.id));
    const rootBeans = this.beans.filter(bean => !bean.parent || !beanIds.has(bean.parent));

    // Sort and create tree items
    return this.sortBeans(rootBeans).map(bean => this.createTreeItem(bean));
  }

  /**
   * Rebuild the in-progress descendants cache
   * This pre-computes which beans have in-progress descendants to avoid O(n²) complexity
   */
  private rebuildInProgressCache(): void {
    this.inProgressDescendantsCache.clear();

    // Build id->bean map for O(1) lookups
    const beanMap = new Map<string, Bean>();
    for (const bean of this.beans) {
      beanMap.set(bean.id, bean);
    }

    // Find all in-progress beans
    const inProgressBeans = this.beans.filter(b => b.status === 'in-progress');

    // Mark all ancestors of in-progress beans (iterative to avoid stack overflow)
    for (const bean of inProgressBeans) {
      let currentId = bean.parent;
      while (currentId) {
        // If already marked, we can stop (all ancestors above are already marked)
        if (this.inProgressDescendantsCache.has(currentId)) {
          break;
        }

        this.inProgressDescendantsCache.set(currentId, true);

        // Move up to parent (O(1) lookup via map)
        const currentBean = beanMap.get(currentId);
        currentId = currentBean?.parent;
      }
    }
  }

  /**
   * Create tree item for a bean
   */
  private createTreeItem(bean: Bean): BeanTreeItem {
    const hasChildren = this.beans.some(b => b.parent === bean.id);
    const hasInProgressChildren = this.inProgressDescendantsCache.get(bean.id) ?? false;
    const collapsibleState = hasChildren
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    return new BeanTreeItem(bean, collapsibleState, hasChildren, hasInProgressChildren);
  }

  /**
   * Sort beans according to current sort mode
   */
  private sortBeans(beans: Bean[]): Bean[] {
    const sorted = [...beans];

    switch (this.sortMode) {
      case 'status-priority-type-title':
        return this.sortByStatusPriorityTypeTitle(sorted);
      case 'priority-status-type-title':
        return this.sortByPriorityStatusTypeTitle(sorted);
      case 'updated':
        return sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      case 'created':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'id':
        return sorted.sort((a, b) => a.id.localeCompare(b.id));
      default:
        this.logger.warn(`Unknown sort mode: ${this.sortMode}`);
        return sorted;
    }
  }

  /**
   * Sort by status, then priority, then type, then title.
   */
  private sortByStatusPriorityTypeTitle(beans: Bean[]): Bean[] {
    const statusOrder: Record<string, number> = {
      'in-progress': 0,
      todo: 1,
      draft: 2,
      completed: 3,
      scrapped: 4,
    };

    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
      deferred: 4,
    };

    const typeOrder: Record<string, number> = {
      milestone: 0,
      epic: 1,
      feature: 2,
      bug: 3,
      task: 4,
    };

    return beans.sort((a, b) => {
      // 1. Status
      const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      if (statusDiff !== 0) {
        return statusDiff;
      }

      // 2. Priority (treat undefined as 'normal')
      const aPriority = a.priority || 'normal';
      const bPriority = b.priority || 'normal';
      const priorityDiff = priorityOrder[aPriority] - priorityOrder[bPriority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // 3. Type
      const typeDiff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
      if (typeDiff !== 0) {
        return typeDiff;
      }

      // 4. Title alphabetically
      return a.title.localeCompare(b.title);
    });
  }

  /**
   * Sort by priority, then status, then type, then title.
   * Better for the Active pane where priority matters more than
   * the in-progress/todo distinction.
   */
  private sortByPriorityStatusTypeTitle(beans: Bean[]): Bean[] {
    const statusOrder: Record<string, number> = {
      'in-progress': 0,
      todo: 1,
      draft: 2,
      completed: 3,
      scrapped: 4,
    };

    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
      deferred: 4,
    };

    const typeOrder: Record<string, number> = {
      milestone: 0,
      epic: 1,
      feature: 2,
      bug: 3,
      task: 4,
    };

    return beans.sort((a, b) => {
      // 1. Priority (treat undefined as 'normal')
      const aPriority = a.priority || 'normal';
      const bPriority = b.priority || 'normal';
      const priorityDiff = (priorityOrder[aPriority] ?? 99) - (priorityOrder[bPriority] ?? 99);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // 2. Status
      const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      if (statusDiff !== 0) {
        return statusDiff;
      }

      // 3. Type
      const typeDiff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
      if (typeDiff !== 0) {
        return typeDiff;
      }

      // 4. Title alphabetically
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
