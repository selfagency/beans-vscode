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

describe('BeansMcpServer tool handlers', () => {
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
    expect(toolHandlers.size).toBeGreaterThan(10);
    expect(toolHandlers.has('beans_vscode_refresh')).toBe(true);
    expect(toolHandlers.has('beans_vscode_llm_context')).toBe(true);
  });

  it('runs refresh/filter/search/sort handlers', async () => {
    const refresh = toolHandlers.get('beans_vscode_refresh')!;
    const filter = toolHandlers.get('beans_vscode_filter')!;
    const search = toolHandlers.get('beans_vscode_search')!;
    const sort = toolHandlers.get('beans_vscode_sort')!;

    const refreshResult = await refresh({});
    expect(refreshResult.structuredContent.count).toBe(3);

    const filterResult = await filter({
      statuses: ['todo'],
      types: ['task'],
      search: 'bean',
      tags: ['frontend'],
    });
    expect(filterResult.structuredContent.count).toBe(2);
    expect(filterResult.structuredContent.beans.map((b: { id: string }) => b.id)).toEqual(
      expect.arrayContaining(['bean-active', 'bean-scrap'])
    );

    const searchResult = await search({ query: 'bean', includeClosed: false });
    expect(searchResult.structuredContent.count).toBe(1);
    expect(searchResult.structuredContent.beans[0].status).toBe('todo');

    const sortResult = await sort({ mode: 'id', statuses: [], types: [], search: '' });
    expect(sortResult.structuredContent.mode).toBe('id');

    const filterWithNulls = await filter({
      statuses: null,
      types: ['task'],
      search: 'bean',
      tags: null,
    });
    expect(filterWithNulls.structuredContent.count).toBeGreaterThanOrEqual(1);

    const sortWithNulls = await sort({ mode: 'id', statuses: null, types: null, search: '' });
    expect(sortWithNulls.structuredContent.mode).toBe('id');
  });

  it('handles reopen and delete guard branches', async () => {
    const reopenCompleted = toolHandlers.get('beans_vscode_reopen_completed')!;
    const reopenScrapped = toolHandlers.get('beans_vscode_reopen_scrapped')!;
    const del = toolHandlers.get('beans_vscode_delete')!;

    await expect(reopenCompleted({ beanId: 'active-1', targetStatus: 'todo' })).rejects.toThrow('not completed');
    await expect(reopenScrapped({ beanId: 'active-1', targetStatus: 'todo' })).rejects.toThrow('not scrapped');
    await expect(del({ beanId: 'active-1', force: false })).rejects.toThrow('Only draft and scrapped');

    const reopenOk = await reopenCompleted({ beanId: 'completed-1', targetStatus: 'todo' });
    expect(reopenOk.structuredContent.bean.id).toBe('completed-1');

    const deleteOk = await del({ beanId: 'scrapped-1', force: false });
    expect(deleteOk.structuredContent.deleted).toBe(true);
  });

  it('handles relationship, copy-id, and llm-context tools', async () => {
    const editBlocking = toolHandlers.get('beans_vscode_edit_blocking')!;
    const copyId = toolHandlers.get('beans_vscode_copy_id')!;
    const llmContext = toolHandlers.get('beans_vscode_llm_context')!;

    const blockingResult = await editBlocking({
      beanId: 'block-1',
      relation: 'blocking',
      operation: 'remove',
      relatedBeanIds: ['x'],
    });
    expect(blockingResult.structuredContent.bean.id).toBe('block-1');

    const copyResult = await copyId({ beanId: 'bean-1234' });
    expect(copyResult.structuredContent.id).toBe('bean-1234');
    expect(copyResult.structuredContent.code).toBe('1234');

    const llmResult = await llmContext({ writeToWorkspaceInstructions: true });
    expect(buildInstructionsMock).toHaveBeenCalledWith('prime output');
    expect(writeInstructionsMock).toHaveBeenCalled();
    expect(llmResult.structuredContent.instructionsPath).toContain('.github/instructions');
  });

  it('handles bean file and output log tools including path guard', async () => {
    const readFileTool = toolHandlers.get('beans_vscode_read_bean_file')!;
    const editFileTool = toolHandlers.get('beans_vscode_edit_bean_file')!;
    const createFileTool = toolHandlers.get('beans_vscode_create_bean_file')!;
    const deleteFileTool = toolHandlers.get('beans_vscode_delete_bean_file')!;
    const readOutputTool = toolHandlers.get('beans_vscode_read_output')!;

    await expect(readFileTool({ path: '../outside.md' })).rejects.toThrow('Path must stay within .beans directory');

    await readFileTool({ path: 'bean.md' });
    await editFileTool({ path: 'folder/bean.md', content: 'hello' });
    await createFileTool({ path: 'new.md', content: 'new', overwrite: true });
    await deleteFileTool({ path: 'new.md' });

    expect(mkdirMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalled();
    expect(rmMock).toHaveBeenCalled();

    const output = await readOutputTool({ lines: 2 });
    expect(output.structuredContent.linesReturned).toBe(2);
    expect(output.structuredContent.content).toBe('line2\nline3');
  });
});
