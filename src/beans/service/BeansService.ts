/**
 * Module: beans/service
 *
 * Provides a type-safe, resilient wrapper around the Beans CLI. Responsibilities:
 * - Securely execute the `beans` CLI via `execFile` (avoid shell interpolation)
 * - Parse and normalize CLI JSON output into application `Bean` models
 * - Provide retry + exponential backoff for transient errors
 * - Deduplicate concurrent identical requests to reduce CLI churn
 * - Maintain a short-lived offline cache to allow graceful degradation
 *
 * Important contributor notes:
 * - Tests should mock `child_process.execFile` (or `execFileAsync`) to avoid spawning real processes
 * - Do not change `CACHE_TTL_MS` behaviour without adding tests covering cache expiration
 */
import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { mkdir, readdir, readFile, rename, writeFile } from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { BeansConfigManager } from '../config';
import { BeansOutput } from '../logging';
import {
  Bean,
  BeanPriority,
  BeansCLINotFoundError,
  BeansConfig,
  BeansJSONParseError,
  BeanStatus,
  BeansTimeoutError,
  BeanType,
} from '../model';
import * as graphql from './graphql';

const execFileAsync = promisify(execFile);

/**
 * Raw bean data structure as returned by Beans CLI
 * Matches the GraphQL schema fragments in graphql.ts
 */
interface RawBeanFromCLI {
  id: string;
  slug: string;
  path: string;
  title: string;
  body: string;
  status: string;
  type: string;
  priority?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  etag: string;
  parentId: string;
  code?: string;
  parent?: string;
  blocking?: string[];
  blockingIds: string[];
  blockedBy?: string[];
  blockedByIds: string[];
}

/**
 * Typed representation of a GraphQL error object as commonly returned by GraphQL
 * services. Using this type avoids unsafe `any` usage at call sites.
 */
export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

/**
 * Service for interacting with the Beans CLI
 * Provides type-safe wrappers around CLI operations with secure command execution
 */
export class BeansService {
  private readonly logger = BeansOutput.getInstance();
  private readonly malformedWarningPaths = new Set<string>();
  private cliPath: string;
  private workspaceRoot: string;
  // Config manager instance cached for lifecycle of service to avoid repeated I/O
  private readonly configManager: BeansConfigManager;
  // Short-lived parsed config cache to reduce repeated parsing on hot paths
  private cachedConfig: BeansConfig | null = null;
  private configCacheTs: number | null = null;
  private readonly CONFIG_CACHE_TTL_MS = 5 * 1000; // 5s
  // Request deduplication: tracks in-flight CLI requests to prevent duplicate calls
  private readonly inFlightRequests = new Map<string, Promise<unknown>>();
  // Offline mode: cache last successful results for graceful degradation
  private offlineMode = false;
  private cachedBeans: Bean[] | null = null;
  private cacheTimestamp: number | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(defaultWorkspaceRoot: string) {
    const config = vscode.workspace.getConfiguration('beans');
    this.cliPath = config.get<string>('cliPath', 'beans');
    this.workspaceRoot = config.get<string>('workspaceRoot', '') || defaultWorkspaceRoot;
    // Initialize a single BeansConfigManager for the service lifecycle to avoid
    // repeatedly instantiating and performing workspace I/O on hot paths.
    this.configManager = new BeansConfigManager(this.workspaceRoot);
  }

  /**
   * Check if currently in offline mode
   */
  isOffline(): boolean {
    return this.offlineMode;
  }

  /**
   * Check if cached data is still valid (within TTL)
   */
  private isCacheValid(): boolean {
    if (!this.cachedBeans || !this.cacheTimestamp) {
      return false;
    }
    return Date.now() - this.cacheTimestamp < this.CACHE_TTL_MS;
  }

  /**
   * Update the beans cache
   */
  private updateCache(beans: Bean[]): void {
    this.cachedBeans = beans;
    this.cacheTimestamp = Date.now();
  }

  /**
   * Apply local filtering for cached beans in offline mode.
   */
  private filterBeans(
    beans: Bean[],
    options?: { status?: string[]; type?: string[]; search?: string; parent?: string }
  ): Bean[] {
    return beans.filter(bean => {
      if (options?.status?.length && !options.status.includes(bean.status)) {
        return false;
      }

      if (options?.type?.length && !options.type.includes(bean.type)) {
        return false;
      }

      if (options?.parent && bean.parent !== options.parent) {
        return false;
      }

      if (options?.search) {
        const query = options.search.toLowerCase();
        const haystack = [bean.id, bean.code, bean.slug, bean.title, bean.body, ...(bean.tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Clear the beans cache
   */
  clearCache(): void {
    this.cachedBeans = null;
    this.cacheTimestamp = null;
  }

  /**
   * Check if beans CLI is available in PATH
   */
  async checkCLIAvailable(): Promise<boolean> {
    try {
      await execFileAsync(this.cliPath, ['--version'], {
        cwd: this.workspaceRoot,
        timeout: 5000,
      });
      return true;
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return false;
      }
      // Other errors might mean CLI is there but something else wrong
      return true;
    }
  }

  /**
   * Retry helper with exponential backoff for transient failures.
   *
   * @param fn Function to retry
   * @param maxRetries Maximum number of retries AFTER the initial attempt (default 3).
   *   This results in up to maxRetries + 1 total attempts (1 initial + maxRetries retries).
   *   For example, maxRetries=3 means 4 total attempts: 1 initial + 3 retries.
   * @param baseDelay Base delay in ms between retries (default 100ms), grows exponentially
   * @returns Result from function
   */
  private async withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3, baseDelay: number = 100): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error as Error;
        const err = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string };

        // Don't retry for these permanent errors
        if (err.code === 'ENOENT' || error instanceof BeansJSONParseError || error instanceof BeansCLINotFoundError) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Retry for transient errors (timeouts, network issues, etc.)
        const isTransient = err.killed || err.signal === 'SIGTERM' || error instanceof BeansTimeoutError;

        if (isTransient) {
          const delay = baseDelay * Math.pow(2, attempt);
          this.logger.warn(`Transient error on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // For other errors, don't retry
        throw error;
      }
    }

    // All retries exhausted
    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Execute beans CLI command with JSON output
   * Security: Uses execFile with argument array to prevent shell injection
   * Request deduplication: Identical concurrent requests share the same promise
   * Resilience: Automatic retry with exponential backoff for transient failures
   * @param args Command arguments (don't include 'beans' itself)
   * @returns Parsed JSON response
   */
  private async execute<T>(args: string[]): Promise<T> {
    // Create a bounded unique key for this request based on a hash of the args.
    // Avoid embedding raw args/large payloads into the key or logs to prevent
    // accidental leakage of sensitive or large data.
    const argsString = args.join('::');
    const hash = createHash('sha256').update(argsString).digest('hex').slice(0, 16);
    const requestKey = `exec:${hash}`;

    // Check for in-flight request with same key
    const existingRequest = this.inFlightRequests.get(requestKey);
    if (existingRequest) {
      // Log only the bounded request key (hash) to avoid leaking args
      this.logger.debug(`Deduplicating request: ${requestKey}`);
      return existingRequest as Promise<T>;
    }

    // Create new request with retry logic. Log a redacted summary of args.
    this.logger.debug(`Executing: ${this.cliPath} ${args.slice(0, 5).join(' ')}${args.length > 5 ? ' ...' : ''}`);
    this.logger.diagnostics('CLI command arguments', { cliPath: this.cliPath, args });

    const requestPromise = (async () => {
      try {
        // Wrap execution with retry logic for transient failures
        return await this.withRetry(async () => {
          const { stdout, stderr } = await execFileAsync(this.cliPath, args, {
            cwd: this.workspaceRoot,
            maxBuffer: 10 * 1024 * 1024, // 10MB
            timeout: 30000, // 30s
          });

          // Log CLI output
          if (stdout) {
            this.logger.debug(`CLI stdout: ${stdout.substring(0, 500)}${stdout.length > 500 ? '...' : ''}`);
            this.logger.diagnostics('CLI stdout', stdout);
          }

          if (stderr) {
            // Beans CLI sometimes outputs info to stderr
            if (stderr.includes('[INFO]')) {
              this.logger.debug(`CLI info: ${stderr}`);
            } else {
              this.logger.warn(`CLI stderr: ${stderr}`);
            }
            this.logger.diagnostics('CLI stderr', stderr);
          }

          try {
            return JSON.parse(stdout) as T;
          } catch (parseError) {
            throw new BeansJSONParseError('Failed to parse beans CLI JSON output', stdout, parseError as Error);
          }
        });
      } catch (error: unknown) {
        const err = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string };

        if (err.code === 'ENOENT') {
          throw new BeansCLINotFoundError(
            `Beans CLI not found at: ${this.cliPath}. Please install beans or configure beans.cliPath setting.`
          );
        }

        if (err.killed && err.signal === 'SIGTERM') {
          throw new BeansTimeoutError('Beans CLI operation timed out');
        }

        throw error;
      } finally {
        // Remove from in-flight map when complete (success or failure)
        this.inFlightRequests.delete(requestKey);
      }
    })();

    // Track the in-flight request
    this.inFlightRequests.set(requestKey, requestPromise);

    return requestPromise;
  }

  /**
   * Execute beans CLI command and return raw text output.
   * Security: Uses execFile with argument array to prevent shell injection
   */
  private async executeText(args: string[]): Promise<string> {
    this.logger.debug(`Executing text command: ${this.cliPath} ${args.join(' ')}`);

    try {
      const { stdout, stderr } = await execFileAsync(this.cliPath, args, {
        cwd: this.workspaceRoot,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });

      if (stderr && !stderr.includes('[INFO]')) {
        this.logger.warn(`CLI stderr: ${stderr}`);
      }

      return stdout;
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string };

      if (err.code === 'ENOENT') {
        throw new BeansCLINotFoundError(
          `Beans CLI not found at: ${this.cliPath}. Please install beans or configure beans.cliPath setting.`
        );
      }

      if (err.killed && err.signal === 'SIGTERM') {
        throw new BeansTimeoutError('Beans CLI operation timed out');
      }

      throw error;
    }
  }

  /**
   * Execute beans GraphQL query/mutation.
   * Security: Uses execFile with argument array to prevent shell injection.
   * Request deduplication: Identical concurrent requests share the same promise.
   * @param query GraphQL query or mutation string.
   * @param variables Optional variables as JSON object.
   * @returns GraphQL result with data and optional errors.
   */
  private async executeGraphQL<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<{ data: T; errors?: GraphQLError[] }> {
    const args = ['graphql', '--json', query];
    if (variables) {
      args.push('--variables', JSON.stringify(variables));
    }

    // Create a bounded unique key for this request based on a hash of query+variables.
    // Avoid embedding raw variables/large payloads into the key or logs to prevent
    // accidental leakage of sensitive or large data.
    const variablesString = variables ? JSON.stringify(variables) : '';
    const hash = createHash('sha256')
      .update(query + '::' + variablesString)
      .digest('hex')
      .slice(0, 16);
    const requestKey = `graphql:${hash}`;

    // Check for in-flight request with same key
    const existingRequest = this.inFlightRequests.get(requestKey);
    if (existingRequest) {
      // Log only the bounded request key (hash) to avoid leaking variables
      this.logger.debug(`Deduplicating GraphQL request: ${requestKey}`);
      return existingRequest as Promise<{ data: T; errors?: GraphQLError[] }>;
    }

    // Create new request with retry logic
    this.logger.debug(`Executing GraphQL: ${query.substring(0, 100)}...`);
    this.logger.diagnostics('GraphQL query', query);
    if (variables) {
      this.logger.diagnostics('GraphQL variables', variables);
    }

    const requestPromise = (async () => {
      try {
        // Wrap execution with retry logic for transient failures
        return await this.withRetry(async () => {
          const { stdout, stderr } = await execFileAsync(this.cliPath, args, {
            cwd: this.workspaceRoot,
            maxBuffer: 10 * 1024 * 1024, // 10MB
            timeout: 30000, // 30s
          });

          // Log CLI stderr
          if (stderr && !stderr.includes('[INFO]')) {
            this.logger.warn(`GraphQL CLI stderr: ${stderr}`);
          }
          if (stderr) {
            this.logger.diagnostics('GraphQL CLI stderr', stderr);
          }

          if (stdout) {
            this.logger.diagnostics('GraphQL CLI stdout', stdout);
          }

          try {
            // CLI outputs the data portion directly (e.g. {"beans": [...]})
            // without a {"data": ...} envelope. Errors are reported via
            // stderr / non-zero exit code, not in the JSON payload.
            const parsed = JSON.parse(stdout);
            return {
              data: parsed as T,
            };
          } catch (parseError) {
            throw new BeansJSONParseError('Failed to parse beans GraphQL JSON output', stdout, parseError as Error);
          }
        });
      } catch (error: unknown) {
        const err = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string };

        if (err.code === 'ENOENT') {
          throw new BeansCLINotFoundError(
            `Beans CLI not found at: ${this.cliPath}. Please install beans or configure beans.cliPath setting.`
          );
        }

        if (err.killed && err.signal === 'SIGTERM') {
          throw new BeansTimeoutError('Beans CLI operation timed out');
        }

        // When the CLI exits with a non-zero code, `execFileAsync` wraps the
        // full command + stderr into Error.message. Extract just the first
        // meaningful "Error: ..." line from stderr so the user sees a clean
        // message instead of the raw command boilerplate and usage text.
        const cliStderr: string = (err as any).stderr ?? '';
        if (cliStderr) {
          const meaningfulLine = cliStderr
            .split('\n')
            .map(l => l.trim())
            .find(l => l.startsWith('Error: '));
          if (meaningfulLine) {
            throw new Error(meaningfulLine.replace(/^Error:\s*/, ''));
          }
        }

        throw error;
      } finally {
        // Remove from in-flight map when complete (success or failure)
        this.inFlightRequests.delete(requestKey);
      }
    })();

    // Track the in-flight request
    this.inFlightRequests.set(requestKey, requestPromise);

    return requestPromise;
  }

  /**
   * Check if the current workspace is initialized with Beans
   */
  async checkInitialized(): Promise<boolean> {
    try {
      await this.execute<{ initialized: boolean }>(['check', '--json']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Beans workspace configuration
   * Reads from .beans.yml via BeansConfigManager and merges with defaults
   */
  async getConfig(): Promise<BeansConfig> {
    // Short-circuit to cached parsed config when still fresh
    if (this.cachedConfig && this.configCacheTs && Date.now() - this.configCacheTs < this.CONFIG_CACHE_TTL_MS) {
      return this.cachedConfig;
    }

    // Try to read from .beans.yml via the shared manager instance
    const yamlConfig = await this.configManager.read();

    // Default configuration values
    const defaults: BeansConfig = {
      path: '.beans',
      prefix: 'bean',
      id_length: 4,
      default_status: 'draft',
      default_type: 'task',
      statuses: ['todo', 'in-progress', 'completed', 'scrapped', 'draft'],
      types: ['milestone', 'epic', 'feature', 'task', 'bug'],
      priorities: ['critical', 'high', 'normal', 'low', 'deferred'],
    };

    // Merge YAML config with defaults
    const merged = yamlConfig ? { ...defaults, ...yamlConfig } : defaults;
    // Update short-lived cache so hot paths don't re-read within the TTL window
    this.cachedConfig = merged;
    this.configCacheTs = Date.now();
    return merged;
  }

  /**
   * List beans with optional filters
   * Supports offline mode with cached data fallback
   */
  async listBeans(
    options?: { status?: string[]; type?: string[]; search?: string; parent?: string },
    recoveryAttempted = false
  ): Promise<Bean[]> {
    try {
      const filter: Record<string, unknown> = {};

      if (options?.status && options.status.length > 0) {
        filter.status = options.status;
      }

      if (options?.type && options.type.length > 0) {
        filter.type = options.type;
      }

      if (options?.search) {
        filter.search = options.search;
      }

      if (options?.parent) {
        filter.parent = options.parent;
      }

      const { data, errors } = await this.executeGraphQL<{ beans: RawBeanFromCLI[] }>(graphql.LIST_BEANS_QUERY, {
        filter,
      });

      if (errors && errors.length > 0) {
        throw new Error(`GraphQL error: ${errors.map(e => e.message).join(', ')}`);
      }

      const beans = data.beans || [];

      // Normalize bean data to ensure arrays are always arrays.
      // If an individual bean is malformed, try to repair it and continue
      // instead of failing the entire fetch.
      const normalizedBeans: Bean[] = [];
      const quarantinedPaths = new Map<string, string | undefined>();
      for (const bean of beans) {
        try {
          normalizedBeans.push(this.normalizeBean(bean, { allowPartial: true }));
          continue;
        } catch (error) {
          if (!(error instanceof BeansJSONParseError)) {
            throw error;
          }

          const repaired = await this.tryRepairMalformedBean(bean);
          if (repaired) {
            try {
              normalizedBeans.push(this.normalizeBean(repaired, { allowPartial: true }));
              continue;
            } catch (repairNormalizeError) {
              void repairNormalizeError;
            }
          }

          const quarantinedPath = await this.quarantineMalformedBeanFile(bean);
          this.notifyMalformedBeanQuarantined(bean, quarantinedPath);
          if (bean.id) {
            quarantinedPaths.set(bean.id, quarantinedPath);
          }
        }
      }

      // Disk-level orphan detection and cache updates must only run on unfiltered
      // (full) fetches. Filtered calls (e.g. by status from augmentBeans) only
      // return a subset of beans, which would cause every bean not matching the
      // filter to be misidentified as an orphaned file.
      const isFiltered =
        (options?.status && options.status.length > 0) ||
        (options?.type && options.type.length > 0) ||
        !!options?.search ||
        !!options?.parent;

      if (!isFiltered) {
        // Detect bean files on disk that the CLI silently dropped (e.g. corrupted
        // frontmatter that causes the CLI to skip the file without an error).
        await this.detectOrphanedBeanFiles(normalizedBeans, quarantinedPaths);

        // Orphan children of every quarantined bean by clearing their parent field.
        await this.clearDanglingParentReferences(normalizedBeans);

        // Update cache on successful fetch
        this.updateCache(normalizedBeans);
      }
      this.offlineMode = false;

      return normalizedBeans;
    } catch (error) {
      // If CLI is unavailable and we have valid cached data, use it
      if (
        error instanceof BeansCLINotFoundError ||
        error instanceof BeansTimeoutError ||
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        if (this.isCacheValid()) {
          // Warn user once when entering offline mode
          if (!this.offlineMode) {
            this.offlineMode = true;
            this.logger.warn('CLI unavailable, using cached data (offline mode)');
            vscode.window.showWarningMessage('Beans CLI unavailable. Using cached data (may be stale).');
          }
          return this.filterBeans(this.cachedBeans!, options);
        }

        // No valid cache available
        if (!this.offlineMode) {
          this.offlineMode = true;
          this.logger.error('CLI unavailable and no cached data available');
        }
        throw new BeansCLINotFoundError(
          'Beans CLI is not available and no cached data exists. Please ensure Beans CLI is installed and accessible.',
          error as Error
        );
      }

      if (!recoveryAttempted && (await this.tryRecoverFromMalformedListError(error))) {
        this.logger.info('Recovered from malformed bean list error by quarantining the reported file; retrying list');
        return this.listBeans(options, true);
      }

      // For other errors, just throw
      throw error;
    }
  }

  /**
   * Recover from list-level CLI failure caused by malformed frontmatter, where the
   * CLI aborts before returning bean JSON and per-bean repair/quarantine cannot run.
   */
  private async tryRecoverFromMalformedListError(error: unknown): Promise<boolean> {
    const candidatePath = this.extractMalformedBeanPathFromCliError(error);
    if (!candidatePath) {
      return false;
    }

    const quarantinedPath = await this.quarantineMalformedBeanAbsolutePath(candidatePath);
    if (!quarantinedPath) {
      return false;
    }

    const rawBeanHint: RawBeanFromCLI = {
      id: this.deriveIdFromPath(candidatePath) || candidatePath,
      title: this.deriveTitleFromPath(candidatePath) || path.basename(candidatePath),
      slug: '',
      path: path.relative(this.workspaceRoot, candidatePath),
      body: '',
      status: 'draft',
      type: 'task',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      etag: '',
      parentId: '',
      blockingIds: [],
      blockedByIds: [],
    };
    this.notifyMalformedBeanQuarantined(rawBeanHint, quarantinedPath);
    return true;
  }

  private extractMalformedBeanPathFromCliError(error: unknown): string | undefined {
    const execError = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    const combined = [execError?.message, execError?.stderr, execError?.stdout].filter(Boolean).join('\n');

    // Typical CLI diagnostics include either absolute paths or workspace-relative
    // paths under .beans. Extract and resolve whichever variant appears.
    const pathMatch =
      /((?:[A-Za-z]:\\[^\s:'"\n]+\.md)|(?:\/?[^\s:'"\n]*\.beans[/\\][^\s:'"\n]+\.md)|(?:\.beans[/\\][^\s:'"\n]+\.md))/.exec(
        combined
      );

    if (!pathMatch?.[1]) {
      return undefined;
    }

    const rawPath = pathMatch[1];
    const resolved = path.isAbsolute(rawPath) ? rawPath : path.resolve(this.workspaceRoot, rawPath);
    const relativeToWorkspace = path.relative(this.workspaceRoot, resolved);
    if (!relativeToWorkspace || relativeToWorkspace.startsWith('..') || path.isAbsolute(relativeToWorkspace)) {
      return undefined;
    }

    const beansDirPrefix = `.beans${path.sep}`;
    const beansDirInfix = `${path.sep}.beans${path.sep}`;
    if (!relativeToWorkspace.startsWith(beansDirPrefix) && !relativeToWorkspace.includes(beansDirInfix)) {
      return undefined;
    }

    return resolved;
  }

  private get quarantineDir(): string {
    return path.join(this.workspaceRoot, '.beans', '.quarantine');
  }

  private async quarantineMalformedBeanAbsolutePath(sourcePath: string): Promise<string | undefined> {
    const filename = path.basename(sourcePath);
    // Avoid quarantined files being re-detected as `.md` files: append a marker
    // suffix so they no longer match `*.md` discovery patterns.
    const quarantinedFilename = filename.toLowerCase().endsWith('.md') ? `${filename}.fixme` : filename;
    const targetPath = path.join(this.quarantineDir, quarantinedFilename);

    try {
      await mkdir(this.quarantineDir, { recursive: true });
      await rename(sourcePath, targetPath);
      return targetPath;
    } catch (error) {
      this.logger.warn(`Failed to quarantine malformed bean file at ${sourcePath}: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Returns true when a YAML bare scalar value requires quoting.
   *
   * YAML requires quoting when a plain scalar starts with or contains characters
   * that have special meaning: `:`, `#`, `[`, `]`, `{`, `}`, `&`, `*`, `!`,
   * `|`, `>`, `'`, `"`, `%`, `@`, `` ` ``.  A colon followed by a space (`: `)
   * anywhere in the string is the most common real-world trigger.
   */
  private static titleNeedsYamlQuoting(title: string): boolean {
    // Colon followed by space is the canonical YAML key-value separator
    if (/: /.test(title)) {
      return true;
    }
    // Colon at end of string also triggers the parser
    if (title.endsWith(':')) {
      return true;
    }
    // Other characters that cause YAML parse errors in bare scalars
    if (/^[{[\]|>&*!%@`'"]/.test(title)) {
      return true;
    }
    // '#' preceded by a space is a YAML comment
    if (/ #/.test(title)) {
      return true;
    }
    return false;
  }

  /**
   * After the CLI writes a bean file, check whether the `title:` frontmatter
   * line needs YAML quoting and, if so, rewrite it in place.
   *
   * The beans CLI does not quote title values, so any title that contains a
   * colon (e.g. "Command palette: Reinitialize") results in a malformed
   * frontmatter block that breaks every subsequent `beans graphql` call.
   *
   * This method is deliberately lenient: if the file cannot be read or written
   * (e.g. the CLI did not return a path) it logs a warning and returns without
   * throwing, so that the caller still returns the created bean to the user.
   */
  private async repairBeanFrontmatter(beanPath: string): Promise<void> {
    let absPath: string;
    try {
      absPath = this.resolveBeanFilePath(beanPath);
    } catch {
      return;
    }

    let content: string;
    try {
      content = await readFile(absPath, 'utf8');
    } catch (error) {
      this.logger.warn(`repairBeanFrontmatter: could not read ${absPath}: ${(error as Error).message}`);
      return;
    }

    // Match the `title:` line inside the YAML frontmatter block.
    // The frontmatter is bounded by leading `---` and a closing `---` or `...`.
    const titleLineRe = /^(title:\s*)(.+)$/m;
    const match = titleLineRe.exec(content);
    if (!match) {
      return;
    }

    const rawValue = match[2].trim();

    // Already quoted — nothing to do.
    if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
      return;
    }

    if (!BeansService.titleNeedsYamlQuoting(rawValue)) {
      return;
    }

    // Escape any double quotes inside the value, then wrap in double quotes.
    const escaped = rawValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const repairedContent = content.replace(titleLineRe, `${match[1]}"${escaped}"`);

    try {
      await writeFile(absPath, repairedContent, 'utf8');
      this.logger.debug(`repairBeanFrontmatter: quoted title in ${absPath}`);
    } catch (error) {
      this.logger.warn(`repairBeanFrontmatter: could not write ${absPath}: ${(error as Error).message}`);
    }
  }

  /**
   * Resolve a bean path (relative workspace path preferred) to absolute path.
   */
  private resolveBeanFilePath(beanPath: string): string {
    if (path.isAbsolute(beanPath)) {
      return beanPath;
    }

    const normalized = beanPath.replace(/\\/g, path.sep).replace(/^\.([/\\])/, '');
    const hasBeansSegment =
      normalized.startsWith(`.beans${path.sep}`) || normalized.includes(`${path.sep}.beans${path.sep}`);

    if (hasBeansSegment) {
      return path.resolve(this.workspaceRoot, normalized);
    }

    // Malformed/partial payloads can include filename-only paths. Those files
    // still live under the beans directory, so default to `.beans/<filename>`.
    return path.resolve(this.workspaceRoot, '.beans', path.basename(normalized));
  }

  private static readonly MAX_GIT_HISTORY_COMMITS = 20;

  /**
   * Attempt to recover missing required bean fields from the file's git history.
   * Walks backwards through up to MAX_GIT_HISTORY_COMMITS commits to find the most
   * recent version that has all four required fields (id, title, status, type).
   * Falls back to the best partial recovery if no single commit has all fields.
   * Runs `git log` then `git show` via execFile argument arrays (no shell interpolation).
   * Resolves with an empty object when git is unavailable, the file has no history, or parsing fails.
   */
  private async recoverFieldsFromGitHistory(
    filePath: string
  ): Promise<Partial<Pick<RawBeanFromCLI, 'id' | 'title' | 'status' | 'type' | 'priority'>>> {
    const requiredFields = ['id', 'title', 'status', 'type'] as const;
    const allFields = ['id', 'title', 'status', 'type', 'priority'] as const;

    try {
      const relPath = path.relative(this.workspaceRoot, filePath);

      const { stdout: shaOut } = await execFileAsync(
        'git',
        ['log', '--follow', '-n', String(BeansService.MAX_GIT_HISTORY_COMMITS), '--format=%H', '--', relPath],
        { cwd: this.workspaceRoot }
      );

      const shas = shaOut.trim().split('\n').filter(Boolean);
      if (shas.length === 0) {
        return {};
      }

      let bestRecovered: Partial<Pick<RawBeanFromCLI, 'id' | 'title' | 'status' | 'type' | 'priority'>> = {};
      let bestFieldCount = 0;

      for (const sha of shas) {
        try {
          const { stdout: historicalContent } = await execFileAsync('git', ['show', `${sha}:${relPath}`], {
            cwd: this.workspaceRoot,
          });

          const frontmatterMatch = /^(?:\uFEFF)?[ \t]*---\r?\n([\s\S]*?)\r?\n---/.exec(historicalContent);
          if (!frontmatterMatch) {
            continue;
          }

          const yamlText = frontmatterMatch[1];
          const candidate: Partial<Pick<RawBeanFromCLI, 'id' | 'title' | 'status' | 'type' | 'priority'>> = {};

          for (const field of allFields) {
            const match = new RegExp(`^\\s*${field}\\s*:[ \\t]*(.+)$`, 'm').exec(yamlText);
            if (match) {
              const value = match[1].trim().replace(/^["']|["']$/g, '');
              if (value) {
                candidate[field] = value;
              }
            }
          }

          const requiredCount = requiredFields.filter(f => candidate[f]).length;

          if (requiredCount === requiredFields.length) {
            this.logger.info(
              `Recovered ${Object.keys(candidate).join(', ')} from git history (commit ${sha.slice(0, 8)}) for ${path.basename(filePath)}`
            );
            return candidate;
          }

          if (requiredCount > bestFieldCount) {
            bestRecovered = candidate;
            bestFieldCount = requiredCount;
          }
        } catch {
          // Individual commit may have been deleted or file didn't exist — skip it
          continue;
        }
      }

      if (bestFieldCount > 0) {
        this.logger.info(
          `Partially recovered ${Object.keys(bestRecovered).join(', ')} from git history for ${path.basename(filePath)}`
        );
      }

      return bestRecovered;
    } catch {
      // git unavailable, not a git repo, or file has no history — all expected
      return {};
    }
  }

  /**
   * Attempt to repair malformed bean metadata and persist a corrected markdown frontmatter.
   * Returns a repaired bean payload if enough fields can be recovered.
   * Checks git history first before falling back to filename inference.
   */
  private async tryRepairMalformedBean(rawBean: RawBeanFromCLI): Promise<RawBeanFromCLI | null> {
    const filePath = rawBean.path ? this.resolveBeanFilePath(rawBean.path) : undefined;
    let defaultStatus = 'draft';
    let defaultType = 'task';
    let defaultPrefix = 'bean';
    let defaultIdLength = 4;

    try {
      const config = await this.getConfig();
      defaultStatus = config.default_status || defaultStatus;
      defaultType = config.default_type || defaultType;
      defaultPrefix = config.prefix || defaultPrefix;
      defaultIdLength = config.id_length || defaultIdLength;
    } catch {
      // Ignore config read failures and keep hard defaults for repair fallback.
    }

    // Recover fields from git history before falling back to filename inference.
    // This preserves the correct values (e.g. original status/type) rather than guessing.
    const historical = filePath ? await this.recoverFieldsFromGitHistory(filePath) : {};
    const beanWithHistory: RawBeanFromCLI = { ...rawBean, ...historical };

    const inferred = this.inferRequiredBeanFields(beanWithHistory, filePath, {
      status: defaultStatus,
      type: defaultType,
    });

    if (!inferred.id && inferred.title) {
      inferred.id = this.generateBeanId(defaultPrefix, defaultIdLength);
      this.logger.info(`Generated fallback bean id ${inferred.id} while repairing malformed bean metadata`);
    }

    if (!inferred.id || !inferred.title || !inferred.status || !inferred.type) {
      return null;
    }

    const repaired: RawBeanFromCLI = {
      ...rawBean,
      ...historical,
      id: inferred.id,
      title: inferred.title,
      status: inferred.status,
      type: inferred.type,
    };

    if (filePath) {
      try {
        await this.repairBeanMarkdownFrontmatter(filePath, repaired);
      } catch (error) {
        // Persist failed: do not keep an in-memory repaired bean that points to a
        // still-broken file. Force quarantine+notification through caller flow.
        this.logger.warn(
          `Failed to persist repaired frontmatter for ${path.basename(filePath)}: ${(error as Error).message}; escalating to quarantine`
        );
        return null;
      }
    }

    return repaired;
  }

  private generateBeanId(prefix: string, idLength: number): string {
    const normalizedPrefix = prefix?.trim() || 'bean';
    const normalizedLength = Math.min(16, Math.max(4, Number.isFinite(idLength) ? idLength : 4));
    const suffix = createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .slice(0, normalizedLength);
    return `${normalizedPrefix}-${suffix}`;
  }

  /**
   * Infer missing required bean fields from available payload and file path.
   */
  private inferRequiredBeanFields(
    rawBean: RawBeanFromCLI,
    absolutePath?: string,
    defaults?: { status: string; type: string }
  ): { id?: string; title?: string; status?: string; type?: string } {
    const id = rawBean.id || this.deriveIdFromPath(absolutePath);
    const title = rawBean.title || this.deriveTitleFromPath(absolutePath);
    const status = rawBean.status || defaults?.status || 'draft';
    const type = rawBean.type || defaults?.type || 'task';

    return { id, title, status, type };
  }

  private deriveIdFromPath(absolutePath?: string): string | undefined {
    if (!absolutePath) {
      return undefined;
    }

    const base = path.basename(absolutePath, path.extname(absolutePath));
    const match = /^(.+?)--/.exec(base);
    return match?.[1] || undefined;
  }

  private deriveTitleFromPath(absolutePath?: string): string | undefined {
    if (!absolutePath) {
      return undefined;
    }

    const base = path.basename(absolutePath, path.extname(absolutePath));
    const afterDoubleDash = base.includes('--') ? base.substring(base.indexOf('--') + 2) : base;
    const normalized = afterDoubleDash.replace(/[-_]+/g, ' ').trim();
    return normalized || undefined;
  }

  /**
   * Ensure bean markdown has a valid frontmatter with required fields.
   */
  private async repairBeanMarkdownFrontmatter(filePath: string, bean: RawBeanFromCLI): Promise<void> {
    const originalContent = await readFile(filePath, 'utf8');
    const frontmatterMatch = /^(?:\uFEFF)?[ \t]*---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(originalContent);

    const requiredEntries: Array<[string, string]> = [
      ['id', this.yamlQuote(bean.id)],
      ['title', this.yamlQuote(bean.title)],
      ['status', this.yamlQuote(bean.status)],
      ['type', this.yamlQuote(bean.type)],
    ];

    let frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';
    const body = frontmatterMatch ? originalContent.slice(frontmatterMatch[0].length) : originalContent;

    for (const [key, value] of requiredEntries) {
      const keyLineRegex = new RegExp(`^[ \\t]*${key}[ \\t]*:.*$`, 'm');
      if (keyLineRegex.test(frontmatter)) {
        // Overwrite the existing line so that recovered/repaired values take precedence.
        frontmatter = frontmatter.replace(keyLineRegex, `${key}: ${value}`);
      } else {
        frontmatter = `${frontmatter}${frontmatter.trimEnd() ? '\n' : ''}${key}: ${value}`;
      }
    }

    const repairedContent = `---\n${frontmatter.trimEnd()}\n---\n${body.startsWith('\n') ? body.slice(1) : body}`;
    await writeFile(filePath, repairedContent, 'utf8');
  }

  /**
   * Produce a YAML scalar that matches the beans CLI's own formatting:
   * - Empty string     → ''  (single-quoted empty)
   * - Needs quoting    → 'value' with internal apostrophes doubled as ''
   * - Plain scalar     → value (no quotes)
   *
   * A value needs quoting when it:
   *   - is empty
   *   - starts with a YAML indicator char (-, ?, :, {, }, [, ], #, &, *, !, |, >, ', ", %, @, `)
   *   - contains `: ` (colon-space, which would start a mapping)
   *   - contains ` #` (space-hash, which would start a comment)
   *   - contains a newline or tab
   */
  private yamlQuote(value: string): string {
    const v = value ?? '';
    if (v.length === 0) {
      return "''";
    }
    const needsQuotes = /^[-?:{}[\]#&*!|>'"%@`]/.test(v) || /: |^: $| #|\n|\r|\t/.test(v);
    if (!needsQuotes) {
      return v;
    }
    return `'${v.replace(/'/g, "''")}'`;
  }

  /**
   * For every bean in the list whose parent ID is not present in the list,
   * clear the parent reference. A bean is only "orphaned" if it has a parent
   * field set to an ID that does not exist anywhere in the current bean set
   * (because the parent was deleted, quarantined, or otherwise removed).
   */
  private async clearDanglingParentReferences(normalizedBeans: Bean[]): Promise<void> {
    const knownIds = new Set(normalizedBeans.map(b => b.id));
    // Track per-missing-parent results so we can report accurately to the user.
    const resultsByMissingParent = new Map<
      string,
      { successes: Array<{ id: string; code: string }>; failures: Array<{ id: string; error: Error }> }
    >();

    for (const bean of normalizedBeans) {
      if (!bean.parent || knownIds.has(bean.parent)) {
        continue;
      }

      const missingParentId = bean.parent;
      if (!resultsByMissingParent.has(missingParentId)) {
        resultsByMissingParent.set(missingParentId, { successes: [], failures: [] });
      }

      try {
        const { data: resp, errors } = await this.executeGraphQL<{ updateBean: RawBeanFromCLI }>(
          graphql.UPDATE_BEAN_MUTATION,
          { id: bean.id, input: { parent: '' } }
        );

        if (errors && errors.length > 0) {
          throw new Error(`GraphQL error: ${errors.map(e => e.message).join(', ')}`);
        }

        const updated = this.normalizeBean(resp.updateBean, { allowPartial: true });
        const idx = normalizedBeans.indexOf(bean);
        if (idx !== -1) {
          normalizedBeans[idx] = updated;
        }

        this.logger.info(
          `Cleared dangling parent reference on ${bean.code || bean.id} (parent ${missingParentId} not found)`
        );
        resultsByMissingParent.get(missingParentId)!.successes.push({ id: bean.id, code: bean.code || bean.id });
      } catch (error) {
        const err = error as Error;
        this.logger.warn(`Failed to clear dangling parent for bean ${bean.id}: ${err.message}`);
        resultsByMissingParent.get(missingParentId)!.failures.push({ id: bean.id, error: err });
      }
    }

    // Aggregate user-facing notifications per missing parent. If any failures
    // occurred for a given parent, downgrade the message to indicate we only
    // attempted to orphan children and list succeeded/failed counts.
    for (const [missingParentId, { successes, failures }] of resultsByMissingParent.entries()) {
      if (successes.length === 0 && failures.length === 0) {
        continue;
      }

      if (failures.length === 0) {
        // All child updates succeeded: report as orphaned
        const list = successes.map(s => s.code).join(', ');
        void vscode.window.showWarningMessage(
          `Bean(s) ${list} have been orphaned because their parent (${missingParentId}) no longer exists.`
        );
      } else {
        // Partial or complete failure: inform the user we attempted to orphan
        const succeededCount = successes.length;
        const failedCount = failures.length;
        void vscode.window.showWarningMessage(
          `Attempted to orphan ${succeededCount + failedCount} child(ren) of ${missingParentId}: ${succeededCount} succeeded, ${failedCount} failed. See output for details.`
        );
      }
    }
  }

  /**
   * Detect `.md` files in the beans directory that the CLI silently excluded
   * from its response (e.g. corrupted frontmatter that causes the CLI to skip
   * the file without an error). For each orphaned file, attempt repair and
   * quarantine using the same pipeline as explicitly malformed beans.
   */
  private async detectOrphanedBeanFiles(
    normalizedBeans: Bean[],
    quarantinedPaths: Map<string, string | undefined>
  ): Promise<void> {
    let beansDir: string;
    try {
      const config = await this.getConfig();
      beansDir = path.resolve(this.workspaceRoot, config.path || '.beans');
    } catch {
      beansDir = path.resolve(this.workspaceRoot, '.beans');
    }

    let entries: string[];
    try {
      entries = await readdir(beansDir);
    } catch {
      return;
    }

    const mdFiles = entries.filter(e => e.endsWith('.md'));
    if (mdFiles.length === 0) {
      return;
    }

    // Primary: match by bean ID (reliable — always present on normalized beans).
    // bean.path can be empty when allowPartial normalization is used, so path-based
    // matching alone would incorrectly flag known beans as orphaned.
    const knownIds = new Set(normalizedBeans.map(b => b.id));

    // Secondary fallback: match by resolved absolute path for files whose ID
    // can't be derived from the filename pattern.
    const knownPaths = new Set<string>();
    for (const bean of normalizedBeans) {
      if (bean.path) {
        knownPaths.add(path.resolve(this.workspaceRoot, bean.path));
      }
    }
    for (const qPath of quarantinedPaths.values()) {
      if (qPath) {
        knownPaths.add(qPath);
      }
    }

    for (const filename of mdFiles) {
      const absolutePath = path.join(beansDir, filename);

      // Check by ID first (handles empty bean.path from partial normalization).
      const derivedId = this.deriveIdFromPath(absolutePath);
      if (derivedId && knownIds.has(derivedId)) {
        continue;
      }

      // Fallback: check by resolved path.
      if (knownPaths.has(absolutePath)) {
        continue;
      }

      // Also skip quarantined paths by ID.
      if (derivedId && quarantinedPaths.has(derivedId)) {
        continue;
      }

      this.logger.warn(`Detected orphaned bean file not returned by CLI: ${filename}`);

      // Try to read and repair the file the same way tryRepairMalformedBean works.
      const orphanHint: RawBeanFromCLI = {
        id: '',
        title: '',
        slug: '',
        path: path.relative(this.workspaceRoot, absolutePath),
        body: '',
        status: '',
        type: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        etag: '',
        parentId: '',
        blockingIds: [],
        blockedByIds: [],
      };

      const repaired = await this.tryRepairMalformedBean(orphanHint);
      if (repaired) {
        try {
          normalizedBeans.push(this.normalizeBean(repaired, { allowPartial: true }));
          this.logger.info(`Recovered orphaned bean file ${filename} via repair`);
          continue;
        } catch {
          // Repair produced incomplete data — fall through to quarantine
        }
      }

      const quarantinedPath = await this.quarantineMalformedBeanAbsolutePath(absolutePath);
      this.notifyMalformedBeanQuarantined(orphanHint, quarantinedPath);

      if (derivedId && quarantinedPath) {
        quarantinedPaths.set(derivedId, quarantinedPath);
      }
    }
  }

  /**
   * Move malformed bean file to `.beans/.quarantine/` so it is visibly quarantined.
   */
  private async quarantineMalformedBeanFile(rawBean: RawBeanFromCLI): Promise<string | undefined> {
    if (!rawBean.path) {
      return undefined;
    }

    const sourcePath = this.resolveBeanFilePath(rawBean.path);
    return this.quarantineMalformedBeanAbsolutePath(sourcePath);
  }

  /**
   * Notify the user once per malformed quarantined file.
   */
  private notifyMalformedBeanQuarantined(rawBean: RawBeanFromCLI, quarantinedPath?: string): void {
    // Always key on the original bean identity so concurrent provider refreshes
    // that encounter the same malformed bean (after it's already quarantined) don't
    // fire duplicate notifications.
    const warningKey = rawBean.path || rawBean.id;
    if (this.malformedWarningPaths.has(warningKey)) {
      return;
    }
    this.malformedWarningPaths.add(warningKey);

    const fileLabel = quarantinedPath
      ? path.basename(quarantinedPath)
      : path.basename(rawBean.path || String(rawBean.id));
    const message = `Bean file quarantined: ${fileLabel}. Open the .beans/.quarantine folder to inspect or restore the file.`;

    if (!quarantinedPath) {
      void vscode.window.showWarningMessage(message);
      return;
    }

    const warningSelection = vscode.window.showWarningMessage(message, 'Open File');
    void Promise.resolve(warningSelection).then(async selection => {
      if (selection !== 'Open File') {
        return;
      }

      try {
        const document = await vscode.workspace.openTextDocument(quarantinedPath);
        await vscode.window.showTextDocument(document, { preview: false });
      } catch (error) {
        this.logger.warn(`Failed to open malformed bean file: ${quarantinedPath}`, error as Error);
      }
    });
  }

  /**
   * Normalize bean data from GraphQL/CLI to ensure required fields exist.
   * GraphQL responses use camelCase for fields (createdAt, updatedAt, parentId, blockingIds, blockedByIds, etc.).
   * We map these response fields to the application Bean model (also camelCase) and derive the short 'code' from the ID.
   * @throws BeansJSONParseError if bean is missing required fields
   */
  private normalizeBean(rawBean: RawBeanFromCLI, options?: { allowPartial?: boolean }): Bean {
    // Validate required fields
    if (!rawBean.id || !rawBean.title || !rawBean.status || !rawBean.type) {
      throw new BeansJSONParseError(
        'Bean missing required fields (id, title, status, or type)',
        JSON.stringify(rawBean),
        new Error('Invalid bean structure')
      );
    }

    const allowPartial = options?.allowPartial ?? false;

    // Validate additional required fields for full Bean interface payloads.
    // Some Beans CLI responses (notably the `beans` query) can omit content-heavy
    // fields like `body` and metadata fields like `etag`, so list normalization
    // supports partial payloads and supplies safe fallbacks.
    if (
      !allowPartial &&
      (rawBean.slug === undefined ||
        rawBean.slug === null ||
        rawBean.path === undefined ||
        rawBean.path === null ||
        rawBean.body === undefined ||
        rawBean.body === null ||
        rawBean.etag === undefined ||
        rawBean.etag === null)
    ) {
      throw new BeansJSONParseError(
        'Bean missing required fields (slug, path, body, or etag)',
        JSON.stringify(rawBean),
        new Error('Invalid bean structure')
      );
    }

    // Derive short code from ID: last segment after final hyphen
    const code = rawBean.code || (rawBean.id ? rawBean.id.split('-').pop() : '') || '';

    // Parse and validate dates
    const createdAt = this.parseDate(rawBean.createdAt, 'createdAt', rawBean.id);
    const updatedAt = this.parseDate(rawBean.updatedAt, 'updatedAt', rawBean.id);

    return {
      id: rawBean.id,
      code,
      slug: rawBean.slug ?? '',
      path: rawBean.path ?? '',
      title: rawBean.title,
      body: rawBean.body ?? '',
      status: rawBean.status as BeanStatus,
      type: rawBean.type as BeanType,
      priority: rawBean.priority as BeanPriority | undefined,
      tags: rawBean.tags || [],
      parent: rawBean.parent || rawBean.parentId,
      blocking: rawBean.blocking || rawBean.blockingIds || [],
      blockedBy: rawBean.blockedBy || rawBean.blockedByIds || [],
      createdAt,
      updatedAt,
      etag: rawBean.etag ?? '',
    };
  }

  /**
   * Parse and validate a date string, returning current date if invalid
   */
  private parseDate(dateValue: string | Date | number | undefined, fieldName: string, beanId: string): Date {
    if (!dateValue) {
      return new Date();
    }

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      this.logger.warn(`Invalid ${fieldName} date for bean ${beanId}: ${dateValue}. Using current date.`);
      return new Date();
    }

    return date;
  }

  /**
   * Get a single bean by ID
   */
  async showBean(id: string): Promise<Bean> {
    const { data, errors } = await this.executeGraphQL<{ bean: RawBeanFromCLI }>(graphql.SHOW_BEAN_QUERY, { id });

    if (errors && errors.length > 0) {
      throw new Error(`GraphQL error: ${errors.map(e => e.message).join(', ')}`);
    }

    const beanData = data.bean;

    if (!beanData) {
      throw new Error(`Bean not found: ${id}`);
    }

    try {
      return this.normalizeBean(beanData);
    } catch (error) {
      // Some Beans CLI versions can return partial payloads for GraphQL queries.
      // (omitting fields like slug/path/body/etag). Keep strict validation for
      // core identity fields, but gracefully accept partial metadata.
      if (error instanceof BeansJSONParseError) {
        this.logger.warn(`Partial bean payload received from show for ${id}; using safe defaults for missing fields.`);
        return this.normalizeBean(beanData, { allowPartial: true });
      }

      throw error;
    }
  }

  /**
   * Validate bean title
   * @throws Error if title is invalid
   */
  private validateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new Error('Bean title is required');
    }
    if (title.length > 200) {
      throw new Error('Bean title must be 200 characters or less');
    }
  }

  /**
   * Validate bean type against workspace configuration
   * @param type - Type to validate
   * @param validTypes - Valid types from workspace config
   * @throws Error if type is invalid
   */
  private validateType(type: string, validTypes: BeanType[]): void {
    if (!validTypes.includes(type as BeanType)) {
      throw new Error(`Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  /**
   * Validate bean status against workspace configuration
   * @param status - Status to validate
   * @param validStatuses - Valid statuses from workspace config
   * @throws Error if status is invalid
   */
  private validateStatus(status: string, validStatuses: BeanStatus[]): void {
    if (!validStatuses.includes(status as BeanStatus)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }
  }

  /**
   * Validate bean priority against workspace configuration
   * @param priority - Priority to validate
   * @param validPriorities - Valid priorities from workspace config
   * @throws Error if priority is invalid
   */
  private validatePriority(priority: string, validPriorities: BeanPriority[]): void {
    if (!validPriorities.includes(priority as BeanPriority)) {
      throw new Error(`Invalid priority: ${priority}. Must be one of: ${validPriorities.join(', ')}`);
    }
  }

  /**
   * Create a new bean
   * @throws Error if input validation fails
   */
  async createBean(data: {
    title: string;
    type: string;
    status?: string;
    priority?: string;
    description?: string;
    parent?: string;
  }): Promise<Bean> {
    const config = await this.getConfig();
    return this.createBeanWithConfig(data, config);
  }

  /**
   * Create a bean with pre-fetched config (optimized for batch operations)
   * @private
   */
  private async createBeanWithConfig(
    data: {
      title: string;
      type: string;
      status?: string;
      priority?: string;
      description?: string;
      parent?: string;
    },
    config: BeansConfig
  ): Promise<Bean> {
    // Validate inputs
    this.validateTitle(data.title);
    this.validateType(data.type, config.types ?? []);
    if (data.status) {
      this.validateStatus(data.status, config.statuses ?? []);
    }
    if (data.priority) {
      this.validatePriority(data.priority, config.priorities ?? []);
    }

    const input: Record<string, unknown> = {
      title: data.title,
      type: data.type,
      status: data.status,
      priority: data.priority,
      body: data.description,
      parent: data.parent,
    };

    const { data: resp, errors } = await this.executeGraphQL<{ createBean: RawBeanFromCLI }>(
      graphql.CREATE_BEAN_MUTATION,
      { input }
    );

    if (errors && errors.length > 0) {
      throw new Error(`GraphQL error: ${errors.map(e => e.message).join(', ')}`);
    }

    const bean = this.normalizeBean(resp.createBean);

    // The beans CLI does not quote YAML frontmatter values, so a title containing
    // a colon (e.g. "Command palette: Foo") will produce invalid frontmatter that
    // breaks every subsequent `beans graphql` call. Repair the file proactively.
    if (bean.path) {
      await this.repairBeanFrontmatter(bean.path);
    }

    return bean;
  }

  /**
   * Update an existing bean
   * @throws Error if input validation fails
   */
  async updateBean(
    id: string,
    updates: {
      status?: string;
      type?: string;
      priority?: string;
      parent?: string;
      clearParent?: boolean;
      blocking?: string[];
      blockedBy?: string[];
    }
  ): Promise<Bean> {
    const config = await this.getConfig();
    return this.updateBeanWithConfig(id, updates, config);
  }

  /**
   * Update a bean with pre-fetched config (optimized for batch operations)
   * @private
   */
  private async updateBeanWithConfig(
    id: string,
    updates: {
      status?: string;
      type?: string;
      priority?: string;
      parent?: string;
      clearParent?: boolean;
      blocking?: string[];
      blockedBy?: string[];
    },
    config: BeansConfig
  ): Promise<Bean> {
    // Validate inputs
    if (updates.status) {
      this.validateStatus(updates.status, config.statuses ?? []);
    }
    if (updates.type) {
      this.validateType(updates.type, config.types ?? []);
    }
    if (updates.priority) {
      this.validatePriority(updates.priority, config.priorities ?? []);
    }

    if (updates.parent !== undefined && updates.clearParent) {
      throw new Error('Cannot set parent and clear parent in the same update');
    }

    const input: Record<string, unknown> = {
      status: updates.status,
      type: updates.type,
      priority: updates.priority,
    };

    if (updates.parent !== undefined) {
      input.parent = updates.parent;
    } else if (updates.clearParent) {
      input.parent = '';
    }

    if (updates.blocking) {
      input.addBlocking = updates.blocking;
    }

    if (updates.blockedBy) {
      input.addBlockedBy = updates.blockedBy;
    }

    const { data: resp, errors } = await this.executeGraphQL<{ updateBean: RawBeanFromCLI }>(
      graphql.UPDATE_BEAN_MUTATION,
      {
        id,
        input,
      }
    );

    if (errors && errors.length > 0) {
      throw new Error(`GraphQL error: ${errors.map(e => e.message).join(', ')}`);
    }

    let updatedBean: Bean;
    try {
      updatedBean = this.normalizeBean(resp.updateBean);
    } catch (error) {
      // Some Beans CLI update responses may be partial (for example, only returning
      // changed fields). In that case, fetch the full bean as a resilience fallback.
      if (error instanceof BeansJSONParseError) {
        this.logger.warn(`Partial bean payload received from update for ${id}; fetching full bean as fallback.`);
        updatedBean = await this.showBean(id);
      } else {
        throw error;
      }
    }

    // Recursively update children if status has changed
    if (updates.status) {
      try {
        const children = await this.listBeans({ parent: id });
        for (const child of children) {
          if (child.status !== updates.status) {
            // Propagate if moving to terminal status, or if child is not terminal,
            // or if parent is being reopened (simplified to 'propagating always' to fulfill 'full equality' requirement).
            this.logger.info(
              `Parent ${id} status changed to ${updates.status}; recursively updating child ${child.id}`
            );
            await this.updateBeanWithConfig(child.id, { status: updates.status }, config);
          }
        }
      } catch (childError) {
        // Log but don't fail the primary update if child update fails
        this.logger.error(`Failed to recursively update children for ${id}: ${childError}`);
      }
    }

    return updatedBean;
  }

  /**
   * Delete a bean (only works for scrapped and draft beans)
   */
  async deleteBean(id: string): Promise<void> {
    const { errors } = await this.executeGraphQL<Record<string, unknown>>(graphql.DELETE_BEAN_MUTATION, { id });

    if (errors && errors.length > 0) {
      throw new Error(`GraphQL error: ${errors.map(e => e.message).join(', ')}`);
    }
  }

  /**
   * Batch create multiple beans in parallel
   * Returns array of results with success/failure status for each operation
   * @param batchData Array of bean creation data
   * @returns Array of results with bean or error for each operation
   */
  async batchCreateBeans(
    batchData: Array<{
      title: string;
      type: string;
      status?: string;
      priority?: string;
      description?: string;
      parent?: string;
    }>
  ): Promise<Array<{ success: true; bean: Bean } | { success: false; error: Error; data: (typeof batchData)[0] }>> {
    if (batchData.length === 0) {
      return [];
    }

    // Build batch mutation with aliases
    const aliases: string[] = [];
    const variables: Record<string, unknown> = {};
    const mutationParts: string[] = [];

    batchData.forEach((data, i) => {
      const alias = `c${i}`;
      aliases.push(alias);

      const input: Record<string, unknown> = {
        title: data.title,
        type: data.type,
        status: data.status,
        priority: data.priority,
        body: data.description,
        parent: data.parent,
      };

      variables[alias] = input;
      mutationParts.push(`${alias}: createBean(input: $${alias}) { ...BeanFields }`);
    });

    const mutation = `
      ${graphql.BEAN_FIELDS}
      mutation BatchCreate(${aliases.map(a => `$${a}: CreateBeanInput!`).join(', ')}) {
        ${mutationParts.join('\n        ')}
      }
    `;

    try {
      const { data: resp, errors } = await this.executeGraphQL<Record<string, RawBeanFromCLI>>(mutation, variables);

      const results: Array<
        { success: true; bean: Bean } | { success: false; error: Error; data: (typeof batchData)[0] }
      > = batchData.map((data, i) => {
        const alias = aliases[i];
        const error = errors?.find(e => e.path?.includes(alias));

        if (error) {
          return { success: false, error: new Error(error.message), data };
        }

        const beanData = resp[alias];
        if (!beanData) {
          return { success: false, error: new Error('Internal error: Mutation results missing for alias'), data };
        }

        return { success: true, bean: this.normalizeBean(beanData) };
      });

      // Repair frontmatter for all successfully created beans. The beans CLI does
      // not quote YAML title values, so titles containing colons produce invalid
      // frontmatter that breaks subsequent `beans graphql` calls.
      await Promise.all(
        results.map(result =>
          result.success && result.bean.path ? this.repairBeanFrontmatter(result.bean.path) : Promise.resolve()
        )
      );

      return results;
    } catch (error) {
      // Entire batch failed
      return batchData.map(data => ({ success: false, error: error as Error, data }));
    }
  }

  /**
   * Batch update multiple beans in parallel
   * Returns array of results with success/failure status for each operation
   * @param batchUpdates Array of bean ID and update data pairs
   * @returns Array of results with bean or error for each operation
   */
  async batchUpdateBeans(
    batchUpdates: Array<{
      id: string;
      updates: {
        status?: string;
        type?: string;
        priority?: string;
        parent?: string;
        clearParent?: boolean;
        blocking?: string[];
        blockedBy?: string[];
      };
    }>
  ): Promise<Array<{ success: true; bean: Bean } | { success: false; error: Error; id: string }>> {
    if (batchUpdates.length === 0) {
      return [];
    }

    // Build batch mutation with aliases
    const aliases: string[] = [];
    const variables: Record<string, unknown> = {};
    const mutationParts: string[] = [];

    batchUpdates.forEach(({ id, updates }, i) => {
      const alias = `u${i}`;
      aliases.push(alias);

      const input: Record<string, unknown> = {
        status: updates.status,
        type: updates.type,
        priority: updates.priority,
      };

      if (updates.parent !== undefined) {
        input.parent = updates.parent;
      } else if (updates.clearParent) {
        input.parent = '';
      }

      if (updates.blocking) {
        input.addBlocking = updates.blocking;
      }

      if (updates.blockedBy) {
        input.addBlockedBy = updates.blockedBy;
      }

      variables[alias] = input;
      mutationParts.push(`${alias}: updateBean(id: $id${i}, input: $${alias}) { ...BeanFields }`);
      variables[`id${i}`] = id;
    });

    const mutationDefs = aliases.map((a, i) => `$id${i}: ID!, $${a}: UpdateBeanInput!`).join(', ');

    const mutation = `
      ${graphql.BEAN_FIELDS}
      mutation BatchUpdate(${mutationDefs}) {
        ${mutationParts.join('\n        ')}
      }
    `;

    try {
      const { data: resp, errors } = await this.executeGraphQL<Record<string, RawBeanFromCLI>>(mutation, variables);

      return batchUpdates.map(({ id }, i) => {
        const alias = aliases[i];
        const error = errors?.find(e => e.path?.includes(alias));

        if (error) {
          return { success: false, error: new Error(error.message), id };
        }

        const beanData = resp[alias];
        if (!beanData) {
          return { success: false, error: new Error('Internal error: Mutation results missing for alias'), id };
        }

        return { success: true, bean: this.normalizeBean(beanData) };
      });
    } catch (error) {
      // Entire batch failed
      return batchUpdates.map(({ id }) => ({ success: false, error: error as Error, id }));
    }
  }

  /**
   * Batch delete multiple beans in parallel
   * Returns array of results with success/failure status for each operation
   * @param ids Array of bean IDs to delete
   * @returns Array of results with success/failure status for each deletion
   */
  async batchDeleteBeans(
    ids: string[]
  ): Promise<Array<{ success: true; id: string } | { success: false; error: Error; id: string }>> {
    if (ids.length === 0) {
      return [];
    }

    const mutationParts = ids.map((_, i) => `d${i}: deleteBean(id: $id${i})`);
    const variableDefs = ids.map((_, i) => `$id${i}: ID!`).join(', ');
    const variables = ids.reduce((acc, id, i) => ({ ...acc, [`id${i}`]: id }), {});

    const mutation = `
      mutation BatchDelete(${variableDefs}) {
        ${mutationParts.join('\n        ')}
      }
    `;

    try {
      const { errors } = await this.executeGraphQL<Record<string, boolean>>(mutation, variables);

      return ids.map((id, i) => {
        const alias = `d${i}`;
        const error = errors?.find(e => e.path?.includes(alias));

        if (error) {
          return { success: false, error: new Error(error.message), id };
        }

        return { success: true, id };
      });
    } catch (error) {
      // Entire batch failed
      return ids.map(id => ({ success: false, error: error as Error, id }));
    }
  }

  /**
   * Initialize Beans in the current workspace
   */
  async init(options?: { prefix?: string; defaultType?: string; defaultStatus?: string }): Promise<void> {
    const args = ['init', '--json'];

    if (options?.prefix) {
      args.push('--prefix', options.prefix);
    }

    if (options?.defaultType) {
      args.push('--default-type', options.defaultType);
    }

    if (options?.defaultStatus) {
      args.push('--default-status', options.defaultStatus);
    }

    await this.execute<Record<string, unknown>>(args);
  }

  /**
   * Get project-focused guidance text from `beans graphql --schema`.
   */
  async graphqlSchema(): Promise<string> {
    return (await this.executeText(['graphql', '--schema'])).trim();
  }
}
