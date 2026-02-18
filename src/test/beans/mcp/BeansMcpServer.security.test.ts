import { beforeEach, describe, expect, it, vi } from 'vitest';

const toolHandlers = vi.hoisted(() => new Map<string, (...args: any[]) => any>());
const connectSpy = vi.hoisted(() => vi.fn(async () => {}));
const execFileMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());
const mkdirMock = vi.hoisted(() => vi.fn());
const rmMock = vi.hoisted(() => vi.fn());

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class MockMcpServer {
    registerTool(name: string, meta: any, handler: (...args: any[]) => any): void {
      toolHandlers.set(name, async (input: any) => {
        if (meta.inputSchema) {
          meta.inputSchema.parse(input);
        }
        return handler(input);
      });
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

// We need to mock createReadStream and createInterface for readOutputLog
vi.mock('node:fs', () => ({
  createReadStream: vi.fn(),
}));

vi.mock('node:readline', () => ({
  createInterface: vi.fn(),
}));

describe('BeansMcpServer security review', () => {
  const workspaceRoot = '/safe/workspace';
  const cliPath = '/usr/bin/beans';

  beforeEach(async () => {
    vi.clearAllMocks();
    toolHandlers.clear();

    // Default mock implementations
    execFileMock.mockImplementation((_file, _args, _opts, cb) => {
      cb(null, { stdout: JSON.stringify({ data: { beans: [], bean: {} } }), stderr: '' });
    });

    const mod = await import('../../../beans/mcp/BeansMcpServer.js');
    await mod.startBeansMcpServer(['--workspace', workspaceRoot, '--cli-path', cliPath]);
  });

  describe('Path Traversal (MCP10)', () => {
    it('should reject read_bean_file with path outside .beans', async () => {
      const readTool = toolHandlers.get('beans_vscode_read_bean_file')!;
      // MCP10-A: Should reject paths leading outside the .beans folder
      // Already implemented in resolveBeanFilePath
      await expect(readTool({ path: '../../etc/passwd' })).rejects.toThrow('Path must stay within .beans directory');
    });

    it('should reject read_output_log if BEANS_VSCODE_OUTPUT_LOG points outside workspace', async () => {
      const originalEnv = process.env.BEANS_VSCODE_OUTPUT_LOG;
      process.env.BEANS_VSCODE_OUTPUT_LOG = '/etc/passwd';

      const readOutputTool = toolHandlers.get('beans_vscode_read_output')!;

      try {
        // MCP10-B: Path Traversal via environment variables
        await expect(readOutputTool({})).rejects.toThrow('Output log path must stay within the workspace');
      } finally {
        process.env.BEANS_VSCODE_OUTPUT_LOG = originalEnv;
      }
    });
  });

  describe('Command Injection & CLI Path Validation (MCP05)', () => {
    it('should validate cli-path passed via argv', async () => {
      const mod = await import('../../../beans/mcp/BeansMcpServer.js');
      // A command that would normally be executable in a shell but should be rejected here
      await expect(mod.startBeansMcpServer(['--workspace', '/ws', '--cli-path', 'beans; whoami'])).rejects.toThrow(
        'Invalid CLI path'
      );
    });

    it('should treat flag-like beanIds as literal positional arguments', async () => {
      // In this case, we're testing that passing "--version" as a beanId does NOT inject an extra CLI flag,
      // but is instead forwarded as the bean identifier inside the GraphQL variables JSON.
      const viewTool = toolHandlers.get('beans_vscode_view')!;
      await viewTool({ beanId: '--version' });

      // Validate the exact execFile invocation to ensure safe argument ordering.
      expect(execFileMock).toHaveBeenCalledTimes(1);
      const call = execFileMock.mock.calls[0];
      const cliArgs = call[1];

      // Expected layout: ["graphql", "--json", query, "--variables", jsonVars]
      expect(Array.isArray(cliArgs)).toBe(true);
      expect(cliArgs[0]).toBe('graphql');
      expect(cliArgs[1]).toBe('--json');
      expect(cliArgs[3]).toBe('--variables');

      // The beanId should be inside the JSON variables
      const vars = JSON.parse(cliArgs[4]);
      expect(vars.id).toBe('--version');
    });
  });

  describe('Resource Limits & Sanitization (MCP08/MCP07)', () => {
    it('should reject titles that are too long', async () => {
      const createTool = toolHandlers.get('beans_vscode_create')!;
      const longTitle = 'a'.repeat(2000); // MAX_TITLE_LENGTH is 1024

      await expect(createTool({ title: longTitle, type: 'task' })).rejects.toThrow();
    });

    it('should reject beanIds that are too long', async () => {
      const viewTool = toolHandlers.get('beans_vscode_view')!;
      const longId = 'a'.repeat(200); // MAX_ID_LENGTH is 128

      await expect(viewTool({ beanId: longId })).rejects.toThrow();
    });
  });

  describe('Token Exposure (MCP01)', () => {
    it('should NOT pass all environment variables to the CLI', async () => {
      const refreshTool = toolHandlers.get('beans_vscode_refresh')!;
      process.env.SECRET_TOKEN = 'super-secret';

      await refreshTool({});

      expect(execFileMock).toHaveBeenCalled();
      const call = execFileMock.mock.calls[0];
      const options = call[2];

      expect(options.env).toBeDefined();
      expect(options.env.SECRET_TOKEN).toBeUndefined();

      delete process.env.SECRET_TOKEN;
    });
  });
});
