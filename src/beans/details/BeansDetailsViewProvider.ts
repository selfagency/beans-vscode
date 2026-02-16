import * as vscode from 'vscode';
import { BeansOutput } from '../logging';
import { Bean } from '../model';
import { BeansService } from '../service';

/**
 * Webview view provider for displaying bean details in the sidebar
 */
export class BeansDetailsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'beans.details';
  private _view?: vscode.WebviewView;
  private _currentBean?: Bean;
  private _parentBean?: Bean;
  private readonly logger = BeansOutput.getInstance();

  constructor(private readonly extensionUri: vscode.Uri, private readonly service: BeansService) {}

  /**
   * Resolve the webview view
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    // Include codicons dist folder so the webview can load the font
    const codiconsUri = vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist');

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri, codiconsUri]
    };

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'updateBean':
          await this.handleBeanUpdate(message.updates);
          break;
        case 'editBean':
          if (this._currentBean) {
            await vscode.commands.executeCommand('beans.edit', this._currentBean);
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
    try {
      // Fetch full bean data including body field
      const fullBean = await this.service.showBean(bean.id);
      this._currentBean = fullBean;

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
    if (this._view) {
      this._view.webview.html = this.getEmptyHtml();
    }
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
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
    const tagsBadges = bean.tags?.map((tag) => this.renderBadge(tag, 'tag')).join('') || '';
    const iconName = this.getIconName(bean);

    // Generate codicon CSS URI for the webview
    const codiconCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
    );

    // Render relationships (blocking / blocked-by only; parent moved to header)
    const blockingSection =
      bean.blocking && bean.blocking.length > 0
        ? `
      <div class="section">
        <h3>Blocks</h3>
        <div class="badge-container">
          ${bean.blocking.map((id) => this.renderBadge(id, 'relationship')).join('')}
        </div>
      </div>
    `
        : '';

    const blockedBySection =
      bean.blockedBy && bean.blockedBy.length > 0
        ? `
      <div class="section">
        <h3>Blocked By</h3>
        <div class="badge-container">
          ${bean.blockedBy.map((id) => this.renderBadge(id, 'relationship')).join('')}
        </div>
      </div>
    `
        : '';

    // Render body with basic markdown
    const bodyHtml = bean.body
      ? this.renderMarkdown(bean.body)
      : '<p style="color: var(--vscode-descriptionForeground);">No description</p>';

    const createdDate = new Date(bean.createdAt).toLocaleDateString();
    const updatedDate = new Date(bean.updatedAt).toLocaleDateString();

    // Parent line: show parent code + title (truncated) if available
    const parentLine = this._parentBean
      ? `<div class="parent-line" title="${this.escapeHtml(
          this._parentBean.id
        )}"><span class="parent-code">${this.escapeHtml(this._parentBean.code)}</span> ${this.escapeHtml(
          this._parentBean.title
        )}</div>`
      : bean.parent
      ? `<div class="parent-line" title="${this.escapeHtml(bean.parent)}"><span class="parent-code">${this.escapeHtml(
          bean.parent.split('-').pop() || ''
        )}</span> ${this.escapeHtml(bean.parent)}</div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bean Details</title>
  <link href="${codiconCssUri}" rel="stylesheet" />
  <style>
    body {
      padding: 0;
      margin: 0;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.6;
    }
    .toolbar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 6px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
    }
    .icon-button {
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--vscode-foreground);
      opacity: 0.7;
      padding: 4px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .icon-button:hover {
      opacity: 1;
      background: var(--vscode-toolbar-hoverBackground);
    }
    .icon-button:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }
    .header {
      padding: 12px 16px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
    }
    .title-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 12px;
    }
    .title-icon {
      font-size: 16px;
      opacity: 0.8;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .title {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
      color: var(--vscode-foreground);
      line-height: 1.3;
    }
    .bean-id {
      font-size: 12px;
      font-family: var(--vscode-editor-font-family);
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    .bean-id .code-badge {
      font-weight: 600;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 11px;
    }
    .parent-line {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .parent-line .parent-code {
      font-weight: 600;
      font-family: var(--vscode-editor-font-family);
      margin-right: 4px;
    }
    .metadata {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .metadata-row {
      display: flex;
      gap: 20px;
      align-items: center;
      margin-bottom: 8px;
    }
    .metadata-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      min-width: 60px;
    }
    select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      padding: 6px 12px;
      font-size: 12px;
      border-radius: 2px;
      cursor: pointer;
      min-width: 150px;
    }
    select:focus {
      outline: 1px solid var(--vscode-focusBorder);
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
      padding: 16px;
    }
    .section {
      margin-bottom: 20px;
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
    }
    .body-content h1,
    .body-content h2,
    .body-content h3 {
      margin-top: 16px;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .body-content h1 { font-size: 18px; }
    .body-content h2 { font-size: 16px; }
    .body-content h3 { font-size: 14px; }
    .body-content p {
      margin: 8px 0;
    }
    .body-content ul,
    .body-content ol {
      margin: 8px 0;
      padding-left: 24px;
    }
    .body-content li {
      margin: 4px 0;
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
    .timestamp {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="icon-button" onclick="editBean()" title="Edit Bean" aria-label="Edit Bean">
      <span class="codicon codicon-edit"></span>
    </button>
  </div>
  <div class="header">
    <div class="bean-id">
      <span class="code-badge">${this.escapeHtml(bean.id)}</span>
    </div>
    ${parentLine}
    <div class="title-row">
      <span class="codicon codicon-${iconName} title-icon"></span>
      <h1 class="title">${this.escapeHtml(bean.title)}</h1>
    </div>

    <div class="timestamp">
      Created ${createdDate} &middot; Updated ${updatedDate}
    </div>

    <div class="metadata-row">
      <span class="metadata-label">Status</span>
      <select id="status" onchange="updateField('status', this.value)" aria-label="Status">
        <option value="todo" ${bean.status === 'todo' ? 'selected' : ''}>Todo</option>
        <option value="in-progress" ${bean.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
        <option value="completed" ${bean.status === 'completed' ? 'selected' : ''}>Completed</option>
        <option value="draft" ${bean.status === 'draft' ? 'selected' : ''}>Draft</option>
        <option value="scrapped" ${bean.status === 'scrapped' ? 'selected' : ''}>Scrapped</option>
      </select>
    </div>

    <div class="metadata-row">
      <span class="metadata-label">Type</span>
      <select id="type" onchange="updateField('type', this.value)" aria-label="Type">
        <option value="task" ${bean.type === 'task' ? 'selected' : ''}>Task</option>
        <option value="bug" ${bean.type === 'bug' ? 'selected' : ''}>Bug</option>
        <option value="feature" ${bean.type === 'feature' ? 'selected' : ''}>Feature</option>
        <option value="epic" ${bean.type === 'epic' ? 'selected' : ''}>Epic</option>
        <option value="milestone" ${bean.type === 'milestone' ? 'selected' : ''}>Milestone</option>
      </select>
    </div>

    <div class="metadata-row">
      <span class="metadata-label">Priority</span>
      <select id="priority" onchange="updateField('priority', this.value)" aria-label="Priority">
        <option value="" ${!bean.priority ? 'selected' : ''}>None</option>
        <option value="critical" ${bean.priority === 'critical' ? 'selected' : ''}>Critical</option>
        <option value="high" ${bean.priority === 'high' ? 'selected' : ''}>High</option>
        <option value="normal" ${bean.priority === 'normal' ? 'selected' : ''}>Normal</option>
        <option value="low" ${bean.priority === 'low' ? 'selected' : ''}>Low</option>
        <option value="deferred" ${bean.priority === 'deferred' ? 'selected' : ''}>Deferred</option>
      </select>
    </div>

    ${tagsBadges ? `<div class="metadata">${tagsBadges}</div>` : ''}
  </div>
  <div class="content">
    ${blockingSection}
    ${blockedBySection}
    <div class="body-content">
      ${bodyHtml}
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function updateField(field, value) {
      const updates = {};
      updates[field] = value || undefined;
      vscode.postMessage({
        command: 'updateBean',
        updates: updates
      });
    }

    function editBean() {
      vscode.postMessage({
        command: 'editBean'
      });
    }
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
  private renderMarkdown(text: string): string {
    if (!text) {
      return '';
    }

    let html = this.escapeHtml(text);

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

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');

    return html;
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
   * Get icon name for bean based on status and type
   */
  private getIconName(bean: Bean): string {
    switch (bean.status) {
      case 'completed':
        return 'issue-closed';
      case 'in-progress':
        return this.getTypeIconName(bean.type);
      case 'scrapped':
        return 'error';
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
        return 'issues';
    }
  }
}
