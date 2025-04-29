import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure Neon WebSockets for serverless environments
neonConfig.webSocketConstructor = ws;

// Set environment to test mode
process.env.NODE_ENV = 'test';

// Increase Jest timeout for database operations
jest.setTimeout(30000);

// Global setup before all tests
beforeAll(async () => {
  // Ensure we have the test database connection
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set for tests to work');
  }
  
  // Make sure we're not using the production database
  if (process.env.DATABASE_URL.includes('production') || 
      !process.env.DATABASE_URL.includes('test')) {
    throw new Error('Tests must use a test database to avoid data loss');
  }
  
  console.log('🔧 Setting up test environment...');
  
  // Initial connection test
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query('SELECT 1 as test');
    if (rows[0].test !== 1) {
      throw new Error('Database connection test failed');
    }
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
});

// Cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Any global cleanup here
  
  console.log('✅ Test environment cleanup complete');
});

// Mock console methods for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  if (process.env.DEBUG === 'true') {
    originalConsoleLog(...args);
  }
};

console.error = (...args) => {
  if (process.env.DEBUG === 'true') {
    originalConsoleError(...args);
  }
};

console.warn = (...args) => {
  if (process.env.DEBUG === 'true') {
    originalConsoleWarn(...args);
  }
};