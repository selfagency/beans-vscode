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

const execFileAsync = promisify(execFile);

/**
 * Raw bean data structure as returned by Beans CLI
 */
interface RawBeanFromCLI {
  id: string;
  title: string;
  slug: string;
  path: string;
  body: string;
  status: string;
  type: string;
  priority?: string;
  tags?: string[];
  parent?: string;
  parent_id?: string;
  parentId?: string;
  blocking?: string[];
  blocking_ids?: string[];
  blockingIds?: string[];
  blocked_by?: string[];
  blocked_by_ids?: string[];
  blockedBy?: string[];
  blockedByIds?: string[];
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  code?: string;
  etag: string;
}

/**
 * Service for interacting with the Beans CLI
 * Provides type-safe wrappers around CLI operations with secure command execution
 */
export class BeansService {
  private readonly logger = BeansOutput.getInstance();
  private cliPath: string;
  private workspaceRoot: string;
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
    // Create a unique key for this request
    const requestKey = JSON.stringify(args);

    // Check for in-flight request with same key
    const existingRequest = this.inFlightRequests.get(requestKey);
    if (existingRequest) {
      this.logger.debug(`Deduplicating request: ${this.cliPath} ${args.join(' ')}`);
      return existingRequest as Promise<T>;
    }

    // Create new request with retry logic
    this.logger.info(`Executing: ${this.cliPath} ${args.join(' ')}`);

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
          }

          if (stderr) {
            // Beans CLI sometimes outputs info to stderr
            if (stderr.includes('[INFO]')) {
              this.logger.debug(`CLI info: ${stderr}`);
            } else {
              this.logger.warn(`CLI stderr: ${stderr}`);
            }
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
    this.logger.info(`Executing text command: ${this.cliPath} ${args.join(' ')}`);

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
    // Try to read from .beans.yml
    const configManager = new BeansConfigManager(this.workspaceRoot);
    const yamlConfig = await configManager.read();

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
    return yamlConfig ? { ...defaults, ...yamlConfig } : defaults;
  }

  /**
   * List beans with optional filters
   * Supports offline mode with cached data fallback
   */
  async listBeans(options?: { status?: string[]; type?: string[]; search?: string; parent?: string }): Promise<Bean[]> {
    try {
      const args = ['list', '--json'];

      // Status and type filters use repeated flags, not comma-separated values
      if (options?.status && options.status.length > 0) {
        for (const status of options.status) {
          args.push('--status', status);
        }
      }

      if (options?.type && options.type.length > 0) {
        for (const type of options.type) {
          args.push('--type', type);
        }
      }

      if (options?.search) {
        args.push('--search', options.search);
      }

      if (options?.parent) {
        args.push('--parent', options.parent);
      }

      const result = await this.execute<RawBeanFromCLI[]>(args);
      const beans = result || [];

      // Normalize bean data to ensure arrays are always arrays
      const normalizedBeans = beans.map(bean => this.normalizeBean(bean, { allowPartial: true }));

      // Update cache on successful fetch
      this.updateCache(normalizedBeans);
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

      // For other errors, just throw
      throw error;
    }
  }

  /**
   * Normalize bean data from CLI to ensure required fields exist.
   * CLI outputs snake_case (created_at, updated_at, blocked_by, parent_id, blocking_ids, blocked_by_ids).
   * We map to camelCase model fields and derive the short 'code' from the ID.
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
    // Some Beans CLI responses (notably `list --json`) can omit content-heavy fields
    // like `body` and metadata fields like `etag`, so list normalization supports
    // partial payloads and supplies safe fallbacks.
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

    const bean = rawBean;
    // Derive short code from ID: last segment after final hyphen
    const code = bean.code || (bean.id ? bean.id.split('-').pop() : '') || '';

    // Parse and validate dates
    const createdAt = this.parseDate(bean.createdAt || bean.created_at, 'created_at', bean.id);
    const updatedAt = this.parseDate(bean.updatedAt || bean.updated_at, 'updated_at', bean.id);

    return {
      id: bean.id,
      code,
      slug: bean.slug ?? '',
      path: bean.path ?? '',
      title: bean.title,
      body: bean.body ?? '',
      status: bean.status as BeanStatus,
      type: bean.type as BeanType,
      priority: bean.priority as BeanPriority | undefined,
      tags: bean.tags || [],
      parent: bean.parent || bean.parentId || bean.parent_id,
      blocking: bean.blocking || bean.blockingIds || bean.blocking_ids || [],
      // Prefer canonical *_ids fields when both canonical and legacy keys are present.
      blockedBy: bean.blockedBy || bean.blockedByIds || bean.blocked_by_ids || bean.blocked_by || [],
      createdAt,
      updatedAt,
      etag: bean.etag ?? '',
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
    const result = await this.execute<RawBeanFromCLI>(['show', '--json', id]);
    try {
      return this.normalizeBean(result);
    } catch (error) {
      // Some Beans CLI versions can return partial payloads for `show --json`
      // (omitting fields like slug/path/body/etag). Keep strict validation for
      // core identity fields, but gracefully accept partial metadata.
      if (error instanceof BeansJSONParseError) {
        this.logger.warn(`Partial bean payload received from show for ${id}; using safe defaults for missing fields.`);
        return this.normalizeBean(result, { allowPartial: true });
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

    const args = ['create', '--json', data.title, '-t', data.type];

    if (data.status) {
      args.push('-s', data.status);
    }

    if (data.priority) {
      args.push('-p', data.priority);
    }

    if (data.description) {
      args.push('-d', data.description);
    }

    if (data.parent) {
      args.push('--parent', data.parent);
    }

    const result = await this.execute<RawBeanFromCLI>(args);
    return this.normalizeBean(result);
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

    const args = ['update', '--json', id];

    if (updates.status) {
      args.push('-s', updates.status);
    }

    if (updates.type) {
      args.push('-t', updates.type);
    }

    if (updates.priority) {
      args.push('-p', updates.priority);
    }

    if (updates.parent !== undefined && updates.clearParent) {
      throw new Error('Cannot set parent and clear parent in the same update');
    }

    if (updates.parent !== undefined) {
      args.push('--parent', updates.parent);
    }

    if (updates.clearParent) {
      // Beans CLI clears parent when --parent is passed with an empty value.
      args.push('--parent', '');
    }

    if (updates.blocking) {
      args.push('--blocking', updates.blocking.join(','));
    }

    if (updates.blockedBy) {
      args.push('--blocked-by', updates.blockedBy.join(','));
    }

    const result = await this.execute<RawBeanFromCLI>(args);
    let updatedBean: Bean;

    try {
      updatedBean = this.normalizeBean(result);
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

    // Recursively complete children if parent is completed
    if (updates.status === 'completed') {
      try {
        const children = await this.listBeans({ parent: id });
        for (const child of children) {
          // If child is not already terminal (completed/scrapped), mark as completed
          if (child.status !== 'completed' && child.status !== 'scrapped') {
            this.logger.info(`Parent ${id} completed; recursively completing child ${child.id}`);
            await this.updateBeanWithConfig(child.id, { status: 'completed' }, config);
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
    await this.execute<Record<string, unknown>>(['delete', '--json', id]);
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
    // Fetch config once for the entire batch to avoid multiple I/O operations
    const config = await this.getConfig();

    const promises = batchData.map(async data => {
      try {
        const bean = await this.createBeanWithConfig(data, config);
        return { success: true as const, bean };
      } catch (error) {
        return { success: false as const, error: error as Error, data };
      }
    });

    return Promise.all(promises);
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
    // Fetch config once for the entire batch to avoid multiple I/O operations
    const config = await this.getConfig();

    const promises = batchUpdates.map(async ({ id, updates }) => {
      try {
        const bean = await this.updateBeanWithConfig(id, updates, config);
        return { success: true as const, bean };
      } catch (error) {
        return { success: false as const, error: error as Error, id };
      }
    });

    return Promise.all(promises);
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
    const promises = ids.map(async id => {
      try {
        await this.deleteBean(id);
        return { success: true as const, id };
      } catch (error) {
        return { success: false as const, error: error as Error, id };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Initialize Beans in the current workspace
   */
  async init(options?: { prefix?: string; defaultType?: string; defaultStatus?: string }): Promise<void> {
    const args = ['init'];

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
   * Get project-focused guidance text from `beans prime`.
   */
  async prime(): Promise<string> {
    return (await this.executeText(['prime'])).trim();
  }
}
