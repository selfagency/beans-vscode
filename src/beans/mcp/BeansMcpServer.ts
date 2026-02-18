import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { z } from 'zod';
import { buildBeansCopilotInstructions, writeBeansCopilotInstructions } from '../config/CopilotInstructions';
import * as graphql from '../service/graphql';

const execFileAsync = promisify(execFile);

type SortMode = 'status-priority-type-title' | 'updated' | 'created' | 'id';

type BeanRecord = {
  id: string;
  slug: string;
  path: string;
  title: string;
  body: string;
  status: string;
  type: string;
  priority?: string;
  tags?: string[];
  parentId?: string;
  blockingIds?: string[];
  blockedByIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  etag?: string;
};

const DEFAULT_MCP_PORT = 39173;

function makeTextAndStructured<T extends Record<string, unknown>>(value: T) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

class BeansCliBackend {
  constructor(
    private readonly workspaceRoot: string,
    private readonly cliPath: string
  ) {}

  private getBeansRoot(): string {
    return resolve(this.workspaceRoot, '.beans');
  }

  private resolveBeanFilePath(relativePath: string): string {
    const cleaned = relativePath.trim().replace(/^\/+/, '');
    if (!cleaned) {
      throw new Error('Path is required');
    }

    const beansRoot = this.getBeansRoot();
    const target = resolve(beansRoot, cleaned);
    const relativeTarget = relative(beansRoot, target);

    if (relativeTarget.startsWith('..')) {
      throw new Error('Path must stay within .beans directory');
    }

    return target;
  }

  /**
   * Execute a GraphQL query via the Beans CLI.
   */
  private async executeGraphQL<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<{ data: T; errors?: any[] }> {
    const args = ['graphql', '--json', query];

    if (variables) {
      args.push('--variables', JSON.stringify(variables));
    }

    const { stdout } = await execFileAsync(this.cliPath, args, {
      cwd: this.workspaceRoot,
      env: this.getSafeEnv(),
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });

    try {
      return JSON.parse(stdout) as { data: T; errors?: any[] };
    } catch (error) {
      throw new Error(
        `Failed to parse Beans CLI GraphQL output: ${(error as Error).message}\nOutput: ${stdout.slice(0, 1000)}`
      );
    }
  }

  async init(prefix?: string): Promise<Record<string, unknown>> {
    const args = ['init'];
    if (prefix) {
      args.push('--prefix', prefix);
    }
    await execFileAsync(this.cliPath, args, {
      cwd: this.workspaceRoot,
      env: this.getSafeEnv(),
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });

    return { initialized: true };
  }

  async list(options?: { status?: string[]; type?: string[]; search?: string }): Promise<BeanRecord[]> {
    const filter: Record<string, any> = {};

    if (options?.status && options.status.length > 0) {
      filter.status = options.status;
    }

    if (options?.type && options.type.length > 0) {
      filter.type = options.type;
    }

    if (options?.search) {
      filter.search = options.search;
    }

    const { data, errors } = await this.executeGraphQL<{ beans: BeanRecord[] }>(graphql.LIST_BEANS_QUERY, { filter });

    if (errors && errors.length > 0) {
      throw new Error(`GraphQL error: ${errors.map(e => e.message).join(', ')}`);
    }

    return data.beans;
  }

  async show(beanId: string): Promise<BeanRecord> {
    const { data, errors } = await this.executeGraphQL<{ bean: BeanRecord }>(graphql.SHOW_BEAN_QUERY, { id: beanId });

    if (errors && errors.length > 0) {
      throw new Error(`GraphQL error: ${errors.map(e => e.message).join(', ')}`);
    }

    if (!data.bean) {
      throw new Error(`Bean not found: ${beanId}`);
    }

    return data.bean;
  }

  async create(input: {
    title: string;
    type: string;
    status?: string;
    priority?: string;
    description?: string;
    parent?: string;
  }): Promise<BeanRecord> {
    const createInput: Record<string, unknown> = {
      title: input.title,
      type: input.type,
      status: input.status,
      priority: input.priority,
      body: input.description,
      parent: input.parent,
    };

    const { data, errors } = await this.executeGraphQL<{ createBean: BeanRecord }>(graphql.CREATE_BEAN_MUTATION, {
      input: createInput,
    });

    if (errors && errors.length > 0) {
      throw new Error(`GraphQL error: ${errors.map(e => e.message).join(', ')}`);
    }

    return data.createBean;
  }

  async update(
    beanId: string,
    updates: {
      status?: string;
      type?: string;
      priority?: string;
      parent?: string;
      clearParent?: boolean;
      blocking?: string[];
      blockedBy?: string[];
    }
  ): Promise<BeanRecord> {
    const updateInput: Record<string, unknown> = {
      status: updates.status,
      type: updates.type,
      priority: updates.priority,
    };

    if (updates.parent !== undefined) {
      updateInput.parent = updates.parent;
    } else if (updates.clearParent) {
      updateInput.parent = '';
    }

    if (updates.blocking) {
      updateInput.addBlocking = updates.blocking;
    }

    if (updates.blockedBy) {
      updateInput.addBlockedBy = updates.blockedBy;
    }

    const { data, errors } = await this.executeGraphQL<{ updateBean: BeanRecord }>(graphql.UPDATE_BEAN_MUTATION, {
      id: beanId,
      input: updateInput,
    });

    if (errors && errors.length > 0) {
      throw new Error(`GraphQL error: ${errors.map(e => e.message).join(', ')}`);
    }

    return data.updateBean;
  }

  async delete(beanId: string): Promise<Record<string, unknown>> {
    const { errors } = await this.executeGraphQL<{ deleteBean: boolean }>(graphql.DELETE_BEAN_MUTATION, { id: beanId });

    if (errors && errors.length > 0) {
      throw new Error(`GraphQL error: ${errors.map(e => e.message).join(', ')}`);
    }

    return { deleted: true, beanId };
  }

  async openConfig(): Promise<{ configPath: string; content: string }> {
    const configPath = join(this.workspaceRoot, '.beans.yml');
    const content = await readFile(configPath, 'utf8');
    return { configPath, content };
  }

  async prime(): Promise<string> {
    const { stdout } = await execFileAsync(this.cliPath, ['graphql', '--schema'], {
      cwd: this.workspaceRoot,
      env: this.getSafeEnv(),
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });

    return stdout.trim();
  }

  async writeInstructions(content: string): Promise<string> {
    return writeBeansCopilotInstructions(this.workspaceRoot, content);
  }

  async readOutputLog(options?: { lines?: number }): Promise<{ path: string; content: string; linesReturned: number }> {
    const outputPath = resolve(
      process.env.BEANS_VSCODE_OUTPUT_LOG || join(this.workspaceRoot, '.beans', '.vscode', 'beans-output.log')
    );

    const relativePath = relative(this.workspaceRoot, outputPath);
    if (relativePath.startsWith('..')) {
      throw new Error('Output log path must stay within the workspace');
    }

    const maxLines = options?.lines && options.lines > 0 ? options.lines : 500;
    const ringBuffer: string[] = [];

    const stream = createReadStream(outputPath, { encoding: 'utf8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line) {
        continue;
      }

      ringBuffer.push(line);
      if (ringBuffer.length > maxLines) {
        ringBuffer.shift();
      }
    }

    return {
      path: outputPath,
      content: ringBuffer.join('\n'),
      linesReturned: ringBuffer.length,
    };
  }

  async readBeanFile(relativePath: string): Promise<{ path: string; content: string }> {
    const absolutePath = this.resolveBeanFilePath(relativePath);
    const content = await readFile(absolutePath, 'utf8');
    return { path: absolutePath, content };
  }

  async editBeanFile(relativePath: string, content: string): Promise<{ path: string; bytes: number }> {
    const absolutePath = this.resolveBeanFilePath(relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
    return { path: absolutePath, bytes: Buffer.byteLength(content, 'utf8') };
  }

  async createBeanFile(
    relativePath: string,
    content: string,
    options?: { overwrite?: boolean }
  ): Promise<{ path: string; bytes: number; created: boolean }> {
    const absolutePath = this.resolveBeanFilePath(relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });

    await writeFile(absolutePath, content, {
      encoding: 'utf8',
      flag: options?.overwrite ? 'w' : 'wx',
    });

    return {
      path: absolutePath,
      bytes: Buffer.byteLength(content, 'utf8'),
      created: true,
    };
  }

  async deleteBeanFile(relativePath: string): Promise<{ path: string; deleted: boolean }> {
    const absolutePath = this.resolveBeanFilePath(relativePath);
    await rm(absolutePath, { force: false });
    return { path: absolutePath, deleted: true };
  }
}

export function sortBeans(beans: BeanRecord[], mode: SortMode): BeanRecord[] {
  const sorted = [...beans];
  const statusWeight: Record<string, number> = {
    'in-progress': 0,
    todo: 1,
    draft: 2,
    completed: 3,
    scrapped: 4,
  };
  const priorityWeight: Record<string, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
    deferred: 4,
  };
  const typeWeight: Record<string, number> = {
    milestone: 0,
    epic: 1,
    feature: 2,
    bug: 3,
    task: 4,
  };

  if (mode === 'updated') {
    return sorted.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  if (mode === 'created') {
    return sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  if (mode === 'id') {
    return sorted.sort((a, b) => a.id.localeCompare(b.id));
  }

  return sorted.sort((a, b) => {
    const statusCmp = (statusWeight[a.status] ?? 99) - (statusWeight[b.status] ?? 99);
    if (statusCmp !== 0) {
      return statusCmp;
    }

    const aPriority = a.priority || 'normal';
    const bPriority = b.priority || 'normal';
    const priorityCmp = (priorityWeight[aPriority] ?? 99) - (priorityWeight[bPriority] ?? 99);
    if (priorityCmp !== 0) {
      return priorityCmp;
    }

    const typeCmp = (typeWeight[a.type] ?? 99) - (typeWeight[b.type] ?? 99);
    if (typeCmp !== 0) {
      return typeCmp;
    }

    return a.title.localeCompare(b.title);
  });
}

export function parseCliArgs(argv: string[]): { workspaceRoot: string; cliPath: string; port: number } {
  let workspaceRoot = process.cwd();
  let cliPath = 'beans';
  const envPort = Number.parseInt(process.env.BEANS_VSCODE_MCP_PORT || process.env.BEANS_MCP_PORT || '', 10);
  let port = Number.isInteger(envPort) && envPort > 0 ? envPort : DEFAULT_MCP_PORT;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--workspace' && argv[i + 1]) {
      workspaceRoot = argv[i + 1]!;
      i += 1;
    } else if (arg === '--cli-path' && argv[i + 1]) {
      cliPath = argv[i + 1]!;
      if (/[\s;&|><$(){}\[\]`]/.test(cliPath)) {
        throw new Error('Invalid CLI path');
      }
      i += 1;
    } else if (arg === '--port' && argv[i + 1]) {
      const parsedPort = Number.parseInt(argv[i + 1]!, 10);
      if (Number.isInteger(parsedPort) && parsedPort > 0) {
        port = parsedPort;
      }
      i += 1;
    }
  }

  return { workspaceRoot, cliPath, port };
}

const MAX_ID_LENGTH = 128;
const MAX_TITLE_LENGTH = 1024;
const MAX_METADATA_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 65536; // 64KB
const MAX_PATH_LENGTH = 1024;

function registerTools(server: McpServer, backend: BeansCliBackend): void {
  server.registerTool(
    'beans_vscode_init',
    {
      title: 'Initialize Beans Workspace',
      description: 'Initialize Beans in the current workspace, equivalent to the extension init command.',
      inputSchema: z.object({
        prefix: z.string().max(32).optional().describe('Optional workspace prefix for bean IDs'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ prefix }: { prefix?: string }) => {
      const result = await backend.init(prefix);
      return makeTextAndStructured(result);
    }
  );

  server.registerTool(
    'beans_vscode_refresh',
    {
      title: 'Refresh Beans',
      description: 'Refresh equivalent: returns current beans snapshot.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const beans = await backend.list();
      return makeTextAndStructured({ count: beans.length, beans });
    }
  );

  server.registerTool(
    'beans_vscode_view',
    {
      title: 'View Bean',
      description: 'Fetch full bean details by ID.',
      inputSchema: z.object({ beanId: z.string().min(1).max(MAX_ID_LENGTH) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ beanId }: { beanId: string }) => makeTextAndStructured({ bean: await backend.show(beanId) })
  );

  server.registerTool(
    'beans_vscode_create',
    {
      title: 'Create Bean',
      description: 'Create a new bean.',
      inputSchema: z.object({
        title: z.string().min(1).max(MAX_TITLE_LENGTH),
        type: z.string().min(1).max(MAX_METADATA_LENGTH),
        status: z.string().max(MAX_METADATA_LENGTH).optional(),
        priority: z.string().max(MAX_METADATA_LENGTH).optional(),
        description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
        parent: z.string().max(MAX_ID_LENGTH).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input: {
      title: string;
      type: string;
      status?: string;
      priority?: string;
      description?: string;
      parent?: string;
    }) => makeTextAndStructured({ bean: await backend.create(input) })
  );

  server.registerTool(
    'beans_vscode_edit',
    {
      title: 'Edit Bean Metadata',
      description: 'Update bean metadata fields (status/type/priority/parent/blocking).',
      inputSchema: z.object({
        beanId: z.string().min(1).max(MAX_ID_LENGTH),
        status: z.string().max(MAX_METADATA_LENGTH).optional(),
        type: z.string().max(MAX_METADATA_LENGTH).optional(),
        priority: z.string().max(MAX_METADATA_LENGTH).optional(),
        parent: z.string().max(MAX_ID_LENGTH).optional(),
        clearParent: z.boolean().optional(),
        blocking: z.array(z.string().max(MAX_ID_LENGTH)).optional(),
        blockedBy: z.array(z.string().max(MAX_ID_LENGTH)).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({
      beanId,
      ...updates
    }: {
      beanId: string;
      status?: string;
      type?: string;
      priority?: string;
      parent?: string;
      clearParent?: boolean;
      blocking?: string[];
      blockedBy?: string[];
    }) => makeTextAndStructured({ bean: await backend.update(beanId, updates) })
  );

  server.registerTool(
    'beans_vscode_set_status',
    {
      title: 'Set Bean Status',
      description: 'Set status for a bean.',
      inputSchema: z.object({
        beanId: z.string().min(1).max(MAX_ID_LENGTH),
        status: z.string().min(1).max(MAX_METADATA_LENGTH),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ beanId, status }: { beanId: string; status: string }) =>
      makeTextAndStructured({ bean: await backend.update(beanId, { status }) })
  );

  server.registerTool(
    'beans_vscode_reopen_completed',
    {
      title: 'Reopen Completed Bean',
      description: 'Reopen a completed bean into a non-closed status.',
      inputSchema: z.object({
        beanId: z.string().min(1).max(MAX_ID_LENGTH),
        targetStatus: z.string().max(MAX_METADATA_LENGTH).default('todo'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ beanId, targetStatus }: { beanId: string; targetStatus: string }) => {
      const bean = await backend.show(beanId);
      if (bean.status !== 'completed') {
        throw new Error(`Bean ${beanId} is not completed`);
      }
      return makeTextAndStructured({ bean: await backend.update(beanId, { status: targetStatus }) });
    }
  );

  server.registerTool(
    'beans_vscode_reopen_scrapped',
    {
      title: 'Reopen Scrapped Bean',
      description: 'Reopen a scrapped bean into a non-closed status.',
      inputSchema: z.object({
        beanId: z.string().min(1).max(MAX_ID_LENGTH),
        targetStatus: z.string().max(MAX_METADATA_LENGTH).default('todo'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ beanId, targetStatus }: { beanId: string; targetStatus: string }) => {
      const bean = await backend.show(beanId);
      if (bean.status !== 'scrapped') {
        throw new Error(`Bean ${beanId} is not scrapped`);
      }
      return makeTextAndStructured({ bean: await backend.update(beanId, { status: targetStatus }) });
    }
  );

  server.registerTool(
    'beans_vscode_set_type',
    {
      title: 'Set Bean Type',
      description: 'Set type for a bean.',
      inputSchema: z.object({
        beanId: z.string().min(1).max(MAX_ID_LENGTH),
        type: z.string().min(1).max(MAX_METADATA_LENGTH),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ beanId, type }: { beanId: string; type: string }) =>
      makeTextAndStructured({ bean: await backend.update(beanId, { type }) })
  );

  server.registerTool(
    'beans_vscode_set_priority',
    {
      title: 'Set Bean Priority',
      description: 'Set priority for a bean.',
      inputSchema: z.object({
        beanId: z.string().min(1).max(MAX_ID_LENGTH),
        priority: z.string().min(1).max(MAX_METADATA_LENGTH),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ beanId, priority }: { beanId: string; priority: string }) =>
      makeTextAndStructured({ bean: await backend.update(beanId, { priority }) })
  );

  server.registerTool(
    'beans_vscode_set_parent',
    {
      title: 'Set Bean Parent',
      description: 'Set parent for a bean.',
      inputSchema: z.object({
        beanId: z.string().min(1).max(MAX_ID_LENGTH),
        parentBeanId: z.string().min(1).max(MAX_ID_LENGTH),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ beanId, parentBeanId }: { beanId: string; parentBeanId: string }) =>
      makeTextAndStructured({ bean: await backend.update(beanId, { parent: parentBeanId }) })
  );

  server.registerTool(
    'beans_vscode_remove_parent',
    {
      title: 'Remove Bean Parent',
      description: 'Remove parent relationship from a bean.',
      inputSchema: z.object({ beanId: z.string().min(1).max(MAX_ID_LENGTH) }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ beanId }: { beanId: string }) =>
      makeTextAndStructured({ bean: await backend.update(beanId, { clearParent: true }) })
  );

  server.registerTool(
    'beans_vscode_edit_blocking',
    {
      title: 'Edit Blocking Relationships',
      description: 'Add or remove blocking/blocked-by relationships.',
      inputSchema: z.object({
        beanId: z.string().min(1).max(MAX_ID_LENGTH),
        relation: z.enum(['blocking', 'blocked_by']),
        operation: z.enum(['add', 'remove']),
        relatedBeanIds: z.array(z.string().min(1).max(MAX_ID_LENGTH)).min(1),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({
      beanId,
      relation,
      operation,
      relatedBeanIds,
    }: {
      beanId: string;
      relation: 'blocking' | 'blocked_by';
      operation: 'add' | 'remove';
      relatedBeanIds: string[];
    }) => {
      const bean = await backend.show(beanId);

      const currentBlocking = (bean.blockingIds as string[]) || [];
      const currentBlockedBy = (bean.blockedByIds as string[]) || [];

      const mutate = (current: string[]) => {
        if (operation === 'add') {
          return [...new Set([...current, ...relatedBeanIds])];
        }
        const removeSet = new Set(relatedBeanIds);
        return current.filter(id => !removeSet.has(id));
      };

      const updates =
        relation === 'blocking' ? { blocking: mutate(currentBlocking) } : { blockedBy: mutate(currentBlockedBy) };

      return makeTextAndStructured({ bean: await backend.update(beanId, updates) });
    }
  );

  server.registerTool(
    'beans_vscode_copy_id',
    {
      title: 'Copy Bean ID',
      description: 'Return bean ID and short code equivalent of copy-id command.',
      inputSchema: z.object({ beanId: z.string().min(1).max(MAX_ID_LENGTH) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ beanId }: { beanId: string }) => {
      const bean = await backend.show(beanId);
      const code = bean.id.split('-').pop() || bean.id;
      return makeTextAndStructured({ id: bean.id, code });
    }
  );

  server.registerTool(
    'beans_vscode_delete',
    {
      title: 'Delete Bean',
      description: 'Delete a bean (intended for draft/scrapped beans).',
      inputSchema: z.object({
        beanId: z.string().min(1).max(MAX_ID_LENGTH),
        force: z.boolean().default(false),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ beanId, force }: { beanId: string; force: boolean }) => {
      const bean = await backend.show(beanId);
      if (!force && bean.status !== 'draft' && bean.status !== 'scrapped') {
        throw new Error('Only draft and scrapped beans are deletable unless force=true');
      }
      return makeTextAndStructured(await backend.delete(beanId));
    }
  );

  server.registerTool(
    'beans_vscode_filter',
    {
      title: 'Filter Beans',
      description: 'Filter beans by status, type, and free-text search.',
      inputSchema: z.object({
        statuses: z.array(z.string().max(MAX_METADATA_LENGTH)).nullable().optional(),
        types: z.array(z.string().max(MAX_METADATA_LENGTH)).nullable().optional(),
        search: z.string().max(MAX_TITLE_LENGTH).optional(),
        tags: z.array(z.string().max(MAX_METADATA_LENGTH)).nullable().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({
      statuses,
      types,
      search,
      tags,
    }: {
      statuses?: string[] | null;
      types?: string[] | null;
      search?: string;
      tags?: string[] | null;
    }) => {
      const normalizedStatuses = Array.isArray(statuses) ? statuses : undefined;
      const normalizedTypes = Array.isArray(types) ? types : undefined;
      const normalizedTags = Array.isArray(tags) ? tags : undefined;

      let beans = await backend.list({ status: normalizedStatuses, type: normalizedTypes, search });
      if (normalizedTags && normalizedTags.length > 0) {
        const tagSet = new Set(normalizedTags);
        beans = beans.filter(bean => (bean.tags || []).some(tag => tagSet.has(tag)));
      }
      return makeTextAndStructured({ count: beans.length, beans });
    }
  );

  server.registerTool(
    'beans_vscode_search',
    {
      title: 'Search Beans',
      description: 'Search beans by text query.',
      inputSchema: z.object({
        query: z.string().min(1).max(MAX_TITLE_LENGTH),
        includeClosed: z.boolean().default(true),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, includeClosed }: { query: string; includeClosed: boolean }) => {
      let beans = await backend.list({ search: query });
      if (!includeClosed) {
        beans = beans.filter(bean => bean.status !== 'completed' && bean.status !== 'scrapped');
      }
      return makeTextAndStructured({ query, count: beans.length, beans });
    }
  );

  server.registerTool(
    'beans_vscode_sort',
    {
      title: 'Sort Beans',
      description: 'Sort beans using extension-supported sort modes.',
      inputSchema: z.object({
        mode: z.enum(['status-priority-type-title', 'updated', 'created', 'id']).default('status-priority-type-title'),
        statuses: z.array(z.string().max(MAX_METADATA_LENGTH)).nullable().optional(),
        types: z.array(z.string().max(MAX_METADATA_LENGTH)).nullable().optional(),
        search: z.string().max(MAX_TITLE_LENGTH).optional(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({
      mode,
      statuses,
      types,
      search,
    }: {
      mode: SortMode;
      statuses?: string[] | null;
      types?: string[] | null;
      search?: string;
    }) => {
      const normalizedStatuses = Array.isArray(statuses) ? statuses : undefined;
      const normalizedTypes = Array.isArray(types) ? types : undefined;
      const beans = await backend.list({ status: normalizedStatuses, type: normalizedTypes, search });
      return makeTextAndStructured({ mode, count: beans.length, beans: sortBeans(beans, mode) });
    }
  );

  server.registerTool(
    'beans_vscode_open_config',
    {
      title: 'Open Beans Config',
      description: 'Read `.beans.yml` content from workspace.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => makeTextAndStructured(await backend.openConfig())
  );

  server.registerTool(
    'beans_vscode_llm_context',
    {
      title: 'LLM Context for Beans Workflows',
      description:
        'Returns generated Copilot/LLM instructions based on `beans graphql --schema` and extension/MCP guidance; can optionally write instructions file to workspace.',
      inputSchema: z.object({
        writeToWorkspaceInstructions: z.boolean().default(false),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ writeToWorkspaceInstructions }: { writeToWorkspaceInstructions: boolean }) => {
      const primeOutput = await backend.prime();
      const generatedInstructions = buildBeansCopilotInstructions(primeOutput);
      const instructionsPath = writeToWorkspaceInstructions
        ? await backend.writeInstructions(generatedInstructions)
        : null;

      return makeTextAndStructured({
        primeOutput,
        generatedInstructions,
        instructionsPath,
      });
    }
  );

  server.registerTool(
    'beans_vscode_read_bean_file',
    {
      title: 'Read Bean File',
      description: 'Read a file directly from the .beans directory.',
      inputSchema: z.object({
        path: z.string().min(1).max(MAX_PATH_LENGTH).describe('Path relative to .beans, e.g. bean-id.md'),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ path }: { path: string }) => makeTextAndStructured(await backend.readBeanFile(path))
  );

  server.registerTool(
    'beans_vscode_edit_bean_file',
    {
      title: 'Edit Bean File',
      description: 'Overwrite a file in .beans with new content.',
      inputSchema: z.object({
        path: z.string().min(1).max(MAX_PATH_LENGTH).describe('Path relative to .beans'),
        content: z.string().max(MAX_DESCRIPTION_LENGTH).describe('Complete replacement content'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ path, content }: { path: string; content: string }) =>
      makeTextAndStructured(await backend.editBeanFile(path, content))
  );

  server.registerTool(
    'beans_vscode_create_bean_file',
    {
      title: 'Create Bean File',
      description: 'Create a new file under .beans (optionally overwrite).',
      inputSchema: z.object({
        path: z.string().min(1).max(MAX_PATH_LENGTH).describe('Path relative to .beans'),
        content: z.string().max(MAX_DESCRIPTION_LENGTH).describe('Initial file content'),
        overwrite: z.boolean().default(false),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ path, content, overwrite }: { path: string; content: string; overwrite: boolean }) =>
      makeTextAndStructured(await backend.createBeanFile(path, content, { overwrite }))
  );

  server.registerTool(
    'beans_vscode_delete_bean_file',
    {
      title: 'Delete Bean File',
      description: 'Delete a file under .beans.',
      inputSchema: z.object({
        path: z.string().min(1).max(MAX_PATH_LENGTH).describe('Path relative to .beans'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ path }: { path: string }) => makeTextAndStructured(await backend.deleteBeanFile(path))
  );

  server.registerTool(
    'beans_vscode_read_output',
    {
      title: 'Read Beans Output Log',
      description: 'Read mirrored output window contents from the extension log mirror file.',
      inputSchema: z.object({
        lines: z.number().int().min(1).max(5000).optional().describe('Optional number of trailing lines to return'),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ lines }: { lines?: number }) => makeTextAndStructured(await backend.readOutputLog({ lines }))
  );

  server.registerTool(
    'beans_vscode_show_output',
    {
      title: 'Show Output Guidance',
      description: 'Returns guidance for inspecting Beans extension logs.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      makeTextAndStructured({
        message:
          'When using VS Code UI, run command `Beans: Show Output` to open extension logs. In MCP mode, rely on tool error outputs and host logs.',
      })
  );
}

export async function startBeansMcpServer(argv: string[]): Promise<void> {
  const { workspaceRoot, cliPath, port } = parseCliArgs(argv);
  process.env.BEANS_VSCODE_MCP_PORT = String(port);
  process.env.BEANS_MCP_PORT = String(port);
  const backend = new BeansCliBackend(workspaceRoot, cliPath);

  const server = new McpServer({
    name: 'beans-mcp-server',
    version: '0.1.0',
  });

  registerTools(server, backend);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  startBeansMcpServer(process.argv.slice(2)).catch(error => {
    console.error('[beans-mcp-server] fatal:', error);
    process.exit(1);
  });
}
