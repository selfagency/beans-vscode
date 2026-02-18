import * as vscode from 'vscode';
import { BeansOutput } from '../logging';
import { Bean } from '../model';
import { BeansService } from '../service';
import { BeanTreeItem } from '../tree/BeanTreeItem';
import { BeansFilterState } from '../tree/BeansFilterManager';

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  deferred: 4,
};

const STATUS_ORDER: Record<string, number> = {
  'in-progress': 0,
  todo: 1,
  draft: 2,
  completed: 3,
  scrapped: 4,
};

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
      if (this.currentFilter?.statuses && this.currentFilter.statuses.length > 0) {
        options.status = this.currentFilter.statuses;
      }

      // Request beans from service
      this.beans = (await this.service.listBeans(options)) || [];

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
    const fields: Array<unknown> = [bean.id, bean.code, bean.title, bean.body, bean.status, bean.type, bean.priority];
    if (Array.isArray(bean.tags) && bean.tags.length > 0) {
      fields.push(...bean.tags);
    }
    return fields.some(field => field !== null && field !== undefined && this.toLower(field).includes(q));
  }

  private scoreRelevance(bean: Bean, q: string): number {
    if (!q) {
      return 0;
    }
    return (
      this.scoreIdentityMatch(bean, q) +
      this.scoreTitleMatch(bean, q) +
      this.scoreContentMatch(bean, q) +
      this.scoreMetadataMatch(bean, q)
    );
  }

  private scoreIdentityMatch(bean: Bean, q: string): number {
    const idLower = this.toLower(bean.id);
    const codeLower = this.toLower(bean.code);

    if (idLower === q || codeLower === q) {
      return 1000;
    }
    if (idLower.startsWith(q) || codeLower.startsWith(q)) {
      return 500;
    }
    if (idLower.includes(q) || codeLower.includes(q)) {
      return 300;
    }
    return 0;
  }

  private scoreTitleMatch(bean: Bean, q: string): number {
    const titleLower = this.toLower(bean.title);
    if (titleLower === q) {
      return 200;
    }
    if (titleLower.startsWith(q)) {
      return 150;
    }
    if (titleLower.includes(q)) {
      return 100;
    }
    return 0;
  }

  private scoreContentMatch(bean: Bean, q: string): number {
    let score = 0;
    if (this.toLower(bean.body).includes(q)) {
      score += 20;
    }
    if ((bean.tags || []).some(t => this.toLower(t).includes(q))) {
      score += 15;
    }
    return score;
  }

  private scoreMetadataMatch(bean: Bean, q: string): number {
    if (
      this.toLower(bean.status).includes(q) ||
      this.toLower(bean.type).includes(q) ||
      this.toLower(bean.priority).includes(q)
    ) {
      return 10;
    }
    return 0;
  }

  private toLower(value: unknown): string {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    return '';
  }

  private sortBeans(beans: Bean[]): Bean[] {
    const q = (this.currentFilter?.text || '').toLowerCase();

    return [...beans].sort((a, b) => {
      if (q) {
        const ra = this.scoreRelevance(a, q);
        const rb = this.scoreRelevance(b, q);
        if (ra !== rb) {
          return rb - ra;
        }
      }

      const pa = PRIORITY_ORDER[a.priority || 'normal'] ?? 2;
      const pb = PRIORITY_ORDER[b.priority || 'normal'] ?? 2;
      if (pa !== pb) {
        return pa - pb;
      }

      // Keep in-progress higher
      const sa = STATUS_ORDER[a.status] ?? 5;
      const sb = STATUS_ORDER[b.status] ?? 5;
      if (sa !== sb) {
        return sa - sb;
      }

      return a.title.localeCompare(b.title);
    });
  }
}
