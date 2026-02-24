import { beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal harness: capture registered MCP tools and assert the public surface is
// larger than an allowed target (this test is expected to FAIL prior to refactor).
const toolHandlers = vi.hoisted(() => new Map<string, (...args: any[]) => any>());
const connectSpy = vi.hoisted(() => vi.fn(async () => {}));
const execFileMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());
const createReadStreamMock = vi.hoisted(() => vi.fn());
const createInterfaceMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());
const mkdirMock = vi.hoisted(() => vi.fn());
const rmMock = vi.hoisted(() => vi.fn());

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

vi.mock('node:child_process', () => ({ execFile: execFileMock }));
vi.mock('node:fs', () => ({ createReadStream: createReadStreamMock }));
vi.mock('node:readline', () => ({ createInterface: createInterfaceMock }));
vi.mock('node:fs/promises', () => ({ readFile: readFileMock, writeFile: writeFileMock, mkdir: mkdirMock, rm: rmMock }));

function setupExecFileMock(): void {
  execFileMock.mockImplementation((file: string, args: string[], _opts: unknown, cb: (...params: any[]) => void) => {
    const done = (stdout: string) => cb(null, { stdout, stderr: '' });
    if (args[0] === 'graphql') {
      // Return minimal JSON for list/show/create/update/delete queries used by handlers
      const query = args[args.indexOf('graphql') + 2] || '';
      if (query.includes('ListBeans')) {
        return done(JSON.stringify({ beans: [] }));
      }
      if (query.includes('ShowBean')) {
        return done(JSON.stringify({ bean: { id: 'bean-1', title: 'Bean', status: 'todo', type: 'task' } }));
      }
      if (query.includes('CreateBean')) {
        return done(JSON.stringify({ createBean: { id: 'new-1', title: 'x', status: 'todo', type: 'task' } }));
      }
      if (query.includes('UpdateBean')) {
        return done(JSON.stringify({ updateBean: { id: 'u-1', title: 'u', status: 'todo', type: 'task' } }));
      }
      if (query.includes('DeleteBean')) {
        return done(JSON.stringify({ deleteBean: true }));
      }
    }

    if (args[0] === 'init') {
      return done('');
    }

    if (args[0] === 'graphql' && args.includes('--schema')) {
      return done('schema');
    }

    return done(JSON.stringify({}));
  });
}

describe('MCP tool surface size (red test)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    toolHandlers.clear();
    setupExecFileMock();
    readFileMock.mockResolvedValue('');
    createReadStreamMock.mockReturnValue({ __lines: [] });
    createInterfaceMock.mockImplementation(({ input }: { input: { __lines: string[] } }) => ({
      async *[Symbol.asyncIterator]() {
        for (const line of input.__lines) {
          yield line;
        }
      },
    }));

    // Import and start the MCP server which will populate toolHandlers via mocked McpServer
    const mod = await import('../../../beans/mcp/BeansMcpServer.js');
    await mod.startBeansMcpServer(['--workspace', '/ws', '--cli-path', '/custom/beans']);
  });

  it('fails because the MCP public tool surface is larger than our allowed target', () => {
    const allowedMax = 10; // target: reduce to 10 or fewer public tools
    expect(toolHandlers.size).toBeLessThanOrEqual(allowedMax);
  });
});
