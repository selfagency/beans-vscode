/**
 * Base error class for all Beans-related errors
 */
export abstract class BeansError extends Error {
  abstract readonly code: string;

  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when Beans CLI cannot be found in PATH
 */
export class BeansCLINotFoundError extends BeansError {
  readonly code = 'CLI_NOT_FOUND';

  constructor(message: string = 'Beans CLI not found in PATH', cause?: Error) {
    super(message, cause);
  }
}

/**
 * Error thrown when .beans.yml configuration file is missing or invalid
 */
export class BeansConfigMissingError extends BeansError {
  readonly code = 'CONFIG_MISSING';

  constructor(message: string = '.beans.yml not found or invalid', cause?: Error) {
    super(message, cause);
  }
}

/**
 * Error thrown when JSON parsing from Beans CLI fails
 */
export class BeansJSONParseError extends BeansError {
  readonly code = 'JSON_PARSE_ERROR';

  constructor(message: string, public readonly output: string, cause?: Error) {
    super(message, cause);
  }
}

/**
 * Error thrown when Beans integrity check fails
 */
export class BeansIntegrityCheckFailedError extends BeansError {
  readonly code = 'INTEGRITY_CHECK_FAILED';

  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}

/**
 * Error thrown when a concurrent modification is detected (ETag mismatch)
 */
export class BeansConcurrencyError extends BeansError {
  readonly code = 'CONCURRENCY_ERROR';

  constructor(message: string, public readonly currentEtag: string, cause?: Error) {
    super(message, cause);
  }
}

/**
 * Error thrown when a bean operation times out
 */
export class BeansTimeoutError extends BeansError {
  readonly code = 'TIMEOUT';

  constructor(message: string = 'Beans operation timed out', cause?: Error) {
    super(message, cause);
  }
}

/**
 * Error thrown when insufficient permissions for Beans operation
 */
export class BeansPermissionError extends BeansError {
  readonly code = 'PERMISSION_ERROR';

  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}

/**
 * Check if error is a Beans-specific error
 */
export function isBeansError(error: unknown): error is BeansError {
  return error instanceof BeansError;
}

/**
 * Extract user-friendly error message from any error
 */
export function getUserMessage(error: unknown): string {
  if (isBeansError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
