import { execFile } from 'child_process';
import { mkdir, readFile, readdir, rename, writeFile } from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansOutput } from '../../../beans/logging/BeansOutput';
import { BeansCLINotFoundError, BeansJSONParseError, BeansTimeoutError } from '../../../beans/model';
import { BeansService } from '../../../beans/service';

// Mock child_process
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
}));

// Mock vscode
vi.mock('vscode', () => {
  const mockConfig = {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (key === 'cliPath') {
        return 'beans';
      }
      if (key === 'workspaceRoot') {
        return '';
      }
      return defaultValue;
    }),
  };

  const mockOutputChannel = {
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    workspace: {
      getConfiguration: vi.fn(() => mockConfig),
    },
    window: {
      createOutputChannel: vi.fn(() => mockOutputChannel),
      showWarningMessage: vi.fn(),
    },
    LogLevel: {
      Trace: 0,
      Debug: 1,
      Info: 2,
      Warning: 3,
      Error: 4,
      Off: 5,
    },
  };
});

describe('BeansService', () => {
  let service: BeansService;
  let mockExecFile: ReturnType<typeof vi.fn>;
  let mockReadFile: ReturnType<typeof vi.fn>;
  let mockWriteFile: ReturnType<typeof vi.fn>;
  let mockRename: ReturnType<typeof vi.fn>;
  let mockMkdir: ReturnType<typeof vi.fn>;
  let mockReaddir: ReturnType<typeof vi.fn>;

  function createErrnoError(message: string, code: string): NodeJS.ErrnoException {
    const error = new Error(message) as NodeJS.ErrnoException;
    error.code = code;
    return error;
  }

  function createTimeoutError(message: string): NodeJS.ErrnoException & { killed: boolean; signal: string } {
    const error = new Error(message) as NodeJS.ErrnoException & { killed: boolean; signal: string };
    error.killed = true;
    error.signal = 'SIGTERM';
    return error;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
    mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>;
    mockWriteFile = writeFile as unknown as ReturnType<typeof vi.fn>;
    mockRename = rename as unknown as ReturnType<typeof vi.fn>;
    mockMkdir = mkdir as unknown as ReturnType<typeof vi.fn>;
    mockReaddir = readdir as unknown as ReturnType<typeof vi.fn>;

    mockReadFile.mockResolvedValue('---\nstatus: todo\ntype: task\n---\nbody');
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue([]);

    service = new BeansService('/test/workspace');
  });

  describe('constructor', () => {
    it('initializes with workspace root', () => {
      expect(service).toBeDefined();
    });

    it('reads CLI path from configuration', () => {
      const config = vscode.workspace.getConfiguration('beans');
      expect(config.get).toHaveBeenCalledWith('cliPath', 'beans');
    });
  });

  describe('checkCLIAvailable', () => {
    it('returns true when CLI responds to --version', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: '0.1.0', stderr: '' });
      });

      const available = await service.checkCLIAvailable();
      expect(available).toBe(true);
    });

    it('returns false when CLI is not found (ENOENT)', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const error = createErrnoError('ENOENT', 'ENOENT');
        callback(error, null);
      });

      const available = await service.checkCLIAvailable();
      expect(available).toBe(false);
    });

    it('returns true for other errors (CLI exists but failed)', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(new Error('Permission denied'), null);
      });

      const available = await service.checkCLIAvailable();
      expect(available).toBe(true);
    });
  });

  describe('checkInitialized', () => {
    it('returns true when workspace is initialized', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ initialized: true }), stderr: '' });
      });

      const initialized = await service.checkInitialized();
      expect(initialized).toBe(true);
    });

    it('returns false when check fails', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(new Error('Not initialized'), null);
      });

      const initialized = await service.checkInitialized();
      expect(initialized).toBe(false);
    });
  });

  describe('listBeans', () => {
    const mockBeanData = [
      {
        id: 'test-abc1',
        title: 'Test Bean 1',
        slug: 'test-bean-1',
        path: 'beans/test-abc1.md',
        body: 'Test body',
        status: 'todo',
        type: 'task',
        tags: ['tag1'],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      },
    ];

    it('lists all beans without filters', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: mockBeanData }), stderr: '' });
      });

      const beans = await service.listBeans();
      expect(beans).toHaveLength(1);
      expect(beans[0].id).toBe('test-abc1');
      expect(beans[0].code).toBe('abc1');
    });

    it('logs GraphQL query and CLI response diagnostics when diagnostics mode is enabled', async () => {
      const config = vscode.workspace.getConfiguration('beans');
      (config.get as ReturnType<typeof vi.fn>).mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'cliPath') {
          return 'beans';
        }
        if (key === 'workspaceRoot') {
          return '';
        }
        if (key === 'logging.level') {
          return 'debug';
        }
        if (key === 'logging.diagnostics.enabled') {
          return true;
        }
        return defaultValue;
      });
      BeansOutput.getInstance().refreshConfig();

      const outputChannel = vscode.window.createOutputChannel('Beans', { log: true });

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: mockBeanData }), stderr: '' });
      });

      await service.listBeans({ status: ['todo'] });

      expect(outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[DIAGNOSTICS] GraphQL query'));
      expect(outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('query ListBeans'));
      expect(outputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[DIAGNOSTICS] GraphQL CLI stdout')
      );
    });

    it('logs GraphQL stderr diagnostics when CLI writes to stderr', async () => {
      const config = vscode.workspace.getConfiguration('beans');
      (config.get as ReturnType<typeof vi.fn>).mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'cliPath') {
          return 'beans';
        }
        if (key === 'workspaceRoot') {
          return '';
        }
        if (key === 'logging.level') {
          return 'debug';
        }
        if (key === 'logging.diagnostics.enabled') {
          return true;
        }
        return defaultValue;
      });
      BeansOutput.getInstance().refreshConfig();

      const outputChannel = vscode.window.createOutputChannel('Beans', { log: true });

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, {
          stdout: JSON.stringify({ beans: mockBeanData }),
          stderr: 'graphql warning: test stderr output',
        });
      });

      await service.listBeans({ status: ['todo'] });

      expect(outputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[DIAGNOSTICS] GraphQL CLI stderr')
      );
    });

    it('applies status filters', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.filter.status).toEqual(['todo']);
        callback(null, { stdout: JSON.stringify({ beans: mockBeanData }), stderr: '' });
      });

      await service.listBeans({ status: ['todo'] });
    });

    it('applies type filters', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.filter.type).toEqual(['task']);
        callback(null, { stdout: JSON.stringify({ beans: mockBeanData }), stderr: '' });
      });

      await service.listBeans({ type: ['task'] });
    });

    it('applies search filter', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.filter.search).toBe('test');
        callback(null, { stdout: JSON.stringify({ beans: mockBeanData }), stderr: '' });
      });

      await service.listBeans({ search: 'test' });
    });

    it('normalizes beans with camelCase fields', async () => {
      const rawBean = {
        id: 'test-xyz9',
        title: 'Test',
        slug: 'test',
        path: 'beans/test.md',
        body: '',
        status: 'todo',
        type: 'task',
        parentId: 'parent-123',
        blockingIds: ['block-1'],
        blockedByIds: ['blocked-1'],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: [rawBean] }), stderr: '' });
      });

      const beans = await service.listBeans();
      expect(beans[0].parent).toBe('parent-123');
      expect(beans[0].blocking).toEqual(['block-1']);
      expect(beans[0].blockedBy).toEqual(['blocked-1']);
    });

    it('prioritizes blockedByIds over blocked_by when both exist', async () => {
      const rawBean = {
        id: 'test-xyz9',
        title: 'Test',
        slug: 'test',
        path: 'beans/test.md',
        body: '',
        status: 'todo',
        type: 'task',
        blocked_by: ['legacy'],
        blockedByIds: ['preferred'],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: [rawBean] }), stderr: '' });
      });

      const beans = await service.listBeans();
      expect(beans[0].blockedBy).toEqual(['preferred']);
    });

    it('caches successful results', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: mockBeanData }), stderr: '' });
      });

      await service.listBeans();
      expect(service.isOffline()).toBe(false);

      // Clear cache to test it was set
      service.clearCache();
    });

    it('falls back to cache in offline mode', async () => {
      // First successful call to populate cache
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: mockBeanData }), stderr: '' });
      });

      await service.listBeans();

      // Second call fails, should use cache
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const error = createErrnoError('ENOENT', 'ENOENT');
        callback(error, null);
      });

      const beans = await service.listBeans();
      expect(beans).toHaveLength(1);
      expect(service.isOffline()).toBe(true);
    });

    it('applies requested filters when serving cached data in offline mode', async () => {
      const cachedBeans = [
        {
          id: 'test-abc1',
          title: 'Todo Task',
          slug: 'todo-task',
          path: 'beans/test-abc1.md',
          body: 'todo body',
          status: 'todo',
          type: 'task',
          tags: ['frontend'],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          etag: 'etag1',
        },
        {
          id: 'test-def2',
          title: 'Completed Bug',
          slug: 'completed-bug',
          path: 'beans/test-def2.md',
          body: 'done body',
          status: 'completed',
          type: 'bug',
          tags: ['backend'],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          etag: 'etag2',
        },
      ];

      // Cache the beans
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: cachedBeans }), stderr: '' });
      });
      await service.listBeans();

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const error = createErrnoError('ENOENT', 'ENOENT');
        callback(error, null);
      });

      const filtered = await service.listBeans({ status: ['todo'], type: ['task'], search: 'todo' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('test-abc1');
      expect(service.isOffline()).toBe(true);
    });

    it('throws when CLI unavailable and no cache', async () => {
      service.clearCache();

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const error = createErrnoError('ENOENT', 'ENOENT');
        callback(error, null);
      });

      await expect(service.listBeans()).rejects.toThrow(BeansCLINotFoundError);
      await expect(service.listBeans()).rejects.toThrow('Beans CLI is not available and no cached data exists');
    });

    it('continues listing when one bean is malformed and can be auto-repaired', async () => {
      const malformedBean = {
        id: 'test-bad1',
        title: '',
        slug: 'bad-bean',
        path: '.beans/test-bad1--bad-bean.md',
        body: 'broken',
        status: 'todo',
        type: 'task',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-bad',
      };

      const goodBean = {
        id: 'test-good1',
        title: 'Good Bean',
        slug: 'good-bean',
        path: '.beans/test-good1--good-bean.md',
        body: 'ok',
        status: 'todo',
        type: 'task',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-good',
      };

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: [malformedBean, goodBean] }), stderr: '' });
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(2);
      expect(beans.map(bean => bean.id)).toEqual(expect.arrayContaining(['test-bad1', 'test-good1']));
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      expect(mockRename).not.toHaveBeenCalled();
    });

    it('uses configured default status/type when repairing malformed beans', async () => {
      mockReadFile.mockResolvedValue('body');

      vi.spyOn(service, 'getConfig').mockResolvedValue({
        path: '.beans',
        prefix: 'bean',
        id_length: 4,
        default_status: 'todo',
        default_type: 'bug',
        statuses: ['todo', 'in-progress', 'completed', 'scrapped', 'draft'],
        types: ['milestone', 'epic', 'feature', 'task', 'bug'],
        priorities: ['critical', 'high', 'normal', 'low', 'deferred'],
      });

      const malformedBean = {
        id: '',
        title: '',
        slug: 'repair-me',
        path: '.beans/test-bad3--repair-me.md',
        body: 'broken',
        status: '',
        type: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-bad3',
      };

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(1);
      expect(beans[0].id).toBe('test-bad3');
      expect(beans[0].title).toBe('repair me');
      expect(beans[0].status).toBe('todo');
      expect(beans[0].type).toBe('bug');
      expect(service.getConfig).toHaveBeenCalledTimes(2);
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('status: todo');
      expect(writtenContent).toContain('type: bug');
    });

    it('does not treat in-body horizontal rules as frontmatter during repair', async () => {
      mockReadFile.mockResolvedValue('Body intro\n---\nnot frontmatter\n---\nrest of body');

      const malformedBean = {
        id: 'test-bad4',
        title: '',
        slug: 'hr-bean',
        path: '.beans/test-bad4--hr-bean.md',
        body: 'broken',
        status: 'todo',
        type: 'task',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-bad4',
      };

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(1);
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('id: test-bad4');
      expect(writtenContent).toContain('title: hr bean');
      expect(writtenContent).toContain('status: todo');
      expect(writtenContent).toContain('type: task');
      expect(writtenContent).toContain('\nBody intro\n---\nnot frontmatter\n---\nrest of body');
    });

    it('quarantines malformed bean when frontmatter write fails instead of returning in-memory repair', async () => {
      const malformedBean = {
        id: 'test-bad2',
        title: '',
        slug: 'broken-bean',
        path: '.beans/test-bad2--broken-bean.md',
        body: 'broken',
        status: 'todo',
        type: 'task',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-bad2',
      };

      mockWriteFile.mockRejectedValue(new Error('cannot write file'));

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
      });

      const beans = await service.listBeans();

      // No in-memory repaired bean should be returned; file must be quarantined.
      expect(beans).toHaveLength(0);
      expect(mockRename).toHaveBeenCalledTimes(1);
      const [renameSource, renameTarget] = mockRename.mock.calls[0] as [string, string];
      expect(renameSource).toContain('/test/workspace/.beans/test-bad2--broken-bean.md');
      expect(renameTarget).toContain('/test/workspace/.beans/.quarantine/test-bad2--broken-bean.md');
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('Bean file quarantined:'),
        'Open File'
      );
    });

    it('quarantines filename-only malformed path under .beans', async () => {
      const malformedBean = {
        id: 'rocketbase-3s0i',
        title: '',
        slug: 'redirects',
        path: 'rocketbase-3s0i--redirects.md',
        body: 'broken',
        status: 'todo',
        type: 'task',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-rb',
      };

      mockWriteFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(0);
      expect(mockRename).toHaveBeenCalledTimes(1);
      const [renameSource, renameTarget] = mockRename.mock.calls[0] as [string, string];
      expect(renameSource).toContain('/test/workspace/.beans/rocketbase-3s0i--redirects.md');
      expect(renameTarget).toContain('/test/workspace/.beans/.quarantine/rocketbase-3s0i--redirects.md');
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('rocketbase-3s0i--redirects.md'),
        'Open File'
      );
    });

    it('recovers malformed bean with filename lacking id delimiter by generating a new id', async () => {
      const malformedBean = {
        id: '',
        title: '',
        slug: '',
        path: '.beans/broken-quarantine-test.md',
        body: 'broken',
        status: '',
        type: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-generated-id',
      };

      mockExecFile.mockImplementation((cmd, _args, _opts, callback) => {
        if (cmd === 'git') {
          callback(createErrnoError('git not found', 'ENOENT'), null);
          return;
        }
        callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(1);
      expect(beans[0].id).toMatch(/^bean-[a-f0-9]{4,16}$/);
      expect(beans[0].title).toBe('broken quarantine test');
      expect(beans[0].status).toBe('draft');
      expect(beans[0].type).toBe('task');
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      expect(mockRename).not.toHaveBeenCalled();
    });

    it('recovers when list command fails with malformed bean path in CLI error', async () => {
      const healthyBean = {
        id: 'test-good-recovered',
        title: 'Recovered Good Bean',
        slug: 'recovered-good-bean',
        path: '.beans/test-good-recovered--recovered-good-bean.md',
        body: 'ok',
        status: 'todo',
        type: 'task',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-good-recovered',
        parentId: '',
        blockingIds: [],
        blockedByIds: [],
      };

      let callCount = 0;
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callCount += 1;

        if (callCount === 1) {
          const malformedError = Object.assign(new Error('yaml parse error in bean frontmatter'), {
            stderr: 'failed to parse /test/workspace/.beans/test-bad4--broken.md: yaml: did not find expected key',
            stdout: '',
          });
          callback(malformedError, null);
          return;
        }

        callback(null, { stdout: JSON.stringify({ beans: [healthyBean] }), stderr: '' });
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(1);
      expect(beans[0].id).toBe('test-good-recovered');
      expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('/test/workspace/.beans/.quarantine'), {
        recursive: true,
      });
      expect(mockRename).toHaveBeenCalledTimes(1);
      const [renameSource, renameTarget] = mockRename.mock.calls[0] as [string, string];
      expect(renameSource).toContain('/test/workspace/.beans/test-bad4--broken.md');
      expect(renameTarget).toContain('/test/workspace/.beans/.quarantine/test-bad4--broken.md');
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('Bean file quarantined:'),
        'Open File'
      );
    });

    it('malformed bean path regex matches both forward-slash and backslash .beans separators', () => {
      // The regex used by extractMalformedBeanPathFromCliError must match .beans paths
      // with either separator so Windows CLI errors are handled. On POSIX the method
      // would still reject the resolved path (backslash is literal, not a separator),
      // but the regex must extract the candidate in both cases.
      const pattern =
        /((?:[A-Za-z]:\\[^\s:'"\n]+\.md)|(?:\/?[^\s:'"\n]*\.beans[/\\][^\s:'"\n]+\.md)|(?:\.beans[/\\][^\s:'"\n]+\.md))/;

      // Forward-slash (POSIX / universal)
      expect(pattern.exec('failed to parse .beans/broken.md: yaml error')?.[1]).toBe('.beans/broken.md');
      expect(pattern.exec('error in /workspace/.beans/sub/file.md')?.[1]).toBe('/workspace/.beans/sub/file.md');

      // Backslash (Windows)
      expect(pattern.exec('failed to parse .beans\\broken.md: yaml error')?.[1]).toBe('.beans\\broken.md');
      expect(pattern.exec('error in C:\\workspace\\.beans\\file.md')?.[1]).toBe('C:\\workspace\\.beans\\file.md');

      // No match for paths without .beans dir
      expect(pattern.exec('error in /workspace/other/file.md')).toBeNull();
    });

    it('clears dangling parent references for beans whose parent is not in the list', async () => {
      // Parent is malformed (no title, no path) so it ends up quarantined and absent from normalizedBeans.
      // The child references its id; since the parent is not in the list, the parent field must be cleared.
      const malformedParent = {
        id: 'test-bad3',
        title: '',
        slug: 'broken-parent',
        path: '',
        body: '',
        status: 'todo',
        type: 'epic',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        etag: 'etag-bp',
        parentId: '',
        blockingIds: [],
        blockedByIds: [],
      };
      const childBean = {
        id: 'test-child1',
        code: 'ch1',
        title: 'Child Task',
        slug: 'child-task',
        path: '.beans/test-child1--child-task.md',
        body: 'some body',
        status: 'todo',
        type: 'task',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        etag: 'etag-ch1',
        parentId: 'test-bad3',
        parent: 'test-bad3',
        blockingIds: [],
        blockedByIds: [],
      };
      const orphanedChild = { ...childBean, parentId: '', parent: '' };

      mockExecFile.mockImplementation((_cmd, args: string[], _opts, callback) => {
        const query: string = args[2] ?? '';
        if (query.includes('UpdateBean')) {
          callback(null, { stdout: JSON.stringify({ updateBean: orphanedChild }), stderr: '' });
        } else {
          callback(null, { stdout: JSON.stringify({ beans: [malformedParent, childBean] }), stderr: '' });
        }
      });

      const beans = await service.listBeans();

      // No placeholder created — CreateBean must not have been called
      const updateCall = mockExecFile.mock.calls.find(c => (c[1] as string[])[2]?.includes('UpdateBean'));
      expect(updateCall).toBeDefined();
      const createCall = mockExecFile.mock.calls.find(c => (c[1] as string[])[2]?.includes('CreateBean'));
      expect(createCall).toBeUndefined();

      // Child's parent cleared — it appears as a root-level bean
      const child = beans.find(b => b.id === 'test-child1');
      expect(child).toBeDefined();
      expect(child!.status).toBe('todo');
      expect(child!.parent).toBeFalsy();

      // Warning mentions the orphaned child
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('ch1'));
    });

    it('uses git history to recover missing fields when a previous commit exists', async () => {
      const historicalContent =
        '---\nid: test-hist1\ntitle: "My Historical Title"\nstatus: completed\ntype: feature\n---\n## Body';

      const malformedBean = {
        id: '',
        title: '',
        slug: 'historical-bean',
        path: '.beans/test-hist1--historical-bean.md',
        body: '',
        status: '',
        type: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-hist1',
      };

      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback: Function) => {
        if (cmd === 'git' && args.includes('log')) {
          callback(null, { stdout: 'abc1234567890abcdef', stderr: '' });
        } else if (cmd === 'git' && args.includes('show')) {
          callback(null, { stdout: historicalContent, stderr: '' });
        } else {
          callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
        }
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(1);
      expect(beans[0].id).toBe('test-hist1');
      expect(beans[0].title).toBe('My Historical Title');
      expect(beans[0].status).toBe('completed');
      expect(beans[0].type).toBe('feature');
      const writtenContent = mockWriteFile.mock.calls[0][1] as string;
      expect(writtenContent).toContain('id: test-hist1');
      expect(writtenContent).toContain('title: My Historical Title');
      expect(writtenContent).toContain('status: completed');
      expect(writtenContent).toContain('type: feature');
    });

    it('falls back to filename inference when git log returns no commits', async () => {
      const malformedBean = {
        id: '',
        title: '',
        slug: 'no-history-bean',
        path: '.beans/test-nogh1--no-history-bean.md',
        body: '',
        status: '',
        type: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-nogh1',
      };

      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback: Function) => {
        if (cmd === 'git' && args.includes('log')) {
          callback(null, { stdout: '', stderr: '' }); // empty SHA = no history
        } else {
          callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
        }
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(1);
      expect(beans[0].id).toBe('test-nogh1');
      expect(beans[0].title).toBe('no history bean');
    });

    it('falls back to filename inference when git is unavailable', async () => {
      const malformedBean = {
        id: '',
        title: '',
        slug: 'no-git-bean',
        path: '.beans/test-nogit--no-git-bean.md',
        body: '',
        status: '',
        type: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-nogit',
      };

      mockExecFile.mockImplementation((cmd: string, _args: string[], _opts: unknown, callback: Function) => {
        if (cmd === 'git') {
          callback(createErrnoError('git not found', 'ENOENT'), null);
        } else {
          callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
        }
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(1);
      expect(beans[0].id).toBe('test-nogit');
      expect(beans[0].title).toBe('no git bean');
    });

    it('falls back to filename inference when historical frontmatter cannot be parsed', async () => {
      const malformedBean = {
        id: '',
        title: '',
        slug: 'corrupt-hist',
        path: '.beans/test-crpt1--corrupt-hist.md',
        body: '',
        status: '',
        type: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-crpt1',
      };

      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback: Function) => {
        if (cmd === 'git' && args.includes('log')) {
          callback(null, { stdout: 'deadbeef01234567', stderr: '' });
        } else if (cmd === 'git' && args.includes('show')) {
          callback(null, { stdout: 'not yaml at all\njust garbage\n', stderr: '' });
        } else {
          callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
        }
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(1);
      expect(beans[0].id).toBe('test-crpt1');
      expect(beans[0].title).toBe('corrupt hist');
    });

    it('walks back through multiple git commits to find a valid historical version', async () => {
      const corruptedContent = '---\nid: test-walk1\ntitle: ""\nstatus: ""\ntype: ""\n---\ncorrupted';
      const validContent =
        '---\nid: test-walk1\ntitle: "Originally Good"\nstatus: in-progress\ntype: feature\n---\n## Body';

      const malformedBean = {
        id: '',
        title: '',
        slug: 'walk-bean',
        path: '.beans/test-walk1--walk-bean.md',
        body: '',
        status: '',
        type: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-walk1',
      };

      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback: Function) => {
        if (cmd === 'git' && args.includes('log')) {
          // Return 3 commit SHAs — first two are corrupted, third is good
          callback(null, { stdout: 'aaaa1111\nbbbb2222\ncccc3333', stderr: '' });
        } else if (cmd === 'git' && args.includes('show')) {
          const ref = args[1];
          if (ref.startsWith('cccc3333:')) {
            callback(null, { stdout: validContent, stderr: '' });
          } else {
            callback(null, { stdout: corruptedContent, stderr: '' });
          }
        } else {
          callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
        }
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(1);
      expect(beans[0].id).toBe('test-walk1');
      expect(beans[0].title).toBe('Originally Good');
      expect(beans[0].status).toBe('in-progress');
      expect(beans[0].type).toBe('feature');
    });

    it('uses best partial recovery when no single commit has all required fields', async () => {
      // Commit 1: has id and title but empty status and type
      const partialContent1 = '---\nid: test-part1\ntitle: "Partial Title"\nstatus: ""\ntype: ""\n---\nbody';
      // Commit 2: has only id
      const partialContent2 = '---\nid: test-part1\ntitle: ""\nstatus: ""\ntype: ""\n---\nbody';

      const malformedBean = {
        id: '',
        title: '',
        slug: 'partial-bean',
        path: '.beans/test-part1--partial-bean.md',
        body: '',
        status: '',
        type: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag-part1',
      };

      mockExecFile.mockImplementation((cmd: string, args: string[], _opts: unknown, callback: Function) => {
        if (cmd === 'git' && args.includes('log')) {
          callback(null, { stdout: 'sha11111\nsha22222', stderr: '' });
        } else if (cmd === 'git' && args.includes('show')) {
          const ref = args[1];
          if (ref.startsWith('sha11111:')) {
            callback(null, { stdout: partialContent1, stderr: '' });
          } else {
            callback(null, { stdout: partialContent2, stderr: '' });
          }
        } else {
          callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
        }
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(1);
      // id and title recovered from best partial (commit 1), status/type from defaults
      expect(beans[0].id).toBe('test-part1');
      expect(beans[0].title).toBe('Partial Title');
    });

    it('quarantines bean when no fields can be inferred at all', async () => {
      const malformedBean = {
        id: '',
        title: '',
        slug: '',
        path: '',
        body: '',
        status: '',
        type: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: '',
      };

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
      });

      const beans = await service.listBeans();

      // No path, no id, no title — cannot infer anything, bean is dropped
      expect(beans).toHaveLength(0);
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('Bean file quarantined:'));
    });

    it('notification message includes filename in inline code formatting', async () => {
      const malformedBean = {
        id: '',
        title: '',
        slug: '',
        path: '',
        body: '',
        status: '',
        type: '',
        tags: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: '',
      };

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: [malformedBean] }), stderr: '' });
      });

      await service.listBeans();

      const warningCall = (vscode.window.showWarningMessage as ReturnType<typeof vi.fn>).mock.calls[0];
      const message = warningCall[0] as string;
      expect(message).toContain('Bean file quarantined:');
      expect(message).toContain('Open the .beans/.quarantine folder to inspect or restore the file.');
    });
  });

  describe('showBean', () => {
    it('retrieves a single bean by ID', async () => {
      const mockBean = {
        id: 'test-abc1',
        title: 'Test Bean',
        slug: 'test-bean',
        path: 'beans/test-abc1.md',
        body: 'Body',
        status: 'todo',
        type: 'task',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.id).toBe('test-abc1');
        callback(null, { stdout: JSON.stringify({ bean: mockBean }), stderr: '' });
      });

      const bean = await service.showBean('test-abc1');
      expect(bean.id).toBe('test-abc1');
      expect(bean.code).toBe('abc1');
    });

    it('accepts partial show payloads from CLI and applies safe defaults', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        callback(null, {
          stdout: JSON.stringify({
            bean: {
              id: 'test-abc1',
              title: 'Test Bean',
              status: 'todo',
              type: 'task',
              // show payload can be partial on some CLI versions;
              // intentionally omit slug/path/body/etag
            },
          }),
          stderr: '',
        });
      });

      const bean = await service.showBean('test-abc1');

      expect(bean.id).toBe('test-abc1');
      expect(bean.slug).toBe('');
      expect(bean.path).toBe('');
      expect(bean.body).toBe('');
      expect(bean.etag).toBe('');
    });
  });

  describe('createBean', () => {
    it('creates a bean with required fields', async () => {
      const mockBean = {
        id: 'new-xyz9',
        title: 'New Bean',
        slug: 'new-bean',
        path: 'beans/new-xyz9.md',
        body: '',
        status: 'todo',
        type: 'task',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.input.title).toBe('New Bean');
        expect(variables.input.type).toBe('task');
        callback(null, { stdout: JSON.stringify({ createBean: mockBean }), stderr: '' });
      });

      const bean = await service.createBean({
        title: 'New Bean',
        type: 'task',
      });

      expect(bean.title).toBe('New Bean');
    });

    it('creates a bean with all optional fields', async () => {
      const mockBean = {
        id: 'new-xyz9',
        title: 'New Bean',
        slug: 'new-bean',
        path: 'beans/new-xyz9.md',
        body: 'Description here',
        status: 'in-progress',
        type: 'feature',
        priority: 'high',
        parentId: 'parent-123',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.input.status).toBe('in-progress');
        expect(variables.input.priority).toBe('high');
        expect(variables.input.body).toBe('Description here');
        expect(variables.input.parent).toBe('parent-123');
        callback(null, { stdout: JSON.stringify({ createBean: mockBean }), stderr: '' });
      });

      await service.createBean({
        title: 'New Bean',
        type: 'feature',
        status: 'in-progress',
        priority: 'high',
        description: 'Description here',
        parent: 'parent-123',
      });
    });

    it('validates title is required', async () => {
      await expect(service.createBean({ title: '', type: 'task' })).rejects.toThrow('Bean title is required');
    });

    it('validates title length', async () => {
      await expect(
        service.createBean({
          title: 'x'.repeat(201),
          type: 'task',
        })
      ).rejects.toThrow('Bean title must be 200 characters or less');
    });

    it('validates type', async () => {
      await expect(service.createBean({ title: 'Test', type: 'invalid' })).rejects.toThrow('Invalid type');
    });

    it('validates status', async () => {
      await expect(service.createBean({ title: 'Test', type: 'task', status: 'invalid' })).rejects.toThrow(
        'Invalid status'
      );
    });

    it('validates priority', async () => {
      await expect(service.createBean({ title: 'Test', type: 'task', priority: 'invalid' })).rejects.toThrow(
        'Invalid priority'
      );
    });

    describe('frontmatter repair after creation', () => {
      it('repairs unquoted title containing a colon in the written file', async () => {
        const mockBean = {
          id: 'new-xyz9',
          title: 'Command palette: Reinitialize Copilot',
          slug: 'command-palette-reinitialize-copilot',
          path: '.beans/new-xyz9.md',
          body: '',
          status: 'todo',
          type: 'task',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          etag: 'etag1',
        };

        mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
          callback(null, { stdout: JSON.stringify({ createBean: mockBean }), stderr: '' });
        });

        // Simulate the file as written by the CLI — unquoted title with colon
        mockReadFile.mockResolvedValue(
          '---\ntitle: Command palette: Reinitialize Copilot\nstatus: todo\ntype: task\n---\n'
        );

        await service.createBean({
          title: 'Command palette: Reinitialize Copilot',
          type: 'task',
        });

        // writeFile must have been called with the title wrapped in double quotes
        const writeCalls = mockWriteFile.mock.calls.filter(
          c => typeof c[1] === 'string' && (c[1] as string).includes('title:')
        );
        expect(writeCalls.length).toBeGreaterThan(0);
        const written = writeCalls[0][1] as string;
        expect(written).toContain('title: "Command palette: Reinitialize Copilot"');
      });

      it('does not rewrite the file when title needs no quoting', async () => {
        const mockBean = {
          id: 'new-abc1',
          title: 'Simple title',
          slug: 'simple-title',
          path: '.beans/new-abc1.md',
          body: '',
          status: 'todo',
          type: 'task',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          etag: 'etag1',
        };

        mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
          callback(null, { stdout: JSON.stringify({ createBean: mockBean }), stderr: '' });
        });

        mockReadFile.mockResolvedValue('---\ntitle: Simple title\nstatus: todo\ntype: task\n---\n');

        await service.createBean({ title: 'Simple title', type: 'task' });

        // writeFile should NOT have been called for frontmatter repair
        const writeCalls = mockWriteFile.mock.calls.filter(
          c => typeof c[1] === 'string' && (c[1] as string).includes('title:')
        );
        expect(writeCalls.length).toBe(0);
      });

      it('repairs title with colon in batchCreateBeans', async () => {
        const mockBatch = {
          c0: {
            id: 'batch-001',
            title: 'Feature: new search',
            slug: 'feature-new-search',
            path: '.beans/batch-001.md',
            body: '',
            status: 'todo',
            type: 'task',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
            etag: 'etag1',
          },
        };

        mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
          callback(null, { stdout: JSON.stringify(mockBatch), stderr: '' });
        });

        mockReadFile.mockResolvedValue('---\ntitle: Feature: new search\nstatus: todo\ntype: task\n---\n');

        const results = await service.batchCreateBeans([{ title: 'Feature: new search', type: 'task' }]);

        expect(results[0].success).toBe(true);

        const writeCalls = mockWriteFile.mock.calls.filter(
          c => typeof c[1] === 'string' && (c[1] as string).includes('title:')
        );
        expect(writeCalls.length).toBeGreaterThan(0);
        const written = writeCalls[0][1] as string;
        expect(written).toContain('title: "Feature: new search"');
      });
    });
  });

  describe('updateBean', () => {
    it('updates bean status', async () => {
      const mockBean = {
        id: 'test-abc1',
        title: 'Test',
        slug: 'test',
        path: 'beans/test.md',
        body: '',
        status: 'completed',
        type: 'task',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.id).toBe('test-abc1');
        expect(variables.input.status).toBe('completed');
        callback(null, { stdout: JSON.stringify({ updateBean: mockBean }), stderr: '' });
      });

      await service.updateBean('test-abc1', { status: 'completed' });
    });

    it('updates multiple fields', async () => {
      const mockBean = {
        id: 'test-abc1',
        title: 'Test',
        slug: 'test',
        path: 'beans/test.md',
        body: '',
        status: 'in-progress',
        type: 'bug',
        priority: 'critical',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.input.status).toBe('in-progress');
        expect(variables.input.type).toBe('bug');
        expect(variables.input.priority).toBe('critical');
        callback(null, { stdout: JSON.stringify({ updateBean: mockBean }), stderr: '' });
      });

      await service.updateBean('test-abc1', {
        status: 'in-progress',
        type: 'bug',
        priority: 'critical',
      });
    });

    it('updates parent relationship', async () => {
      const mockBean = {
        id: 'test-abc1',
        title: 'Test',
        slug: 'test',
        path: 'beans/test.md',
        body: '',
        status: 'todo',
        type: 'task',
        parentId: 'parent-123',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.input.parent).toBe('parent-123');
        callback(null, { stdout: JSON.stringify({ updateBean: mockBean }), stderr: '' });
      });

      await service.updateBean('test-abc1', { parent: 'parent-123' });
    });

    it('falls back to show when update returns partial payload missing required fields', async () => {
      const fullBean = {
        id: 'test-abc1',
        title: 'Recovered Bean',
        slug: 'recovered-bean',
        path: 'beans/test-abc1.md',
        body: 'Recovered body',
        status: 'todo',
        type: 'task',
        parentId: 'parent-123',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        if (Array.isArray(args) && args.includes('graphql')) {
          const query = args[args.indexOf('graphql') + 2];
          if (query.includes('updateBean')) {
            callback(null, { stdout: JSON.stringify({ updateBean: { id: 'test-abc1' } }), stderr: '' });
            return;
          }
          if (query.includes('ShowBean')) {
            callback(null, { stdout: JSON.stringify({ bean: fullBean }), stderr: '' });
            return;
          }
        }

        callback(new Error('Unexpected command') as any, null);
      });

      const bean = await service.updateBean('test-abc1', { parent: 'parent-123' });
      expect(bean.id).toBe('test-abc1');
      expect(bean.title).toBe('Recovered Bean');
      expect(bean.parent).toBe('parent-123');
    });

    it('clears parent relationship explicitly', async () => {
      const mockBean = {
        id: 'test-abc1',
        title: 'Test',
        slug: 'test',
        path: 'beans/test.md',
        body: '',
        status: 'todo',
        type: 'task',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.input.parent).toBe('');
        callback(null, { stdout: JSON.stringify({ updateBean: mockBean }), stderr: '' });
      });

      await service.updateBean('test-abc1', { clearParent: true });
    });

    it('rejects updates that set and clear parent simultaneously', async () => {
      await expect(service.updateBean('test-abc1', { parent: 'parent-123', clearParent: true })).rejects.toThrow(
        'Cannot set parent and clear parent in the same update'
      );
    });

    it('updates blocking relationships', async () => {
      const mockBean = {
        id: 'test-abc1',
        title: 'Test',
        slug: 'test',
        path: 'beans/test.md',
        body: '',
        status: 'todo',
        type: 'task',
        blockingIds: ['block-1', 'block-2'],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.id).toBe('test-abc1');
        expect(variables.input.addBlocking).toEqual(['block-1', 'block-2']);
        callback(null, { stdout: JSON.stringify({ updateBean: mockBean }), stderr: '' });
      });

      await service.updateBean('test-abc1', { blocking: ['block-1', 'block-2'] });
    });

    it('validates status when updating', async () => {
      await expect(service.updateBean('test-abc1', { status: 'invalid' })).rejects.toThrow('Invalid status');
    });

    describe('recursive status propagation', () => {
      const parentId = 'parent-abc1';
      const childId = 'child-abc2';
      const grandChildId = 'grandchild-abc3';

      beforeEach(() => {
        mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
          if (args.includes('graphql')) {
            const query = args[args.indexOf('graphql') + 2];
            const vars = args.includes('--variables') ? JSON.parse(args[args.indexOf('--variables') + 1]) : {};

            if (query.includes('query ListBeans')) {
              const filter = vars.filter || {};
              const parentFilter = filter.parent;

              if (parentFilter === parentId) {
                callback(null, {
                  stdout: JSON.stringify({
                    beans: [
                      {
                        id: childId,
                        title: 'Child',
                        status: 'todo',
                        type: 'task',
                        parent: parentId,
                        slug: 'c',
                        path: 'c.md',
                        body: '',
                        createdAt: '2026-01-01T00:00:00Z',
                        updatedAt: '2026-01-02T00:00:00Z',
                        etag: 'e2',
                      },
                    ],
                  }),
                  stderr: '',
                });
              } else if (parentFilter === childId) {
                callback(null, {
                  stdout: JSON.stringify({
                    beans: [
                      {
                        id: grandChildId,
                        title: 'Grandchild',
                        status: 'todo',
                        type: 'task',
                        parent: childId,
                        slug: 'gc',
                        path: 'gc.md',
                        body: '',
                        createdAt: '2026-01-01T00:00:00Z',
                        updatedAt: '2026-01-02T00:00:00Z',
                        etag: 'e3',
                      },
                    ],
                  }),
                  stderr: '',
                });
              } else {
                callback(null, { stdout: JSON.stringify({ beans: [] }), stderr: '' });
              }
            } else if (query.includes('mutation UpdateBean')) {
              const id = vars.id;
              const input = vars.input || {};
              const status = input.status || 'todo';
              callback(null, {
                stdout: JSON.stringify({
                  updateBean: {
                    id,
                    title: 'Updated',
                    status,
                    type: 'task',
                    slug: 'u',
                    path: 'u.md',
                    body: '',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-01-02T00:00:00Z',
                    etag: 'eu',
                  },
                }),
                stderr: '',
              });
            } else if (query.includes('query ShowBean')) {
              const id = vars.id;
              callback(null, {
                stdout: JSON.stringify({
                  bean: {
                    id,
                    title: 'Shown',
                    status: 'todo',
                    type: 'task',
                    slug: 's',
                    path: 's.md',
                    body: '',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-01-02T00:00:00Z',
                    etag: 'es',
                  },
                }),
                stderr: '',
              });
            } else {
              callback(null, { stdout: JSON.stringify({}), stderr: '' });
            }
          } else {
            callback(null, { stdout: '{}', stderr: '' });
          }
        });
      });

      it('recursively completes children when parent is completed', async () => {
        await service.updateBean(parentId, { status: 'completed' });

        const updateCalls = mockExecFile.mock.calls.filter(
          call =>
            call[1].includes('graphql') &&
            call[1].some((arg: any) => typeof arg === 'string' && arg.includes('UpdateBean'))
        );
        expect(updateCalls).toHaveLength(3); // Parent, Child, Grandchild

        const parentUpdate = updateCalls.find(call =>
          call[1].some((arg: any) => typeof arg === 'string' && arg.includes(parentId))
        );
        const childUpdate = updateCalls.find(call =>
          call[1].some((arg: any) => typeof arg === 'string' && arg.includes(childId))
        );
        const grandChildUpdate = updateCalls.find(call =>
          call[1].some((arg: any) => typeof arg === 'string' && arg.includes(grandChildId))
        );

        expect(parentUpdate![1].some((arg: any) => typeof arg === 'string' && arg.includes('completed'))).toBe(true);
        expect(childUpdate![1].some((arg: any) => typeof arg === 'string' && arg.includes('completed'))).toBe(true);
        expect(grandChildUpdate![1].some((arg: any) => typeof arg === 'string' && arg.includes('completed'))).toBe(
          true
        );
      });

      it('propagates in-progress status to children', async () => {
        await service.updateBean(parentId, { status: 'in-progress' });

        const updateCalls = mockExecFile.mock.calls.filter(
          call =>
            call[1].includes('graphql') &&
            call[1].some((arg: any) => typeof arg === 'string' && arg.includes('UpdateBean'))
        );
        expect(updateCalls).toHaveLength(3);

        expect(
          updateCalls.every(call => call[1].some((arg: any) => typeof arg === 'string' && arg.includes('in-progress')))
        ).toBe(true);
      });

      it('propagates scrapped status to children', async () => {
        await service.updateBean(parentId, { status: 'scrapped' });

        const updateCalls = mockExecFile.mock.calls.filter(
          call =>
            call[1].includes('graphql') &&
            call[1].some((arg: any) => typeof arg === 'string' && arg.includes('UpdateBean'))
        );
        expect(updateCalls).toHaveLength(3);

        expect(
          updateCalls.every(call => call[1].some((arg: any) => typeof arg === 'string' && arg.includes('scrapped')))
        ).toBe(true);
      });

      it('reopens children when parent is reopened from completed', async () => {
        let updateCount = 0;
        mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
          if (args.includes('graphql')) {
            const query = args[args.indexOf('graphql') + 2];
            const vars = args.includes('--variables') ? JSON.parse(args[args.indexOf('--variables') + 1]) : {};

            if (query.includes('query ShowBean')) {
              const id = vars.id;
              callback(null, {
                stdout: JSON.stringify({
                  bean: {
                    id,
                    title: id === parentId ? 'Parent' : 'Child',
                    status: 'completed',
                    type: 'task',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-01-02T00:00:00Z',
                    etag: 'es',
                  },
                }),
                stderr: '',
              });
            } else if (query.includes('query ListBeans')) {
              if (vars.filter?.parent === parentId) {
                callback(null, {
                  stdout: JSON.stringify({
                    beans: [
                      {
                        id: childId,
                        title: 'Child',
                        status: 'completed',
                        type: 'task',
                        parent: parentId,
                        slug: 'c',
                        path: 'c.md',
                        body: '',
                        createdAt: '2026-01-01T00:00:00Z',
                        updatedAt: '2026-01-02T00:00:00Z',
                        etag: 'e2',
                      },
                    ],
                  }),
                  stderr: '',
                });
              } else {
                callback(null, { stdout: JSON.stringify({ beans: [] }), stderr: '' });
              }
            } else if (query.includes('mutation UpdateBean')) {
              updateCount++;
              callback(null, {
                stdout: JSON.stringify({
                  updateBean: {
                    id: vars.id,
                    title: 'Updated',
                    status: 'todo',
                    type: 'task',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-01-02T00:00:00Z',
                    etag: 'eu',
                  },
                }),
                stderr: '',
              });
            }
          } else {
            callback(null, { stdout: JSON.stringify({ beans: [] }), stderr: '' });
          }
        });

        await service.updateBean(parentId, { status: 'todo' });

        expect(updateCount).toBe(2); // Parent and Child
      });

      it('propagates status when moving out of draft', async () => {
        mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
          if (args.includes('graphql')) {
            const query = args[args.indexOf('graphql') + 2];
            const vars = args.includes('--variables') ? JSON.parse(args[args.indexOf('--variables') + 1]) : {};

            if (query.includes('query ListBeans')) {
              const filter = vars.filter || {};
              const parentFilter = filter.parent;
              if (parentFilter === parentId) {
                callback(null, {
                  stdout: JSON.stringify({
                    beans: [
                      {
                        id: childId,
                        title: 'Child',
                        status: 'draft',
                        type: 'task',
                        parent: parentId,
                        slug: 'c',
                        path: 'c.md',
                        body: '',
                        createdAt: '2026-01-01T00:00:00Z',
                        updatedAt: '2026-01-02T00:00:00Z',
                        etag: 'e2',
                      },
                    ],
                  }),
                  stderr: '',
                });
              } else if (parentFilter === childId) {
                callback(null, {
                  stdout: JSON.stringify({
                    beans: [
                      {
                        id: grandChildId,
                        title: 'Grandchild',
                        status: 'draft',
                        type: 'task',
                        parent: childId,
                        slug: 'gc',
                        path: 'gc.md',
                        body: '',
                        createdAt: '2026-01-01T00:00:00Z',
                        updatedAt: '2026-01-02T00:00:00Z',
                        etag: 'e3',
                      },
                    ],
                  }),
                  stderr: '',
                });
              } else {
                callback(null, { stdout: JSON.stringify({ beans: [] }), stderr: '' });
              }
            } else if (query.includes('mutation UpdateBean')) {
              const id = vars.id;
              const input = vars.input || {};
              const status = input.status || 'todo';
              callback(null, {
                stdout: JSON.stringify({
                  updateBean: {
                    id,
                    title: 'Updated',
                    status,
                    type: 'task',
                    slug: 'u',
                    path: 'u.md',
                    body: '',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-01-02T00:00:00Z',
                    etag: 'eu',
                  },
                }),
                stderr: '',
              });
            } else {
              callback(null, { stdout: JSON.stringify({ beans: [] }), stderr: '' });
            }
          }
        });

        await service.updateBean(parentId, { status: 'todo' });

        const updateCalls = mockExecFile.mock.calls.filter(
          call =>
            call[1].includes('graphql') &&
            call[1].some((arg: any) => typeof arg === 'string' && arg.includes('UpdateBean'))
        );
        expect(updateCalls).toHaveLength(3);
        expect(
          updateCalls.every(call => call[1].some((arg: any) => typeof arg === 'string' && arg.includes('todo')))
        ).toBe(true);
      });

      it('does not update children if their status already matches', async () => {
        mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
          if (args.includes('graphql')) {
            const query = args[args.indexOf('graphql') + 2];
            const vars = args.includes('--variables') ? JSON.parse(args[args.indexOf('--variables') + 1]) : {};

            if (query.includes('query ListBeans')) {
              callback(null, {
                stdout: JSON.stringify({
                  beans: [
                    {
                      id: childId,
                      title: 'Child',
                      status: 'in-progress',
                      type: 'task',
                      createdAt: '2026-01-01T00:00:00Z',
                      updatedAt: '2026-01-02T00:00:00Z',
                      etag: 'e2',
                    },
                  ],
                }),
                stderr: '',
              });
            } else if (query.includes('mutation UpdateBean')) {
              callback(null, {
                stdout: JSON.stringify({
                  updateBean: {
                    id: vars.id,
                    title: 'Updated',
                    status: 'in-progress',
                    type: 'task',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-01-02T00:00:00Z',
                    etag: 'eu',
                  },
                }),
                stderr: '',
              });
            } else if (query.includes('query ShowBean')) {
              callback(null, {
                stdout: JSON.stringify({
                  bean: {
                    id: vars.id,
                    title: 'Shown',
                    status: 'todo',
                    type: 'task',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-01-02T00:00:00Z',
                    etag: 'es',
                  },
                }),
                stderr: '',
              });
            } else {
              callback(null, { stdout: JSON.stringify({ beans: [] }), stderr: '' });
            }
          }
        });

        await service.updateBean(parentId, { status: 'in-progress' });

        const updateCalls = mockExecFile.mock.calls.filter(
          call =>
            call[1].includes('graphql') &&
            call[1].some((arg: any) => typeof arg === 'string' && arg.includes('UpdateBean'))
        );
        expect(updateCalls).toHaveLength(1); // Only Parent
        expect(updateCalls[0][1].some((arg: any) => typeof arg === 'string' && arg.includes(parentId))).toBe(true);
      });
    });
  });

  describe('deleteBean', () => {
    it('deletes a bean by ID', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.id).toBe('test-abc1');
        callback(null, { stdout: JSON.stringify({ deleteBean: true }), stderr: '' });
      });

      await service.deleteBean('test-abc1');
    });
  });

  describe('batch operations', () => {
    it('batch creates multiple beans', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const variables = JSON.parse(args[args.indexOf('--variables') + 1]);
        expect(variables.c0.title).toBe('Bean 1');
        expect(variables.c1.title).toBe('Bean 2');

        const mockResponse = {
          c0: {
            id: 'test-1',
            title: 'Bean 1',
            slug: 'bean-1',
            path: 'beans/test-1.md',
            body: '',
            status: 'todo',
            type: 'task',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
            etag: 'etag1',
          },
          c1: {
            id: 'test-2',
            title: 'Bean 2',
            slug: 'bean-2',
            path: 'beans/test-2.md',
            body: '',
            status: 'todo',
            type: 'bug',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
            etag: 'etag12',
          },
        };
        callback(null, { stdout: JSON.stringify(mockResponse), stderr: '' });
      });

      const results = await service.batchCreateBeans([
        { title: 'Bean 1', type: 'task' },
        { title: 'Bean 2', type: 'bug' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      if (results[0].success) {
        expect(results[0].bean.id).toBe('test-1');
      }
    });

    it('batch creates multiple beans with partial failures', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');

        const mockResponse = {
          c0: {
            id: 'test-1',
            title: 'Bean 1',
            slug: 'bean-1',
            path: 'beans/test-1.md',
            body: '',
            status: 'todo',
            type: 'task',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
            etag: 'etag1',
          },
          c1: null,
          c2: {
            id: 'test-3',
            title: 'Bean 3',
            slug: 'bean-3',
            path: 'beans/test-3.md',
            body: '',
            status: 'todo',
            type: 'feature',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
            etag: 'etag3',
          },
        };

        callback(null, { stdout: JSON.stringify(mockResponse), stderr: '' });
      });

      const results = await service.batchCreateBeans([
        { title: 'Bean 1', type: 'task' },
        { title: 'Bean 2', type: 'invalid' },
        { title: 'Bean 3', type: 'feature' },
      ]);

      expect(results).toHaveLength(3);

      // First bean should succeed
      expect(results[0].success).toBe(true);
      if (results[0].success) {
        expect(results[0].bean.id).toBe('test-1');
        expect(results[0].bean.title).toBe('Bean 1');
      }

      // Second bean should fail (null response = missing alias)
      expect(results[1].success).toBe(false);
      if (!results[1].success) {
        expect(results[1].error).toBeDefined();
        expect(results[1].error).toBeInstanceOf(Error);
        expect(results[1].error.message).toContain('Mutation results missing for alias');
        expect((results[1] as any).bean).toBeUndefined();
      }

      // Third bean should succeed
      expect(results[2].success).toBe(true);
      if (results[2].success) {
        expect(results[2].bean.id).toBe('test-3');
        expect(results[2].bean.title).toBe('Bean 3');
      }
    });

    it('maps per-alias errors to individual results', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');

        const mockResponse = {
          c0: {
            id: 'test-1',
            title: 'Bean 1',
            slug: 'bean-1',
            path: 'beans/test-1.md',
            body: '',
            status: 'todo',
            type: 'task',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
            etag: 'etag1',
          },
          c1: null,
          errors: [
            {
              message: 'Failed to create bean 2',
              path: ['c1', 'createBean'],
            },
          ],
        };

        callback(null, { stdout: JSON.stringify(mockResponse), stderr: '' });
      });

      const results = await service.batchCreateBeans([
        { title: 'Bean 1', type: 'task' },
        { title: 'Bean 2', type: 'bug' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      if (results[0].success) {
        expect(results[0].bean.id).toBe('test-1');
      } else {
        throw new Error('expected first batch result to be successful');
      }

      // c1 should be marked as failed with accompanying error
      expect(results[1].success).toBe(false);
      if (!results[1].success) {
        expect(results[1].error).toBeDefined();
        expect((results[1] as any).bean).toBeUndefined();
      } else {
        throw new Error('expected second batch result to be a failure');
      }
    });

    it('maps per-alias errors when error path is alias-only', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');

        const mockResponse = {
          c0: {
            id: 'test-1',
            title: 'Bean 1',
            slug: 'bean-1',
            path: 'beans/test-1.md',
            body: '',
            status: 'todo',
            type: 'task',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
            etag: 'etag1',
          },
          c1: null,
          errors: [
            {
              message: 'Failed to create bean 2',
              path: ['c1'],
            },
          ],
        };

        callback(null, { stdout: JSON.stringify(mockResponse), stderr: '' });
      });

      const results = await service.batchCreateBeans([
        { title: 'Bean 1', type: 'task' },
        { title: 'Bean 2', type: 'bug' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      if (results[0].success) {
        expect(results[0].bean.id).toBe('test-1');
      }

      expect(results[1].success).toBe(false);
      if (!results[1].success) {
        expect(results[1].error).toBeDefined();
        expect((results[1] as any).bean).toBeUndefined();
      }
    });

    it('batch updates multiple beans', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const query = args[args.indexOf('graphql') + 2];
        expect(query).toContain('u0: updateBean');
        expect(query).toContain('u1: updateBean');

        const mockResponse = {
          u0: {
            id: 'bean-1',
            status: 'completed',
            title: 'T1',
            type: 'task',
            slug: 't1',
            path: 'beans/t1.md',
            body: '',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
            etag: 'e1',
          },
          u1: {
            id: 'bean-2',
            status: 'completed',
            title: 'T2',
            type: 'task',
            slug: 't2',
            path: 'beans/t2.md',
            body: '',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
            etag: 'e2',
          },
        };
        callback(null, { stdout: JSON.stringify(mockResponse), stderr: '' });
      });

      const results = await service.batchUpdateBeans([
        { id: 'bean-1', updates: { status: 'completed' } },
        { id: 'bean-2', updates: { status: 'completed' } },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('batch deletes multiple beans', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        const query = args[args.indexOf('graphql') + 2];
        expect(query).toContain('d0: deleteBean');
        expect(query).toContain('d1: deleteBean');

        const mockResponse = {
          d0: true,
          d1: true,
        };
        callback(null, { stdout: JSON.stringify(mockResponse), stderr: '' });
      });

      const results = await service.batchDeleteBeans(['bean-1', 'bean-2']);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('init', () => {
    it('passes --json flag so output can be parsed as JSON', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('--json');
        callback(null, {
          stdout: JSON.stringify({ success: true, message: 'Initialized .beans directory', path: '/test/.beans' }),
          stderr: '',
        });
      });

      await service.init();
    });

    it('initializes workspace without options', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('init');
        callback(null, {
          stdout: JSON.stringify({ success: true, message: 'Initialized .beans directory', path: '/test/.beans' }),
          stderr: '',
        });
      });

      await service.init();
    });

    it('initializes workspace with options', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('--prefix');
        expect(args).toContain('custom');
        expect(args).toContain('--default-type');
        expect(args).toContain('bug');
        callback(null, {
          stdout: JSON.stringify({ success: true, message: 'Initialized .beans directory', path: '/test/.beans' }),
          stderr: '',
        });
      });

      await service.init({ prefix: 'custom', defaultType: 'bug' });
    });
  });

  describe('prime', () => {
    it('returns guidance text', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('graphql');
        expect(args).toContain('--schema');
        callback(null, { stdout: 'Guidance text here\n', stderr: '' });
      });

      const guidance = await service.graphqlSchema();
      expect(guidance).toBe('Guidance text here');
    });
  });

  describe('error handling', () => {
    it('throws BeansCLINotFoundError when CLI not found', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const error = createErrnoError('ENOENT', 'ENOENT');
        callback(error, null);
      });

      await expect(service.showBean('test-abc1')).rejects.toThrow(BeansCLINotFoundError);
    });

    it('throws BeansTimeoutError on timeout', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const error = createTimeoutError('Timeout');
        callback(error, null);
      });

      await expect(service.showBean('test-abc1')).rejects.toThrow(BeansTimeoutError);
    });

    it('throws BeansJSONParseError on invalid JSON', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: 'invalid json', stderr: '' });
      });

      await expect(service.showBean('test-abc1')).rejects.toThrow(BeansJSONParseError);
    });

    it('handles beans missing required fields without failing the whole list', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify({ beans: [{ id: 'test' }] }), stderr: '' });
      });

      const beans = await service.listBeans();
      expect(beans).toEqual([]);
      expect(mockRename).not.toHaveBeenCalled();
    });

    it('falls back to current time for invalid date values', async () => {
      vi.useFakeTimers();
      try {
        const now = new Date('2026-02-17T00:00:00.000Z');
        vi.setSystemTime(now);

        mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
          callback(null, {
            stdout: JSON.stringify({
              beans: [
                {
                  id: 'test-abc1',
                  title: 'Test',
                  slug: 'test',
                  path: 'beans/test.md',
                  body: '',
                  status: 'todo',
                  type: 'task',
                  createdAt: 'not-a-date',
                  updatedAt: 'still-not-a-date',
                  etag: 'etag1',
                },
              ],
            }),
            stderr: '',
          });
        });

        const beans = await service.listBeans();
        expect(beans[0].createdAt.toISOString()).toBe(now.toISOString());
        expect(beans[0].updatedAt.toISOString()).toBe(now.toISOString());
      } finally {
        vi.useRealTimers();
      }
    });

    it('extracts clean error message from CLI non-zero exit (strips command boilerplate)', async () => {
      const stderr =
        'Error: graphql: feature beans can only have milestone or epic as parent, not feature\n' +
        'Usage: beans graphql <query> [flags]\n' +
        'Aliases: graphql, query\n' +
        'Flags:\n' +
        '  -h, --help   help for graphql';
      const cliError = Object.assign(
        new Error(`Command failed: beans graphql --json fragment BeanFields on Bean {...}\n${stderr}`),
        { code: 1, stderr, stdout: '' }
      );

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(cliError as any, null);
      });

      await expect(service.updateBean('test-abc1', { parent: 'other-abc1' })).rejects.toMatchObject({
        message: 'graphql: feature beans can only have milestone or epic as parent, not feature',
      });
    });

    it('falls back to raw message when CLI error has no parseable stderr line', async () => {
      const cliError = Object.assign(new Error('Command failed: beans graphql --json some-query'), {
        code: 1,
        stderr: '',
        stdout: '',
      });

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(cliError as any, null);
      });

      await expect(service.updateBean('test-abc1', { parent: 'other-abc1' })).rejects.toMatchObject({
        message: expect.stringContaining('Command failed'),
      });
    });

    it('accepts partial list payloads from CLI and applies safe defaults', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        if (Array.isArray(args) && args.includes('graphql')) {
          callback(null, {
            stdout: JSON.stringify({
              beans: [
                {
                  id: 'test-abc1',
                  title: 'Test Bean',
                  status: 'todo',
                  type: 'task',
                  // GraphQL fields are camelCase
                },
              ],
            }),
            stderr: '',
          });
          return;
        }

        callback(new Error('unexpected command') as any, null);
      });

      const beans = await service.listBeans();

      expect(beans).toHaveLength(1);
      expect(beans[0].id).toBe('test-abc1');
      expect(beans[0].slug).toBe('');
      expect(beans[0].path).toBe('');
      expect(beans[0].body).toBe('');
      expect(beans[0].etag).toBe('');
    });
  });

  describe('request deduplication', () => {
    it('deduplicates concurrent identical requests', async () => {
      let execCount = 0;
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        execCount++;
        setTimeout(() => {
          const mockBean = {
            id: 'test-abc1',
            title: 'Test',
            slug: 'test',
            path: 'beans/test.md',
            body: '',
            status: 'todo',
            type: 'task',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
            etag: 'etag1',
          };
          callback(null, { stdout: JSON.stringify({ bean: mockBean }), stderr: '' });
        }, 10);
      });

      // Make two concurrent requests
      const [result1, result2] = await Promise.all([service.showBean('test-abc1'), service.showBean('test-abc1')]);

      // Only one execution should occur
      expect(execCount).toBe(1);
      expect(result1.id).toBe(result2.id);
    });
  });

  describe('cache management', () => {
    it('clearCache clears cached data', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, {
          stdout: JSON.stringify({
            beans: [
              {
                id: 'test-abc1',
                title: 'Test',
                slug: 'test',
                path: 'beans/test.md',
                body: '',
                status: 'todo',
                type: 'task',
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-02T00:00:00Z',
                etag: 'etag1',
              },
            ],
          }),
          stderr: '',
        });
      });

      // Populate cache
      await service.listBeans();

      // Clear cache
      service.clearCache();

      // Next call with error should fail (no cache)
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        const error = createErrnoError('ENOENT', 'ENOENT');
        callback(error, null);
      });

      await expect(service.listBeans()).rejects.toThrow();
    });
  });

  describe('getConfig', () => {
    it('returns config with defaults', async () => {
      const config = await service.getConfig();

      expect(config.path).toBe('.beans');
      expect(config.prefix).toBe('bean');
      expect(config.statuses).toContain('todo');
      expect(config.types).toContain('task');
      expect(config.priorities).toContain('normal');
    });
  });
});
