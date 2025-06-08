// DEBUG CURRENT USER AND TENANT - FIND THE REAL ISSUE
// Run this in Replit to see what user is logged in and what they should see

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found. Run this in Replit where DATABASE_URL is set.');
  process.exit(1);
}

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

console.log('🔍 DEBUG: Current User & Tenant Analysis\n');

async function debugUserAndTenant() {
  try {
    const client = await pool.connect();
    
    console.log('👤 ALL USERS AND THEIR ORGANIZATIONS:');
    const users = await client.query(`
      SELECT u.id, u.username, u.email, u.role, u.tenant_id as direct_tenant,
             ou.organization_id as org_from_mapping, t.name as org_name
      FROM users u
      LEFT JOIN organization_users ou ON u.id = ou.user_id
      LEFT JOIN tenants t ON ou.organization_id = t.id
      ORDER BY u.id
    `);
    
    users.rows.forEach(user => {
      console.log(`  User ${user.id}: ${user.username} (${user.email})`);
      console.log(`    Direct tenant_id: ${user.direct_tenant}`);
      console.log(`    Org from mapping: ${user.org_from_mapping} (${user.org_name})`);
      console.log('');
    });
    
    console.log('🏢 ORGANIZATION-FACILITY MAPPINGS:');
    const mappings = await client.query(`
      SELECT of.organization_id, t.name as org_name, 
             of.facility_id, f.name as facility_name
      FROM organization_facilities of
      LEFT JOIN tenants t ON of.organization_id = t.id
      LEFT JOIN facilities f ON of.facility_id = f.id
      ORDER BY of.organization_id, of.facility_id
    `);
    
    const orgGroups = {};
    mappings.rows.forEach(mapping => {
      if (!orgGroups[mapping.organization_id]) {
        orgGroups[mapping.organization_id] = {
          name: mapping.org_name,
          facilities: []
        };
      }
      orgGroups[mapping.organization_id].facilities.push({
        id: mapping.facility_id,
        name: mapping.facility_name
      });
    });
    
    Object.keys(orgGroups).forEach(orgId => {
      const org = orgGroups[orgId];
      console.log(`  Organization ${orgId} (${org.name}):`);
      org.facilities.forEach(facility => {
        console.log(`    -> Facility ${facility.id}: ${facility.name}`);
      });
      console.log('');
    });
    
    console.log('🚪 DOCKS BY ORGANIZATION:');
    for (const orgId of Object.keys(orgGroups)) {
      const docks = await client.query(`
        SELECT d.id, d.name, d.facility_id, f.name as facility_name
        FROM docks d
        JOIN facilities f ON d.facility_id = f.id
        JOIN organization_facilities of ON f.id = of.facility_id
        WHERE of.organization_id = $1
        ORDER BY d.id
      `, [orgId]);
      
      console.log(`  Organization ${orgId} (${orgGroups[orgId].name}) can see ${docks.rows.length} docks:`);
      if (docks.rows.length > 0) {
        docks.rows.forEach(dock => {
          console.log(`    Dock ${dock.id}: ${dock.name} -> ${dock.facility_name}`);
        });
      } else {
        console.log('    ❌ NO DOCKS VISIBLE');
      }
      console.log('');
    }
    
    console.log('🎯 LIKELY ISSUE DIAGNOSIS:');
    console.log('Based on the screenshot showing "450 Airtech Pkwy" in the facility dropdown:');
    console.log('- "450 Airtech Pkwy" is Facility 1');
    console.log('- Facility 1 belongs to Organization 2 (Hanzo Logistics)');
    console.log('- You might be logged in as Organization 2, not Organization 5');
    console.log('');
    console.log('Check which user you\'re logged in as in the browser and compare with the list above.');
    
    client.release();
    
  } catch (error) {
    console.error('❌ Error debugging user and tenant:', error);
  }
}

async function runDebug() {
  console.log('🚀 Running user and tenant debug...\n');
  
  await debugUserAndTenant();
  
  console.log('\n🔄 NEXT STEPS:');
  console.log('1. Check which user you\'re logged in as in the browser');
  console.log('2. If you\'re logged in as Organization 2, try switching facilities');
  console.log('3. If you need to be Organization 5, log in as a Fresh Connect user');
  console.log('4. Check the facility dropdown - it should show all facilities for your org');
  
  await pool.end();
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDebug().catch(console.error);
} 