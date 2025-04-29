/**
 * Test Database Cleanup Utility
 * 
 * This script truncates all test-specific tables and resets their sequences
 * to clean up after tests and ensure a fresh state for the next test run.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';

// Set up environment
dotenv.config();
neonConfig.webSocketConstructor = ws;

// Constants
const prefix = 'test_';
const TEST_MODE = process.env.NODE_ENV === 'test';

// Verify we're in test mode to avoid accidental deletion of production data
if (!TEST_MODE) {
  console.error('ERROR: This script should only be run in test mode!');
  console.error('Set NODE_ENV=test before running this script.');
  process.exit(1);
}

// Connect to database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanTestDatabase() {
  const client = await pool.connect();

  try {
    console.log('Starting test database cleanup...');
    
    // Begin transaction
    await client.query('BEGIN');

    // 1. Get all table names that are specific to tests
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '${prefix}%'
    `);

    const testTables = result.rows.map(row => row.table_name);
    
    if (testTables.length === 0) {
      console.log('No test-specific tables found.');
    } else {
      console.log(`Found ${testTables.length} test tables to clean: ${testTables.join(', ')}`);
      
      // 2. Truncate all test tables
      for (const table of testTables) {
        await client.query(`TRUNCATE TABLE "${table}" CASCADE`);
        console.log(`Truncated table: ${table}`);
        
        // 3. Reset sequences if they exist
        try {
          // Find sequences associated with the table
          const seqResult = await client.query(`
            SELECT pg_get_serial_sequence('${table}', 'id') as seq_name
          `);
          
          if (seqResult.rows[0]?.seq_name) {
            const sequenceName = seqResult.rows[0].seq_name;
            await client.query(`ALTER SEQUENCE ${sequenceName} RESTART WITH 1`);
            console.log(`Reset sequence: ${sequenceName}`);
          }
        } catch (error) {
          console.warn(`Warning: Failed to reset sequence for table ${table}:`, error);
        }
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('Test database cleanup completed successfully.');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error cleaning test database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the cleanup
cleanTestDatabase()
  .then(() => {
    console.log('Database cleanup script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database cleanup script failed:', error);
    process.exit(1);
  });