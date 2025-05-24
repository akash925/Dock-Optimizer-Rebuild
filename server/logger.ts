/**
 * Enhanced logger for Dock Optimizer
 * Provides structured logging with severity levels and context
 */

import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'server', 'logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create logs directory:', err);
  }
}

// Log file paths
const errorLogPath = path.join(logsDir, 'error.log');
const infoLogPath = path.join(logsDir, 'info.log');
const debugLogPath = path.join(logsDir, 'debug.log');

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

function formatLogMessage(level: LogLevel, context: string, message: string, data?: any): string {
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS');
  const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}${dataStr}`;
}

function writeToFile(filePath: string, message: string): void {
  try {
    fs.appendFileSync(filePath, message + '\n');
  } catch (err) {
    console.error(`Failed to write to log file ${filePath}:`, err);
  }
}

/**
 * Log an error message
 * @param context The logging context (e.g., 'Notifications', 'BOL-Upload')
 * @param message The log message
 * @param error Optional error object
 * @param data Optional additional data
 */
export function logError(context: string, message: string, error?: any, data?: any): void {
  // Format error properly
  let errorInfo = '';
  if (error) {
    // Extract stack trace and message
    if (error instanceof Error) {
      errorInfo = `\nError: ${error.message}\nStack: ${error.stack || 'No stack trace'}`;
    } else {
      errorInfo = `\nError: ${JSON.stringify(error)}`;
    }
  }

  const logMessage = formatLogMessage('error', context, message + errorInfo, data);
  console.error(logMessage);
  writeToFile(errorLogPath, logMessage);
}

/**
 * Log a warning message
 * @param context The logging context
 * @param message The log message
 * @param data Optional additional data
 */
export function logWarn(context: string, message: string, data?: any): void {
  const logMessage = formatLogMessage('warn', context, message, data);
  console.warn(logMessage);
  writeToFile(errorLogPath, logMessage); // Warnings also go to error log
}

/**
 * Log an informational message
 * @param context The logging context
 * @param message The log message
 * @param data Optional additional data
 */
export function logInfo(context: string, message: string, data?: any): void {
  const logMessage = formatLogMessage('info', context, message, data);
  console.log(logMessage);
  writeToFile(infoLogPath, logMessage);
}

/**
 * Log a debug message (only in development)
 * @param context The logging context
 * @param message The log message
 * @param data Optional additional data
 */
export function logDebug(context: string, message: string, data?: any): void {
  // In production, only log debug messages if DEBUG env var is set
  if (process.env.NODE_ENV === 'production' && !process.env.DEBUG) {
    return;
  }
  
  const logMessage = formatLogMessage('debug', context, message, data);
  console.log(logMessage);
  writeToFile(debugLogPath, logMessage);
}

export default {
  error: logError,
  warn: logWarn,
  info: logInfo,
  debug: logDebug
};