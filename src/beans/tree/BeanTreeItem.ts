import * as vscode from 'vscode';
import { Bean } from '../model';

/**
 * Tree item representing a bean in the VS Code tree view
 */
export class BeanTreeItem extends vscode.TreeItem {
  constructor(
    public readonly bean: Bean,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly hasChildren: boolean = false,
    public readonly hasInProgressChildren: boolean = false
  ) {
    super(bean.title, collapsibleState);

    this.id = bean.id;
    this.description = this.buildDescription();
    this.tooltip = this.buildTooltip();
    this.contextValue = this.buildContextValue();
    this.iconPath = this.getIcon();

    // Open bean in details view on click (works even if item is already selected)
    this.command = {
      command: 'beans.openBean',
      title: 'Open Bean',
      arguments: [bean]
    };
  }

  /**
   * Build description showing the short code
   */
  private buildDescription(): string {
    return this.bean.code || '';
  }

  /**
   * Build detailed tooltip with full bean information
   */
  private buildTooltip(): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.supportHtml = true;
    tooltip.isTrusted = true;

    tooltip.appendMarkdown(`**${this.bean.title}**\n\n`);
    tooltip.appendMarkdown(`ID: \`${this.bean.id}\`\n\n`);
    tooltip.appendMarkdown(`Code: \`${this.bean.code}\`\n\n`);
    tooltip.appendMarkdown(`Type: ${this.bean.type}\n\n`);
    tooltip.appendMarkdown(`Status: ${this.bean.status}\n\n`);

    if (this.bean.priority) {
      tooltip.appendMarkdown(`Priority: ${this.bean.priority}\n\n`);
    }

    if (this.bean.parent) {
      tooltip.appendMarkdown(`Parent: ${this.bean.parent}\n\n`);
    }

    if (this.bean.blocking.length > 0) {
      tooltip.appendMarkdown(`Blocking: ${this.bean.blocking.length} bean(s)\n\n`);
    }

    if (this.bean.blockedBy.length > 0) {
      tooltip.appendMarkdown(`Blocked by: ${this.bean.blockedBy.length} bean(s)\n\n`);
    }

    if (this.bean.tags.length > 0) {
      tooltip.appendMarkdown(`Tags: ${this.bean.tags.join(', ')}\n\n`);
    }

    tooltip.appendMarkdown(`---\n\n`);
    tooltip.appendMarkdown(`Created: ${new Date(this.bean.createdAt).toLocaleString()}\n\n`);
    tooltip.appendMarkdown(`Updated: ${new Date(this.bean.updatedAt).toLocaleString()}\n\n`);

    return tooltip;
  }

  /**
   * Build context value for command filtering
   */
  private buildContextValue(): string {
    const parts = ['bean'];

    // Add status
    parts.push(this.bean.status);

    // Add type
    parts.push(this.bean.type);

    // Add special states
    if (this.bean.parent) {
      parts.push('hasParent');
    }

    if (this.hasChildren) {
      parts.push('hasChildren');
    }

    if (this.bean.blocking.length > 0) {
      parts.push('isBlocking');
    }

    if (this.bean.blockedBy.length > 0) {
      parts.push('isBlocked');
    }

    // Deletable only if scrapped or draft
    if (this.bean.status === 'scrapped' || this.bean.status === 'draft') {
      parts.push('deletable');
    }

    return parts.join('-');
  }

  /**
   * Map priority to a pastel-ish ThemeColor for the tree item icon.
   */
  private static readonly PRIORITY_COLORS: Record<string, vscode.ThemeColor> = {
    critical: new vscode.ThemeColor('charts.red'),
    high: new vscode.ThemeColor('charts.orange'),
    normal: new vscode.ThemeColor('charts.blue'),
    low: new vscode.ThemeColor('charts.green'),
    deferred: new vscode.ThemeColor('charts.purple')
  };

  /**
   * Get appropriate icon for the bean.
   * Icon color is determined by priority (if set) or amber for in-progress status.
   */
  private getIcon(): vscode.ThemeIcon {
    // Priority color takes precedence, then in-progress/parent highlight
    const priorityColor = this.bean.priority ? BeanTreeItem.PRIORITY_COLORS[this.bean.priority] : undefined;

    const shouldHighlight = this.bean.status === 'in-progress' || this.hasInProgressChildren;
    const color = priorityColor ?? (shouldHighlight ? new vscode.ThemeColor('charts.yellow') : undefined);

    // Status-based icons (priority over type)
    switch (this.bean.status) {
      case 'completed':
        return new vscode.ThemeIcon('issue-closed', color);
      case 'in-progress':
        return this.getTypeIcon(color);
      case 'scrapped':
        return new vscode.ThemeIcon('error', color);
      case 'draft':
        return new vscode.ThemeIcon('issue-draft', color);
      case 'todo':
      default:
        return this.getTypeIcon(color);
    }
  }

  /**
   * Get type-specific icon
   */
  private getTypeIcon(color?: vscode.ThemeColor): vscode.ThemeIcon {
    switch (this.bean.type) {
      case 'milestone':
        return new vscode.ThemeIcon('milestone', color);
      case 'epic':
        return new vscode.ThemeIcon('zap', color);
      case 'feature':
        return new vscode.ThemeIcon('lightbulb', color);
      case 'bug':
        return new vscode.ThemeIcon('bug', color);
      case 'task':
      default:
        return new vscode.ThemeIcon('issues', color);
    }
  }
}
