/**
 * Structured Logging Service
 *
 * Wraps Pino with a compatible API for the rest of the codebase.
 * Provides structured JSON output, log-level filtering, redaction
 * of sensitive fields, and request-scoped child loggers.
 */

import pino from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
  userId?: string;
  requestId?: string;
  workspaceId?: string;
}

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const pinoInstance = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
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
    ],
    remove: true,
  },
  base: {
    env: process.env.NODE_ENV,
    service: 'rag-starter-kit',
  },
  ...(isProduction && {
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }),
});

class LoggerAdapter {
  private pino: pino.Logger;

  constructor(pinoLogger: pino.Logger) {
    this.pino = pinoLogger;
  }

  debug(message: string, context?: LogContext): void {
    if (context) {
      this.pino.debug(context, message);
    } else {
      this.pino.debug(message);
    }
  }

  info(message: string, context?: LogContext): void {
    if (context) {
      this.pino.info(context, message);
    } else {
      this.pino.info(message);
    }
  }

  warn(message: string, context?: LogContext): void {
    if (context) {
      this.pino.warn(context, message);
    } else {
      this.pino.warn(message);
    }
  }

  error(message: string, context?: LogContext): void {
    if (context) {
      this.pino.error(context, message);
    } else {
      this.pino.error(message);
    }
  }

  child(context: LogContext): LoggerAdapter {
    return new LoggerAdapter(this.pino.child(context));
  }

  request(method: string, path: string, context?: LogContext): void {
    this.info(`Request: ${method} ${path}`, context);
  }

  performance(operation: string, durationMs: number, context?: LogContext): void {
    this.info(`Performance: ${operation} took ${durationMs}ms`, {
      ...context,
      duration: durationMs,
      operation,
    });
  }
}

export const logger = new LoggerAdapter(pinoInstance);
export default logger;
