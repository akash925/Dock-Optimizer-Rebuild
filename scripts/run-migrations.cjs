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
      // Create migrations table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      log('✅ "migrations" table checked/created.');

      // Get list of already applied migrations
      const { rows: appliedMigrationsRows } = await client.query('SELECT name FROM migrations');
      const appliedMigrations = new Set(appliedMigrationsRows.map(row => row.name));
      log(`🔍 Found ${appliedMigrations.size} applied migrations.`);

      const newMigrations = sqlFiles.filter(file => !appliedMigrations.has(file));

      if (newMigrations.length === 0) {
        log('✅ No new migrations to apply. Database is up to date.');
      } else {
        log(`Found ${newMigrations.length} new migration(s) to apply: ${newMigrations.join(', ')}`);
        for (const file of newMigrations) {
          log(`\n\t-- Applying migration: ${file} --`);
          const filePath = path.join(migrationsDir, file);
          const sql = await fs.readFile(filePath, 'utf-8');
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          log(`\t✅ Successfully applied ${file}`);
        }
        console.log('\n🎉 All new migrations applied successfully!');
      }
    } finally {
      client.release();
      await pool.end();
      log('Database connection pool closed.');
    }
  } catch (error) {
    logError('Migration process failed.', error);
    process.exit(1);
  }
}

runMigrations().catch(error => {
  logError('Migration process failed.', error);
  process.exit(1);
}); 