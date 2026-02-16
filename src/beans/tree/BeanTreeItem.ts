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

    // Do NOT set this.id — VS Code uses `id` to reconcile tree items
    // across refreshes and will preserve old positions instead of
    // accepting the new order from getChildren().  Leaving id unset
    // forces VS Code to rebuild from scratch each refresh.
    this.label = this.buildLabel();
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
   * Theme color per priority level.
   */
  private static readonly PRIORITY_COLORS: Record<string, string> = {
    critical: 'charts.red',
    high: 'charts.orange',
    normal: 'charts.yellow',
    low: 'charts.green',
    deferred: 'charts.blue'
  };

  /**
   * Display labels for status values (emoji + title case).
   */
  private static readonly STATUS_LABELS: Record<string, string> = {
    todo: '☑️ Todo',
    'in-progress': '⏳ In Progress',
    completed: '✅ Completed',
    draft: '📝 Draft',
    scrapped: '🗑️ Scrapped'
  };

  /**
   * Display labels for type values (emoji + title case).
   */
  private static readonly TYPE_LABELS: Record<string, string> = {
    task: '🧑‍💻 Task',
    bug: '🐛 Bug',
    feature: '💡 Feature',
    epic: '⚡ Epic',
    milestone: '🏁 Milestone'
  };

  /**
   * Display labels for priority values (emoji + title case).
   */
  private static readonly PRIORITY_LABELS: Record<string, string> = {
    critical: '🔴 Critical',
    high: '🟠 High',
    normal: '🟡 Normal',
    low: '🟢 Low',
    deferred: '🔵 Deferred'
  };

  /**
   * Build label — only show ⏳ prefix for in-progress items.
   */
  private buildLabel(): string {
    if (this.bean.status === 'in-progress') {
      return `⏳ ${this.bean.title}`;
    }
    return this.bean.title;
  }

  /**
   * Build description — shows the short code after the title.
   */
  private buildDescription(): string {
    return this.bean.code || '';
  }

  /**
   * Build detailed tooltip styled like the details pane, using
   * full emoji + title-case labels for status, type, and priority.
   */
  private buildTooltip(): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.supportHtml = true;
    tooltip.isTrusted = true;

    const statusLabel = BeanTreeItem.STATUS_LABELS[this.bean.status] || this.bean.status;
    const typeLabel = BeanTreeItem.TYPE_LABELS[this.bean.type] || this.bean.type;
    const priorityLabel = this.bean.priority
      ? BeanTreeItem.PRIORITY_LABELS[this.bean.priority] || this.bean.priority
      : null;

    // Title + code
    tooltip.appendMarkdown(`**${this.bean.title}**&ensp;\`${this.bean.code}\`\n\n`);

    // Metadata table
    tooltip.appendMarkdown(`| | |\n|---|---|\n`);
    tooltip.appendMarkdown(`| **Status** | ${statusLabel} |\n`);
    tooltip.appendMarkdown(`| **Type** | ${typeLabel} |\n`);
    if (priorityLabel) {
      tooltip.appendMarkdown(`| **Priority** | ${priorityLabel} |\n`);
    }

    // Relationships
    if (this.bean.parent) {
      tooltip.appendMarkdown(`| **Parent** | \`${this.bean.parent}\` |\n`);
    }
    if (this.bean.blocking.length > 0) {
      tooltip.appendMarkdown(`| **Blocking** | ${this.bean.blocking.length} bean(s) |\n`);
    }
    if (this.bean.blockedBy.length > 0) {
      tooltip.appendMarkdown(`| **Blocked by** | ${this.bean.blockedBy.length} bean(s) |\n`);
    }
    if (this.bean.tags.length > 0) {
      tooltip.appendMarkdown(`| **Tags** | ${this.bean.tags.join(', ')} |\n`);
    }

    // Timestamps
    tooltip.appendMarkdown(`\n---\n\n`);
    tooltip.appendMarkdown(`Created: ${new Date(this.bean.createdAt).toLocaleString()}&emsp;`);
    tooltip.appendMarkdown(`Updated: ${new Date(this.bean.updatedAt).toLocaleString()}\n`);

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
   * Get appropriate icon for the bean.
   * Icon color reflects priority (red/orange/yellow/green/blue).
   * In-progress items without a priority fall back to orange.
   * Completed and scrapped items use gray to avoid distraction.
   */
  private getIcon(): vscode.ThemeIcon {
    const priorityColorId = this.bean.priority ? BeanTreeItem.PRIORITY_COLORS[this.bean.priority] : undefined;
    const shouldHighlight = this.bean.status === 'in-progress' || this.hasInProgressChildren;
    const color = priorityColorId
      ? new vscode.ThemeColor(priorityColorId)
      : shouldHighlight
      ? new vscode.ThemeColor('charts.orange')
      : undefined;

    // Status-based icons (priority over type)
    switch (this.bean.status) {
      case 'completed':
        // Use gray for completed items to reduce visual noise
        return new vscode.ThemeIcon('issue-closed', new vscode.ThemeColor('descriptionForeground'));
      case 'in-progress':
        return this.getTypeIcon(color);
      case 'scrapped':
        // Use gray for scrapped items to reduce visual noise
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('descriptionForeground'));
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
