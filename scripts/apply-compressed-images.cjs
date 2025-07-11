const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config();

const log = (message) => console.log(`[Migration] ${message}`);
const logError = (message, error) => {
  console.error(`[Migration] ❌ ERROR: ${message}`);
  if (error) {
    console.error(JSON.stringify({ message: error.message, code: error.code }, null, 2));
  }
};

async function applyCompressedImagesMigration() {
  log('🚀 Applying compressed images migration...');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logError('DATABASE_URL environment variable not set. Cannot proceed.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    webSocketConstructor: ws,
  });

  try {
    const client = await pool.connect();
    log('✅ Successfully connected to the database.');

    try {
      // Read the compressed images migration
      const migrationPath = path.join(process.cwd(), 'migrations', '0012_add_compressed_images.sql');
      const sql = await fs.readFile(migrationPath, 'utf-8');
      
      log('📦 Applying compressed images migration...');
      await client.query(sql);
      log('✅ Successfully applied compressed images migration');
      
    } finally {
      client.release();
      await pool.end();
      log('Database connection pool closed.');
    }

    console.log('\n🎉 Compressed images migration applied successfully!');
  } catch (error) {
    // Check if the columns already exist
    if (error.code === '42701') {
      log('⚠️ Columns already exist - migration may have been previously applied');
      console.log('\n✅ Database is already up to date!');
    } else {
      logError('Migration failed.', error);
      process.exit(1);
    }
  }
}

applyCompressedImagesMigration(); 