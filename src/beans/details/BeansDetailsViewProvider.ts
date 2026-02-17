import * as vscode from 'vscode';
import { BeansOutput } from '../logging';
import { Bean } from '../model';
import { BeansService } from '../service';

type DetailsWebviewMessage = {
  command?: 'updateBean' | 'openBeanFromReference' | 'goBack';
  updates?: unknown;
  beanId?: unknown;
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
        case 'goBack':
          await this.goBack();
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
    this._navigationHistory.length = 0;
    try {
      // Fetch full bean data including body field
      const fullBean = await this.service.showBean(bean.id);
      this._currentBean = fullBean;
      await vscode.commands.executeCommand('setContext', 'beans.hasSelectedBean', true);

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
      await vscode.commands.executeCommand('setContext', 'beans.hasSelectedBean', true);
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
    void vscode.commands.executeCommand('setContext', 'beans.hasSelectedBean', false);
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
    const iconGlyph = this.getIconGlyph(iconName);
    const iconLabel = this.getIconLabel(bean);
    const showBackButton = this._navigationHistory.length > 0;
    const backButtonHtml = showBackButton
      ? '<button type="button" id="back-button" class="back-button" aria-label="Back to previous bean">← Back</button>'
      : '';
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
        <h3>Blocked By</h3>
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
        )}"><span class="parent-code">${this.escapeHtml(this._parentBean.code)}</span> <span class="parent-title" title="${this.escapeHtml(
          this._parentBean.title
        )}">${this.escapeHtml(this._parentBean.title)}</span></a>`
      : bean.parent
        ? ` <span class="parent-sep">&middot;</span> <span class="parent-label">Parent</span> <a href="#" class="bean-ref parent-ref" data-bean-id="${this.escapeHtml(
            bean.parent
          )}"><span class="parent-code">${this.escapeHtml(bean.parent.split('-').pop() || bean.parent)}</span></a>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
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
      padding: 12px 16px 16px;
      background: var(--vscode-sideBar-background);
    }
    .title-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 12px;
    }
    .back-button {
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
      color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 11px;
      line-height: 1.5;
      cursor: pointer;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .back-button:hover {
      background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground));
    }
    .back-button:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
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
      display: flex;
      flex-direction: column;
      align-items: center;
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
      padding: 6px 8px;
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
      ${backButtonHtml}
      <span class="title-icon" role="img" aria-label="${this.escapeHtml(iconLabel)}">${this.escapeHtml(iconGlyph)}</span>
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
      <span class="metadata-label">Status</span>
      <select id="status" onchange="updateField('status', this.value)" aria-label="Status">
        <option value="todo" ${bean.status === 'todo' ? 'selected' : ''}>☑️ Todo</option>
        <option value="in-progress" ${bean.status === 'in-progress' ? 'selected' : ''}>⏳ In Progress</option>
        <option value="completed" ${bean.status === 'completed' ? 'selected' : ''}>✅ Completed</option>
        <option value="draft" ${bean.status === 'draft' ? 'selected' : ''}>📝 Draft</option>
        <option value="scrapped" ${bean.status === 'scrapped' ? 'selected' : ''}>🗑️ Scrapped</option>
      </select>
    </div>

    <div class="metadata-row">
      <span class="metadata-label">Type</span>
      <select id="type" onchange="updateField('type', this.value)" aria-label="Type">
        <option value="task" ${bean.type === 'task' ? 'selected' : ''}>🧑‍💻 Task</option>
        <option value="bug" ${bean.type === 'bug' ? 'selected' : ''}>\uD83D\uDC1B Bug</option>
        <option value="feature" ${bean.type === 'feature' ? 'selected' : ''}>\uD83D\uDCA1 Feature</option>
        <option value="epic" ${bean.type === 'epic' ? 'selected' : ''}>\u26A1 Epic</option>
        <option value="milestone" ${bean.type === 'milestone' ? 'selected' : ''}>\uD83C\uDFC1 Milestone</option>
      </select>
    </div>

    <div class="metadata-row">
      <span class="metadata-label">Priority</span>
      <select id="priority" onchange="updateField('priority', this.value)" aria-label="Priority">
        <option value="" ${!bean.priority ? 'selected' : ''}>\u2014 None</option>
        <option value="critical" ${bean.priority === 'critical' ? 'selected' : ''}>\uD83D\uDD34 Critical</option>
        <option value="high" ${bean.priority === 'high' ? 'selected' : ''}>\uD83D\uDFE0 High</option>
        <option value="normal" ${bean.priority === 'normal' ? 'selected' : ''}>\uD83D\uDFE1 Normal</option>
        <option value="low" ${bean.priority === 'low' ? 'selected' : ''}>\uD83D\uDFE2 Low</option>
        <option value="deferred" ${bean.priority === 'deferred' ? 'selected' : ''}>\uD83D\uDD35 Deferred</option>
      </select>
    </div>

    ${tagsBadges ? `<div class="metadata">${tagsBadges}</div>` : ''}
  </div>
  <div class="content">
    <div class="body-content">
      ${bodyHtml}
    </div>
    ${blockingSection}
    ${blockedBySection}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function updateField(field, value) {
      const updates = {};
      updates[field] = value || undefined;
      vscode.postMessage({
        command: 'updateBean',
        updates: updates
      });
    }

    document.addEventListener('click', event => {
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

      const backButton = target.closest('#back-button');
      if (backButton instanceof Element) {
        event.preventDefault();
        vscode.postMessage({ command: 'goBack' });
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

    let html = this.escapeHtml(normalizedText);

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
    const beanIdPattern = /\b([a-z][a-z0-9-]*-\d+)\b/gi;
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
    }
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
    }
  }

  private async showBeanById(beanId: string): Promise<boolean> {
    try {
      const fullBean = await this.service.showBean(beanId);
      this._currentBean = fullBean;
      await vscode.commands.executeCommand('setContext', 'beans.hasSelectedBean', true);

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

  private getNonce(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
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

  /**
   * Use resilient inline glyphs for title icons (no external codicon font dependency).
   */
  private getIconGlyph(iconName: string): string {
    switch (iconName) {
      case 'issue-closed':
        return '✅';
      case 'issue-draft':
        return '📝';
      case 'error':
        return '🗑️';
      case 'milestone':
        return '🏁';
      case 'zap':
        return '⚡';
      case 'lightbulb':
        return '💡';
      case 'bug':
        return '🐛';
      case 'issues':
      default:
        return '📋';
    }
  }

  private getIconLabel(bean: Bean): string {
    return `${bean.type} ${bean.status} bean`;
  }
}
