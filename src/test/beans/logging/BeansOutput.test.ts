import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { BeansOutput } from '../../../beans/logging/BeansOutput';

// Mock vscode
vi.mock('vscode', () => {
  const mockOutputChannel = {
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  };

  const mockConfig = {
    get: vi.fn((key: string, defaultValue?: any) => {
      if (key === 'logging.level') {
        return 'info';
      }
      if (key === 'logging.diagnostics.enabled') {
        return false;
      }
      return defaultValue;
    }),
  };

  return {
    workspace: {
      getConfiguration: vi.fn(() => mockConfig),
    },
    window: {
      createOutputChannel: vi.fn(() => mockOutputChannel),
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

describe('BeansOutput', () => {
  let logger: BeansOutput;
  let mockOutputChannel: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get fresh instance - singleton pattern means we need to get the same instance
    logger = BeansOutput.getInstance();
    mockOutputChannel = vscode.window.createOutputChannel('Beans', { log: true });
  });

  describe('singleton pattern', () => {
    it('returns the same instance', () => {
      const instance1 = BeansOutput.getInstance();
      const instance2 = BeansOutput.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('log levels', () => {
    it('logs debug messages when level is debug', () => {
      const config = vscode.workspace.getConfiguration('beans');
      (config.get as any).mockReturnValue('debug');
      logger.refreshConfig();

      logger.debug('Test debug message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Test debug message'));
    });

    it('logs debug messages with args', () => {
      const config = vscode.workspace.getConfiguration('beans');
      (config.get as any).mockReturnValue('debug');
      logger.refreshConfig();

      logger.debug('Test message', { foo: 'bar' }, 123);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[DEBUG\] Test message.*\{"foo":"bar"\},123/)
      );
    });

    it('logs info messages', () => {
      logger.info('Test info message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test info message'));
    });

    it('logs warning messages', () => {
      logger.warn('Test warning');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[WARN] Test warning'));
    });

    it('logs warning messages with error', () => {
      const error = new Error('Test error');
      logger.warn('Test warning', error);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] Test warning - Test error')
      );
    });

    it('logs error messages', () => {
      logger.error('Test error');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Test error'));
    });

    it('logs error messages with error object', () => {
      const error = new Error('Detailed error');
      error.stack = 'Error: Detailed error\n  at test.ts:123';
      logger.error('Test error', error);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Test error'));
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('Error: Detailed error'));
    });

    it('does not log debug when level is info', () => {
      const config = vscode.workspace.getConfiguration('beans');
      (config.get as any).mockReturnValue('info');
      logger.refreshConfig();

      vi.clearAllMocks();
      logger.debug('Should not log');
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });

    it('does not log info when level is warn', () => {
      const config = vscode.workspace.getConfiguration('beans');
      (config.get as any).mockReturnValue('warn');
      logger.refreshConfig();

      vi.clearAllMocks();
      logger.info('Should not log');
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });

    it('does not log warn when level is error', () => {
      const config = vscode.workspace.getConfiguration('beans');
      (config.get as any).mockReturnValue('error');
      logger.refreshConfig();

      vi.clearAllMocks();
      logger.warn('Should not log');
      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });
  });

  describe('mirror file path', () => {
    it('sets and gets mirror file path', () => {
      const filePath = '/tmp/beans-log.txt';
      logger.setMirrorFilePath(filePath);
      expect(logger.getMirrorFilePath()).toBe(filePath);
    });

    // Note: Testing the actual file writing in writeMirror is complex due to
    // the void async pattern and requires more sophisticated mocking.
    // The setMirrorFilePath/getMirrorFilePath API is tested above.
  });

  describe('output channel methods', () => {
    it('shows output channel', () => {
      logger.show();
      expect(mockOutputChannel.show).toHaveBeenCalled();
    });

    it('disposes output channel', () => {
      logger.dispose();
      expect(mockOutputChannel.dispose).toHaveBeenCalled();
    });
  });

  describe('configuration refresh', () => {
    it('updates log level on refreshConfig', () => {
      const config = vscode.workspace.getConfiguration('beans');
      (config.get as any).mockReturnValue('debug');

      logger.refreshConfig();

      vi.clearAllMocks();
      logger.debug('Should now log');
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
    });
  });

  describe('diagnostics mode', () => {
    it('does not log diagnostics payload when diagnostics mode is disabled', () => {
      const config = vscode.workspace.getConfiguration('beans');
      (config.get as any).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'logging.level') {
          return 'debug';
        }
        if (key === 'logging.diagnostics.enabled') {
          return false;
        }
        return defaultValue;
      });
      logger.refreshConfig();

      vi.clearAllMocks();
      logger.diagnostics('GraphQL variables', { filter: { status: ['todo'] } });

      expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });

    it('logs diagnostics payload when diagnostics mode is enabled', () => {
      const config = vscode.workspace.getConfiguration('beans');
      (config.get as any).mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'logging.level') {
          return 'debug';
        }
        if (key === 'logging.diagnostics.enabled') {
          return true;
        }
        return defaultValue;
      });
      logger.refreshConfig();

      logger.diagnostics('GraphQL query', 'query ListBeans { beans { id } }');

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] [DIAGNOSTICS] GraphQL query')
      );
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('ListBeans'));
    });
  });

  describe('timestamp formatting', () => {
    it('includes ISO timestamp in log messages', () => {
      logger.info('Test');
      const call = mockOutputChannel.appendLine.mock.calls[0][0];
      // Check format matches ISO 8601
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });
  });
});
