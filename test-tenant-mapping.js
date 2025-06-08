import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// We'll make a direct database query instead
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

// Use direct PostgreSQL connection
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function checkTenantMappings() {
  try {
    console.log('=== CHECKING TENANT-FACILITY MAPPINGS ===\n');
    
    // Get all organization-facility mappings
    const mappingsResult = await pool.query('SELECT * FROM organization_facilities ORDER BY organization_id, facility_id');
    const mappings = mappingsResult.rows;
    console.log('All Organization-Facility Mappings:');
    mappings.forEach(m => console.log(`  Org ${m.organization_id} -> Facility ${m.facility_id}`));
    
    // Check Organization 5 specifically
    const org5Mappings = mappings.filter(m => m.organization_id === 5);
    console.log(`\nOrganization 5 has ${org5Mappings.length} facility mappings:`);
    org5Mappings.forEach(m => console.log(`  -> Facility ${m.facility_id}`));
    
    // Get all facilities
    const facilitiesResult = await pool.query('SELECT id, name, tenant_id FROM facilities ORDER BY id');
    const allFacilities = facilitiesResult.rows;
    console.log(`\nAll Facilities in Database (${allFacilities.length} total):`);
    allFacilities.forEach(f => console.log(`  ID ${f.id}: ${f.name} (tenant: ${f.tenant_id})`));
    
    // Get all docks
    const docksResult = await pool.query('SELECT id, name, facility_id FROM docks ORDER BY id');
    const allDocks = docksResult.rows;
    console.log(`\nAll Docks in Database (${allDocks.length} total):`);
    allDocks.forEach(d => console.log(`  ID ${d.id}: ${d.name} -> Facility ${d.facility_id}`));
    
    // Find docks that should belong to org 5
    const org5FacilityIds = org5Mappings.map(m => m.facility_id);
    const org5Docks = allDocks.filter(d => org5FacilityIds.includes(d.facility_id));
    console.log(`\nDocks that should be visible to Organization 5 (${org5Docks.length} total):`);
    org5Docks.forEach(d => console.log(`  ID ${d.id}: ${d.name} -> Facility ${d.facility_id}`));
    
    // Check for any mappings missing
    console.log('\n=== DIAGNOSIS ===');
    if (org5Mappings.length === 0) {
      console.log('❌ PROBLEM: Organization 5 has NO facility mappings!');
      console.log('🔧 SOLUTION: Need to create organization_facilities mapping for org 5');
      
      // Find facility 7 (Fresh Connect HQ) and see if it exists
      const facility7 = allFacilities.find(f => f.id === 7);
      if (facility7) {
        console.log(`\nFacility 7 exists: ${facility7.name} (tenant_id: ${facility7.tenant_id})`);
        console.log('🔧 RECOMMENDED FIX: Add mapping for org 5 -> facility 7');
      }
      
    } else {
      console.log('✅ Organization 5 has facility mappings');
    }
    
    if (org5Docks.length === 0) {
      console.log('❌ PROBLEM: Organization 5 would have NO docks visible!');
    } else {
      console.log(`✅ Organization 5 should see ${org5Docks.length} docks`);
    }
    
  } catch (error) {
    console.error('Error checking mappings:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkTenantMappings(); 