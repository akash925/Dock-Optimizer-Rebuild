import { drizzle } from 'drizzle-orm/better-sqlite3';
// import Database, { type Database as SqliteDatabase } from 'better-sqlite3';
type SqliteDatabase = any;
let Database: any;
import * as schema from '../../shared/schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import fs from 'fs';

let testDb: ReturnType<typeof drizzle>;

export function createTestDb() {
  if (testDb) {
    return testDb;
  }

  // Create in-memory SQLite database
  try {
    // Use dynamic require to avoid TypeScript compilation issues
    Database = eval('require')('better-sqlite3');
  } catch (err) {
    throw new Error('better-sqlite3 module not available for tests');
  }
  const sqlite = new Database(':memory:');
  testDb = drizzle(sqlite, { schema });

  // Initialize with basic schema - create tables manually for testing
  try {
    // Create essential tables for tests
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subdomain TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS facilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tenant_id INTEGER,
        timezone TEXT DEFAULT 'America/New_York',
        monday_open BOOLEAN DEFAULT true,
        monday_start TEXT DEFAULT '08:00',
        monday_end TEXT DEFAULT '17:00',
        tuesday_open BOOLEAN DEFAULT true,
        tuesday_start TEXT DEFAULT '08:00', 
        tuesday_end TEXT DEFAULT '17:00',
        wednesday_open BOOLEAN DEFAULT true,
        wednesday_start TEXT DEFAULT '08:00',
        wednesday_end TEXT DEFAULT '17:00',
        thursday_open BOOLEAN DEFAULT true,
        thursday_start TEXT DEFAULT '08:00',
        thursday_end TEXT DEFAULT '17:00',
        friday_open BOOLEAN DEFAULT true,
        friday_start TEXT DEFAULT '08:00',
        friday_end TEXT DEFAULT '17:00',
        saturday_open BOOLEAN DEFAULT false,
        saturday_start TEXT DEFAULT '08:00',
        saturday_end TEXT DEFAULT '13:00',
        sunday_open BOOLEAN DEFAULT false,
        sunday_start TEXT DEFAULT '08:00',
        sunday_end TEXT DEFAULT '17:00',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS organization_holidays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        is_recurring BOOLEAN DEFAULT false,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS organization_modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        module_name TEXT NOT NULL,
        enabled BOOLEAN DEFAULT false,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        role TEXT NOT NULL,
        tenant_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facility_id INTEGER,
        truck_number TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS company_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        manufacturer TEXT,
        category TEXT,
        status TEXT DEFAULT 'ACTIVE',
        barcode TEXT,
        tenant_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed some basic test data
    seedTestData(sqlite);
    
  } catch (error) {
    console.warn('Failed to initialize test database schema:', error);
  }

  return testDb;
}

function seedTestData(sqlite: SqliteDatabase) {
  try {
    // Insert test tenant
    sqlite.exec(`
      INSERT OR IGNORE INTO tenants (id, name, subdomain, status) 
      VALUES (1, 'Test Organization', 'test-org', 'ACTIVE');
      
      INSERT OR IGNORE INTO facilities (id, name, tenant_id, timezone) 
      VALUES (1, 'Test Facility', 1, 'America/New_York');
      
      INSERT OR IGNORE INTO users (id, username, email, password, first_name, last_name, role, tenant_id)
      VALUES (1, 'testuser', 'test@example.com', 'hashedpassword', 'Test', 'User', 'admin', 1);
    `);
  } catch (error) {
    console.warn('Failed to seed test data:', error);
  }
}

export function resetTestDb() {
  if (testDb) {
    // Access the underlying SQLite database
    const sqlite = (testDb as any).$client as SqliteDatabase;
    // Clear all data but keep schema
    try {
      sqlite.exec(`
        DELETE FROM organization_holidays;
        DELETE FROM organization_modules;
        DELETE FROM schedules;
        DELETE FROM company_assets;
      `);
      // Re-seed basic data
      seedTestData(sqlite);
    } catch (error) {
      console.warn('Failed to reset test database:', error);
    }
  }
}

export function cleanupTestDatabase() {
  resetTestDb();
}

// Export the test database instance
export { testDb }; 