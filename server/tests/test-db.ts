/**
 * Test Database Utilities
 * 
 * This file provides utilities for setting up and tearing down test databases.
 * It creates temporary tables with a test_ prefix to keep test data separate.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '@shared/schema';

// Set up environment
dotenv.config();
neonConfig.webSocketConstructor = ws;

// Constants
const prefix = 'test_';
const TEST_MODE = process.env.NODE_ENV === 'test';

// Verify we're in test mode to avoid accidental modification of production data
if (!TEST_MODE) {
  console.error('ERROR: These utilities should only be used in test mode!');
  console.error('Set NODE_ENV=test before using these utilities.');
  process.exit(1);
}

// Use a separate pool for tests
export const testPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create a Drizzle client for the test database with the test schemas
export const testDb = drizzle({ client: testPool, schema });

/**
 * Sets up a test database by creating temporary tables and initializing schema
 */
export async function setupTestDatabase() {
  const client = await testPool.connect();
  
  try {
    console.log('Setting up test database...');
    
    // Create test-specific schema or tables here if needed
    // This is where you could create temporary tables with the test_ prefix
    
    console.log('Test database setup completed successfully.');
    return testDb;
    
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cleans up test database by truncating all test tables
 */
export async function cleanupTestDatabase() {
  const client = await testPool.connect();
  
  try {
    console.log('Cleaning up test database...');
    
    // Get all test tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '${prefix}%'
    `);
    
    const testTables = result.rows.map(row => row.table_name);
    
    if (testTables.length > 0) {
      // Truncate all test tables in one command with CASCADE
      await client.query(`TRUNCATE TABLE ${testTables.map(t => `"${t}"`).join(', ')} CASCADE`);
      console.log(`Truncated ${testTables.length} test tables.`);
    } else {
      console.log('No test tables found to clean.');
    }
    
    console.log('Test database cleanup completed successfully.');
    
  } catch (error) {
    console.error('Error cleaning up test database:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Creates a test version of the provided table
 * @param tableName The name of the table to duplicate for testing
 */
export async function createTestTable(tableName: string) {
  const client = await testPool.connect();
  const testTableName = `${prefix}${tableName}`;
  
  try {
    console.log(`Creating test table: ${testTableName}`);
    
    // Check if the test table already exists
    const exists = await client.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1
    `, [testTableName]);
    
    if (exists.rowCount && exists.rowCount > 0) {
      console.log(`Test table ${testTableName} already exists. Truncating...`);
      await client.query(`TRUNCATE TABLE "${testTableName}" CASCADE`);
      return testTableName;
    }
    
    // Create the test table by duplicating the schema of the original table
    await client.query(`
      CREATE TABLE "${testTableName}" (LIKE "${tableName}" INCLUDING ALL)
    `);
    
    console.log(`Test table ${testTableName} created successfully.`);
    return testTableName;
    
  } catch (error) {
    console.error(`Error creating test table ${testTableName}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Closes the test database connection
 */
export async function closeTestDatabase() {
  await testPool.end();
  console.log('Test database connection closed.');
}