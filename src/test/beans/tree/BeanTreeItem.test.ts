import * as assert from 'assert';
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

suite('BeanTreeItem', () => {
  suite('label', () => {
    test('shows hourglass prefix only for in-progress items', () => {
      const bean = makeBean({ status: 'in-progress', title: 'Active Task' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual(item.label, '⏳ Active Task');
    });

    test('shows plain title for todo items (no emoji)', () => {
      const bean = makeBean({ status: 'todo', title: 'Planned Work' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual(item.label, 'Planned Work');
    });

    test('shows plain title for completed items (no emoji)', () => {
      const bean = makeBean({ status: 'completed', title: 'Done Work' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual(item.label, 'Done Work');
    });

    test('shows plain title for draft items (no emoji)', () => {
      const bean = makeBean({ status: 'draft', title: 'Draft Idea' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual(item.label, 'Draft Idea');
    });

    test('shows plain title for scrapped items (no emoji)', () => {
      const bean = makeBean({ status: 'scrapped', title: 'Scrapped Idea' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual(item.label, 'Scrapped Idea');
    });
  });

  suite('description', () => {
    test('shows bare code without parentheses', () => {
      const bean = makeBean({ code: 'xyz9' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual(item.description, 'xyz9');
    });

    test('shows empty string when code is empty', () => {
      const bean = makeBean({ code: '' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual(item.description, '');
    });
  });

  suite('tooltip', () => {
    test('contains title and code', () => {
      const bean = makeBean({ title: 'My Bean', code: 'mb1' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('My Bean'));
      assert.ok(tooltip.value.includes('mb1'));
    });

    test('contains emoji status label', () => {
      const bean = makeBean({ status: 'in-progress' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('⏳ In Progress'));
    });

    test('contains emoji type label', () => {
      const bean = makeBean({ type: 'bug' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('🐛 Bug'));
    });

    test('contains emoji priority label when set', () => {
      const bean = makeBean({ priority: 'critical' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('🔴 Critical'));
    });

    test('omits priority row when not set', () => {
      const bean = makeBean({ priority: undefined });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(!tooltip.value.includes('Priority'));
    });

    test('contains parent when set', () => {
      const bean = makeBean({ parent: 'parent-abc' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      const tooltip = item.tooltip as vscode.MarkdownString;
      assert.ok(tooltip.value.includes('parent-abc'));
    });
  });

  suite('contextValue', () => {
    test('includes status and type', () => {
      const bean = makeBean({ status: 'todo', type: 'bug' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.ok(item.contextValue?.includes('todo'));
      assert.ok(item.contextValue?.includes('bug'));
    });

    test('includes hasParent when parent is set', () => {
      const bean = makeBean({ parent: 'parent-123' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.ok(item.contextValue?.includes('hasParent'));
    });

    test('marks scrapped as deletable', () => {
      const bean = makeBean({ status: 'scrapped' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.ok(item.contextValue?.includes('deletable'));
    });

    test('marks draft as deletable', () => {
      const bean = makeBean({ status: 'draft' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.ok(item.contextValue?.includes('deletable'));
    });

    test('does not mark todo as deletable', () => {
      const bean = makeBean({ status: 'todo' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.ok(!item.contextValue?.includes('deletable'));
    });
  });

  suite('icon', () => {
    test('uses issue-closed for completed status', () => {
      const bean = makeBean({ status: 'completed' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'issue-closed');
    });

    test('uses issue-draft for draft status', () => {
      const bean = makeBean({ status: 'draft' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'issue-draft');
    });

    test('uses error for scrapped status', () => {
      const bean = makeBean({ status: 'scrapped' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'error');
    });

    test('uses bug icon for in-progress bug', () => {
      const bean = makeBean({ status: 'in-progress', type: 'bug' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'bug');
    });

    test('uses milestone icon for todo milestone', () => {
      const bean = makeBean({ status: 'todo', type: 'milestone' });
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'milestone');
    });
  });

  suite('command', () => {
    test('sets openBean command with bean argument', () => {
      const bean = makeBean();
      const item = new BeanTreeItem(bean, vscode.TreeItemCollapsibleState.None);
      assert.strictEqual(item.command?.command, 'beans.openBean');
      assert.strictEqual(item.command?.arguments?.[0], bean);
    });
  });
});
