// Jest setup file
import dotenv from 'dotenv';
import { jest, beforeEach } from '@jest/globals';

// Load environment variables from .env file
dotenv.config();

// Set a default test database URL if not provided
if (!process.env.TEST_DATABASE_URL) {
  // Use an in-memory SQLite database or a test-specific Postgres database
  process.env.TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/testdb';
}

// Increase timeout for database operations
jest.setTimeout(30000);

// Set up global variables for error tracking
declare global {
  var consoleErrors: any[];
  var consoleWarnings: any[];
}

// Initialize error tracking arrays
globalThis.consoleErrors = [];
globalThis.consoleWarnings = [];

// Mock console.error and console.warn to keep test output clean
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: any[]) => {
  globalThis.consoleErrors.push(args);
  originalError(...args);
};

console.warn = (...args: any[]) => {
  globalThis.consoleWarnings.push(args);
  originalWarn(...args);
};

// Clear mocks between tests
beforeEach(() => {
  globalThis.consoleErrors = [];
  globalThis.consoleWarnings = [];
});