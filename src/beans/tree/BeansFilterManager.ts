import * as vscode from 'vscode';

/**
 * Filter state for a bean tree view
 */
export interface BeansFilterState {
  /** Text search filter */
  text?: string;

  /** Filter by statuses */
  statuses?: string[];

  /** Filter by tags (any match) */
  tags?: string[];

  /** Filter by types */
  types?: string[];

  /** Filter by priorities */
  priorities?: string[];
}

/**
 * Manages filter state for bean tree views and provides UI for setting filters
 */
export class BeansFilterManager {
  private filters: Map<string, BeansFilterState> = new Map();
  private _onDidChangeFilter = new vscode.EventEmitter<string>();
  public readonly onDidChangeFilter = this._onDidChangeFilter.event;

  /**
   * Get current filter for a view
   */
  public getFilter(viewId: string): BeansFilterState | undefined {
    return this.filters.get(viewId);
  }

  /**
   * Set filter for a view
   */
  public setFilter(viewId: string, filter: BeansFilterState | undefined): void {
    if (!filter || this.isEmptyFilter(filter)) {
      this.filters.delete(viewId);
    } else {
      this.filters.set(viewId, filter);
    }
    this._onDidChangeFilter.fire(viewId);
  }

  /**
   * Clear filter for a view
   */
  public clearFilter(viewId: string): void {
    this.filters.delete(viewId);
    this._onDidChangeFilter.fire(viewId);
  }

  /**
   * Clear all filters
   */
  public clearAllFilters(): void {
    const viewIds = Array.from(this.filters.keys());
    this.filters.clear();
    viewIds.forEach(viewId => this._onDidChangeFilter.fire(viewId));
  }

  /**
   * Check if filter is empty
   */
  private isEmptyFilter(filter: BeansFilterState): boolean {
    const hasStatuses = Array.isArray(filter.statuses) && filter.statuses.length > 0;
    const hasTags = Array.isArray(filter.tags) && filter.tags.length > 0;
    const hasTypes = Array.isArray(filter.types) && filter.types.length > 0;
    const hasPriorities = Array.isArray(filter.priorities) && filter.priorities.length > 0;

    return !filter.text && !hasStatuses && !hasTags && !hasTypes && !hasPriorities;
  }

  /**
   * Get filter description for display in view title
   */
  public getFilterDescription(viewId: string): string | undefined {
    const filter = this.filters.get(viewId);
    if (!filter) {
      return undefined;
    }

    const parts: string[] = [];

    if (filter.text) {
      parts.push(`text:"${filter.text}"`);
    }

    if (Array.isArray(filter.statuses) && filter.statuses.length > 0) {
      parts.push(`status:${filter.statuses.join(',')}`);
    }

    if (Array.isArray(filter.tags) && filter.tags.length > 0) {
      parts.push(`tags:${filter.tags.join(',')}`);
    }

    if (Array.isArray(filter.types) && filter.types.length > 0) {
      parts.push(`types:${filter.types.join(',')}`);
    }

    if (Array.isArray(filter.priorities) && filter.priorities.length > 0) {
      parts.push(`priority:${filter.priorities.join(',')}`);
    }

    return parts.length > 0 ? parts.join(' ') : undefined;
  }

  /**
   * Show filter UI for a view
   */
  public async showFilterUI(currentFilter?: BeansFilterState): Promise<BeansFilterState | undefined> {
    // Show quick pick with filter options
    const filterType = await vscode.window.showQuickPick(
      [
        { label: 'Text Search', value: 'text' },
        { label: 'Filter by Tags', value: 'tags' },
        { label: 'Filter by Type', value: 'types' },
        { label: 'Filter by Priority', value: 'priorities' },
        { label: 'Clear All Filters', value: 'clear' },
      ],
      {
        placeHolder: 'Select filter type',
        title: 'Bean Filters',
      }
    );

    if (!filterType) {
      return undefined;
    }

    if (filterType.value === 'clear') {
      return {};
    }

    const newFilter: BeansFilterState = { ...currentFilter };

    switch (filterType.value) {
      case 'text':
        const text = await vscode.window.showInputBox({
          prompt: 'Enter search text',
          placeHolder: 'Search in title and body',
          value: currentFilter?.text,
        });
        if (text !== undefined) {
          newFilter.text = text || undefined;
        }
        break;

      case 'tags':
        const tagsInput = await vscode.window.showInputBox({
          prompt: 'Enter tags (comma-separated)',
          placeHolder: 'e.g., frontend, bug',
          value: currentFilter?.tags?.join(', '),
        });
        if (tagsInput !== undefined) {
          newFilter.tags = tagsInput
            ? tagsInput
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0)
            : undefined;
        }
        break;

      case 'types':
        const types = await vscode.window.showQuickPick(['milestone', 'epic', 'feature', 'bug', 'task'], {
          canPickMany: true,
          placeHolder: 'Select types to include',
          title: 'Filter by Type',
        });
        if (types !== undefined) {
          newFilter.types = types.length > 0 ? types : undefined;
        }
        break;

      case 'priorities':
        const priorities = await vscode.window.showQuickPick(['critical', 'high', 'normal', 'low', 'deferred'], {
          canPickMany: true,
          placeHolder: 'Select priorities to include',
          title: 'Filter by Priority',
        });
        if (priorities !== undefined) {
          newFilter.priorities = priorities.length > 0 ? priorities : undefined;
        }
        break;
    }

    return newFilter;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._onDidChangeFilter.dispose();
  }
}
