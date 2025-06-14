const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config();

const log = (message) => console.log(`[DB Migration] ${message}`);
const logError = (message, error) => {
  console.error(`[DB Migration] ❌ ERROR: ${message}`);
  if (error) {
    console.error(JSON.stringify({ message: error.message, code: error.code }, null, 2));
  }
};

async function runMigrations() {
  log('🚀 Starting database migration process...');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logError('DATABASE_URL environment variable not set. Cannot proceed.');
    process.exit(1);
  } else {
    log('DATABASE_URL found.');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    webSocketConstructor: ws, // Explicitly provide the ws class
  });

  const migrationsDir = path.join(process.cwd(), 'migrations');
  
  try {
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (sqlFiles.length === 0) {
      log('✅ No .sql migration files found. Database is up to date.');
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
        await client.query(sql);
        log(`\t✅ Successfully applied ${file}`);
      }
    } finally {
      client.release();
      await pool.end();
      log('Database connection pool closed.');
    }

    console.log('\n🎉 All migrations applied successfully!');
  } catch (error) {
    logError('Migration process failed.', error);
    process.exit(1);
  }
}

runMigrations(); 