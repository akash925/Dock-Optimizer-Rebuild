// Setup script to ensure Neon database is the source of truth
// Run this in Replit or locally to verify database connection

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

console.log('🔧 NEON DATABASE ENVIRONMENT SETUP\n');

// Load environment variables
dotenv.config();

// Check for required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'NODE_ENV'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`  - ${varName}`));
  
  console.log('\n📋 TO FIX THIS:');
  console.log('1. In Replit: Go to Secrets tab and add:');
  console.log('   DATABASE_URL=your_neon_database_url');
  console.log('   NODE_ENV=production');
  
  console.log('\n2. Locally: Create a .env file with:');
  console.log('   DATABASE_URL=your_neon_database_url');
  console.log('   NODE_ENV=development');
  
  process.exit(1);
}

// Verify DATABASE_URL format
const DATABASE_URL = process.env.DATABASE_URL;
console.log('✅ DATABASE_URL is set');

if (DATABASE_URL.includes('neon.tech')) {
  console.log('✅ Using Neon database (production source of truth)');
} else if (DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')) {
  console.log('⚠️  Using local database - this may have different data than production');
} else {
  console.log('ℹ️  Using custom database URL');
}

// Test database connection
console.log('\n🔌 Testing database connection...');

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function testDatabaseConnection() {
  try {
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Get database info
    const dbInfo = await client.query('SELECT current_database(), current_user, version()');
    console.log(`📊 Database: ${dbInfo.rows[0].current_database}`);
    console.log(`👤 User: ${dbInfo.rows[0].current_user}`);
    console.log(`🏷️  Version: ${dbInfo.rows[0].version.split(' ')[0]} ${dbInfo.rows[0].version.split(' ')[1]}`);
    
    // Check critical tables exist
    const tables = [
      'tenants',
      'facilities', 
      'docks',
      'organization_facilities',
      'appointments',
      'appointment_types'
    ];
    
    console.log('\n📋 Checking critical tables...');
    
    for (const tableName of tables) {
      try {
        const result = await client.query(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_name = $1
        `, [tableName]);
        
        if (result.rows[0].count > 0) {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          console.log(`  ✅ ${tableName}: ${countResult.rows[0].count} records`);
        } else {
          console.log(`  ❌ ${tableName}: Table not found`);
        }
      } catch (error) {
        console.log(`  ❌ ${tableName}: Error - ${error.message}`);
      }
    }
    
    // Check organization 5 specifically
    console.log('\n🏢 Checking Organization 5 status...');
    
    const org5 = await client.query('SELECT * FROM tenants WHERE id = 5');
    if (org5.rows.length > 0) {
      console.log(`  ✅ Organization 5: ${org5.rows[0].name}`);
      
      // Check facility mappings
      const mappings = await client.query(`
        SELECT f.id, f.name 
        FROM facilities f
        JOIN organization_facilities of ON f.id = of.facility_id
        WHERE of.organization_id = 5
      `);
      
      console.log(`  📋 Mapped facilities: ${mappings.rows.length}`);
      mappings.rows.forEach(f => console.log(`    - Facility ${f.id}: ${f.name}`));
      
      if (mappings.rows.length === 0) {
        console.log('  ⚠️  No facilities mapped - this explains why Door Manager is empty!');
      }
    } else {
      console.log('  ❌ Organization 5 not found');
    }
    
    client.release();
    
    console.log('\n✅ DATABASE VERIFICATION COMPLETE');
    
    if (DATABASE_URL.includes('neon.tech')) {
      console.log('🎯 You are connected to the Neon production database - source of truth ✓');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    if (error.message.includes('SSL')) {
      console.log('\n💡 SSL Error - try adding ?sslmode=require to your DATABASE_URL');
    }
    
    if (error.message.includes('authentication')) {
      console.log('\n💡 Authentication Error - check your database credentials');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Create/update .env file for local development
function createLocalEnvFile() {
  if (process.env.NODE_ENV === 'development') {
    const envPath = '.env';
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Ensure critical env vars are set
    const envUpdates = [];
    
    if (!envContent.includes('DATABASE_URL=')) {
      envUpdates.push('# Add your Neon database URL here:');
      envUpdates.push('# DATABASE_URL=postgresql://username:password@ep-xxx.neon.tech/database?sslmode=require');
    }
    
    if (!envContent.includes('NODE_ENV=')) {
      envUpdates.push('NODE_ENV=development');
    }
    
    if (envUpdates.length > 0) {
      const newContent = envContent + '\n' + envUpdates.join('\n') + '\n';
      fs.writeFileSync(envPath, newContent);
      console.log(`📝 Updated ${envPath} with missing environment variables`);
    }
  }
}

// Main execution
async function main() {
  try {
    await testDatabaseConnection();
    createLocalEnvFile();
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Run the tenant mapping fix: node fix-tenant-facility-mapping-production.js');
    console.log('2. Run the availability fix: node fix-availability-date-error.js'); 
    console.log('3. Restart your server and test the Door Manager page');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

main(); 