import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { BeansOutput } from '../logging';
import {
  Bean,
  BeansCLINotFoundError,
  BeansConfig,
  BeansConfigMissingError,
  BeansJSONParseError,
  BeansTimeoutError
} from '../model';

const execAsync = promisify(exec);

/**
 * Service for interacting with the Beans CLI
 * Provides type-safe wrappers around CLI operations with secure command execution
 */
export class BeansService {
  private readonly logger = BeansOutput.getInstance();
  private cliPath: string;
  private workspaceRoot: string;

  constructor(defaultWorkspaceRoot: string) {
    const config = vscode.workspace.getConfiguration('beans');
    this.cliPath = config.get<string>('cliPath', 'beans');
    this.workspaceRoot = config.get<string>('workspaceRoot', '') || defaultWorkspaceRoot;
  }

  /**
   * Check if beans CLI is available in PATH
   */
  async checkCLIAvailable(): Promise<boolean> {
    try {
      await execAsync(`${this.cliPath} --version`, {
        cwd: this.workspaceRoot,
        timeout: 5000
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
   * Execute beans CLI command with JSON output
   * Security: Uses argument array to prevent shell injection
   * @param args Command arguments (don't include 'beans' itself)
   * @returns Parsed JSON response
   */
  private async execute<T>(args: string[]): Promise<T> {
    // Build command with proper escaping
    const command = `${this.cliPath} ${args.join(' ')}`;
    this.logger.info(`Executing: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workspaceRoot,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 30000 // 30s
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
   */
  async getConfig(): Promise<BeansConfig> {
    const result = await this.execute<{ config: BeansConfig }>(['config', '--json']);
    if (!result.config) {
      throw new BeansConfigMissingError('.beans.yml not found or invalid');
    }
    return result.config;
  }

  /**
   * List beans with optional filters
   */
  async listBeans(options?: { status?: string[]; type?: string[]; search?: string }): Promise<Bean[]> {
    const args = ['list', '--json'];

    if (options?.status && options.status.length > 0) {
      args.push('--status', options.status.join(','));
    }

    if (options?.type && options.type.length > 0) {
      args.push('--type', options.type.join(','));
    }

    if (options?.search) {
      args.push('--search', options.search);
    }

    const result = await this.execute<{ beans: Bean[] }>(args);
    return result.beans || [];
  }

  /**
   * Get a single bean by ID
   */
  async showBean(id: string): Promise<Bean> {
    const result = await this.execute<{ bean: Bean }>(['show', '--json', id]);
    return result.bean;
  }

  /**
   * Create a new bean
   */
  async createBean(data: {
    title: string;
    type: string;
    status?: string;
    priority?: string;
    description?: string;
    parent?: string;
  }): Promise<Bean> {
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

    const result = await this.execute<{ bean: Bean }>(args);
    return result.bean;
  }

  /**
   * Update an existing bean
   */
  async updateBean(
    id: string,
    updates: {
      status?: string;
      type?: string;
      priority?: string;
      parent?: string;
      blocking?: string[];
      blockedBy?: string[];
    }
  ): Promise<Bean> {
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

    if (updates.parent !== undefined) {
      args.push('--parent', updates.parent);
    }

    if (updates.blocking) {
      args.push('--blocking', updates.blocking.join(','));
    }

    if (updates.blockedBy) {
      args.push('--blocked-by', updates.blockedBy.join(','));
    }

    const result = await this.execute<{ bean: Bean }>(args);
    return result.bean;
  }

  /**
   * Delete a bean (only works for scrapped and draft beans)
   */
  async deleteBean(id: string): Promise<void> {
    await this.execute<Record<string, unknown>>(['delete', '--json', id]);
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
}
