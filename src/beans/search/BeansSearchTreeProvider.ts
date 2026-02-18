import * as vscode from 'vscode';
import { BeansOutput } from '../logging';
import { Bean } from '../model';
import { BeansService } from '../service';
import { BeanTreeItem } from '../tree/BeanTreeItem';
import { BeansFilterState } from '../tree/BeansFilterManager';

/**
 * TreeDataProvider showing flat search results for beans.
 * Single-level, non-hierarchical list suitable for the sidebar.
 */
export class BeansSearchTreeProvider implements vscode.TreeDataProvider<BeanTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<BeanTreeItem | undefined | null | void> = new vscode.EventEmitter<
    BeanTreeItem | undefined | null | void
  >();
  public readonly onDidChangeTreeData: vscode.Event<BeanTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private beans: Bean[] = [];
  private logger = BeansOutput.getInstance();
  private currentFilter: BeansFilterState | undefined;

  constructor(private readonly service: BeansService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setFilter(filter: BeansFilterState | undefined): void {
    this.currentFilter = filter;
    this.refresh();
  }

  async getChildren(): Promise<BeanTreeItem[]> {
    await this.fetchBeans();
    if (this.beans.length === 0) {
      return [];
    }

    // Single-level list: return all beans as non-collapsible tree items
    return this.sortBeans(this.beans).map(b => new BeanTreeItem(b, vscode.TreeItemCollapsibleState.None, false, false));
  }

  getTreeItem(element: BeanTreeItem): vscode.TreeItem {
    return element;
  }

  private async fetchBeans(): Promise<void> {
    try {
      const options: { status?: string[]; type?: string[] } = {};

      // Apply status/type filter if present
      if (this.currentFilter?.types && this.currentFilter.types.length > 0) {
        options.type = this.currentFilter.types as string[];
      }
      if ((this.currentFilter as any)?.statuses && (this.currentFilter as any).statuses.length > 0) {
        options.status = (this.currentFilter as any).statuses as string[];
      }

      // Request beans from service
      this.beans = await this.service.listBeans(options);

      // Client-side tag/priorities/text filtering
      if (this.currentFilter) {
        const f = this.currentFilter;

        if (f.priorities && f.priorities.length > 0) {
          const pset = new Set(f.priorities);
          this.beans = this.beans.filter(b => b.priority && pset.has(b.priority));
        }

        if (f.tags && f.tags.length > 0) {
          const tset = new Set(f.tags);
          this.beans = this.beans.filter(b => (b.tags || []).some(t => tset.has(t)));
        }

        if (f.text) {
          const q = f.text.toLowerCase();
          this.beans = this.beans.filter(b => this.matchesQuery(b, q));
        }
      }

      this.logger.debug(`Search provider fetched ${this.beans.length} beans`);
    } catch (error) {
      this.logger.error('Failed to fetch beans for search provider', error as Error);
      this.beans = [];
    }
  }

  private matchesQuery(bean: Bean, q: string): boolean {
    const fields = [bean.id, bean.code || '', bean.title, bean.body || '', bean.status, bean.type, bean.priority || ''];
    if (bean.tags && bean.tags.length > 0) {
      fields.push(...bean.tags);
    }
    return fields.some(f => f.toLowerCase().includes(q));
  }

  private scoreRelevance(bean: Bean, q: string): number {
    if (!q) {
      return 0;
    }
    let score = 0;
    const idLower = bean.id.toLowerCase();
    const codeLower = (bean.code || '').toLowerCase();
    const titleLower = bean.title.toLowerCase();

    if (idLower === q || codeLower === q) {
      score += 1000;
    } else if (idLower.startsWith(q) || codeLower.startsWith(q)) {
      score += 500;
    } else if (idLower.includes(q) || codeLower.includes(q)) {
      score += 300;
    }

    if (titleLower === q) {
      score += 200;
    } else if (titleLower.startsWith(q)) {
      score += 150;
    } else if (titleLower.includes(q)) {
      score += 100;
    }

    if ((bean.body || '').toLowerCase().includes(q)) {
      score += 20;
    }
    if ((bean.tags || []).some(t => t.toLowerCase().includes(q))) {
      score += 15;
    }
    if (
      bean.status.toLowerCase().includes(q) ||
      bean.type.toLowerCase().includes(q) ||
      (bean.priority || '').toLowerCase().includes(q)
    ) {
      score += 10;
    }

    return score;
  }

  private sortBeans(beans: Bean[]): Bean[] {
    const q = (this.currentFilter?.text || '').toLowerCase();
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3, deferred: 4 };

    return [...beans].sort((a, b) => {
      if (q) {
        const ra = this.scoreRelevance(a, q);
        const rb = this.scoreRelevance(b, q);
        if (ra !== rb) {
          return rb - ra;
        }
      }

      const pa = priorityOrder[a.priority || 'normal'] ?? 2;
      const pb = priorityOrder[b.priority || 'normal'] ?? 2;
      if (pa !== pb) {
        return pa - pb;
      }

      // Keep in-progress higher
      const statusOrder: Record<string, number> = { 'in-progress': 0, todo: 1, draft: 2, completed: 3, scrapped: 4 };
      const sa = statusOrder[a.status] ?? 5;
      const sb = statusOrder[b.status] ?? 5;
      if (sa !== sb) {
        return sa - sb;
      }

      return a.title.localeCompare(b.title);
    });
  }
}
