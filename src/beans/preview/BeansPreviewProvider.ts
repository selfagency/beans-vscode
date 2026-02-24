import * as vscode from 'vscode';
import { BeansOutput } from '../logging';
import { Bean } from '../model';
import { BeansService } from '../service';

const logger = BeansOutput.getInstance();

/**
 * Custom text document content provider for bean previews
 * Renders beans as markdown with metadata badges
 */
export class BeansPreviewProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this._onDidChange.event;

  constructor(private readonly service: BeansService) {}

  /**
   * Provide content for a bean preview URI
   */
  public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const beanId = uri.query;
    if (!beanId) {
      return '# Error\n\nNo bean ID provided';
    }

    try {
      const bean = await this.service.showBean(beanId);
      return this.renderBeanPreview(bean);
    } catch (error) {
      logger.error(`Failed to load bean ${beanId} for preview`, error as Error);
      return `# Error\n\nFailed to load bean: ${(error as Error).message}`;
    }
  }

  /**
   * Refresh a specific bean preview
   */
  public refresh(beanId: string): void {
    const uri = this.getBeanPreviewUri(beanId);
    this._onDidChange.fire(uri);
  }

  /**
   * Get the URI for a bean preview
   */
  public getBeanPreviewUri(beanId: string): vscode.Uri {
    return vscode.Uri.parse(`beans-preview:${beanId}?${beanId}`);
  }

  /**
   * Render bean as markdown with metadata badges
   */
  private renderBeanPreview(bean: Bean): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${bean.title}`);
    lines.push('');

    // Metadata badges
    lines.push('---');
    lines.push('');
    lines.push(`**ID:** \`${bean.id}\` | **Code:** \`${bean.code}\``);
    lines.push('');

    // Status, Type, Priority — render as local inline badges (no external
    // network requests) using simple inline-styled HTML spans. These are
    // safe for markdown rendering in VS Code and work offline.
    const badges: string[] = [];
    badges.push(this.renderBadge(bean.status, this.getStatusColorHex(this.getStatusColor(bean.status))));
    badges.push(this.renderBadge(bean.type, this.getTypeColorHex(this.getTypeColor(bean.type))));

    if (bean.priority) {
      badges.push(this.renderBadge(bean.priority, this.getPriorityColorHex(this.getPriorityColor(bean.priority))));
    }

    // Join with a space; badges are raw HTML so ensure markdown renders them
    // as-is by leaving them inline.
    lines.push(badges.join(' '));
    lines.push('');

    // Parent
    if (bean.parent) {
      lines.push(`**Parent:** ${bean.parent}`);
      lines.push('');
    }

    // Blocking relationships
    if (bean.blocking.length > 0) {
      lines.push(`**Blocking:** ${bean.blocking.join(', ')}`);
      lines.push('');
    }

    if (bean.blockedBy.length > 0) {
      lines.push(`**Blocked by:** ${bean.blockedBy.join(', ')}`);
      lines.push('');
    }

    // Tags
    if (bean.tags.length > 0) {
      lines.push(`**Tags:** ${bean.tags.map(t => `\`${t}\``).join(', ')}`);
      lines.push('');
    }

    // Timestamps
    lines.push(`**Created:** ${new Date(bean.createdAt).toLocaleString()}`);
    lines.push('');
    lines.push(`**Updated:** ${new Date(bean.updatedAt).toLocaleString()}`);
    lines.push('');

    lines.push('---');
    lines.push('');

    // Body content
    if (bean.body && bean.body.trim().length > 0) {
      lines.push(bean.body);
    } else {
      lines.push('_No description provided._');
    }

    // Reference encodeForBadge so the method is not flagged as unused by the
    // TypeScript compiler. Tests rely on this helper for legacy expectations.
    void this.encodeForBadge;

    return lines.join('\n');
  }

  // Legacy: badge URL encoder removed because we now render badges inline.
  private encodeForBadge(text: string): string {
    return encodeURIComponent(text.replace(/-/g, '--').replace(/_/g, '__').replace(/ /g, '_'));
  }

  /**
   * Render a simple inline badge as an HTML span with inline styles. We use
   * inline styles so the markdown preview renders the badge consistently
   * without external CSS.
   */
  private renderBadge(label: string, colorHex: string): string {
    const safeLabel = this.escapeHtml(label);
    return `<span style="display:inline-block;background:${colorHex};color:#fff;padding:2px 8px;border-radius:999px;font-size:12px;margin-right:6px">${safeLabel}</span>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private getStatusColorHex(name: string): string {
    switch (name) {
      case 'success':
        return '#28a745';
      case 'blue':
        return '#0078d4';
      case 'lightgrey':
        return '#d3d3d3';
      case 'red':
        return '#d73a49';
      case 'yellow':
        return '#ffb020';
      default:
        return '#d3d3d3';
    }
  }

  private getTypeColorHex(name: string): string {
    switch (name) {
      case 'purple':
        return '#6f42c1';
      case 'blueviolet':
        return '#8a2be2';
      case 'blue':
        return '#0078d4';
      case 'red':
        return '#d73a49';
      case 'green':
        return '#2ea44f';
      default:
        return '#d3d3d3';
    }
  }

  private getPriorityColorHex(name: string): string {
    switch (name) {
      case 'critical':
        return '#b31b1b';
      case 'orange':
        return '#ff8c00';
      case 'blue':
        return '#0078d4';
      case 'lightgrey':
        return '#d3d3d3';
      case 'inactive':
        return '#9e9e9e';
      default:
        return '#d3d3d3';
    }
  }

  /**
   * Get color for status badge
   */
  private getStatusColor(status: string): string {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in-progress':
        return 'blue';
      case 'todo':
        return 'lightgrey';
      case 'scrapped':
        return 'red';
      case 'draft':
        return 'yellow';
      default:
        return 'lightgrey';
    }
  }

  /**
   * Get color for type badge
   */
  private getTypeColor(type: string): string {
    switch (type) {
      case 'milestone':
        return 'purple';
      case 'epic':
        return 'blueviolet';
      case 'feature':
        return 'blue';
      case 'bug':
        return 'red';
      case 'task':
        return 'green';
      default:
        return 'lightgrey';
    }
  }

  /**
   * Get color for priority badge
   */
  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'orange';
      case 'normal':
        return 'blue';
      case 'low':
        return 'lightgrey';
      case 'deferred':
        return 'inactive';
      default:
        return 'lightgrey';
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._onDidChange.dispose();
  }
}
