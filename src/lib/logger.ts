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
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.context = context;
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
      ...this.context,
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
          ? // biome-ignore lint/suspicious/noConsole: Intentional console logging in development
            console.error
          : level === 'warn'
            ? // biome-ignore lint/suspicious/noConsole: Intentional console logging in development
              console.warn
            : level === 'debug'
              ? // biome-ignore lint/suspicious/noConsole: Intentional console logging in development
                console.debug
              : // biome-ignore lint/suspicious/noConsole: Intentional console logging in development
                console.log;
      consoleFn(`[${formatted.level}] ${message}`, context || '');
      return;
    }

    // In production, use structured logging
    const logOutput = JSON.stringify(formatted);

    if (level === 'error') {
      // biome-ignore lint/suspicious/noConsole: Structured logging in production
      console.error(logOutput);
    } else if (level === 'warn') {
      // biome-ignore lint/suspicious/noConsole: Structured logging in production
      console.warn(logOutput);
    } else {
      // biome-ignore lint/suspicious/noConsole: Structured logging in production
      console.log(logOutput);
    }

    // Send to external log endpoint if configured
    const logEndpoint = process.env.LOG_ENDPOINT;
    if (logEndpoint) {
      // Fire-and-forget non-blocking fetch
      fetch(logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: logOutput,
      }).catch(() => {
        // Silently fail to avoid disrupting the application
      });
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

  /**
   * Create a child logger with merged context
   * Used for request-scoped logging with requestId, userId, etc.
   */
  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context });
  }
}

// Singleton instance
export const logger = new Logger();
export default logger;
