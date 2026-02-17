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

    // Status, Type, Priority
    const badges: string[] = [];
    badges.push(
      `![${bean.status}](https://img.shields.io/badge/${this.encodeForBadge(bean.status)}-${this.getStatusColor(
        bean.status
      )})`
    );
    badges.push(
      `![${bean.type}](https://img.shields.io/badge/${this.encodeForBadge(bean.type)}-${this.getTypeColor(bean.type)})`
    );

    if (bean.priority) {
      badges.push(
        `![${bean.priority}](https://img.shields.io/badge/${this.encodeForBadge(bean.priority)}-${this.getPriorityColor(
          bean.priority
        )})`
      );
    }

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

    return lines.join('\n');
  }

  /**
   * Encode text for badge URL
   */
  private encodeForBadge(text: string): string {
    return encodeURIComponent(text.replace(/-/g, '--').replace(/_/g, '__').replace(/ /g, '_'));
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
