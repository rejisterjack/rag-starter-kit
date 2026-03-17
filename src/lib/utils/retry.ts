/**
 * Retry Utility
 * 
 * Provides retry logic with exponential backoff for transient failures.
 */

/**
 * Error that can be retried
 */
export class RetryableError extends Error {
  constructor(
    message: string,
    public readonly isRetryable: boolean = true,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay between retries in ms (default: 1000) */
  delayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Maximum delay between retries in ms (default: 30000) */
  maxDelayMs?: number;
  /** Custom retry condition */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback on each retry */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    maxDelayMs = 30000,
    shouldRetry,
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const canRetry = attempt < maxRetries && (
        shouldRetry?.(lastError, attempt) ?? isRetryableError(lastError)
      );

      if (!canRetry) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        delayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );

      // Add jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * 1000;

      onRetry?.(lastError, attempt + 1, jitteredDelay);

      await sleep(jitteredDelay);
    }
  }

  throw lastError ?? new Error('Retry failed');
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  // RetryableError with explicit flag
  if (error instanceof RetryableError) {
    return error.isRetryable;
  }

  const message = error.message.toLowerCase();
  
  // Network/connection errors
  const retryablePatterns = [
    'timeout',
    'network',
    'econnreset',
    'econnrefused',
    'socket hang up',
    'socket closed',
    'temporarily unavailable',
    'rate limit',
    'too many requests',
    '429',
    '503',
    '502',
    '504',
    'internal server error',
    'bad gateway',
    'service unavailable',
    'gateway timeout',
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a circuit breaker for repeated failures
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Time in ms before attempting to close circuit */
  resetTimeoutMs?: number;
  /** Half-open request count for testing */
  halfOpenMaxCalls?: number;
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailureTime?: number;
  private halfOpenCalls = 0;

  constructor(private options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      halfOpenMaxCalls: 3,
      ...options,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenCalls >= (this.options.halfOpenMaxCalls ?? 3)) {
        throw new Error('Circuit breaker is HALF_OPEN (max calls reached)');
      }
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= (this.options.resetTimeoutMs ?? 30000);
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.halfOpenCalls = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= (this.options.failureThreshold ?? 5)) {
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): { state: CircuitState; failures: number } {
    return {
      state: this.state,
      failures: this.failures,
    };
  }
}
