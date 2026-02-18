import * as path from 'node:path';
import * as vscode from 'vscode';
import { BeansOutput } from '../logging';
import { Bean, BEAN_PRIORITIES, BEAN_STATUSES, BEAN_TYPES } from '../model';
import { BeansService } from '../service';

/**
 * Status icon mapping for search results
 */
const STATUS_ICONS: Record<string, string> = {
  todo: 'issues',
  'in-progress': 'play-circle',
  completed: 'issue-closed',
  draft: 'issue-draft',
  scrapped: 'stop',
};

/**
 * Type icon mapping for search results
 */
const TYPE_ICONS: Record<string, string> = {
  task: 'list-unordered',
  bug: 'bug',
  feature: 'lightbulb',
  epic: 'zap',
  milestone: 'milestone',
};

/**
 * Priority icon mapping for search results
 */
const PRIORITY_ICONS: Record<string, string> = {
  critical: 'circle-large-filled',
  high: 'circle-large-filled',
  normal: 'circle-large-filled',
  low: 'circle-large-filled',
  deferred: 'circle-large-filled',
};

/**
 * Webview view provider for the search pane.
 * Provides a search bar, multi-select filter checkboxes for
 * status / type / priority, and flat search results sorted by relevancy.
 */
export class BeansSearchViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'beans.search';

  private _view?: vscode.WebviewView;
  private readonly logger = BeansOutput.getInstance();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly service: BeansService
  ) {}

  /* ------------------------------------------------------------------ */
  /*  Webview lifecycle                                                  */
  /* ------------------------------------------------------------------ */

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.command) {
        case 'search':
          await this.handleSearch(message.query, message.filters);
          break;
        case 'openBean':
          await this.handleOpenBean(message.beanId);
          break;
      }
    });

    webviewView.webview.html = this.getHtml(webviewView.webview);
    this.logger.debug('Search view resolved');
  }

  /* ------------------------------------------------------------------ */
  /*  Message handlers                                                   */
  /* ------------------------------------------------------------------ */

  private async handleSearch(
    query: string,
    filters: { statuses: string[]; types: string[]; priorities: string[] }
  ): Promise<void> {
    try {
      // Use CLI filters for status/type; do text search client-side
      // so we can match across ALL bean fields, not just title
      const options: { status?: string[]; type?: string[] } = {};

      if (filters.statuses.length > 0) {
        options.status = filters.statuses;
      }
      if (filters.types.length > 0) {
        options.type = filters.types;
      }

      let beans = await this.service.listBeans(options);

      // Client-side priority filter (CLI may not support it)
      if (filters.priorities.length > 0) {
        const prioSet = new Set(filters.priorities);
        beans = beans.filter(b => b.priority && prioSet.has(b.priority));
      }

      // Client-side full-text search across all fields
      if (query) {
        const q = query.toLowerCase();
        beans = beans.filter(b => this.matchesQuery(b, q));
      }

      // Sort by field-weighted relevancy when a query is present
      beans = this.sortByRelevance(beans, query);

      this._view?.webview.postMessage({
        command: 'results',
        beans: beans.map(b => this.beanToResult(b)),
      });
    } catch (error) {
      this.logger.error('Search failed', error as Error);
      this._view?.webview.postMessage({
        command: 'results',
        beans: [],
        error: (error as Error).message,
      });
    }
  }

  private async handleOpenBean(beanId: string): Promise<void> {
    try {
      const bean = await this.service.showBean(beanId);
      await vscode.commands.executeCommand('beans.openBean', bean);
    } catch (error) {
      this.logger.error('Failed to open bean from search', error as Error);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Check whether a bean matches the search query against any field.
   */
  private matchesQuery(bean: Bean, q: string): boolean {
    const fields: string[] = [
      bean.id,
      bean.code || '',
      bean.slug || '',
      bean.title,
      bean.body || '',
      bean.status,
      bean.type,
      bean.priority || '',
      ...(bean.tags || []),
      bean.parent || '',
      ...(bean.blocking || []),
      ...(bean.blockedBy || []),
    ];
    return fields.some(f => f.toLowerCase().includes(q));
  }

  /**
   * Score a bean's relevancy for the given query.
   * Higher score = more relevant.  Priority: id/code > title > other fields.
   */
  private scoreRelevance(bean: Bean, q: string): number {
    if (!q) {
      return 0;
    }
    let score = 0;
    const idLower = bean.id.toLowerCase();
    const codeLower = (bean.code || '').toLowerCase();
    const titleLower = bean.title.toLowerCase();

    // Exact id/code match is strongest signal
    if (idLower === q || codeLower === q) {
      score += 1000;
    } else if (idLower.startsWith(q) || codeLower.startsWith(q)) {
      score += 500;
    } else if (idLower.includes(q) || codeLower.includes(q)) {
      score += 300;
    }

    // Title match is second priority
    if (titleLower === q) {
      score += 200;
    } else if (titleLower.startsWith(q)) {
      score += 150;
    } else if (titleLower.includes(q)) {
      score += 100;
    }

    // Body, tags, and other metadata are lowest priority
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

  private sortByRelevance(beans: Bean[], query: string): Bean[] {
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

    const q = (query || '').toLowerCase();

    return [...beans].sort((a, b) => {
      // When a query is present, sort by relevance score first
      if (q) {
        const ra = this.scoreRelevance(a, q);
        const rb = this.scoreRelevance(b, q);
        if (ra !== rb) {
          return rb - ra; // higher score first
        }
      }
      // Fall back to status → priority → title
      const sa = statusOrder[a.status] ?? 5;
      const sb = statusOrder[b.status] ?? 5;
      if (sa !== sb) {
        return sa - sb;
      }
      const pa = priorityOrder[a.priority || 'normal'] ?? 2;
      const pb = priorityOrder[b.priority || 'normal'] ?? 2;
      if (pa !== pb) {
        return pa - pb;
      }
      return a.title.localeCompare(b.title);
    });
  }

  private beanToResult(bean: Bean): Record<string, string | undefined> {
    return {
      id: bean.id,
      code: bean.code,
      title: bean.title,
      status: bean.status,
      type: bean.type,
      priority: bean.priority,
      statusIcon: STATUS_ICONS[bean.status] || '',
      typeIcon: TYPE_ICONS[bean.type] || '',
      priorityIcon: bean.priority ? PRIORITY_ICONS[bean.priority] || '' : '',
    };
  }

  /* ------------------------------------------------------------------ */
  /*  HTML                                                               */
  /* ------------------------------------------------------------------ */

  private getHtml(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const extensionRootPath = (this.extensionUri as vscode.Uri & { fsPath?: string }).fsPath || this.extensionUri.path;
    const codiconStylesUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(extensionRootPath, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'))
    );
    const csp = [
      "default-src 'none'",
      `font-src ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
    ].join('; ');

    const statusCheckboxes = BEAN_STATUSES.map(
      s =>
        `<label class="filter-option"><input type="checkbox" value="${s}" data-group="status" /><span class="codicon codicon-${
          STATUS_ICONS[s] || 'circle'
        }" aria-hidden="true"></span> ${capitalize(s)}</label>`
    ).join('\n');

    const typeCheckboxes = BEAN_TYPES.map(
      t =>
        `<label class="filter-option"><input type="checkbox" value="${t}" data-group="type" /><span class="codicon codicon-${
          TYPE_ICONS[t] || 'circle'
        }" aria-hidden="true"></span> ${capitalize(t)}</label>`
    ).join('\n');

    const priorityCheckboxes = BEAN_PRIORITIES.map(
      p =>
        `<label class="filter-option"><input type="checkbox" value="${p}" data-group="priority" /><span class="codicon codicon-${
          PRIORITY_ICONS[p] || 'circle-large-outline'
        }" aria-hidden="true"></span> ${capitalize(p)}</label>`
    ).join('\n');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <link href="${codiconStylesUri}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 8px 12px;
    }

    /* ---- Search bar ---- */
    .search-bar {
      display: flex;
      align-items: center;
      gap: 0;
      margin-bottom: 6px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 2px;
    }
    .search-bar:focus-within {
      border-color: var(--vscode-focusBorder);
    }
    .search-icon {
      flex-shrink: 0;
      padding: 0 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 14px;
      display: flex;
      align-items: center;
    }
    .search-bar:focus-within .search-icon {
      color: var(--vscode-descriptionForeground);
    }
    .icon-svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
      display: block;
    }
    .icon-svg-outline {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .search-bar input {
      flex: 1;
      padding: 5px 4px;
      background: transparent;
      color: var(--vscode-input-foreground);
      border: none;
      font-size: 12px;
      outline: none;
      min-width: 0;
    }
    .search-bar input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    .filter-btn {
      flex-shrink: 0;
      background: none;
      border: none;
      border-left: 1px solid var(--vscode-input-border, transparent);
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 4px 6px;
      display: flex;
      align-items: center;
      opacity: 0.9;
    }
    .filter-btn:hover {
      opacity: 1;
      color: var(--vscode-foreground);
    }
    .filter-btn.active {
      opacity: 1;
    }
    .filter-btn.active { color: var(--vscode-descriptionForeground); }
    .vscode-dark .search-icon,
    .vscode-dark .search-bar:focus-within .search-icon,
    .vscode-dark .filter-btn,
    .vscode-dark .filter-btn.active {
      color: var(--vscode-input-foreground);
    }
    .filters-panel {
      display: none;
      margin-bottom: 8px;
      border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent));
      border-radius: 4px;
      padding: 8px;
      background: var(--vscode-sideBar-background);
    }
    .filters-panel.open { display: block; }
    .filter-group {
      margin-bottom: 6px;
    }
    .filter-group:last-child { margin-bottom: 0; }
    .filter-group-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    .filter-options {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 2px;
    }
    .filter-option {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      cursor: pointer;
      padding: 1px 0;
    }
    .filter-option input[type="checkbox"] {
      accent-color: var(--vscode-checkbox-background);
      cursor: pointer;
    }

    /* ---- Results ---- */
    .results-count {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      padding: 4px 0 6px;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, transparent));
      margin-bottom: 4px;
    }
    .result-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    .result-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .result-status-icon { flex-shrink: 0; width: 16px; text-align: center; color: var(--vscode-descriptionForeground); }
    .result-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .result-code {
      flex-shrink: 0;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-editor-font-family);
    }
    .result-priority {
      flex-shrink: 0;
      width: 14px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
    .empty-state {
      text-align: center;
      padding: 24px 8px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .error-state {
      padding: 8px;
      color: var(--vscode-errorForeground);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="search-bar">
    <span class="search-icon" aria-hidden="true">
      <svg class="icon-svg" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M11.742 10.344h-.737l-.262-.253a5.5 5.5 0 1 0-.652.652l.253.262v.737L14.5 15.9 15.9 14.5l-4.158-4.156zM6.5 10.344a3.844 3.844 0 1 1 0-7.688 3.844 3.844 0 0 1 0 7.688z"></path>
      </svg>
    </span>
    <input
      id="searchInput"
      type="text"
      placeholder="Search beans\u2026"
      aria-label="Search beans"
    />
    <button class="filter-btn" id="filtersToggle" aria-expanded="false" aria-controls="filtersPanel" title="Toggle filters" aria-label="Toggle filters">
      <svg class="icon-svg icon-svg-outline" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M2 3h12l-4.5 5.25V12.5l-3-1.8V8.25L2 3z"></path>
      </svg>
    </button>
  </div>

  <div class="filters-panel" id="filtersPanel" role="region" aria-label="Search filters">
    <div class="filter-group">
      <div class="filter-group-title">Status</div>
      <div class="filter-options" id="statusFilters">
        ${statusCheckboxes}
      </div>
    </div>
    <div class="filter-group">
      <div class="filter-group-title">Type</div>
      <div class="filter-options" id="typeFilters">
        ${typeCheckboxes}
      </div>
    </div>
    <div class="filter-group">
      <div class="filter-group-title">Priority</div>
      <div class="filter-options" id="priorityFilters">
        ${priorityCheckboxes}
      </div>
    </div>
  </div>

  <div id="resultsContainer"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const searchInput = document.getElementById('searchInput');
    const filtersToggle = document.getElementById('filtersToggle');
    const filtersPanel = document.getElementById('filtersPanel');
    const resultsContainer = document.getElementById('resultsContainer');

    let debounceTimer;

    /* Toggle filters panel */
    filtersToggle.addEventListener('click', () => {
      const open = filtersPanel.classList.toggle('open');
      filtersToggle.setAttribute('aria-expanded', String(open));
      filtersToggle.classList.toggle('active', open);
    });

    /* Gather checked filters */
    function getFilters() {
      const checked = (group) =>
        Array.from(document.querySelectorAll('input[data-group="' + group + '"]:checked'))
          .map((el) => el.value);
      return {
        statuses: checked('status'),
        types: checked('type'),
        priorities: checked('priority')
      };
    }

    /* Trigger search */
    function triggerSearch() {
      const query = searchInput.value.trim();
      const filters = getFilters();
      const hasFilter = filters.statuses.length || filters.types.length || filters.priorities.length;
      if (!query && !hasFilter) {
        resultsContainer.innerHTML = '';
        return;
      }
      vscode.postMessage({ command: 'search', query, filters });
    }

    /* Debounced search on input */
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(triggerSearch, 250);
    });

    /* Search on Enter */
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(debounceTimer);
        triggerSearch();
      }
    });

    /* Search on filter change */
    document.querySelectorAll('.filters-panel input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        clearTimeout(debounceTimer);
        triggerSearch();
      });
    });

    /* Receive results */
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command !== 'results') return;

      if (msg.error) {
        resultsContainer.innerHTML = '<div class="error-state">Error: ' + escapeHtml(msg.error) + '</div>';
        return;
      }

      const beans = msg.beans || [];
      if (beans.length === 0) {
        resultsContainer.innerHTML = '<div class="empty-state">No results found</div>';
        return;
      }

      let html = '<div class="results-count">' + beans.length + ' result' + (beans.length !== 1 ? 's' : '') + '</div>';
      for (const b of beans) {
        const ctx = JSON.stringify({
          webviewSection: 'searchResult',
          beanId: b.id,
          preventDefaultContextMenuItems: true
        }).replace(/"/g, '&quot;');
        html += '<div class="result-item" tabindex="0" role="button" '
          + 'aria-label="' + escapeAttr(b.title) + '" '
          + 'data-id="' + escapeAttr(b.id) + '" '
          + 'data-vscode-context="' + ctx + '">'
            + '<span class="result-status-icon codicon codicon-' + escapeAttr(b.statusIcon || 'circle-large-outline') + '"></span>'
          + '<span class="result-title">' + escapeHtml(b.title) + '</span>'
            + '<span class="result-priority codicon codicon-' + escapeAttr(b.priorityIcon || 'circle-large-outline') + '"></span>'
          + '<span class="result-code">' + escapeHtml(b.code) + '</span>'
          + '</div>';
      }
      resultsContainer.innerHTML = html;

      /* Click / Enter on result */
      resultsContainer.querySelectorAll('.result-item').forEach((el) => {
        el.addEventListener('click', () => {
          vscode.postMessage({ command: 'openBean', beanId: el.dataset.id });
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            vscode.postMessage({ command: 'openBean', beanId: el.dataset.id });
          }
        });
      });
    });

    function escapeHtml(s) {
      const d = document.createElement('div');
      d.textContent = s || '';
      return d.innerHTML;
    }
    function escapeAttr(s) {
      return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  </script>
</body>
</html>`;
  }

  private getNonce(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Capitalise first letter, replace hyphens with spaces */
function capitalize(s: string): string {
  return s
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
