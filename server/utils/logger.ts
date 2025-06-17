/**
 * Production-Grade Logging System
 * Replaces console.log with structured logging
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: string;
  data?: any;
  userId?: number;
  tenantId?: number;
  requestId?: string;
}

class ProductionLogger {
  private logLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.logLevel = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  private formatLogEntry(level: LogLevel, message: string, context?: string, data?: any, meta?: Partial<LogEntry>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context,
      data,
      ...meta,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private output(entry: LogEntry): void {
    if (this.isDevelopment) {
      // Development: Pretty console output
      const color = this.getLogColor(entry.level);
      const contextStr = entry.context ? `[${entry.context}]` : '';
      const metaStr = entry.data ? JSON.stringify(entry.data, null, 2) : '';
      console.log(`${color}${entry.timestamp} ${entry.level}${contextStr} ${entry.message}${metaStr ? '\n' + metaStr : ''}\x1b[0m`);
    } else {
      // Production: Structured JSON logging
      console.log(JSON.stringify(entry));
    }
  }

  private getLogColor(level: string): string {
    switch (level) {
      case 'ERROR': return '\x1b[31m'; // Red
      case 'WARN': return '\x1b[33m';  // Yellow
      case 'INFO': return '\x1b[36m';  // Cyan
      case 'DEBUG': return '\x1b[90m'; // Gray
      default: return '\x1b[0m';       // Reset
    }
  }

  error(message: string, context?: string, data?: any, meta?: Partial<LogEntry>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.output(this.formatLogEntry(LogLevel.ERROR, message, context, data, meta));
    }
  }

  warn(message: string, context?: string, data?: any, meta?: Partial<LogEntry>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.output(this.formatLogEntry(LogLevel.WARN, message, context, data, meta));
    }
  }

  info(message: string, context?: string, data?: any, meta?: Partial<LogEntry>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.output(this.formatLogEntry(LogLevel.INFO, message, context, data, meta));
    }
  }

  debug(message: string, context?: string, data?: any, meta?: Partial<LogEntry>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.output(this.formatLogEntry(LogLevel.DEBUG, message, context, data, meta));
    }
  }

  // Convenience methods for common use cases
  api(method: string, path: string, status: number, duration: number, meta?: Partial<LogEntry>): void {
    this.info(`${method} ${path} ${status} in ${duration}ms`, 'API', undefined, meta);
  }

  db(query: string, duration: number, meta?: Partial<LogEntry>): void {
    this.debug(`DB Query executed in ${duration}ms`, 'DATABASE', { query }, meta);
  }

  auth(action: string, userId?: number, success: boolean = true, meta?: Partial<LogEntry>): void {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    const message = `Auth ${action} ${success ? 'successful' : 'failed'}`;
    if (level === LogLevel.INFO) {
      this.info(message, 'AUTH', { userId }, meta);
    } else {
      this.warn(message, 'AUTH', { userId }, meta);
    }
  }
}

// Export singleton instance
export const logger = new ProductionLogger();

// Export convenience methods for easy migration
export const log = {
  error: (message: string, context?: string, data?: any) => logger.error(message, context, data),
  warn: (message: string, context?: string, data?: any) => logger.warn(message, context, data),
  info: (message: string, context?: string, data?: any) => logger.info(message, context, data),
  debug: (message: string, context?: string, data?: any) => logger.debug(message, context, data),
  api: (method: string, path: string, status: number, duration: number) => logger.api(method, path, status, duration),
  db: (query: string, duration: number) => logger.db(query, duration),
  auth: (action: string, userId?: number, success?: boolean) => logger.auth(action, userId, success),
}; 