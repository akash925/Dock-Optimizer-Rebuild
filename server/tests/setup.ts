// Set up Node.js environment variables for testing
process.env.NODE_ENV = 'test';

// Import required Jest globals
import { expect, jest, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Set longer timeout for database-related tests
jest.setTimeout(30000);

// Global imports for all tests
import { cleanupTestDatabase, setupTestDatabase, closeTestDatabase } from './test-db';

// Setup and teardown for all tests
beforeAll(async () => {
  // Initialize the test database
  await setupTestDatabase();
});

afterAll(async () => {
  // Close database connections
  await closeTestDatabase();
});

// Clean state between tests
afterEach(async () => {
  // Clean up test data
  await cleanupTestDatabase();
  
  // Reset all mocks between tests
  jest.resetAllMocks();
});

// Make Jest globals available in tests
Object.assign(global, { expect, jest, beforeAll, afterAll, beforeEach, afterEach });