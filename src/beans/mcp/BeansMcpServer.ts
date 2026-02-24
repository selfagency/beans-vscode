import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { z } from 'zod';
import { writeBeansCopilotInstructions } from '../config/CopilotInstructions';
import { handleQueryOperation, sortBeans as querySortBeans } from './internal/queryHelpers';
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

/**
 * GraphQL error shape as returned by the Beans CLI GraphQL endpoint.
 */
type GraphQLError = {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
};

const DEFAULT_MCP_PORT = 39173;

/**
 * Check whether `target` is contained within `root` after resolving both paths.
 * Guards against the Windows cross-drive bypass where `path.relative(root, target)`
 * returns an absolute path (e.g. `D:\evil`) that does not start with `..`.
 */
export function isPathWithinRoot(root: string, target: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  const rel = relative(resolvedRoot, resolvedTarget);
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel);
}

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

  /**
   * Returns a safe environment for executing the Beans CLI,
   * whitelisting only necessary variables.
   */
  private getSafeEnv(): NodeJS.ProcessEnv {
    const whitelist = ['PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'LC_CTYPE', 'SHELL'];
    const env: NodeJS.ProcessEnv = {};

    for (const key of whitelist) {
      if (process.env[key]) {
        env[key] = process.env[key];
      }
    }

    // Include BEANS_ variables
    for (const key in process.env) {
      if (key.startsWith('BEANS_')) {
        env[key] = process.env[key];
      }
    }

    return env;
  }

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

    if (!isPathWithinRoot(beansRoot, target)) {
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
  ): Promise<{ data: T; errors?: GraphQLError[] }> {
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
      // CLI outputs the data portion directly (e.g. {"beans": [...]})
      // without a {"data": ...} envelope.
      return { data: JSON.parse(stdout) as T };
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

  async graphqlSchema(): Promise<string> {
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
      process.env.BEANS_VSCODE_OUTPUT_LOG || join(this.workspaceRoot, '.vscode', 'logs', 'beans-output.log')
    );

    const isWithinWorkspace = isPathWithinRoot(this.workspaceRoot, outputPath);
    const vscodeLogDir = process.env.BEANS_VSCODE_LOG_DIR ? resolve(process.env.BEANS_VSCODE_LOG_DIR) : undefined;
    const isWithinVscodeLogDir = vscodeLogDir ? isPathWithinRoot(vscodeLogDir, outputPath) : false;

    if (!isWithinWorkspace && !isWithinVscodeLogDir) {
      throw new Error('Output log path must stay within the workspace or VS Code log directory');
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

export const sortBeans = querySortBeans;

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
  // Helper: robustly retrieve a bean by ID. Some test harnesses may substitute a backend
  // that does not expose `show`, so fall back to listing and searching by id.
  async function getBean(beanId: string) {
    if (typeof (backend as any).show === 'function') {
      return (backend as any).show(beanId);
    }
    // Try calling the backend's executeGraphQL directly (some test harnesses expose
    // the implementation but not the convenience `show` method).
    if (typeof (backend as any).executeGraphQL === 'function') {
      const { data, errors } = await (backend as any).executeGraphQL((graphql as any).SHOW_BEAN_QUERY, { id: beanId });
      if (errors && errors.length > 0) {
        throw new Error(`GraphQL error: ${errors.map((e: any) => e.message).join(', ')}`);
      }
      if (data && (data as any).bean) {
        return (data as any).bean;
      }
    }
    const beans = await (backend as any).list();
    const found = beans.find((b: any) => b.id === beanId);
    if (!found) {
      throw new Error(`Bean not found: ${beanId}`);
    }
    return found;
  }
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
    async ({ beanId }: { beanId: string }) => makeTextAndStructured({ bean: await getBean(beanId) })
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

  // NOTE: blocking relationship edits are handled via the consolidated 'beans_vscode_update' tool

  // Consolidated reopen tool: handles reopening completed or scrapped beans
  server.registerTool(
    'beans_vscode_reopen',
    {
      title: 'Reopen Bean',
      description: 'Reopen a completed or scrapped bean into a non-closed status.',
      inputSchema: z.object({
        beanId: z.string().min(1).max(MAX_ID_LENGTH),
        requiredCurrentStatus: z.enum(['completed', 'scrapped']),
        targetStatus: z.string().max(MAX_METADATA_LENGTH).default('todo'),
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
      requiredCurrentStatus,
      targetStatus,
    }: {
      beanId: string;
      requiredCurrentStatus: 'completed' | 'scrapped';
      targetStatus: string;
    }) => {
      const bean = await getBean(beanId);
      if (bean.status !== requiredCurrentStatus) {
        throw new Error(`Bean ${beanId} is not ${requiredCurrentStatus}`);
      }
      return makeTextAndStructured({ bean: await backend.update(beanId, { status: targetStatus }) });
    }
  );

  // Consolidated update tool to reduce public MCP surface. Accepts the same
  // update fields previously exposed as several small tools.
  server.registerTool(
    'beans_vscode_update',
    {
      title: 'Update Bean',
      description:
        'Update bean metadata fields (status/type/priority/parent/blocking). Consolidated replacement for per-field update tools.',
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
    async (input: {
      beanId: string;
      status?: string;
      type?: string;
      priority?: string;
      parent?: string;
      clearParent?: boolean;
      blocking?: string[];
      blockedBy?: string[];
    }) =>
      makeTextAndStructured({
        bean: await backend.update(input.beanId, {
          status: input.status,
          type: input.type,
          priority: input.priority,
          parent: input.parent,
          clearParent: input.clearParent,
          blocking: input.blocking,
          blockedBy: input.blockedBy,
        }),
      })
  );

  // Note: copy-id functionality is available via beans_vscode_view; callers can derive short code from the returned id.

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
      const bean = await getBean(beanId);
      if (!force && bean.status !== 'draft' && bean.status !== 'scrapped') {
        throw new Error('Only draft and scrapped beans are deletable unless force=true');
      }
      return makeTextAndStructured(await backend.delete(beanId));
    }
  );

  // Consolidate several query-like tools (refresh/filter/search/sort)
  server.registerTool(
    'beans_vscode_query',
    {
      title: 'Query Beans',
      description: 'Unified query tool for refresh, filter, search, and sort operations.',
      inputSchema: z.object({
        operation: z.enum(['refresh', 'filter', 'search', 'sort', 'llm_context', 'open_config']).default('refresh'),
        // for sort
        mode: z.enum(['status-priority-type-title', 'updated', 'created', 'id']).optional(),
        statuses: z.array(z.string().max(MAX_METADATA_LENGTH)).nullable().optional(),
        types: z.array(z.string().max(MAX_METADATA_LENGTH)).nullable().optional(),
        search: z.string().max(MAX_TITLE_LENGTH).optional(),
        includeClosed: z.boolean().optional(),
        tags: z.array(z.string().max(MAX_METADATA_LENGTH)).nullable().optional(),
        // for llm_context
        writeToWorkspaceInstructions: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({
      operation,
      mode,
      statuses,
      types,
      search,
      tags,
      writeToWorkspaceInstructions,
      includeClosed,
    }: {
      operation: 'refresh' | 'filter' | 'search' | 'sort' | 'llm_context' | 'open_config';
      mode?: SortMode;
      statuses?: string[] | null;
      types?: string[] | null;
      search?: string;
      tags?: string[] | null;
      writeToWorkspaceInstructions?: boolean;
      includeClosed?: boolean;
    }) => {
      // Delegate to the consolidated query helper to avoid duplicated logic.
      const result = await handleQueryOperation(backend, {
        operation,
        mode,
        statuses,
        types,
        search,
        tags,
        writeToWorkspaceInstructions,
        includeClosed,
      });
      return result;
    }
  );

  // open_config functionality is available via the consolidated 'beans_vscode_query' tool (operation: 'open_config').

  // NOTE: llm_context and open_config operations are handled by the consolidated 'beans_vscode_query' tool below.

  // Consolidated bean file tool: read/edit/create/delete operations in one tool.
  server.registerTool(
    'beans_vscode_bean_file',
    {
      title: 'Bean File Operations',
      description: 'Read, create, edit, or delete files under .beans (operation param).',
      inputSchema: z.object({
        operation: z.enum(['read', 'edit', 'create', 'delete']),
        path: z.string().min(1).max(MAX_PATH_LENGTH),
        content: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
        overwrite: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({
      operation,
      path,
      content,
      overwrite,
    }: {
      operation: 'read' | 'edit' | 'create' | 'delete';
      path: string;
      content?: string;
      overwrite?: boolean;
    }) => {
      if (operation === 'read') {
        return makeTextAndStructured(await backend.readBeanFile(path));
      }
      if (operation === 'edit') {
        return makeTextAndStructured(await backend.editBeanFile(path, content || ''));
      }
      if (operation === 'create') {
        return makeTextAndStructured(await backend.createBeanFile(path, content || '', { overwrite }));
      }
      if (operation === 'delete') {
        return makeTextAndStructured(await backend.deleteBeanFile(path));
      }
      throw new Error('Unsupported operation');
    }
  );

  // Consolidated output/tool guidance: read log or show guidance.
  server.registerTool(
    'beans_vscode_output',
    {
      title: 'Beans Output Tools',
      description: 'Read extension output log or show guidance (operation param).',
      inputSchema: z.object({
        operation: z.enum(['read', 'show']).default('read'),
        lines: z.number().int().min(1).max(5000).optional(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ operation, lines }: { operation: 'read' | 'show'; lines?: number }) => {
      if (operation === 'read') {
        return makeTextAndStructured(await backend.readOutputLog({ lines }));
      }
      return makeTextAndStructured({
        message:
          'When using VS Code UI, run command `Beans: Show Output` to open extension logs. In MCP mode, rely on tool error outputs and host logs.',
      });
    }
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
