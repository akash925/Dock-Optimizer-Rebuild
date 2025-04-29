// Jest setup file
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Set a default test database URL if not provided
if (!process.env.TEST_DATABASE_URL) {
  // Use an in-memory SQLite database or a test-specific Postgres database
  process.env.TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/testdb';
}

// Increase timeout for database operations
jest.setTimeout(30000);

// Mock console.error and console.warn to keep test output clean
// but still allow for debugging by preserving to global variables
global.consoleErrors = [];
global.consoleWarnings = [];

console.error = (...args) => {
  global.consoleErrors.push(args);
};

console.warn = (...args) => {
  global.consoleWarnings.push(args);
};

// Clear mocks between tests
beforeEach(() => {
  global.consoleErrors = [];
  global.consoleWarnings = [];
});