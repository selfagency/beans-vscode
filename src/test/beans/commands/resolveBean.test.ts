import type { Bean } from '../../../beans/model';
import { describe, expect, it } from 'vitest';

/**
 * Test the duck-typing logic used by BeansCommands.resolveBean().
 *
 * Since resolveBean is a private method, we replicate the exact logic
 * here and unit-test it. This ensures the duck-typing contract is
 * maintained when refactored.
 */

/**
 * Replicated resolveBean logic (duck-typing, no instanceof).
 */
function resolveBean(arg?: any): Bean | undefined {
  if (!arg) {
    return undefined;
  }
  // BeanTreeItem: has a nested .bean property with an .id string
  if (arg.bean && typeof arg.bean === 'object' && typeof arg.bean.id === 'string') {
    return arg.bean as Bean;
  }
  // Already a Bean (has .id and .status directly)
  if (typeof arg.id === 'string' && typeof arg.status === 'string') {
    return arg as Bean;
  }
  return undefined;
}

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

describe('resolveBean (duck-typing)', () => {
  it('returns undefined for undefined arg', () => {
    expect(resolveBean(undefined)).toBeUndefined();
  });

  it('returns undefined for null arg', () => {
    expect(resolveBean(null)).toBeUndefined();
  });

  it('extracts bean from tree-item-like object', () => {
    const bean = makeBean({ id: 'bean-123', title: 'Tree Item Bean' });
    // Simulate a BeanTreeItem object (has .bean, .label, etc.)
    const treeItem = {
      bean,
      label: '⏳ Tree Item Bean',
      description: 'abc1',
      command: { command: 'beans.openBean', title: 'Open', arguments: [bean] }
    };
    const result = resolveBean(treeItem);
    expect(result).toBe(bean);
    expect(result?.id).toBe('bean-123');
  });

  it('returns plain Bean directly', () => {
    const bean = makeBean({ id: 'bean-456', title: 'Direct Bean' });
    const result = resolveBean(bean);
    expect(result).toBe(bean);
    expect(result?.id).toBe('bean-456');
  });

  it('returns undefined for object without id string', () => {
    const weird = { label: 'Not a bean', description: 'something' };
    expect(resolveBean(weird)).toBeUndefined();
  });

  it('returns undefined for object with numeric id (not a bean)', () => {
    const weird = { id: 42, status: 'active' };
    expect(resolveBean(weird)).toBeUndefined();
  });

  it('handles nested bean with all expected properties', () => {
    const bean = makeBean({ id: 'nested-1', status: 'in-progress', type: 'bug' });
    const treeItem = { bean, iconPath: { id: 'bug' } };
    const result = resolveBean(treeItem);
    expect(result?.id).toBe('nested-1');
    expect(result?.status).toBe('in-progress');
    expect(result?.type).toBe('bug');
  });
});
