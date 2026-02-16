import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import type { Bean } from '../../../beans/model';
import { BeanTreeItem } from '../../../beans/tree/BeanTreeItem';

/**
 * Helper to create a minimal Bean for testing.
 */
function makeBean(overrides: Partial<Bean> = {}): Bean {
  return {
    id: 'test-abc1',
    code: 'abc1',
    slug: 'test-bean',
    path: 'beans/test-abc1.md',
    title: 'Test Bean',
    body: '',
    status: 'todo',
    type: 'task',
    tags: [],
    blocking: [],
    blockedBy: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    etag: 'etag1',
    ...overrides
  } as Bean;
}

describe('BeanTreeItem', () => {
  describe('label', () => {
    it('shows hourglass prefix only for in-progress items', () => {
      const bean = makeBean({ status: 'in-progress', title: 'Active Task' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.label).toBe('⏳ Active Task');
    });

    it('shows plain title for todo items (no emoji)', () => {
      const bean = makeBean({ status: 'todo', title: 'Planned Work' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.label).toBe('Planned Work');
    });

    it('shows plain title for completed items (no emoji)', () => {
      const bean = makeBean({ status: 'completed', title: 'Done Work' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.label).toBe('Done Work');
    });

    it('shows plain title for draft items (no emoji)', () => {
      const bean = makeBean({ status: 'draft', title: 'Draft Idea' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.label).toBe('Draft Idea');
    });

    it('shows plain title for scrapped items (no emoji)', () => {
      const bean = makeBean({ status: 'scrapped', title: 'Scrapped Idea' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.label).toBe('Scrapped Idea');
    });
  });

  describe('description', () => {
    it('shows bare code without parentheses', () => {
      const bean = makeBean({ code: 'xyz9' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.description).toBe('xyz9');
    });

    it('shows empty string when code is empty', () => {
      const bean = makeBean({ code: '' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.description).toBe('');
    });
  });

  describe('tooltip', () => {
    it('contains title and code', () => {
      const bean = makeBean({ title: 'My Bean', code: 'mb1' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      const tooltip = item.tooltip as vscode.MarkdownString;
      expect(tooltip.value.includes('My Bean')).toBe(true);
      expect(tooltip.value.includes('mb1')).toBe(true);
    });

    it('contains emoji status label', () => {
      const bean = makeBean({ status: 'in-progress' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      const tooltip = item.tooltip as vscode.MarkdownString;
      expect(tooltip.value.includes('⏳ In Progress')).toBe(true);
    });

    it('contains emoji type label', () => {
      const bean = makeBean({ type: 'bug' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      const tooltip = item.tooltip as vscode.MarkdownString;
      expect(tooltip.value.includes('🐛 Bug')).toBe(true);
    });

    it('contains emoji priority label when set', () => {
      const bean = makeBean({ priority: 'critical' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      const tooltip = item.tooltip as vscode.MarkdownString;
      expect(tooltip.value.includes('🔴 Critical')).toBe(true);
    });

    it('omits priority row when not set', () => {
      const bean = makeBean({ priority: undefined });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      const tooltip = item.tooltip as vscode.MarkdownString;
      expect(tooltip.value.includes('Priority')).toBe(false);
    });

    it('contains parent when set', () => {
      const bean = makeBean({ parent: 'parent-abc' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      const tooltip = item.tooltip as vscode.MarkdownString;
      expect(tooltip.value.includes('parent-abc')).toBe(true);
    });
  });

  describe('contextValue', () => {
    it('includes status and type', () => {
      const bean = makeBean({ status: 'todo', type: 'bug' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.contextValue?.includes('todo')).toBe(true);
      expect(item.contextValue?.includes('bug')).toBe(true);
    });

    it('includes hasParent when parent is set', () => {
      const bean = makeBean({ parent: 'parent-123' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.contextValue?.includes('hasParent')).toBe(true);
    });

    it('marks scrapped as deletable', () => {
      const bean = makeBean({ status: 'scrapped' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.contextValue?.includes('deletable')).toBe(true);
    });

    it('marks draft as deletable', () => {
      const bean = makeBean({ status: 'draft' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.contextValue?.includes('deletable')).toBe(true);
    });

    it('does not mark todo as deletable', () => {
      const bean = makeBean({ status: 'todo' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.contextValue?.includes('deletable')).toBe(false);
    });
  });

  describe('icon', () => {
    it('uses issue-closed for completed status', () => {
      const bean = makeBean({ status: 'completed' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect((item.iconPath as vscode.ThemeIcon).id).toBe('issue-closed');
    });

    it('uses issue-draft for draft status', () => {
      const bean = makeBean({ status: 'draft' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect((item.iconPath as vscode.ThemeIcon).id).toBe('issue-draft');
    });

    it('uses error for scrapped status', () => {
      const bean = makeBean({ status: 'scrapped' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect((item.iconPath as vscode.ThemeIcon).id).toBe('error');
    });

    it('uses bug icon for in-progress bug', () => {
      const bean = makeBean({ status: 'in-progress', type: 'bug' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect((item.iconPath as vscode.ThemeIcon).id).toBe('bug');
    });

    it('uses milestone icon for todo milestone', () => {
      const bean = makeBean({ status: 'todo', type: 'milestone' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect((item.iconPath as vscode.ThemeIcon).id).toBe('milestone');
    });
  });

  describe('command', () => {
    it('sets openBean command with bean argument', () => {
      const bean = makeBean();
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      expect(item.command?.command).toBe('beans.openBean');
      expect(item.command?.arguments?.[0]).toBe(bean);
    });
  });
});
