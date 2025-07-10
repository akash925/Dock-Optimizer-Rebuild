type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface DebugOptions {
  namespace?: string;
  level?: LogLevel;
  enabled?: boolean;
  timestamp?: boolean;
  color?: boolean;
}

class DebugLogger {
  private namespace: string;
  private level: LogLevel;
  private enabled: boolean;
  private timestamp: boolean;
  private color: boolean;
  private colors: Record<LogLevel, string>;

  constructor(options: DebugOptions = {}) {
    this.namespace = options.namespace || 'app';
    this.level = options.level || 'info';
    this.enabled = options.enabled ?? (process.env.NODE_ENV === 'development');
    this.timestamp = options.timestamp ?? true;
    this.color = options.color ?? true;
    
    this.colors = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;
    
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): [string, ...any[]] {
    const parts: string[] = [];
    
    if (this.timestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }
    
    if (this.color) {
      parts.push(`${this.colors[level]}[${this.namespace}:${level.toUpperCase()}]\x1b[0m`);
    } else {
      parts.push(`[${this.namespace}:${level.toUpperCase()}]`);
    }
    
    const prefix = parts.join(' ');
    return [`${prefix} ${message}`, ...args];
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      const [formattedMessage, ...formattedArgs] = this.formatMessage('debug', message, ...args);
      console.debug(formattedMessage, ...formattedArgs);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      const [formattedMessage, ...formattedArgs] = this.formatMessage('info', message, ...args);
      console.info(formattedMessage, ...formattedArgs);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      const [formattedMessage, ...formattedArgs] = this.formatMessage('warn', message, ...args);
      console.warn(formattedMessage, ...formattedArgs);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      const [formattedMessage, ...formattedArgs] = this.formatMessage('error', message, ...args);
      console.error(formattedMessage, ...formattedArgs);
    }
  }

  // Create a child logger with extended namespace
  extend(subNamespace: string): DebugLogger {
    return new DebugLogger({
      namespace: `${this.namespace}:${subNamespace}`,
      level: this.level,
      enabled: this.enabled,
      timestamp: this.timestamp,
      color: this.color,
    });
  }
}

// Factory function to create debug loggers
export function createDebugLogger(namespace: string, options: Omit<DebugOptions, 'namespace'> = {}): DebugLogger {
  return new DebugLogger({ namespace, ...options });
}

// Common debug loggers for different parts of the application
export const debugLoggers = {
  websocket: createDebugLogger('websocket'),
  api: createDebugLogger('api'),
  auth: createDebugLogger('auth'),
  appointments: createDebugLogger('appointments'),
  queries: createDebugLogger('queries'),
  forms: createDebugLogger('forms'),
  calendar: createDebugLogger('calendar'),
  notifications: createDebugLogger('notifications'),
};

// Main debug function for general use
export const debug = createDebugLogger('app');

// Environment-specific debug control
export const isDebugEnabled = process.env.NODE_ENV === 'development' || 
  (typeof window !== 'undefined' && window.localStorage.getItem('debug') === 'true');

// Function to enable/disable debug logging at runtime
export function setDebugEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    if (enabled) {
      window.localStorage.setItem('debug', 'true');
    } else {
      window.localStorage.removeItem('debug');
    }
    
    // Update existing loggers
    Object.values(debugLoggers).forEach(logger => {
      (logger as any).enabled = enabled;
    });
  }
} 