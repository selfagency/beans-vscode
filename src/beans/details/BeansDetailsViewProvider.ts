import * as vscode from 'vscode';
import { BeansOutput } from '../logging';
import { Bean } from '../model';

/**
 * Webview view provider for displaying bean details in the sidebar
 */
export class BeansDetailsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'beans.details';
  private _view?: vscode.WebviewView;
  private _currentBean?: Bean;
  private readonly logger = BeansOutput.getInstance();

  constructor(private readonly extensionUri: vscode.Uri) {}

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
      localResourceRoots: [this.extensionUri]
    };

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
   * Show bean details in the view
   */
  public showBean(bean: Bean): void {
    this._currentBean = bean;
    if (this._view) {
      this.updateView(bean);
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

    this._view.webview.html = this.getBeanHtml(bean);
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
  private getBeanHtml(bean: Bean): string {
    const statusColor = this.getStatusColor(bean.status);
    const priorityBadge = bean.priority ? this.renderBadge(bean.priority, 'priority') : '';
    const tagsBadges = bean.tags?.map((tag) => this.renderBadge(tag, 'tag')).join('') || '';

    // Render relationships
    const parentSection = bean.parent
      ? `
      <div class="section">
        <h3>Parent</h3>
        <div class="badge-container">
          ${this.renderBadge(bean.parent, 'relationship')}
        </div>
      </div>
    `
      : '';

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
    const bodyHtml = this.renderMarkdown(bean.body);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bean Details</title>
  <style>
    body {
      padding: 0;
      margin: 0;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.6;
    }
    .header {
      padding: 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: var(--vscode-foreground);
    }
    .code {
      font-size: 13px;
      font-family: var(--vscode-editor-font-family);
      color: var(--vscode-descriptionForeground);
      margin: 0 0 12px 0;
    }
    .metadata {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }
    .badge.status {
      background: ${statusColor};
      color: var(--vscode-badge-foreground);
    }
    .badge.type {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .badge.priority {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
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
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="code">${bean.code}</div>
    <h1 class="title">${this.escapeHtml(bean.title)}</h1>
    <div class="metadata">
      <span class="badge status">${bean.status}</span>
      <span class="badge type">${bean.type}</span>
      ${priorityBadge}
    </div>
    ${tagsBadges ? `<div class="metadata">${tagsBadges}</div>` : ''}
    <div class="timestamp">
      Created: ${new Date(bean.createdAt).toLocaleDateString()}<br/>
      Updated: ${new Date(bean.updatedAt).toLocaleDateString()}
    </div>
  </div>
  <div class="content">
    ${parentSection}
    ${blockingSection}
    ${blockedBySection}
    ${
      bean.body
        ? `
      <div class="section">
        <h3>Description</h3>
        <div class="body-content">
          ${bodyHtml}
        </div>
      </div>
    `
        : '<div class="section"><p style="color: var(--vscode-descriptionForeground);">No description</p></div>'
    }
  </div>
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
   * Get color for status
   */
  private getStatusColor(status: string): string {
    switch (status) {
      case 'completed':
        return 'var(--vscode-testing-iconPassed)';
      case 'in-progress':
        return 'var(--vscode-testing-iconQueued)';
      case 'todo':
        return 'var(--vscode-button-background)';
      case 'scrapped':
        return 'var(--vscode-testing-iconFailed)';
      case 'draft':
        return 'var(--vscode-button-secondaryBackground)';
      default:
        return 'var(--vscode-badge-background)';
    }
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
}
