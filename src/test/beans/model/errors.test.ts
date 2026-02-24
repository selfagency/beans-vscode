import { describe, it, expect } from 'vitest';
import {
  BeansError,
  BeansCLINotFoundError,
  BeansConfigMissingError,
  BeansJSONParseError,
  BeansIntegrityCheckFailedError,
  BeansConcurrencyError,
  BeansTimeoutError,
  BeansPermissionError,
  isBeansError,
  getUserMessage,
  extractCliError,
} from '../../../beans/model/errors';

describe('Beans Error Classes', () => {
  describe('BeansCLINotFoundError', () => {
    it('should create error with default message', () => {
      const error = new BeansCLINotFoundError();

      expect(error).toBeInstanceOf(BeansError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Beans CLI not found in PATH');
      expect(error.code).toBe('CLI_NOT_FOUND');
      expect(error.name).toBe('BeansCLINotFoundError');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with custom message', () => {
      const error = new BeansCLINotFoundError('Custom CLI error');

      expect(error.message).toBe('Custom CLI error');
      expect(error.code).toBe('CLI_NOT_FOUND');
    });

    it('should include cause when provided', () => {
      const cause = new Error('Original error');
      const error = new BeansCLINotFoundError('CLI error', cause);

      expect(error.cause).toBe(cause);
    });

    it('should have stack trace', () => {
      const error = new BeansCLINotFoundError();

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('BeansCLINotFoundError');
    });
  });

  describe('BeansConfigMissingError', () => {
    it('should create error with default message', () => {
      const error = new BeansConfigMissingError();

      expect(error).toBeInstanceOf(BeansError);
      expect(error.message).toBe('.beans.yml not found or invalid');
      expect(error.code).toBe('CONFIG_MISSING');
      expect(error.name).toBe('BeansConfigMissingError');
    });

    it('should create error with custom message', () => {
      const error = new BeansConfigMissingError('Config file corrupted');

      expect(error.message).toBe('Config file corrupted');
    });

    it('should include cause when provided', () => {
      const cause = new Error('ENOENT');
      const error = new BeansConfigMissingError('Config not found', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('BeansJSONParseError', () => {
    it('should create error with output property', () => {
      const output = '{ invalid json }';
      const error = new BeansJSONParseError('Failed to parse JSON', output);

      expect(error).toBeInstanceOf(BeansError);
      expect(error.message).toBe('Failed to parse JSON');
      expect(error.code).toBe('JSON_PARSE_ERROR');
      expect(error.output).toBe(output);
      expect(error.name).toBe('BeansJSONParseError');
    });

    it('should include cause when provided', () => {
      const cause = new SyntaxError('Unexpected token');
      const error = new BeansJSONParseError('JSON parse failed', '{ bad }', cause);

      expect(error.cause).toBe(cause);
      expect(error.output).toBe('{ bad }');
    });
  });

  describe('BeansIntegrityCheckFailedError', () => {
    it('should create error with message', () => {
      const error = new BeansIntegrityCheckFailedError('Integrity check failed');

      expect(error).toBeInstanceOf(BeansError);
      expect(error.message).toBe('Integrity check failed');
      expect(error.code).toBe('INTEGRITY_CHECK_FAILED');
      expect(error.name).toBe('BeansIntegrityCheckFailedError');
    });

    it('should include cause when provided', () => {
      const cause = new Error('Checksum mismatch');
      const error = new BeansIntegrityCheckFailedError('Integrity failed', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('BeansConcurrencyError', () => {
    it('should create error with currentEtag property', () => {
      const etag = 'new-etag-value';
      const error = new BeansConcurrencyError('Bean was modified', etag);

      expect(error).toBeInstanceOf(BeansError);
      expect(error.message).toBe('Bean was modified');
      expect(error.code).toBe('CONCURRENCY_ERROR');
      expect(error.currentEtag).toBe(etag);
      expect(error.name).toBe('BeansConcurrencyError');
    });

    it('should include cause when provided', () => {
      const cause = new Error('ETag mismatch');
      const error = new BeansConcurrencyError('Concurrent update detected', 'etag-123', cause);

      expect(error.cause).toBe(cause);
      expect(error.currentEtag).toBe('etag-123');
    });
  });

  describe('BeansTimeoutError', () => {
    it('should create error with default message', () => {
      const error = new BeansTimeoutError();

      expect(error).toBeInstanceOf(BeansError);
      expect(error.message).toBe('Beans operation timed out');
      expect(error.code).toBe('TIMEOUT');
      expect(error.name).toBe('BeansTimeoutError');
    });

    it('should create error with custom message', () => {
      const error = new BeansTimeoutError('Operation exceeded 30s timeout');

      expect(error.message).toBe('Operation exceeded 30s timeout');
    });

    it('should include cause when provided', () => {
      const cause = new Error('Network timeout');
      const error = new BeansTimeoutError('Timeout', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('BeansPermissionError', () => {
    it('should create error with message', () => {
      const error = new BeansPermissionError('Insufficient permissions');

      expect(error).toBeInstanceOf(BeansError);
      expect(error.message).toBe('Insufficient permissions');
      expect(error.code).toBe('PERMISSION_ERROR');
      expect(error.name).toBe('BeansPermissionError');
    });

    it('should include cause when provided', () => {
      const cause = new Error('EACCES');
      const error = new BeansPermissionError('Permission denied', cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('isBeansError', () => {
    it('should return true for BeansError instances', () => {
      const error = new BeansCLINotFoundError();

      expect(isBeansError(error)).toBe(true);
    });

    it('should return true for all BeansError subclasses', () => {
      expect(isBeansError(new BeansCLINotFoundError())).toBe(true);
      expect(isBeansError(new BeansConfigMissingError())).toBe(true);
      expect(isBeansError(new BeansJSONParseError('msg', 'output'))).toBe(true);
      expect(isBeansError(new BeansIntegrityCheckFailedError('msg'))).toBe(true);
      expect(isBeansError(new BeansConcurrencyError('msg', 'etag'))).toBe(true);
      expect(isBeansError(new BeansTimeoutError())).toBe(true);
      expect(isBeansError(new BeansPermissionError('msg'))).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');

      expect(isBeansError(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isBeansError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isBeansError(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isBeansError('error string')).toBe(false);
    });

    it('should return false for object', () => {
      expect(isBeansError({ message: 'error' })).toBe(false);
    });
  });

  describe('getUserMessage', () => {
    it('should extract message from BeansError', () => {
      const error = new BeansCLINotFoundError('CLI not found');

      expect(getUserMessage(error)).toBe('CLI not found');
    });

    it('should extract message from regular Error', () => {
      const error = new Error('Something went wrong');

      expect(getUserMessage(error)).toBe('Something went wrong');
    });

    it('should convert string to message', () => {
      expect(getUserMessage('Error string')).toBe('Error string');
    });

    it('should convert number to string', () => {
      expect(getUserMessage(404)).toBe('404');
    });

    it('should convert null to string', () => {
      expect(getUserMessage(null)).toBe('null');
    });

    it('should convert undefined to string', () => {
      expect(getUserMessage(undefined)).toBe('undefined');
    });

    it('should convert object to string', () => {
      expect(getUserMessage({ code: 500 })).toBe('[object Object]');
    });
  });

  describe('Error inheritance chain', () => {
    it('should have correct instanceof relationships', () => {
      const error = new BeansCLINotFoundError();

      expect(error instanceof BeansCLINotFoundError).toBe(true);
      expect(error instanceof BeansError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should have different instances for different error types', () => {
      const cliError = new BeansCLINotFoundError();
      const configError = new BeansConfigMissingError();

      expect(cliError instanceof BeansCLINotFoundError).toBe(true);
      expect(cliError instanceof BeansConfigMissingError).toBe(false);
      expect(configError instanceof BeansConfigMissingError).toBe(true);
      expect(configError instanceof BeansCLINotFoundError).toBe(false);
    });
  });

  describe('extractCliError', () => {
    it('extracts graphql error message from full CLI output', () => {
      const raw =
        'Command failed: beans graphql --json fragment BeanFields on Bean { id }\n' +
        'Error: graphql: epic beans can only have milestone as parent, not epic\n' +
        'Usage: beans graphql <query> [flags]\n' +
        'Flags:\n  -h, --help  help for graphql';
      expect(extractCliError(raw)).toBe('Epic beans can only have milestone as parent, not epic');
    });

    it('capitalises the first letter of the extracted message', () => {
      expect(extractCliError('Command failed\nError: graphql: lower case message\nUsage: ...')).toBe(
        'Lower case message'
      );
    });

    it('capitalises and returns the message when no Error: pattern is found', () => {
      expect(extractCliError('some generic error text')).toBe('Some generic error text');
    });

    it('handles Error: without graphql: prefix', () => {
      expect(extractCliError('Error: bean not found\nUsage: ...')).toBe('Bean not found');
    });

    it('getUserMessage calls extractCliError for plain Error instances', () => {
      const err = new Error(
        'Command failed: beans graphql --json\nError: graphql: bug beans can only have milestone, epic, or feature as parent, not task\nUsage: beans graphql'
      );
      expect(getUserMessage(err)).toBe('Bug beans can only have milestone, epic, or feature as parent, not task');
    });
  });

  describe('Stack trace capture', () => {
    it('should maintain proper stack trace', () => {
      function throwError() {
        throw new BeansCLINotFoundError('Test error');
      }

      try {
        throwError();
      } catch (error) {
        expect(error).toBeInstanceOf(BeansCLINotFoundError);
        expect((error as BeansCLINotFoundError).stack).toContain('throwError');
      }
    });

    it('should capture stack trace when available', () => {
      const error = new BeansTimeoutError();

      // Should have stack trace
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('BeansTimeoutError');
    });
  });
});
