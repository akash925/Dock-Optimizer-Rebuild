// Set up Node.js environment variables for testing
process.env.NODE_ENV = 'test';

// Set up any global test configurations

// Make sure Jest assertions work correctly
import { expect } from '@jest/globals';

// Set longer timeout for database-related tests
jest.setTimeout(30000);

// Mock any global dependencies if needed