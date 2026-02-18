import { execFile } from 'child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansCLINotFoundError, BeansJSONParseError, BeansTimeoutError } from '../../../beans/model';
import { BeansService } from '../../../beans/service';

// Mock child_process
vi.mock('child_process', () => ({
  execFile: vi.fn(),
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
        callback(null, { stdout: '{"initialized":true}', stderr: '' });
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
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      },
    ];

    it('lists all beans without filters', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify(mockBeanData), stderr: '' });
      });

      const beans = await service.listBeans();
      expect(beans).toHaveLength(1);
      expect(beans[0].id).toBe('test-abc1');
      expect(beans[0].code).toBe('abc1');
    });

    it('applies status filters', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('--status');
        expect(args).toContain('todo');
        callback(null, { stdout: JSON.stringify(mockBeanData), stderr: '' });
      });

      await service.listBeans({ status: ['todo'] });
    });

    it('applies type filters', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('--type');
        expect(args).toContain('task');
        callback(null, { stdout: JSON.stringify(mockBeanData), stderr: '' });
      });

      await service.listBeans({ type: ['task'] });
    });

    it('applies search filter', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('--search');
        expect(args).toContain('test');
        callback(null, { stdout: JSON.stringify(mockBeanData), stderr: '' });
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
        parent_id: 'parent-123',
        blocking_ids: ['block-1'],
        blocked_by_ids: ['blocked-1'],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify([rawBean]), stderr: '' });
      });

      const beans = await service.listBeans();
      expect(beans[0].parent).toBe('parent-123');
      expect(beans[0].blocking).toEqual(['block-1']);
      expect(beans[0].blockedBy).toEqual(['blocked-1']);
    });

    it('prioritizes blocked_by_ids over blocked_by when both exist', async () => {
      const rawBean = {
        id: 'test-xyz9',
        title: 'Test',
        slug: 'test',
        path: 'beans/test.md',
        body: '',
        status: 'todo',
        type: 'task',
        blocked_by: ['legacy'],
        blocked_by_ids: ['preferred'],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify([rawBean]), stderr: '' });
      });

      const beans = await service.listBeans();
      expect(beans[0].blockedBy).toEqual(['preferred']);
    });

    it('caches successful results', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify(mockBeanData), stderr: '' });
      });

      await service.listBeans();
      expect(service.isOffline()).toBe(false);

      // Clear cache to test it was set
      service.clearCache();
    });

    it('falls back to cache in offline mode', async () => {
      // First successful call to populate cache
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify(mockBeanData), stderr: '' });
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
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
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
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
          etag: 'etag2',
        },
      ];

      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify(cachedBeans), stderr: '' });
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
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('show');
        expect(args).toContain('test-abc1');
        callback(null, { stdout: JSON.stringify(mockBean), stderr: '' });
      });

      const bean = await service.showBean('test-abc1');
      expect(bean.id).toBe('test-abc1');
      expect(bean.code).toBe('abc1');
    });

    it('accepts partial show payloads from CLI and applies safe defaults', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('show');
        expect(args).toContain('test-abc1');
        callback(null, {
          stdout: JSON.stringify({
            id: 'test-abc1',
            title: 'Test Bean',
            status: 'todo',
            type: 'task',
            // show payload can be partial on some CLI versions;
            // intentionally omit slug/path/body/etag
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
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('create');
        expect(args).toContain('New Bean');
        expect(args).toContain('-t');
        expect(args).toContain('task');
        callback(null, { stdout: JSON.stringify(mockBean), stderr: '' });
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
        parent_id: 'parent-123',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('-s');
        expect(args).toContain('in-progress');
        expect(args).toContain('-p');
        expect(args).toContain('high');
        expect(args).toContain('-d');
        expect(args).toContain('Description here');
        expect(args).toContain('--parent');
        expect(args).toContain('parent-123');
        callback(null, { stdout: JSON.stringify(mockBean), stderr: '' });
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
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('update');
        expect(args).toContain('test-abc1');
        expect(args).toContain('-s');
        expect(args).toContain('completed');
        callback(null, { stdout: JSON.stringify(mockBean), stderr: '' });
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
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('-s');
        expect(args).toContain('in-progress');
        expect(args).toContain('-t');
        expect(args).toContain('bug');
        expect(args).toContain('-p');
        expect(args).toContain('critical');
        callback(null, { stdout: JSON.stringify(mockBean), stderr: '' });
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
        parent_id: 'parent-123',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('--parent');
        expect(args).toContain('parent-123');
        callback(null, { stdout: JSON.stringify(mockBean), stderr: '' });
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
        parent_id: 'parent-123',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        if (Array.isArray(args) && args.includes('update')) {
          callback(null, { stdout: JSON.stringify({ id: 'test-abc1' }), stderr: '' });
          return;
        }

        if (Array.isArray(args) && args.includes('show')) {
          callback(null, { stdout: JSON.stringify(fullBean), stderr: '' });
          return;
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
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('--parent');
        const parentFlagIndex = args.indexOf('--parent');
        expect(args[parentFlagIndex + 1]).toBe('');
        callback(null, { stdout: JSON.stringify(mockBean), stderr: '' });
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
        blocking_ids: ['block-1', 'block-2'],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
        etag: 'etag1',
      };

      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('--blocking');
        expect(args).toContain('block-1,block-2');
        callback(null, { stdout: JSON.stringify(mockBean), stderr: '' });
      });

      await service.updateBean('test-abc1', { blocking: ['block-1', 'block-2'] });
    });

    it('validates status when updating', async () => {
      await expect(service.updateBean('test-abc1', { status: 'invalid' })).rejects.toThrow('Invalid status');
    });
  });

  describe('deleteBean', () => {
    it('deletes a bean by ID', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('delete');
        expect(args).toContain('test-abc1');
        callback(null, { stdout: '{}', stderr: '' });
      });

      await service.deleteBean('test-abc1');
    });
  });

  describe('batch operations', () => {
    it('batch creates multiple beans', async () => {
      let callCount = 0;
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callCount++;
        const mockBean = {
          id: `test-${callCount}`,
          title: `Bean ${callCount}`,
          slug: `bean-${callCount}`,
          path: `beans/test-${callCount}.md`,
          body: '',
          status: 'todo',
          type: 'task',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
          etag: 'etag1',
        };
        callback(null, { stdout: JSON.stringify(mockBean), stderr: '' });
      });

      const results = await service.batchCreateBeans([
        { title: 'Bean 1', type: 'task' },
        { title: 'Bean 2', type: 'bug' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('handles partial failures in batch create', async () => {
      let callCount = 0;
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callCount++;
        if (callCount === 2) {
          callback(new Error('Failed to create'), null);
        } else {
          const mockBean = {
            id: `test-${callCount}`,
            title: `Bean ${callCount}`,
            slug: `bean-${callCount}`,
            path: `beans/test-${callCount}.md`,
            body: '',
            status: 'todo',
            type: 'task',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
            etag: 'etag1',
          };
          callback(null, { stdout: JSON.stringify(mockBean), stderr: '' });
        }
      });

      const results = await service.batchCreateBeans([
        { title: 'Bean 1', type: 'task' },
        { title: 'Bean 2', type: 'task' },
      ]);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });

    it('batch updates multiple beans', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        const id = args[args.indexOf('update') + 2];
        const mockBean = {
          id,
          title: 'Test',
          slug: 'test',
          path: `beans/${id}.md`,
          body: '',
          status: 'completed',
          type: 'task',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
          etag: 'etag1',
        };
        callback(null, { stdout: JSON.stringify(mockBean), stderr: '' });
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
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: '{}', stderr: '' });
      });

      const results = await service.batchDeleteBeans(['bean-1', 'bean-2']);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('init', () => {
    it('initializes workspace without options', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('init');
        callback(null, { stdout: '{}', stderr: '' });
      });

      await service.init();
    });

    it('initializes workspace with options', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('--prefix');
        expect(args).toContain('custom');
        expect(args).toContain('--default-type');
        expect(args).toContain('bug');
        callback(null, { stdout: '{}', stderr: '' });
      });

      await service.init({ prefix: 'custom', defaultType: 'bug' });
    });
  });

  describe('prime', () => {
    it('returns guidance text', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        expect(args).toContain('prime');
        callback(null, { stdout: 'Guidance text here\n', stderr: '' });
      });

      const guidance = await service.prime();
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

    it('throws BeansJSONParseError when bean missing required fields', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
        callback(null, { stdout: JSON.stringify([{ id: 'test' }]), stderr: '' });
      });

      await expect(service.listBeans()).rejects.toThrow(BeansJSONParseError);
    });

    it('falls back to current time for invalid date values', async () => {
      vi.useFakeTimers();
      try {
        const now = new Date('2026-02-17T00:00:00.000Z');
        vi.setSystemTime(now);

        mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
          callback(null, {
            stdout: JSON.stringify([
              {
                id: 'test-abc1',
                title: 'Test',
                slug: 'test',
                path: 'beans/test.md',
                body: '',
                status: 'todo',
                type: 'task',
                created_at: 'not-a-date',
                updated_at: 'still-not-a-date',
                etag: 'etag1',
              },
            ]),
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

    it('accepts partial list payloads from CLI and applies safe defaults', async () => {
      mockExecFile.mockImplementation((_cmd, args, _opts, callback) => {
        if (Array.isArray(args) && args.includes('list')) {
          callback(null, {
            stdout: JSON.stringify([
              {
                id: 'test-abc1',
                title: 'Test Bean',
                status: 'todo',
                type: 'task',
                // list payload can be partial; intentionally omit slug/path/body/etag
              },
            ]),
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
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
            etag: 'etag1',
          };
          callback(null, { stdout: JSON.stringify(mockBean), stderr: '' });
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
          stdout: JSON.stringify([
            {
              id: 'test-abc1',
              title: 'Test',
              slug: 'test',
              path: 'beans/test.md',
              body: '',
              status: 'todo',
              type: 'task',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-02T00:00:00Z',
              etag: 'etag1',
            },
          ]),
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
