/**
 * Structured Logging with Pino
 *
 * Production-grade logging with:
 * - Structured JSON output
 * - Log levels
 * - Redaction of sensitive fields
 * - Performance tracking
 * - Request correlation
 */

import pino from 'pino';

// =============================================================================
// Configuration
// =============================================================================

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// =============================================================================
// Pino Configuration
// =============================================================================

const pinoConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Pretty print in development
  transport:
    isProduction || isTest
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },

  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      '*.password',
      'token',
      '*.token',
      'apiKey',
      '*.apiKey',
      'secret',
      '*.secret',
      'authorization',
      '*.authorization',
      'cookie',
      '*.cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    remove: true,
  },

  // Base properties for all logs
  base: {
    env: process.env.NODE_ENV,
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  },

  // Enable async logging for performance
  // (buffer logs and flush asynchronously)
  ...(isProduction && {
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }),
};

// =============================================================================
// Create Logger
// =============================================================================

export const logger = pino(pinoConfig);

// =============================================================================
// Child Loggers
// =============================================================================

/**
 * Create a child logger with request context
 */
export function createRequestLogger(requestId: string, userId?: string) {
  return logger.child({
    requestId,
    userId,
    type: 'request',
  });
}

/**
 * Create a child logger for background jobs
 */
export function createJobLogger(jobId: string, jobType: string) {
  return logger.child({
    jobId,
    jobType,
    type: 'job',
  });
}

// =============================================================================
// Performance Tracking
// =============================================================================

interface Timer {
  start: number;
  label: string;
}

/**
 * Start a performance timer
 */
export function startTimer(label: string): Timer {
  return {
    start: performance.now(),
    label,
  };
}

/**
 * End a performance timer and log the result
 */
export function endTimer(timer: Timer, metadata?: Record<string, unknown>): number {
  const duration = performance.now() - timer.start;

  logger.debug({
    msg: `Timer: ${timer.label}`,
    duration,
    durationMs: Math.round(duration * 100) / 100,
    ...metadata,
  });

  return duration;
}

// =============================================================================
// Error Logging
// =============================================================================

/**
 * Log an error with full context
 */
export function logError(
  error: Error,
  context?: {
    userId?: string;
    requestId?: string;
    operation?: string;
    [key: string]: unknown;
  }
): void {
  logger.error({
    msg: error.message,
    error: {
      name: error.name,
      message: error.message,
      stack: isProduction ? undefined : error.stack,
    },
    ...context,
  });
}

// =============================================================================
// Audit Logging
// =============================================================================

/**
 * Log audit events (security, compliance)
 */
export function logAudit(
  event: string,
  details: {
    userId?: string;
    workspaceId?: string;
    action: string;
    resource?: string;
    result: 'success' | 'failure';
    metadata?: Record<string, unknown>;
  }
): void {
  logger.info({
    msg: `Audit: ${event}`,
    type: 'audit',
    ...details,
  });
}

// =============================================================================
// Request/Response Logging
// =============================================================================

interface RequestLog {
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
}

interface ResponseLog {
  statusCode: number;
  duration: number;
}

/**
 * Log incoming request
 */
export function logRequest(req: RequestLog): void {
  logger.debug({
    msg: 'Request started',
    type: 'request-start',
    ...req,
  });
}

/**
 * Log outgoing response
 */
export function logResponse(req: RequestLog, res: ResponseLog): void {
  const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

  logger[level]({
    msg: 'Request completed',
    type: 'request-end',
    ...req,
    ...res,
    durationMs: Math.round(res.duration * 100) / 100,
  });
}

// =============================================================================
// Business Metrics Logging
// =============================================================================

/**
 * Log business metrics for analytics
 */
export function logMetric(name: string, value: number, tags?: Record<string, string>): void {
  logger.info({
    msg: `Metric: ${name}`,
    type: 'metric',
    metric: name,
    value,
    tags,
  });
}

// =============================================================================
// Export default
// =============================================================================

export default logger;
