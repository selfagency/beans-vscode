import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleQueryOperation } from '../../../../src/beans/mcp/internal/queryHelpers';

describe('queryHelpers', () => {
  const backend: any = {};

  beforeEach(() => {
    backend.list = vi.fn(async () => [
      { id: 'bean-1', status: 'todo', title: 'One', type: 'task' },
      { id: 'bean-2', status: 'completed', title: 'Two', type: 'bug' },
    ]);
    backend.graphqlSchema = vi.fn(async () => 'schema');
    backend.writeInstructions = vi.fn(async () => '/path/instructions.md');
    backend.openConfig = vi.fn(async () => ({ configPath: '.beans.yml', content: 'x' }));
  });

  it('filters out closed beans when includeClosed=false', async () => {
    const res: any = await handleQueryOperation(backend, { operation: 'search', search: 'bean', includeClosed: false });
    expect(res.structuredContent.count).toBe(1);
    expect(res.structuredContent.beans[0].status).toBe('todo');
  });

  it('handles llm_context and writes instructions when requested', async () => {
    const res: any = await handleQueryOperation(backend, {
      operation: 'llm_context',
      writeToWorkspaceInstructions: true,
    });
    expect(backend.graphqlSchema).toHaveBeenCalled();
    expect(backend.writeInstructions).toHaveBeenCalled();
    expect(res.structuredContent.instructionsPath).toBe('/path/instructions.md');
  });

  it('open_config returns config', async () => {
    const res: any = await handleQueryOperation(backend, { operation: 'open_config' });
    expect(res.structuredContent.configPath).toBe('.beans.yml');
  });
});
