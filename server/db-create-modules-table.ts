import { pool } from './db';

async function createOrganizationModulesTable() {
  try {
    // Check if organization_modules table exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'organization_modules'
      );
    `;
    
    const tableExists = await pool.query(checkTableQuery);
    
    if (!tableExists.rows[0].exists) {
      console.log('Creating organization_modules table...');
      
      // Create the organization_modules table
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS "organization_modules" (
          "id" SERIAL PRIMARY KEY,
          "organization_id" INTEGER NOT NULL,
          "module_name" TEXT NOT NULL,
          "enabled" BOOLEAN DEFAULT TRUE,
          "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("organization_id") REFERENCES "tenants" ("id") ON DELETE CASCADE
        );
      `;
      
      await pool.query(createTableQuery);
      console.log('organization_modules table created successfully');
    } else {
      console.log('organization_modules table already exists');
    }
  } catch (error) {
    console.error('Error creating organization_modules table:', error);
    throw error;
  }
}

// Execute the function
createOrganizationModulesTable()
  .then(() => console.log('Database setup complete'))
  .catch(error => console.error('Database setup failed:', error))
  .finally(() => process.exit(0));