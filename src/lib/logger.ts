/**
 * Structured Logging Service
 * Replaces console.log with proper logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
  userId?: string;
  requestId?: string;
  workspaceId?: string;
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...context,
      environment: process.env.NODE_ENV,
      service: 'rag-starter-kit',
    };
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message, context);

    // In development, use console for readability
    if (this.isDevelopment) {
      const consoleFn =
        level === 'error'
          ? console.error
          : level === 'warn'
            ? console.warn
            : level === 'debug'
              ? console.debug
              : console.log;
      consoleFn(`[${formatted.level}] ${message}`, context || '');
      return;
    }

    // In production, use structured logging
    // Could integrate with services like Datadog, LogDNA, etc.
    if (level === 'error') {
      // Send to error tracking service (Sentry, etc.)
      console.error(JSON.stringify(formatted));
    } else {
      console.log(JSON.stringify(formatted));
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  // Request logging helper
  request(method: string, path: string, context?: LogContext): void {
    this.info(`Request: ${method} ${path}`, context);
  }

  // Performance logging
  performance(operation: string, durationMs: number, context?: LogContext): void {
    this.info(`Performance: ${operation} took ${durationMs}ms`, {
      ...context,
      duration: durationMs,
      operation,
    });
  }
}

// Singleton instance
export const logger = new Logger();
export default logger;
