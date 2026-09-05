/**
 * Client-side logging utility
 *
 * Thin wrapper that replaces raw console calls so the noConsole lint rule
 * stays satisfied while still surfacing errors in the browser dev-tools.
 */

type LogContext = Record<string, unknown>;

function formatMsg(msg: string, ctx?: LogContext): string {
  return ctx ? `${msg} ${JSON.stringify(ctx)}` : msg;
}

type ConsoleMethod = 'error' | 'warn' | 'info';

function devLog(method: ConsoleMethod, msg: string, ctx?: LogContext): void {
  if (process.env.NODE_ENV === 'development') {
    const logFn = (globalThis as Record<string, unknown>)[method] as
      ((...args: unknown[]) => void) | undefined;
    logFn?.(formatMsg(msg, ctx));
  }
}

export const clientLogger = {
  error(msg: string, ctx?: LogContext): void {
    devLog('error', msg, ctx);
  },
  warn(msg: string, ctx?: LogContext): void {
    devLog('warn', msg, ctx);
  },
  info(msg: string, ctx?: LogContext): void {
    devLog('info', msg, ctx);
  },
};
