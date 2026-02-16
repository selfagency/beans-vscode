import * as vscode from 'vscode';
import { Bean, BeanStatus, BeanType } from '../model';

/**
 * Tree item representing a bean in the VS Code tree view
 */
export class BeanTreeItem extends vscode.TreeItem {
	constructor(
		public readonly bean: Bean,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly hasChildren: boolean = false
	) {
		super(bean.title, collapsibleState);

		this.id = bean.id;
		this.description = this.buildDescription();
		this.tooltip = this.buildTooltip();
		this.contextValue = this.buildContextValue();
		this.iconPath = this.getIcon();

		// Make tree items clickable to view bean
		this.command = {
			command: 'beans.view',
			title: 'View Bean',
			arguments: [bean]
		};
	}

	/**
	 * Build description showing code, type, and status
	 */
	private buildDescription(): string {
		const parts: string[] = [];
		
		// Add code
		parts.push(`[${this.bean.code}]`);
		
		// Add type icon/text
		parts.push(this.getTypeLabel());
		
		// Add status
		parts.push(this.getStatusLabel());
		
		// Add priority if set and not normal
		if (this.bean.priority && this.bean.priority !== 'normal') {
			parts.push(`P:${this.bean.priority}`);
		}

		return parts.join(' ');
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
	 * Get appropriate icon for the bean
	 */
	private getIcon(): vscode.ThemeIcon {
		// Status-based icons
		switch (this.bean.status) {
			case 'completed':
				return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
			case 'in-progress':
				return new vscode.ThemeIcon('debug-start', new vscode.ThemeColor('charts.blue'));
			case 'scrapped':
				return new vscode.ThemeIcon('trash', new vscode.ThemeColor('charts.red'));
			case 'draft':
				return new vscode.ThemeIcon('file', new vscode.ThemeColor('charts.gray'));
			case 'todo':
			default:
				// Use type-based icons for todo items
				return this.getTypeIcon();
		}
	}

	/**
	 * Get type-specific icon
	 */
	private getTypeIcon(): vscode.ThemeIcon {
		switch (this.bean.type) {
			case 'milestone':
				return new vscode.ThemeIcon('milestone');
			case 'epic':
				return new vscode.ThemeIcon('folder');
			case 'feature':
				return new vscode.ThemeIcon('lightbulb');
			case 'bug':
				return new vscode.ThemeIcon('bug', new vscode.ThemeColor('charts.red'));
			case 'task':
			default:
				return new vscode.ThemeIcon('checklist');
		}
	}

	/**
	 * Get readable type label
	 */
	private getTypeLabel(): string {
		const typeLabels: Record<BeanType, string> = {
			milestone: '🎯',
			epic: '📁',
			feature: '✨',
			bug: '🐛',
			task: '☑️'
		};
		return typeLabels[this.bean.type] || this.bean.type;
	}

	/**
	 * Get readable status label
	 */
	private getStatusLabel(): string {
		const statusLabels: Record<BeanStatus, string> = {
			'todo': '📋',
			'in-progress': '🔄',
			'completed': '✅',
			'scrapped': '🗑️',
			'draft': '📝'
		};
		return statusLabels[this.bean.status] || this.bean.status;
	}
}
