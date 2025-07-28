import { pool } from './db.js';

async function createOrganizationUsersTable() {
  try {
    // Check if organization_users table exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'organization_users'
      );
    `;
    
    const tableExists = await pool!.query(checkTableQuery);
    
    if (!tableExists.rows[0].exists) {
      console.log('Creating organization_users table...');
      
      // Create the organization_users table
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS "organization_users" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL,
          "organization_id" INTEGER NOT NULL,
          "role_id" INTEGER NOT NULL,
          "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
          FOREIGN KEY ("organization_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
          FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE,
          UNIQUE ("user_id", "organization_id")
        );
      `;
      
      await pool!.query(createTableQuery);
      console.log('organization_users table created successfully');
    } else {
      console.log('organization_users table already exists');
    }
  } catch (error) {
    console.error('Error creating organization_users table:', error);
    throw error;
  }
}

// Execute the function
createOrganizationUsersTable()
  .then(() => console.log('Database setup complete'))
  .catch(error => console.error('Database setup failed:', error))
  .finally(() => process.exit(0));