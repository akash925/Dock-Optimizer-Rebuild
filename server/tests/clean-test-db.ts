import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

// To run on import
export async function cleanupTestDatabase(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('This script should only be run in test environment');
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set');
  }

  const pool = new Pool({ connectionString });
  
  try {
    console.log('🧹 Cleaning up test database...');
    
    // Drop all tables in reverse order to avoid foreign key constraints
    const dropTablesQuery = `
      DO $$ 
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE;';
        END LOOP;
      END $$;
    `;
    
    await pool.query(dropTablesQuery);
    console.log('✅ Test database cleaned');
  } catch (error) {
    console.error('❌ Error cleaning test database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Allow running as a standalone script
if (require.main === module) {
  cleanupTestDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed to clean test database:', error);
      process.exit(1);
    });
}