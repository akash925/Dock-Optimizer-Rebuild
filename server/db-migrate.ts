import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, pool } from './db';

// Run migrations
async function main() {
  console.log('Creating database schema from models...');
  try {
    // Use drizzle-orm migration API directly
    await db.execute(/* sql */ `
    -- Drop existing tables if needed
    DROP TABLE IF EXISTS asset_tags;
    DROP TABLE IF EXISTS assets;
    DROP TABLE IF EXISTS tenant_modules;
    DROP TABLE IF EXISTS user_organizations;
    DROP TABLE IF EXISTS custom_form_fields;
    DROP TABLE IF EXISTS tenants;
    DROP TABLE IF EXISTS session;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS roles;
    `);

    // Create schema based on model
    await db.execute(/* sql */ `
    -- Create the roles table
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Create the users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL,
      tenant_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Create tenants table
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      subdomain TEXT NOT NULL UNIQUE,
      metadata JSONB,
      status TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      address1 TEXT,
      address2 TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      country TEXT,
      logo_url TEXT,
      primary_color TEXT,
      secondary_color TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
      created_by INTEGER,
      updated_by INTEGER
    );

    -- Session store for authentication
    CREATE TABLE IF NOT EXISTS session (
      sid VARCHAR NOT NULL,
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL,
      CONSTRAINT session_pkey PRIMARY KEY (sid)
    );

    -- Create user_organizations table for mapping users to organizations
    CREATE TABLE IF NOT EXISTS user_organizations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(user_id, organization_id)
    );

    -- Create tenant_modules table
    CREATE TABLE IF NOT EXISTS tenant_modules (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      module_name TEXT NOT NULL,
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(tenant_id, module_name)
    );

    -- Create assets table
    CREATE TABLE IF NOT EXISTS assets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
      status TEXT,
      po_number TEXT,
      notes TEXT,
      created_by INTEGER,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
      manufacturer TEXT,
      model TEXT,
      serial_number TEXT,
      asset_tag TEXT,
      category TEXT,
      subcategory TEXT,
      location TEXT,
      department TEXT,
      owner TEXT,
      purchase_date TEXT,
      purchase_cost NUMERIC,
      warranty_expiration TEXT,
      condition TEXT,
      last_maintenance_date TEXT,
      next_maintenance_date TEXT,
      assigned_to TEXT,
      checkout_date TEXT,
      expected_checkin_date TEXT,
      actually_checked_in_date TEXT,
      template TEXT,
      custom_fields JSONB,
      dimensions TEXT,
      weight TEXT,
      color TEXT,
      images JSONB,
      attachments JSONB,
      qr_code TEXT,
      barcode TEXT,
      maintenance_history JSONB,
      checkout_history JSONB,
      supplier TEXT,
      certification_status TEXT,
      certification_expiry TEXT
    );

    -- Create asset_tags table
    CREATE TABLE IF NOT EXISTS asset_tags (
      id SERIAL PRIMARY KEY,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    `);

    console.log('Database schema created successfully');
  } catch (error) {
    console.error('Error creating database schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);