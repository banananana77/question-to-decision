import { isDev } from '@/lib/utils/env.server';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Production-safe error metadata for logger calls.
 * In production: errorType only (no message, no stack).
 * In development: errorType + errorMessage.
 */
export function safeErrorMeta(error: unknown): Record<string, string> {
  const errorType = error instanceof Error ? error.name : 'UnknownError';
  if (isDev()) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { errorType, errorMessage };
  }
  return { errorType };
}

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();

    if (isDev()) {
      // 開発環境：Pretty print
      const contextStr = context ? `\n${JSON.stringify(context, null, 2)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
    } else {
      // 本番環境：JSON
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...context,
      });
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage('error', message, context));
  }

  debug(message: string, context?: LogContext): void {
    if (isDev()) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }
}

export const logger = new Logger();
