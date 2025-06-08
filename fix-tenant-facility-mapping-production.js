// Production Fix for Tenant-Facility Mapping Issue
// Run this in Replit console: node fix-tenant-facility-mapping-production.js
// This script is designed to work with the Neon PostgreSQL database

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Import production dependencies
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found. This script must be run in the Replit environment.');
  console.error('Please copy this script to your Replit project and run it there.');
  process.exit(1);
}

// Use PostgreSQL client for Neon database
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function fixProductionTenantMapping() {
  try {
    console.log('🚀 FIXING PRODUCTION TENANT-FACILITY MAPPING\n');
    console.log('📊 Current Database Status Check...\n');
    
    // Step 1: Verify we're connected to the right database
    const dbInfo = await pool.query('SELECT current_database(), current_user');
    console.log(`✅ Connected to database: ${dbInfo.rows[0].current_database} as user: ${dbInfo.rows[0].current_user}`);
    
    // Step 2: Check organization 5 current state
    const org5Check = await pool.query('SELECT id, name FROM tenants WHERE id = 5');
    if (org5Check.rows.length === 0) {
      console.log('❌ Organization 5 does not exist in this database');
      return;
    }
    console.log(`✅ Organization 5 exists: ${org5Check.rows[0].name}`);
    
    // Step 3: Check current facility mappings
    const currentMappings = await pool.query(
      'SELECT * FROM organization_facilities WHERE organization_id = 5'
    );
    console.log(`📋 Organization 5 currently has ${currentMappings.rows.length} facility mappings`);
    
    // Step 4: Check available facilities
    const allFacilities = await pool.query(
      'SELECT id, name, tenant_id FROM facilities ORDER BY id'
    );
    console.log(`📋 Total facilities in database: ${allFacilities.rows.length}`);
    allFacilities.rows.forEach(f => 
      console.log(`  Facility ${f.id}: ${f.name} (tenant_id: ${f.tenant_id})`)
    );
    
    // Step 5: Check for facility 7 specifically
    const facility7 = allFacilities.rows.find(f => f.id === 7);
    if (!facility7) {
      console.log('❌ Facility 7 not found. Looking for Fresh Connect facilities...');
      const freshConnectFacilities = allFacilities.rows.filter(f => 
        f.name.toLowerCase().includes('fresh') || f.name.toLowerCase().includes('connect')
      );
      console.log(`Found ${freshConnectFacilities.length} Fresh Connect-related facilities:`);
      freshConnectFacilities.forEach(f => 
        console.log(`  Facility ${f.id}: ${f.name}`)
      );
      return;
    }
    
    console.log(`✅ Facility 7 found: ${facility7.name}`);
    
    // Step 6: Check if mapping already exists
    const existingMapping = await pool.query(
      'SELECT * FROM organization_facilities WHERE organization_id = 5 AND facility_id = 7'
    );
    
    if (existingMapping.rows.length > 0) {
      console.log('✅ Mapping already exists! Let\'s check why docks aren\'t showing...');
      
      // Check the docks query logic
      const docksQuery = `
        SELECT d.id, d.name, d.facility_id 
        FROM docks d
        JOIN organization_facilities of ON d.facility_id = of.facility_id
        WHERE of.organization_id = 5
        ORDER BY d.id
      `;
      const orgDocks = await pool.query(docksQuery);
      console.log(`🔍 Docks visible to org 5: ${orgDocks.rows.length}`);
      
      if (orgDocks.rows.length === 0) {
        console.log('❌ No docks visible despite mapping existing. Checking dock-facility relationships...');
        const facility7Docks = await pool.query(
          'SELECT id, name, facility_id FROM docks WHERE facility_id = 7'
        );
        console.log(`Docks for facility 7: ${facility7Docks.rows.length}`);
        facility7Docks.rows.forEach(d => 
          console.log(`  Dock ${d.id}: ${d.name} -> Facility ${d.facility_id}`)
        );
      } else {
        console.log('✅ Docks are properly mapped:');
        orgDocks.rows.forEach(d => 
          console.log(`  Dock ${d.id}: ${d.name} -> Facility ${d.facility_id}`)
        );
      }
      return;
    }
    
    // Step 7: Create the mapping
    console.log('🔧 Creating mapping: Organization 5 -> Facility 7');
    
    const insertResult = await pool.query(
      'INSERT INTO organization_facilities (organization_id, facility_id, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [5, 7]
    );
    
    console.log('✅ Successfully created mapping:', insertResult.rows[0]);
    
    // Step 8: Verify the fix worked
    const verifyDocks = await pool.query(`
      SELECT d.id, d.name, d.facility_id, f.name as facility_name
      FROM docks d
      JOIN facilities f ON d.facility_id = f.id
      JOIN organization_facilities of ON f.id = of.facility_id
      WHERE of.organization_id = 5
      ORDER BY d.id
    `);
    
    console.log(`\n🎉 SUCCESS! Organization 5 can now see ${verifyDocks.rows.length} docks:`);
    verifyDocks.rows.forEach(d => 
      console.log(`  ✅ Dock ${d.id}: ${d.name} -> ${d.facility_name} (facility ${d.facility_id})`)
    );
    
    console.log('\n✅ TENANT MAPPING FIXED! Door Manager should now show docks.');
    console.log('🔄 Please refresh your browser to see the changes.');
    
  } catch (error) {
    console.error('❌ Error fixing tenant mapping:', error);
    console.error('📋 Error details:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixProductionTenantMapping().then(() => {
  console.log('\n🏁 Script completed. Check the Door Manager page in your application.');
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
}); 