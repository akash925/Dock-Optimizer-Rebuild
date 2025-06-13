import fs from 'fs/promises';
import path from 'path';
import { Pool } from '@neondatabase/serverless';
import 'dotenv/config';

// Create a logger for consistent output
const log = (message: string) => console.log(`[DB Migration] ${message}`);
const logError = (message: string, error?: any) => {
  console.error(`[DB Migration] ❌ ERROR: ${message}`);
  if (error) {
    // Log concise error info
    const errorDetails = {
      message: error.message,
      code: error.code,
      routine: error.routine,
    };
    console.error(JSON.stringify(errorDetails, null, 2));
  }
};

async function main() {
  log('🚀 Starting database migration process...');

  if (!process.env.DATABASE_URL) {
    logError('DATABASE_URL environment variable not set. Cannot proceed.');
    process.exit(1);
  } else {
    log('DATABASE_URL found.');
  }

  const migrationsDir = path.join(process.cwd(), 'migrations');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter((file) => file.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order

    if (sqlFiles.length === 0) {
      log('✅ No .sql migration files found. Database is considered up to date.');
      return;
    }

    log(`🔍 Found ${sqlFiles.length} migration file(s): ${sqlFiles.join(', ')}`);

    const client = await pool.connect();
    log('✅ Successfully connected to the database.');

    try {
      for (const file of sqlFiles) {
        log(`\n\t-- Applying migration: ${file} --`);
        const filePath = path.join(migrationsDir, file);
        const sql = await fs.readFile(filePath, 'utf-8');
        
        // Execute the entire SQL file as a single transaction
        await client.query(sql);
        log(`\t✅ Successfully applied ${file}`);
      }
    } finally {
      log('Releasing database client.');
      client.release();
      log('Ending connection pool.');
      await pool.end();
    }

    console.log('\n🎉 All migrations applied successfully!');
  } catch (error) {
    logError('Migration process failed.', error);
    process.exit(1);
  }
}

main(); 