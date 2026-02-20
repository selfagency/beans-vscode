import * as vscode from 'vscode';
import { BeansOutput } from '../logging';
import { Bean } from '../model';
import { BeansService } from '../service';

type DetailsWebviewMessage = {
  command?: 'updateBean' | 'openBeanFromReference' | 'toggleChecklist';
  updates?: unknown;
  beanId?: unknown;
  lineIndex?: unknown;
  checked?: unknown;
};

/**
 * Webview view provider for displaying bean details in the sidebar
 */
export class BeansDetailsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'beans.details';
  private _view?: vscode.WebviewView;
  private _currentBean?: Bean;
  private _parentBean?: Bean;
  private readonly _navigationHistory: string[] = [];
  private readonly logger = BeansOutput.getInstance();

  /** The currently displayed bean (used by view/title edit command). */
  public get currentBean(): Bean | undefined {
    return this._currentBean;
  }

  /** Whether there is a previously visited bean in details navigation history. */
  public get canGoBack(): boolean {
    return this._navigationHistory.length > 0;
  }

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly service: BeansService
  ) {}

  /**
   * Resolve the webview view
   */
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

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (message: DetailsWebviewMessage) => {
      switch (message.command) {
        case 'updateBean':
          await this.handleBeanUpdate(message.updates);
          break;
        case 'openBeanFromReference':
          if (typeof message.beanId === 'string') {
            await this.openBeanFromReference(message.beanId);
          }
          break;
        case 'toggleChecklist':
          if (typeof message.lineIndex === 'number' && typeof message.checked === 'boolean') {
            await this.handleToggleChecklist(message.lineIndex, message.checked);
          }
          break;
      }
    });

    // Update content when view becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this._currentBean) {
        this.updateView(this._currentBean);
      }
    });

    // Set initial content
    if (this._currentBean) {
      this.updateView(this._currentBean);
    } else {
      webviewView.webview.html = this.getEmptyHtml();
    }

    void this.updateDetailsContextKeys();

    this.logger.debug('Bean details view resolved');
  }

  /**
   * Handle bean update from webview
   */
  private async handleBeanUpdate(updates: any): Promise<void> {
    if (!this._currentBean) {
      return;
    }

    try {
      const updatedBean = await this.service.updateBean(this._currentBean.id, updates);
      this._currentBean = updatedBean;
      this.updateView(updatedBean);

      // Refresh tree views
      await vscode.commands.executeCommand('beans.refreshAll');

      vscode.window.showInformationMessage('Bean updated successfully');
    } catch (error) {
      this.logger.error('Failed to update bean', error as Error);
      vscode.window.showErrorMessage(`Failed to update bean: ${(error as Error).message}`);
    }
  }

  /**
   * Show bean details in the view
   * Fetches full bean data including body field
   */
  public async showBean(bean: Bean): Promise<void> {
    this._navigationHistory.length = 0;
    try {
      // Fetch full bean data including body field
      const fullBean = await this.service.showBean(bean.id);
      this._currentBean = fullBean;
      await this.updateDetailsContextKeys();

      // Resolve parent bean for display (code + title)
      this._parentBean = undefined;
      if (fullBean.parent) {
        try {
          this._parentBean = await this.service.showBean(fullBean.parent);
        } catch {
          // Parent may not be resolvable; ignore
        }
      }

      if (this._view) {
        this.updateView(fullBean);
      }
    } catch (error) {
      this.logger.error('Failed to fetch bean details', error as Error);
      // Fall back to using the provided bean (without body)
      this._currentBean = bean;
      this._parentBean = undefined;
      await this.updateDetailsContextKeys();
      if (this._view) {
        this.updateView(bean);
      }
    }
  }

  /**
   * Clear the view
   */
  public clear(): void {
    this._currentBean = undefined;
    this._parentBean = undefined;
    this._navigationHistory.length = 0;
    this.updateDetailsContextKeys().catch(error => {
      this.logger.error('Failed to update details context keys after clear', error as Error);
    });
    if (this._view) {
      this._view.webview.html = this.getEmptyHtml();
    }
  }

  /** Navigate back to the previously opened bean, if any history exists. */
  public async goBackFromHistory(): Promise<void> {
    await this.goBack();
  }

  /** Refresh the currently displayed bean from disk/CLI and rerender details view. */
  public async refreshCurrentBean(): Promise<void> {
    if (!this._currentBean) {
      return;
    }

    await this.showBeanById(this._currentBean.id);
  }

  /**
   * Update the webview content with bean details
   */
  private updateView(bean: Bean): void {
    if (!this._view) {
      return;
    }

    this._view.webview.html = this.getBeanHtml(bean, this._view.webview);
    this.logger.debug(`Updated details view for bean ${bean.code}`);
  }

  /**
   * Generate HTML for empty state
   */
  private getEmptyHtml(): string {
    const nonce = this.getNonce();
    const csp = [
      "default-src 'none'",
      'img-src data:',
      "style-src 'unsafe-inline'",
      `script-src 'nonce-${nonce}'`,
      'font-src data:',
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>Bean Details</title>
  <style>
    body {
      padding: 16px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="empty-state">
    <p>Select a bean to view details</p>
  </div>
</body>
</html>`;
  }

  /**
   * Generate HTML for bean details
   */
  private getBeanHtml(bean: Bean, webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const tagsBadges = bean.tags?.map(tag => this.renderBadge(tag, 'tag')).join('') || '';
    const iconName = this.getIconName(bean);
    const iconLabel = this.getIconLabel(bean);
    const codiconStylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'media', 'codicon.css')
    );
    const codiconFontUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'media', 'codicon.ttf'));
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data: https:`,
      `font-src ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');

    // Render relationships (blocking / blocked-by only; parent moved to header)
    const blockingSection =
      bean.blocking && bean.blocking.length > 0
        ? `
      <div class="section">
        <h3>Blocks</h3>
        <div class="badge-container">
          ${bean.blocking.map(id => this.renderBadge(id, 'relationship')).join('')}
        </div>
      </div>
    `
        : '';

    const blockedBySection =
      bean.blockedBy && bean.blockedBy.length > 0
        ? `
      <div class="section">
        <h3><span class="codicon codicon-stop-circle" aria-hidden="true"></span> Blocked By</h3>
        <div class="badge-container">
          ${bean.blockedBy.map(id => this.renderBadge(id, 'relationship')).join('')}
        </div>
      </div>
    `
        : '';

    // Render body with basic markdown
    const bodyHtml = bean.body
      ? this.renderMarkdown(bean.body, bean.id)
      : '<p style="color: var(--vscode-descriptionForeground);">No description</p>';

    const createdDate = new Date(bean.createdAt).toLocaleDateString();
    const updatedDate = new Date(bean.updatedAt).toLocaleDateString();

    // Parent info: show inline with clickable reference
    const parentSpan = this._parentBean
      ? ` <span class="parent-sep">&middot;</span> <span class="parent-label">Parent</span> <a href="#" class="bean-ref parent-ref" data-bean-id="${this.escapeHtml(
          this._parentBean.id
        )}"><span class="parent-code">${this.escapeHtml(this._parentBean.code)}</span></a> <span class="parent-title" title="${this.escapeHtml(
          this._parentBean.title
        )}">${this.escapeHtml(this._parentBean.title)}</span>`
      : bean.parent
        ? ` <span class="parent-sep">&middot;</span> <span class="parent-label">Parent</span> <a href="#" class="bean-ref parent-ref" data-bean-id="${this.escapeHtml(
            bean.parent
          )}"><span class="parent-code">${this.escapeHtml(bean.parent.split('-').pop() || bean.parent)}</span></a>`
        : '';

    const statusOptions = this.escapeHtml(
      JSON.stringify([
        { value: 'draft', label: 'Draft', icon: 'issue-draft' },
        { value: 'todo', label: 'Todo', icon: 'issues' },
        { value: 'in-progress', label: 'In Progress', icon: 'play-circle' },
        { value: 'completed', label: 'Completed', icon: 'issue-closed' },
        { value: 'scrapped', label: 'Scrapped', icon: 'stop' },
      ])
    );
    const typeOptions = this.escapeHtml(
      JSON.stringify([
        { value: 'milestone', label: 'Milestone', icon: 'milestone' },
        { value: 'epic', label: 'Epic', icon: 'zap' },
        { value: 'feature', label: 'Feature', icon: 'lightbulb' },
        { value: 'task', label: 'Task', icon: 'list-unordered' },
        { value: 'bug', label: 'Bug', icon: 'bug' },
      ])
    );
    const priorityOptions = this.escapeHtml(
      JSON.stringify([
        { value: '', label: '— None', icon: '' },
        { value: 'critical', label: ' ① Critical', icon: '' },
        { value: 'high', label: ' ② High', icon: '' },
        { value: 'normal', label: ' ③ Normal', icon: '' },
        { value: 'low', label: ' ④ Low', icon: '' },
        { value: 'deferred', label: ' ⑤ Deferred', icon: '' },
      ])
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link href="${codiconStylesUri}" rel="stylesheet" />
  <title>Bean Details</title>
  <style>
    @font-face {
      font-family: "codicon";
      font-display: block;
      src: url("${codiconFontUri}") format("truetype");
    }
    body {
      padding: 0;
      margin: 0;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.6;
    }
    .header {
      padding: 12px 16px 16px;
      background: var(--vscode-sideBar-background);
    }
    .title-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 12px;
    }
    .title-icon {
      font-size: 15px;
      opacity: 0.8;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .sr-only {
      border: 0;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      height: 1px;
      margin: -1px;
      overflow: hidden;
      padding: 0;
      position: absolute;
      white-space: nowrap;
      width: 1px;
    }
    .title {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
      color: var(--vscode-foreground);
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .bean-id {
      font-size: 11px;
      font-family: var(--vscode-editor-font-family);
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
      margin-bottom: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bean-id .code-badge {
      font-weight: 600;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 11px;
    }
    .parent-sep {
      margin: 0 2px;
      opacity: 0.5;
    }
    .parent-label {
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-right: 2px;
      opacity: 0.7;
      font-size: 10px;
    }
    .parent-code {
      font-weight: 600;
      font-family: var(--vscode-editor-font-family);
      margin-right: 4px;
    }
    .parent-title {
      opacity: 0.7;
    }
    .parent-ref {
      color: var(--vscode-textLink-foreground);
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 2px;
    }
    .parent-ref:hover {
      color: var(--vscode-textLink-activeForeground, var(--vscode-textLink-foreground));
    }
    .parent-ref:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 2px;
      border-radius: 2px;
    }
    .metadata {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .metadata-section {
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
      border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 8px;
      row-gap: 6px;
      align-items: center;
    }
    .metadata-row {
      display: contents;
    }
    .metadata-label-group {
      display: flex;
      align-items: center;
      gap: 5px;
      min-width: 85px;
      flex-shrink: 0;
    }
    .metadata-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .metadata-icon {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      width: 14px;
      text-align: center;
      flex-shrink: 0;
    }
    .icon-select {
      position: relative;
    }
    .icon-select-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      width: 100%;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      padding: 3px 6px;
      font-size: 12px;
      border-radius: 2px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
      text-align: left;
      box-sizing: border-box;
    }
    .icon-select-btn:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .icon-select-chevron {
      margin-left: auto;
      opacity: 0.6;
    }
    .icon-select-list {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 200;
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 2px;
      margin-top: 1px;
      padding: 2px 0;
      list-style: none;
      max-height: 200px;
      overflow-y: auto;
    }
    .icon-select-list.open {
      display: block;
    }
    .icon-select-option {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      font-size: 12px;
      cursor: pointer;
      color: var(--vscode-dropdown-foreground);
    }
    .icon-select-option:hover,
    .icon-select-option:focus {
      background: var(--vscode-list-hoverBackground);
      outline: none;
    }
    .icon-select-option.selected {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }
    .badge.tag {
      background: var(--vscode-editor-inactiveSelectionBackground);
      color: var(--vscode-foreground);
      font-size: 11px;
    }
    .badge.relationship {
      background: var(--vscode-textLink-foreground);
      color: var(--vscode-badge-foreground);
      font-size: 11px;
    }
    .content {
      padding: 0 16px 8px;
    }
    .section {
      margin-bottom: 12px;
    }
    .section h3 {
      font-size: 13px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: var(--vscode-foreground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-container {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .body-content {
      color: var(--vscode-foreground);
      font-size: 12px;
    }
    .body-content h1,
    .body-content h2,
    .body-content h3 {
      margin-top: 12px;
      margin-bottom: 6px;
      font-weight: 600;
    }
    .body-content h1 { font-size: 13px; }
    .body-content h2 { font-size: 12.5px; }
    .body-content h3 { font-size: 12px; }
    .body-content p {
      margin: 6px 0;
    }
    .body-content ul,
    .body-content ol {
      margin: 8px 0;
      padding-left: 24px;
    }
    .body-content li {
      margin: 4px 0;
    }
    .body-content .checklist-item {
      list-style: none;
      margin-left: -20px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 2px 0;
    }
    .body-content .checklist-checkbox {
      margin-top: 1px;
      accent-color: var(--vscode-checkbox-selectBackground, var(--vscode-focusBorder));
      cursor: pointer;
      flex-shrink: 0;
    }
    .body-content .checklist-label {
      display: inline-block;
      min-width: 0;
    }
    .body-content code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    .body-content pre {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
    }
    .body-content pre code {
      background: none;
      padding: 0;
    }
    .body-content blockquote {
      margin: 8px 0;
      padding-left: 12px;
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      color: var(--vscode-textBlockQuote-foreground);
    }
    .body-content .bean-ref {
      color: var(--vscode-textLink-foreground);
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 2px;
    }
    .body-content .bean-ref:hover {
      color: var(--vscode-textLink-activeForeground, var(--vscode-textLink-foreground));
    }
    .body-content .bean-ref:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 2px;
      border-radius: 2px;
    }
    .timestamp {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-row">
      <span class="title-icon codicon codicon-${this.escapeHtml(iconName)}" role="img" aria-label="${this.escapeHtml(iconLabel)}"></span>
      <h1 class="title">${this.escapeHtml(bean.title)}</h1>
    </div>
    <div class="bean-id">
      <span class="code-badge">${this.escapeHtml(bean.id)}</span>${parentSpan}
    </div>

    <div class="timestamp">
      Created ${createdDate} &middot; Updated ${updatedDate}
    </div>
  </div>
  <div class="metadata-section">
    <div class="metadata-row">
      <div class="metadata-label-group">
        <span class="metadata-icon codicon codicon-pulse" aria-hidden="true"></span>
        <span class="metadata-label">Status</span>
      </div>
      <div class="icon-select" data-field="status" data-value="${this.escapeHtml(bean.status)}" data-options="${statusOptions}" aria-label="Status" role="group"></div>
    </div>

    <div class="metadata-row">
      <div class="metadata-label-group">
        <span class="metadata-icon codicon codicon-folder" aria-hidden="true"></span>
        <span class="metadata-label">Type</span>
      </div>
      <div class="icon-select" data-field="type" data-value="${this.escapeHtml(bean.type)}" data-options="${typeOptions}" aria-label="Type" role="group"></div>
    </div>

    <div class="metadata-row">
      <div class="metadata-label-group">
        <span class="metadata-icon codicon codicon-list-ordered" aria-hidden="true"></span>
        <span class="metadata-label">Priority</span>
      </div>
      <div class="icon-select" data-field="priority" data-value="${this.escapeHtml(bean.priority || '')}" data-options="${priorityOptions}" aria-label="Priority" role="group"></div>
    </div>

    ${tagsBadges ? `<div class="metadata" style="grid-column:1/-1">${tagsBadges}</div>` : ''}
  </div>
  <div class="content">
    <div class="body-content">
      ${bodyHtml}
    </div>
    ${blockingSection}
    ${blockedBySection}
  </div>

  <script nonce="${nonce}">
    function initIconSelect(el) {
      var field = el.dataset.field;
      var options = JSON.parse(el.dataset.options || '[]');

      function renderBtnInner() {
        var cur = options.find(function(o) { return o.value === el.dataset.value; });
        if (!cur) { cur = options[0]; }
        var iconHtml = cur && cur.icon ? '<span class="codicon codicon-' + cur.icon + '" aria-hidden="true"></span>' : '';
        return iconHtml
          + '<span>' + (cur ? cur.label : '') + '</span>'
          + '<span class="codicon codicon-chevron-down icon-select-chevron" aria-hidden="true"></span>';
      }

      var list = document.createElement('ul');
      list.className = 'icon-select-list';
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', el.getAttribute('aria-label') || field);
      options.forEach(function(o) {
        var li = document.createElement('li');
        li.className = 'icon-select-option' + (o.value === el.dataset.value ? ' selected' : '');
        li.setAttribute('role', 'option');
        li.setAttribute('data-value', o.value);
        li.setAttribute('aria-selected', o.value === el.dataset.value ? 'true' : 'false');
        li.setAttribute('tabindex', '-1');
        var iconHtml = o.icon ? '<span class="codicon codicon-' + o.icon + '" aria-hidden="true"></span>' : '';
        li.innerHTML = iconHtml + '<span>' + o.label + '</span>';
        list.appendChild(li);
      });

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'icon-select-btn';
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', el.getAttribute('aria-label') || field);
      btn.innerHTML = renderBtnInner();

      el.innerHTML = '';
      el.appendChild(btn);
      el.appendChild(list);

      function openList() {
        list.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        var sel = list.querySelector('.selected') || list.querySelector('[role="option"]');
        if (sel) { sel.focus(); }
      }

      function closeList() {
        list.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }

      function selectVal(value) {
        el.dataset.value = value;
        btn.innerHTML = renderBtnInner();
        list.querySelectorAll('[role="option"]').forEach(function(opt) {
          var isSelected = opt.dataset.value === value;
          opt.classList.toggle('selected', isSelected);
          opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
        closeList();
        btn.focus();
        updateField(field, value);
      }

      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        list.classList.contains('open') ? closeList() : openList();
      });

      btn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          list.classList.contains('open') ? closeList() : openList();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!list.classList.contains('open')) { openList(); }
          else {
            var items = Array.from(list.querySelectorAll('[role="option"]'));
            var idx = items.indexOf(document.activeElement);
            if (items[idx + 1]) { items[idx + 1].focus(); }
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeList();
          btn.focus();
        }
      });

      list.addEventListener('click', function(e) {
        var option = e.target.closest('[role="option"]');
        if (option) { selectVal(option.dataset.value); }
      });

      list.addEventListener('keydown', function(e) {
        var items = Array.from(list.querySelectorAll('[role="option"]'));
        var idx = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (items[idx + 1]) { items[idx + 1].focus(); }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (idx <= 0) { closeList(); btn.focus(); }
          else if (items[idx - 1]) { items[idx - 1].focus(); }
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (document.activeElement && document.activeElement.hasAttribute('data-value')) {
            selectVal(document.activeElement.dataset.value);
          }
        } else if (e.key === 'Escape' || e.key === 'Tab') {
          e.preventDefault();
          closeList();
          btn.focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          if (items[0]) { items[0].focus(); }
        } else if (e.key === 'End') {
          e.preventDefault();
          if (items[items.length - 1]) { items[items.length - 1].focus(); }
        }
      });
    }

    const vscode = acquireVsCodeApi();

    function updateField(field, value) {
      const updates = {};
      updates[field] = value || undefined;
      vscode.postMessage({
        command: 'updateBean',
        updates: updates
      });
    }

    document.querySelectorAll('.icon-select').forEach(initIconSelect);

    document.addEventListener('change', event => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (target.type !== 'checkbox' || !target.classList.contains('checklist-checkbox')) {
        return;
      }

      const lineIndexText = target.getAttribute('data-line-index');
      if (!lineIndexText) {
        return;
      }

      const lineIndex = Number.parseInt(lineIndexText, 10);
      if (!Number.isInteger(lineIndex) || lineIndex < 0) {
        return;
      }

      vscode.postMessage({
        command: 'toggleChecklist',
        lineIndex,
        checked: target.checked,
      });
    });

    document.addEventListener('click', event => {
      // Close any open dropdowns when clicking outside
      document.querySelectorAll('.icon-select-list.open').forEach(function(openList) {
        openList.classList.remove('open');
        var selectEl = openList.closest('.icon-select');
        if (selectEl) {
          var selectBtn = selectEl.querySelector('.icon-select-btn');
          if (selectBtn) { selectBtn.setAttribute('aria-expanded', 'false'); }
        }
      });

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const beanReference = target.closest('a.bean-ref');
      if (beanReference instanceof Element) {
        event.preventDefault();
        const beanId = beanReference.getAttribute('data-bean-id');
        if (beanId) {
          vscode.postMessage({
            command: 'openBeanFromReference',
            beanId,
          });
        }
        return;
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Render a badge
   */
  private renderBadge(text: string, type: 'status' | 'type' | 'priority' | 'tag' | 'relationship'): string {
    return `<span class="badge ${type}">${this.escapeHtml(text)}</span>`;
  }

  /**
   * Basic markdown rendering
   */
  private renderMarkdown(text: string, currentBeanId?: string): string {
    if (!text) {
      return '';
    }

    const normalizedText = this.normalizeEscapedNewlinesOutsideCodeBlocks(text);

    const checklistLineStates = new Map<number, boolean>();
    const withChecklistMarkers = normalizedText
      .split('\n')
      .map((line, lineIndex) => {
        const checklistMatch = /^- \[( |x|X)\] (.+)$/.exec(line);
        if (!checklistMatch) {
          return line;
        }

        const checked = checklistMatch[1].toLowerCase() === 'x';
        checklistLineStates.set(lineIndex, checked);
        return `- @@CHECKLIST_${lineIndex}@@ ${checklistMatch[2]}`;
      })
      .join('\n');

    let html = this.escapeHtml(withChecklistMarkers);

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Code blocks
    html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Links (sanitize href to avoid scriptable protocols in webview)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText: string, href: string) => {
      const safeHref = this.sanitizeHref(href);
      if (!safeHref) {
        return linkText;
      }
      return `<a href="${this.escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    });

    // Lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/<li>@@CHECKLIST_(\d+)@@ (.*?)<\/li>/g, (_match, lineIndexText: string, labelHtml: string) => {
      const lineIndex = Number.parseInt(lineIndexText, 10);
      const isChecked = checklistLineStates.get(lineIndex) ?? false;
      const checkedAttribute = isChecked ? ' checked' : '';

      return `<li class="checklist-item"><input class="checklist-checkbox" type="checkbox" data-line-index="${lineIndex}" aria-label="Toggle checklist item"${checkedAttribute}><span class="checklist-label">${labelHtml}</span></li>`;
    });
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');

    html = this.autoLinkBeanReferences(html, currentBeanId);

    return html;
  }

  /**
   * Convert escaped newline literals ("\\n") to real newlines, but only outside
   * fenced code blocks so code samples keep literal escape sequences intact.
   */
  private normalizeEscapedNewlinesOutsideCodeBlocks(text: string): string {
    const lines = text.split('\n');
    let inFence = false;

    const normalizedLines = lines.map(line => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('```')) {
        inFence = !inFence;
        return line;
      }

      return inFence ? line : line.replace(/\\n/g, '\n');
    });

    return normalizedLines.join('\n');
  }

  private autoLinkBeanReferences(html: string, currentBeanId?: string): string {
    const tokenPattern = /(<[^>]+>|[^<]+)/g;
    const beanIdPattern = /\b([a-z][a-z0-9-]*-\d[a-z0-9]*)\b/gi;
    let inAnchor = false;
    let inCode = false;
    let inPre = false;

    return html.replace(tokenPattern, token => {
      if (token.startsWith('<')) {
        const tag = token.toLowerCase();
        if (/^<a(?:\s|>)/.test(tag) && !/^<\/a>/.test(tag)) {
          inAnchor = true;
        } else if (/^<\/a>/.test(tag)) {
          inAnchor = false;
        } else if (/^<pre(?:\s|>)/.test(tag) && !/^<\/pre>/.test(tag)) {
          inPre = true;
        } else if (/^<\/pre>/.test(tag)) {
          inPre = false;
        } else if (/^<code(?:\s|>)/.test(tag) && !/^<\/code>/.test(tag)) {
          inCode = true;
        } else if (/^<\/code>/.test(tag)) {
          inCode = false;
        }
        return token;
      }

      if (inAnchor || inCode || inPre) {
        return token;
      }

      return token.replace(beanIdPattern, matchedId => {
        if (currentBeanId && matchedId.toLowerCase() === currentBeanId.toLowerCase()) {
          return matchedId;
        }
        const safeId = this.escapeHtml(matchedId);
        return `<a href="#" class="bean-ref" data-bean-id="${safeId}">${safeId}</a>`;
      });
    });
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const div = { textContent: text } as any;
    return div.textContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Allow only safe URL schemes for markdown links rendered in webview content.
   */
  private sanitizeHref(href: string): string | undefined {
    const trimmed = href.trim();
    if (!trimmed) {
      return undefined;
    }

    // Block control characters and whitespace obfuscation in protocol segment.
    if (/\s/.test(trimmed) || /[\u0000-\u001F\u007F]/.test(trimmed)) {
      return undefined;
    }

    // Explicitly allow common safe absolute schemes only.
    if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) {
      return trimmed;
    }

    return undefined;
  }

  private async openBeanFromReference(beanId: string): Promise<void> {
    if (!this._currentBean || this._currentBean.id === beanId) {
      return;
    }

    this._navigationHistory.push(this._currentBean.id);
    const opened = await this.showBeanById(beanId);
    if (!opened) {
      this._navigationHistory.pop();
      if (this._currentBean) {
        this.updateView(this._currentBean);
      }
      await this.updateDetailsContextKeys();
    }
  }

  private async handleToggleChecklist(lineIndex: number, checked: boolean): Promise<void> {
    if (!this._currentBean) {
      return;
    }

    if (!Number.isInteger(lineIndex) || lineIndex < 0) {
      return;
    }

    try {
      const fileUri = this.resolveCurrentBeanFileUri();
      const document = await vscode.workspace.openTextDocument(fileUri);
      const bodyStartLine = this.getBeanBodyStartLine(document.getText());
      const targetLineIndex = bodyStartLine + lineIndex;

      if (targetLineIndex < 0 || targetLineIndex >= document.lineCount) {
        throw new Error(`Checklist line out of range: ${lineIndex}`);
      }

      const targetLine = document.lineAt(targetLineIndex);
      const checklistMatch = /^(\s*- \[)( |x|X)(\] .*)$/.exec(targetLine.text);
      if (!checklistMatch) {
        throw new Error(`Line ${lineIndex} is not a checklist item`);
      }

      const desiredMarker = checked ? 'x' : ' ';
      const updatedLine = `${checklistMatch[1]}${desiredMarker}${checklistMatch[3]}`;

      if (updatedLine === targetLine.text) {
        return;
      }

      const edit = new vscode.WorkspaceEdit();
      edit.replace(fileUri, targetLine.range, updatedLine);

      const applied = await vscode.workspace.applyEdit(edit);
      if (!applied) {
        throw new Error('Failed to apply checklist edit');
      }

      await document.save();

      const refreshed = await this.service.showBean(this._currentBean.id);
      this._currentBean = refreshed;

      this._parentBean = undefined;
      if (refreshed.parent) {
        try {
          this._parentBean = await this.service.showBean(refreshed.parent);
        } catch {
          // Parent may not be resolvable; ignore
        }
      }

      if (this._view) {
        this.updateView(refreshed);
      }

      await vscode.commands.executeCommand('beans.refreshAll');
    } catch (error) {
      this.logger.error('Failed to toggle checklist item', error as Error);
      vscode.window.showErrorMessage(`Failed to toggle checklist item: ${(error as Error).message}`);
    }
  }

  private resolveCurrentBeanFileUri(): vscode.Uri {
    if (!this._currentBean) {
      throw new Error('No selected bean');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    const beanPath = this._currentBean.path.replace(/\\/g, '/');
    if (beanPath.startsWith('.beans/')) {
      return vscode.Uri.joinPath(workspaceFolder.uri, beanPath);
    }

    return vscode.Uri.joinPath(workspaceFolder.uri, '.beans', beanPath);
  }

  private getBeanBodyStartLine(fileContent: string): number {
    const lines = fileContent.split('\n');
    if (lines.length === 0 || lines[0].trim() !== '---') {
      return 0;
    }

    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i].trim() === '---') {
        return i + 1;
      }
    }

    return 0;
  }

  private async goBack(): Promise<void> {
    const previousBeanId = this._navigationHistory.pop();
    if (!previousBeanId) {
      return;
    }

    const opened = await this.showBeanById(previousBeanId);
    if (!opened) {
      this._navigationHistory.push(previousBeanId);
      if (this._currentBean) {
        this.updateView(this._currentBean);
      }
      await this.updateDetailsContextKeys();
    }
  }

  private async showBeanById(beanId: string): Promise<boolean> {
    try {
      const fullBean = await this.service.showBean(beanId);
      this._currentBean = fullBean;
      await this.updateDetailsContextKeys();

      this._parentBean = undefined;
      if (fullBean.parent) {
        try {
          this._parentBean = await this.service.showBean(fullBean.parent);
        } catch {
          // Parent may not be resolvable; ignore
        }
      }

      if (this._view) {
        this.updateView(fullBean);
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to fetch bean details for ${beanId}`, error as Error);
      vscode.window.showErrorMessage(`Failed to open bean ${beanId}: ${(error as Error).message}`);
      return false;
    }
  }

  private async updateDetailsContextKeys(): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'beans.hasSelectedBean', Boolean(this._currentBean));
    await vscode.commands.executeCommand('setContext', 'beans.detailsCanGoBack', this.canGoBack);
  }

  private getNonce(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }

  /**
   * Get icon name for bean based on status and type
   */
  private getIconName(bean: Bean): string {
    // Mirror BeanTreeItem: use status-specific icons for non-todo statuses,
    // fall back to type icon for todo/default.
    switch (bean.status) {
      case 'completed':
        return 'issue-closed';
      case 'in-progress':
        return 'play-circle';
      case 'scrapped':
        return 'stop';
      case 'draft':
        return 'issue-draft';
      case 'todo':
      default:
        return this.getTypeIconName(bean.type);
    }
  }

  /**
   * Get type-specific icon name
   */
  private getTypeIconName(type: string): string {
    switch (type) {
      case 'milestone':
        return 'milestone';
      case 'epic':
        return 'zap';
      case 'feature':
        return 'lightbulb';
      case 'bug':
        return 'bug';
      case 'task':
      default:
        return 'list-unordered';
    }
  }

  private getIconLabel(bean: Bean): string {
    return `${bean.type} ${bean.status} bean`;
  }
}
