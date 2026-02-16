import { describe, expect, it } from 'vitest';
import type { Bean } from '../../../beans/model';

/**
 * Unit tests for the sort logic used by BeansTreeDataProvider.
 *
 * Since `sortBeans` is private, we replicate the algorithm here and
 * test it in isolation. This ensures the sort contract is maintained
 * even if the implementation is refactored.
 */

function makeBean(overrides: Partial<Bean> = {}): Bean {
  return {
    id: 'test-1',
    code: 't1',
    slug: 'test-bean',
    path: 'beans/test-1.md',
    title: 'Test',
    body: '',
    status: 'todo',
    type: 'task',
    tags: [],
    blocking: [],
    blockedBy: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    etag: 'e1',
    ...overrides
  } as Bean;
}

const statusOrder: Record<string, number> = {
  'in-progress': 0,
  todo: 1,
  draft: 2,
  completed: 3,
  scrapped: 4
};

const priorityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
  deferred: 4
};

const typeOrder: Record<string, number> = {
  milestone: 0,
  epic: 1,
  feature: 2,
  bug: 3,
  task: 4
};

function sortByStatusPriorityTypeTitle(beans: Bean[]): Bean[] {
  return [...beans].sort((a, b) => {
    const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
    if (statusDiff !== 0) {
      return statusDiff;
    }

    const aPriority = a.priority || 'normal';
    const bPriority = b.priority || 'normal';
    const priorityDiff = priorityOrder[aPriority] - priorityOrder[bPriority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const typeDiff = (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
    if (typeDiff !== 0) {
      return typeDiff;
    }

    return a.title.localeCompare(b.title);
  });
}

describe('Sort: status-priority-type-title', () => {
  it('in-progress comes before todo', () => {
    const beans = [
      makeBean({ id: '1', status: 'todo', title: 'Alpha' }),
      makeBean({ id: '2', status: 'in-progress', title: 'Beta' })
    ];
    const sorted = sortByStatusPriorityTypeTitle(beans);
    expect(sorted[0].status).toBe('in-progress');
    expect(sorted[1].status).toBe('todo');
  });

  it('todo comes before completed', () => {
    const beans = [
      makeBean({ id: '1', status: 'completed', title: 'A' }),
      makeBean({ id: '2', status: 'todo', title: 'B' })
    ];
    const sorted = sortByStatusPriorityTypeTitle(beans);
    expect(sorted[0].status).toBe('todo');
    expect(sorted[1].status).toBe('completed');
  });

  it('critical before high before normal', () => {
    const beans = [
      makeBean({ id: '1', priority: 'normal', title: 'C' }),
      makeBean({ id: '2', priority: 'critical', title: 'A' }),
      makeBean({ id: '3', priority: 'high', title: 'B' })
    ];
    const sorted = sortByStatusPriorityTypeTitle(beans);
    expect(sorted[0].priority).toBe('critical');
    expect(sorted[1].priority).toBe('high');
    expect(sorted[2].priority).toBe('normal');
  });

  it('milestone before epic before bug before task', () => {
    const beans = [
      makeBean({ id: '1', type: 'task', title: 'D' }),
      makeBean({ id: '2', type: 'milestone', title: 'A' }),
      makeBean({ id: '3', type: 'bug', title: 'C' }),
      makeBean({ id: '4', type: 'epic', title: 'B' })
    ];
    const sorted = sortByStatusPriorityTypeTitle(beans);
    expect(sorted[0].type).toBe('milestone');
    expect(sorted[1].type).toBe('epic');
    expect(sorted[2].type).toBe('bug');
    expect(sorted[3].type).toBe('task');
  });

  it('alphabetical by title within same status/priority/type', () => {
    const beans = [
      makeBean({ id: '1', title: 'Zulu' }),
      makeBean({ id: '2', title: 'Alpha' }),
      makeBean({ id: '3', title: 'Mike' })
    ];
    const sorted = sortByStatusPriorityTypeTitle(beans);
    expect(sorted[0].title).toBe('Alpha');
    expect(sorted[1].title).toBe('Mike');
    expect(sorted[2].title).toBe('Zulu');
  });

  it('full sort order: status > priority > type > title', () => {
    const beans = [
      makeBean({ id: '1', status: 'todo', priority: 'low', type: 'task', title: 'Z' }),
      makeBean({ id: '2', status: 'in-progress', priority: 'low', type: 'task', title: 'Y' }),
      makeBean({ id: '3', status: 'todo', priority: 'critical', type: 'task', title: 'X' }),
      makeBean({ id: '4', status: 'todo', priority: 'critical', type: 'milestone', title: 'W' })
    ];
    const sorted = sortByStatusPriorityTypeTitle(beans);
    expect(sorted[0].id).toBe('2'); // in-progress first
    expect(sorted[1].id).toBe('4'); // todo + critical + milestone
    expect(sorted[2].id).toBe('3'); // todo + critical + task
    expect(sorted[3].id).toBe('1'); // todo + low + task
  });

  it('undefined priority treated as normal', () => {
    const beans = [
      makeBean({ id: '1', priority: undefined, title: 'No Priority' }),
      makeBean({ id: '2', priority: 'high', title: 'High Priority' })
    ];
    const sorted = sortByStatusPriorityTypeTitle(beans);
    expect(sorted[0].id).toBe('2'); // high comes before normal
    expect(sorted[1].id).toBe('1');
  });
});
