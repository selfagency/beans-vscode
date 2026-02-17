import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

/**
 * Log level enumeration
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Singleton logger for the Beans extension
 * Provides structured logging with configurable log levels
 */
export class BeansOutput {
  private static instance: BeansOutput;
  private outputChannel: vscode.OutputChannel;
  private level: LogLevel = 'info';
  private mirrorFilePath: string | undefined;
  private mirrorWriteQueue: Promise<void> = Promise.resolve();
  private mirrorDirReady = false;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Beans', { log: true });
    this.updateLevel();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BeansOutput {
    if (!BeansOutput.instance) {
      BeansOutput.instance = new BeansOutput();
    }
    return BeansOutput.instance;
  }

  /**
   * Update log level from configuration
   */
  private updateLevel(): void {
    const config = vscode.workspace.getConfiguration('beans');
    this.level = config.get<LogLevel>('logging.level', 'info');
  }

  /**
   * Check if a log level should be logged based on current configuration
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Format timestamp for log messages
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private writeMirror(line: string): void {
    const mirrorFilePath = this.mirrorFilePath;
    if (!mirrorFilePath) {
      return;
    }

    this.mirrorWriteQueue = this.mirrorWriteQueue
      .then(async () => {
        if (!this.mirrorDirReady) {
          await fs.mkdir(path.dirname(mirrorFilePath), { recursive: true });
          this.mirrorDirReady = true;
        }
        await fs.appendFile(mirrorFilePath, `${line}\n`, 'utf8');
      })
      .catch(() => {
        // Swallow mirror errors to avoid interfering with extension logging.
      });
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      const argsStr = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
      const line = `[${this.getTimestamp()}] [DEBUG] ${message}${argsStr}`;
      this.outputChannel.appendLine(line);
      this.writeMirror(line);
    }
  }

  /**
   * Log info message
   */
  info(message: string): void {
    if (this.shouldLog('info')) {
      const line = `[${this.getTimestamp()}] [INFO] ${message}`;
      this.outputChannel.appendLine(line);
      this.writeMirror(line);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, error?: Error): void {
    if (this.shouldLog('warn')) {
      const errorStr = error ? ` - ${error.message}` : '';
      const line = `[${this.getTimestamp()}] [WARN] ${message}${errorStr}`;
      this.outputChannel.appendLine(line);
      this.writeMirror(line);
    }
  }

  /**
   * Log error message with optional error object
   */
  error(message: string, error?: Error): void {
    if (this.shouldLog('error')) {
      const line = `[${this.getTimestamp()}] [ERROR] ${message}`;
      this.outputChannel.appendLine(line);
      this.writeMirror(line);
      if (error) {
        const stackLine = `  ${error.stack || error.message}`;
        this.outputChannel.appendLine(stackLine);
        this.writeMirror(stackLine);
      }
    }
  }

  /**
   * Enable mirroring output messages to a workspace file for MCP log access.
   */
  setMirrorFilePath(filePath: string): void {
    const changed = this.mirrorFilePath !== filePath;
    this.mirrorFilePath = filePath;
    if (changed) {
      this.mirrorDirReady = false;
    }
  }

  getMirrorFilePath(): string | undefined {
    return this.mirrorFilePath;
  }

  /**
   * Show the output channel
   */
  show(): void {
    this.outputChannel.show();
  }

  /**
   * Dispose the output channel
   */
  dispose(): void {
    this.outputChannel.dispose();
  }

  /**
   * Refresh configuration (called when config changes)
   */
  refreshConfig(): void {
    this.updateLevel();
  }
}
