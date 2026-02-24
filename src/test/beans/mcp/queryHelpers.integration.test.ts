import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleQueryOperation, sortBeans } from '../../../../src/beans/mcp/internal/queryHelpers';

describe('queryHelpers integration', () => {
  let backend: any;

  beforeEach(() => {
    backend = {
      graphqlSchema: vi.fn(async () => 'type Query { x: String }'),
      writeInstructions: vi.fn(async () => '/ws/.github/instructions/tasks.instructions.md'),
      openConfig: vi.fn(async () => ({ configPath: '/ws/.beans.yml', content: 'cfg' })),
      list: vi.fn(async (opts?: any) => {
        void opts;
        return [
          {
            id: 'a',
            title: 'A',
            status: 'todo',
            type: 'task',
            priority: 'normal',
            tags: ['x'],
            createdAt: '2020-01-02',
            updatedAt: '2020-01-03',
          },
          {
            id: 'b',
            title: 'B',
            status: 'completed',
            type: 'feature',
            priority: 'high',
            tags: ['y'],
            createdAt: '2020-01-01',
            updatedAt: '2020-01-04',
          },
          {
            id: 'c',
            title: 'C',
            status: 'scrapped',
            type: 'bug',
            priority: 'low',
            tags: ['x'],
            createdAt: '2020-01-03',
            updatedAt: '2020-01-02',
          },
        ];
      }),
    };
  });

  it('handles llm_context with writeToWorkspaceInstructions', async () => {
    const res = await handleQueryOperation(backend, { operation: 'llm_context', writeToWorkspaceInstructions: true });
    expect(res.structuredContent.graphqlSchema).toBe('type Query { x: String }');
    expect(res.structuredContent.instructionsPath).toBe('/ws/.github/instructions/tasks.instructions.md');
  });

  it('handles open_config', async () => {
    const res = await handleQueryOperation(backend, { operation: 'open_config' });
    expect(res.structuredContent.content).toBe('cfg');
  });

  it('handles refresh', async () => {
    const res = await handleQueryOperation(backend, { operation: 'refresh' });
    expect(res.structuredContent.count).toBe(3);
  });

  it('handles filter with tags', async () => {
    const res = await handleQueryOperation(backend, { operation: 'filter', tags: ['x'] });
    expect(res.structuredContent.count).toBe(2);
  });

  it('handles search with includeClosed=false', async () => {
    const res = await handleQueryOperation(backend, { operation: 'search', search: 'B', includeClosed: false });
    // only bean 'b' matches search but is completed -> filtered out
    expect(res.structuredContent.count).toBe(0);
  });

  it('sorts by updated/created/id and default', async () => {
    const updated = await handleQueryOperation(backend, { operation: 'sort', mode: 'updated' });
    expect(updated.structuredContent.beans[0].id).toBe('b');

    const created = await handleQueryOperation(backend, { operation: 'sort', mode: 'created' });
    expect(created.structuredContent.beans[0].id).toBe('c');

    const byId = await handleQueryOperation(backend, { operation: 'sort', mode: 'id' });
    expect(byId.structuredContent.beans[0].id).toBe('a');

    const def = await handleQueryOperation(backend, { operation: 'sort' });
    expect(def.structuredContent.beans.length).toBe(3);
  });

  it('exported sortBeans works directly', () => {
    const beans = [
      { id: 'z', title: 'Z', status: 'todo', type: 'task', priority: 'normal' },
      { id: 'a', title: 'A', status: 'in-progress', type: 'feature', priority: 'critical' },
    ];
    const sorted = sortBeans(beans as any, 'status-priority-type-title');
    expect(sorted[0].id).toBe('a');
  });
});
