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

	/**
	 * Log debug message
	 */
	debug(message: string, ...args: unknown[]): void {
		if (this.shouldLog('debug')) {
			const argsStr = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
			this.outputChannel.appendLine(`[${this.getTimestamp()}] [DEBUG] ${message}${argsStr}`);
		}
	}

	/**
	 * Log info message
	 */
	info(message: string): void {
		if (this.shouldLog('info')) {
			this.outputChannel.appendLine(`[${this.getTimestamp()}] [INFO] ${message}`);
		}
	}

	/**
	 * Log warning message
	 */
	warn(message: string, error?: Error): void {
		if (this.shouldLog('warn')) {
			const errorStr = error ? ` - ${error.message}` : '';
			this.outputChannel.appendLine(`[${this.getTimestamp()}] [WARN] ${message}${errorStr}`);
		}
	}

	/**
	 * Log error message with optional error object
	 */
	error(message: string, error?: Error): void {
		if (this.shouldLog('error')) {
			this.outputChannel.appendLine(`[${this.getTimestamp()}] [ERROR] ${message}`);
			if (error) {
				this.outputChannel.appendLine(`  ${error.stack || error.message}`);
			}
		}
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
