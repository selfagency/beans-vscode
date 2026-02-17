import { beforeEach, describe, expect, it, vi } from 'vitest';

// TODO(beans-vscode-6h2m): Expand MCP tool tests with full schema/validation
// matrices and richer CLI failure modes (timeouts, stderr-only failures,
// malformed partial JSON, and argument shape assertions per tool).
const toolHandlers = vi.hoisted(() => new Map<string, (...args: any[]) => any>());
const connectSpy = vi.hoisted(() => vi.fn(async () => {}));
const execFileMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());
const mkdirMock = vi.hoisted(() => vi.fn());
const rmMock = vi.hoisted(() => vi.fn());
const buildInstructionsMock = vi.hoisted(() => vi.fn((prime: string) => `generated:${prime}`));
const writeInstructionsMock = vi.hoisted(() => vi.fn(async () => '/ws/.github/instructions/beans.instructions.md'));

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

vi.mock('node:fs/promises', () => ({
  readFile: readFileMock,
  writeFile: writeFileMock,
  mkdir: mkdirMock,
  rm: rmMock,
}));

vi.mock('../../../beans/config', () => ({
  buildBeansCopilotInstructions: buildInstructionsMock,
  writeBeansCopilotInstructions: writeInstructionsMock,
}));

function setupExecFileMock(): void {
  execFileMock.mockImplementation((file: string, args: string[], _opts: unknown, cb: (...params: any[]) => void) => {
    const done = (stdout: string) => cb(null, { stdout, stderr: '' });
    const cmd = args[0];

    if (file !== '/custom/beans') {
      return cb(new Error(`unexpected cli path ${file}`));
    }

    if (cmd === 'init') {
      return done('');
    }
    if (cmd === 'prime') {
      return done('prime output\n');
    }
    if (cmd === 'list') {
      return done(
        JSON.stringify([
          { id: 'bean-active', title: 'Active', status: 'todo', type: 'task', tags: ['frontend'] },
          { id: 'bean-done', title: 'Done', status: 'completed', type: 'bug', tags: ['backend'] },
          { id: 'bean-scrap', title: 'Scrap', status: 'scrapped', type: 'feature', tags: ['frontend'] },
        ])
      );
    }
    if (cmd === 'show') {
      const beanId = args[args.length - 1];
      if (beanId === 'completed-1') {
        return done(JSON.stringify({ id: beanId, title: 'Completed', status: 'completed', type: 'task' }));
      }
      if (beanId === 'scrapped-1') {
        return done(JSON.stringify({ id: beanId, title: 'Scrapped', status: 'scrapped', type: 'task' }));
      }
      if (beanId === 'active-1') {
        return done(JSON.stringify({ id: beanId, title: 'Active', status: 'todo', type: 'task' }));
      }
      if (beanId === 'block-1') {
        return done(
          JSON.stringify({
            id: beanId,
            title: 'Blocking bean',
            status: 'todo',
            type: 'task',
            blocking: ['x'],
            blocked_by: ['y'],
          })
        );
      }
      return done(JSON.stringify({ id: beanId, title: 'Bean', status: 'todo', type: 'task' }));
    }
    if (cmd === 'update') {
      return done(
        JSON.stringify({
          id: args[2],
          title: 'Updated',
          status: args.includes('-s') ? args[args.indexOf('-s') + 1] : 'todo',
          type: 'task',
        })
      );
    }
    if (cmd === 'delete') {
      return done(JSON.stringify({ ok: true }));
    }
    if (cmd === 'create') {
      return done(JSON.stringify({ id: 'new-1', title: 'New bean', status: 'todo', type: 'task' }));
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
