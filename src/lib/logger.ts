import fs from 'fs';
import path from 'path';
import { getLogsPath } from './user-data';

type LogLevelName = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVELS: Record<LogLevelName, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

type LogContext = {
  traceId?: string;
  userId?: string;
};

class Logger {
  private currentLogFilePath: string;
  private logLevel: number;

  constructor() {
    const logsDir = getLogsPath();
    const dateStr = new Date().toISOString().split('T')[0];
    this.currentLogFilePath = path.join(logsDir, `hodo-${dateStr}.log`);
    this.logLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevelName) || 'INFO'] ?? LOG_LEVELS.INFO;
  }

  private serializeData(data: unknown): string | undefined {
    if (data === undefined) return undefined;
    try {
      if (data instanceof Error) {
        return JSON.stringify({
          name: data.name,
          message: data.message,
          stack: data.stack,
        });
      }
      if (typeof data === 'object' && data !== null) {
        const maybeError = (data as Record<string, unknown>).error;
        if (maybeError instanceof Error) {
          const cloned = { ...(data as Record<string, unknown>), error: {
            name: (maybeError as Error).name,
            message: (maybeError as Error).message,
            stack: (maybeError as Error).stack,
          }};
          return JSON.stringify(cloned);
        }
      }
      return JSON.stringify(data);
    } catch {
      try {
        return String(data);
      } catch {
        return '[[unserializable-data]]';
      }
    }
  }

  private format(level: LogLevelName, message: string, context?: LogContext, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const traceId = context?.traceId ?? '-';
    const userId = context?.userId ?? '-';
    const serialized = this.serializeData(data);
    const suffix = serialized !== undefined ? ` | ${serialized}` : '';
    return `[${timestamp}] [${level}] [${traceId}] [${userId}] ${message}${suffix}\n`;
  }

  private write(line: string): void {
    try {
      console.log(line.trim());
      fs.appendFileSync(this.currentLogFilePath, line, 'utf8');
    } catch (error) {
      // 仅在控制台报告写入失败，避免影响主流程
      console.error('Failed to write to log file:', error);
    }
  }

  logWithContext(level: LogLevelName, message: string, data?: unknown, context?: LogContext): void {
    if (LOG_LEVELS[level] < this.logLevel) return;
    const line = this.format(level, message, context, data);
    this.write(line);
  }

  debug(message: string, data?: unknown): void {
    this.logWithContext('DEBUG', message, data);
  }
  info(message: string, data?: unknown): void {
    this.logWithContext('INFO', message, data);
  }
  warn(message: string, data?: unknown): void {
    this.logWithContext('WARN', message, data);
  }
  error(message: string, data?: unknown): void {
    this.logWithContext('ERROR', message, data);
  }
}

const logger = new Logger();

export function generateTraceId(): string {
  return `${Math.random().toString(36).substring(2, 11)}`;
}

type LoggerLevelMethod = (message: string, data?: unknown) => void;

export interface LoggerLike {
  debug: LoggerLevelMethod;
  info: LoggerLevelMethod;
  warn: LoggerLevelMethod;
  error: LoggerLevelMethod;
}

export function createLogger(
  _component?: string,
  traceId?: string,
  userInfo?: unknown
): LoggerLike {
  const context: LogContext = {};
  if (traceId) context.traceId = traceId;
  if (userInfo && typeof userInfo === 'object') {
    const u = userInfo as Record<string, unknown>;
    if (typeof u.userId === 'string') context.userId = u.userId as string;
  }

  return {
    debug: (message: string, data?: unknown) => logger.logWithContext('DEBUG', message, data, context),
    info: (message: string, data?: unknown) => logger.logWithContext('INFO', message, data, context),
    warn: (message: string, data?: unknown) => logger.logWithContext('WARN', message, data, context),
    error: (message: string, data?: unknown) => logger.logWithContext('ERROR', message, data, context),
  };
}

export default logger;