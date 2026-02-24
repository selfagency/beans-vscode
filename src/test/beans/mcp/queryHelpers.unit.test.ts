import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleQueryOperation } from '../../../../src/beans/mcp/internal/queryHelpers';

describe('queryHelpers unit', () => {
  let backend: any;

  beforeEach(() => {
    backend = {
      graphqlSchema: vi.fn(async () => 'type Query { x: String }'),
      writeInstructions: vi.fn(async () => '/ws/.github/instructions/tasks.instructions.md'),
      openConfig: vi.fn(async () => ({ configPath: '/ws/.beans.yml', content: 'cfg' })),
      list: vi.fn(async () => [
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
      ]),
    };
  });

  it('llm_context without writeToWorkspaceInstructions does not call writeInstructions', async () => {
    const res = await handleQueryOperation(backend, { operation: 'llm_context', writeToWorkspaceInstructions: false });
    expect(res.structuredContent.graphqlSchema).toBe('type Query { x: String }');
    expect(res.structuredContent.instructionsPath).toBeNull();
    expect(backend.writeInstructions).not.toHaveBeenCalled();
  });

  it('search with empty string returns all beans', async () => {
    const res = await handleQueryOperation(backend, { operation: 'search', search: '' });
    expect(res.structuredContent.count).toBe(3);
  });

  it('filter with empty tags returns all beans', async () => {
    const res = await handleQueryOperation(backend, { operation: 'filter', tags: [] });
    expect(res.structuredContent.count).toBe(3);
  });
});
