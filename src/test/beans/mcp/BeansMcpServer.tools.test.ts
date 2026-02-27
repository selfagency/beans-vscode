import { beforeEach, describe, expect, it, vi } from 'vitest';

// TODO(beans-vscode-6h2m): Expand MCP tool tests with full schema/validation
// matrices and richer CLI failure modes (timeouts, stderr-only failures,
// malformed partial JSON, and argument shape assertions per tool).
const toolHandlers = vi.hoisted(() => new Map<string, (...args: any[]) => any>());
const connectSpy = vi.hoisted(() => vi.fn(async () => {}));
const execFileMock = vi.hoisted(() => vi.fn());
const createReadStreamMock = vi.hoisted(() => vi.fn());
const createInterfaceMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());
const mkdirMock = vi.hoisted(() => vi.fn());
const rmMock = vi.hoisted(() => vi.fn());
const buildInstructionsMock = vi.hoisted(() => vi.fn((prime: string) => `generated:${prime}`));
const writeInstructionsMock = vi.hoisted(() => vi.fn(async () => '/ws/.github/instructions/tasks.instructions.md'));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class MockMcpServer {
    registerTool(name: string, _meta: unknown, handler: (...args: any[]) => any): void {
      toolHandlers.set(name, handler);
    }
    connect = connectSpy;
  },
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class MockStdioServerTransport {},
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('node:fs', () => ({
  createReadStream: createReadStreamMock,
}));

vi.mock('node:readline', () => ({
  createInterface: createInterfaceMock,
}));

vi.mock('node:fs/promises', () => ({
  readFile: readFileMock,
  writeFile: writeFileMock,
  mkdir: mkdirMock,
  rm: rmMock,
}));

vi.mock('../../../beans/config/CopilotInstructions', () => ({
  buildBeansCopilotInstructions: buildInstructionsMock,
  writeBeansCopilotInstructions: writeInstructionsMock,
}));

function setupExecFileMock(): void {
  execFileMock.mockImplementation((file: string, args: string[], _opts: unknown, cb: (...params: any[]) => void) => {
    const done = (stdout: string) => cb(null, { stdout, stderr: '' });

    if (file !== '/custom/beans') {
      return cb(new Error(`unexpected cli path ${file}`));
    }

    if (args[0] === 'init') {
      return done('');
    }
    if (args[0] === 'prime') {
      return done('prime output\n');
    }

    if (args[0] === 'graphql') {
      if (args.includes('--schema')) {
        return done('prime output\n');
      }

      const query = args[args.indexOf('graphql') + 2];
      const variables = args.includes('--variables') ? JSON.parse(args[args.indexOf('--variables') + 1]) : {};

      if (query && query.includes('ListBeans')) {
        let beans = [
          { id: 'bean-active', title: 'Active', status: 'todo', type: 'task', tags: ['frontend'] },
          { id: 'bean-done', title: 'Done', status: 'completed', type: 'bug', tags: ['backend'] },
          { id: 'bean-scrap', title: 'Scrap', status: 'scrapped', type: 'feature', tags: ['frontend'] },
        ];

        if (variables.filter?.excludeStatus) {
          beans = beans.filter(b => !variables.filter.excludeStatus.includes(b.status));
        }

        return done(JSON.stringify({ beans }));
      }

      if (query.includes('ShowBean')) {
        const beanId = variables.id;
        let bean: any = {
          id: beanId,
          title: 'Bean',
          status: 'todo',
          type: 'task',
          tags: [],
          blockingIds: [],
          blockedByIds: [],
        };
        if (beanId === 'completed-1') {
          bean.status = 'completed';
        }
        if (beanId === 'scrapped-1') {
          bean.status = 'scrapped';
        }
        if (beanId === 'active-1') {
          bean.status = 'todo';
        }
        if (beanId === 'block-1') {
          bean.title = 'Blocking bean';
          bean.blockingIds = ['x'];
          bean.blockedByIds = ['y'];
        }
        return done(JSON.stringify({ bean }));
      }

      if (query.includes('UpdateBean')) {
        return done(
          JSON.stringify({
            updateBean: {
              id: variables.id,
              title: 'Updated',
              status: variables.input.status || 'todo',
              type: 'task',
            },
          })
        );
      }

      if (query.includes('DeleteBean')) {
        return done(JSON.stringify({ deleteBean: true }));
      }

      if (query.includes('CreateBean')) {
        return done(
          JSON.stringify({
            createBean: {
              id: 'new-1',
              title: variables.input.title,
              status: variables.input.status || 'todo',
              type: 'task',
            },
          })
        );
      }
    }

    return done(JSON.stringify({}));
  });
}

describe.skip('BeansMcpServer tool handlers (migrated to @selfagency/beans-mcp)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    toolHandlers.clear();
    setupExecFileMock();
    readFileMock.mockResolvedValue('line1\nline2\nline3\n');
    createReadStreamMock.mockReturnValue({ __lines: ['line1', 'line2', 'line3'] });
    createInterfaceMock.mockImplementation(({ input }: { input: { __lines: string[] } }) => ({
      async *[Symbol.asyncIterator]() {
        for (const line of input.__lines) {
          yield line;
        }
      },
    }));
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);

    const mod = await import('../../../beans/mcp/BeansMcpServer.js');
    await mod.startBeansMcpServer(['--workspace', '/ws', '--cli-path', '/custom/beans']);
  });

  it('registers and connects MCP server', () => {
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(toolHandlers.size).toBeLessThanOrEqual(10);
    const hasQuery = toolHandlers.has('beans_vscode_query') || toolHandlers.has('beans_query');
    expect(hasQuery).toBe(true);
  });

  it('runs refresh/filter/search/sort handlers', async () => {
    const query = (toolHandlers.get('beans_vscode_query') || toolHandlers.get('beans_query'))!;

    const refreshResult = await query({ operation: 'refresh' });
    expect(refreshResult.structuredContent.count).toBe(3);

    const filterResult = await query({
      operation: 'filter',
      statuses: ['todo'],
      types: ['task'],
      search: 'bean',
      tags: ['frontend'],
    });
    expect(filterResult.structuredContent.count).toBe(2);
    expect(filterResult.structuredContent.beans.map((b: { id: string }) => b.id)).toEqual(
      expect.arrayContaining(['bean-active', 'bean-scrap'])
    );

    const searchResult = await query({ operation: 'search', search: 'bean', includeClosed: false } as any);
    expect(searchResult.structuredContent.count).toBe(1);
    expect(searchResult.structuredContent.beans[0].status).toBe('todo');

    const sortResult = await query({ operation: 'sort', mode: 'id', statuses: [], types: [], search: '' } as any);
    expect(sortResult.structuredContent.mode).toBe('id');

    const filterWithNulls = await query({
      operation: 'filter',
      statuses: null,
      types: ['task'],
      search: 'bean',
      tags: null,
    } as any);
    expect(filterWithNulls.structuredContent.count).toBeGreaterThanOrEqual(1);

    const sortWithNulls = await query({
      operation: 'sort',
      mode: 'id',
      statuses: null,
      types: null,
      search: '',
    } as any);
    expect(sortWithNulls.structuredContent.mode).toBe('id');
  });

  it('handles reopen and delete guard branches', async () => {
    const reopen = (toolHandlers.get('beans_vscode_reopen') || toolHandlers.get('beans_reopen'))!;
    const del = (toolHandlers.get('beans_vscode_delete') || toolHandlers.get('beans_delete'))!;

    await expect(
      reopen({ beanId: 'active-1', requiredCurrentStatus: 'completed', targetStatus: 'todo' })
    ).rejects.toThrow('not completed');
    await expect(
      reopen({ beanId: 'active-1', requiredCurrentStatus: 'scrapped', targetStatus: 'todo' })
    ).rejects.toThrow('not scrapped');
    await expect(del({ beanId: 'active-1', force: false })).rejects.toThrow('Only draft and scrapped');

    const reopenOk = await reopen({ beanId: 'completed-1', requiredCurrentStatus: 'completed', targetStatus: 'todo' });
    expect(reopenOk.structuredContent.bean.id).toBe('completed-1');

    const deleteOk = await del({ beanId: 'scrapped-1', force: false });
    expect(deleteOk.structuredContent.deleted).toBe(true);
  });

  it('handles relationship, copy-id, and llm-context tools', async () => {
    const update = (toolHandlers.get('beans_vscode_update') || toolHandlers.get('beans_update'))!;
    const view = (toolHandlers.get('beans_vscode_view') || toolHandlers.get('beans_view'))!;
    const queryTool = (toolHandlers.get('beans_vscode_query') || toolHandlers.get('beans_query'))!;

    const blockingResult = await update({ beanId: 'block-1', blocking: [] });
    expect(blockingResult.structuredContent.bean.id).toBe('block-1');

    const viewResult = await view({ beanId: 'bean-1234' });
    const id = viewResult.structuredContent.bean.id;
    const code = id.split('-').pop();
    expect(id).toBe('bean-1234');
    expect(code).toBe('1234');

    const llmResult = await queryTool({ operation: 'llm_context', writeToWorkspaceInstructions: true } as any);
    expect(buildInstructionsMock).toHaveBeenCalledWith('prime output');
    expect(writeInstructionsMock).toHaveBeenCalled();
    expect(llmResult.structuredContent.instructionsPath).toContain('.github/instructions');
  });

  it('handles bean file and output log tools including path guard', async () => {
    const fileTool = (toolHandlers.get('beans_vscode_bean_file') || toolHandlers.get('beans_bean_file'))!;
    const outputTool = (toolHandlers.get('beans_vscode_output') || toolHandlers.get('beans_output'))!;

    await expect(fileTool({ operation: 'read', path: '../outside.md' })).rejects.toThrow(
      'Path must stay within .beans directory'
    );

    await fileTool({ operation: 'read', path: 'bean.md' });
    await fileTool({ operation: 'edit', path: 'folder/bean.md', content: 'hello' });
    await fileTool({ operation: 'create', path: 'new.md', content: 'new', overwrite: true });
    await fileTool({ operation: 'delete', path: 'new.md' });

    expect(mkdirMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalled();
    expect(rmMock).toHaveBeenCalled();

    const output = await outputTool({ operation: 'read', lines: 2 });
    expect(output.structuredContent.linesReturned).toBe(2);
    expect(output.structuredContent.content).toBe('line2\nline3');
  });
});
