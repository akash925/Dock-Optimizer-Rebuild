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

async function fixTenantFacilityMapping() {
  try {
    console.log('=== FIXING TENANT-FACILITY MAPPING FOR ORGANIZATION 5 ===\n');
    
    // Check current state
    const currentMappingsResult = await pool.query(
      'SELECT * FROM organization_facilities WHERE organization_id = 5'
    );
    console.log(`Organization 5 currently has ${currentMappingsResult.rows.length} facility mappings`);
    
    // Check if facility 7 exists
    const facility7Result = await pool.query(
      'SELECT id, name, tenant_id FROM facilities WHERE id = 7'
    );
    
    if (facility7Result.rows.length === 0) {
      console.log('❌ Facility 7 does not exist in this database');
      console.log('This appears to be a local development database, not the Replit production database');
      return;
    }
    
    const facility7 = facility7Result.rows[0];
    console.log(`✅ Facility 7 exists: ${facility7.name} (tenant_id: ${facility7.tenant_id})`);
    
    // Check if mapping already exists
    const existingMappingResult = await pool.query(
      'SELECT * FROM organization_facilities WHERE organization_id = 5 AND facility_id = 7'
    );
    
    if (existingMappingResult.rows.length > 0) {
      console.log('✅ Mapping already exists for organization 5 -> facility 7');
      return;
    }
    
    // Create the mapping
    console.log('🔧 Creating mapping: Organization 5 -> Facility 7');
    
    const insertResult = await pool.query(
      'INSERT INTO organization_facilities (organization_id, facility_id, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [5, 7]
    );
    
    console.log('✅ Successfully created mapping:', insertResult.rows[0]);
    
    // Verify by checking how many docks organization 5 should now see
    const docksForOrg5Result = await pool.query(`
      SELECT d.id, d.name, d.facility_id, f.name as facility_name
      FROM docks d
      JOIN facilities f ON d.facility_id = f.id
      JOIN organization_facilities of ON f.id = of.facility_id
      WHERE of.organization_id = 5
      ORDER BY d.id
    `);
    
    console.log(`\n🎉 Organization 5 should now see ${docksForOrg5Result.rows.length} docks:`);
    docksForOrg5Result.rows.forEach(d => 
      console.log(`  ID ${d.id}: ${d.name} -> ${d.facility_name} (facility ${d.facility_id})`)
    );
    
    console.log('\n✅ TENANT MAPPING FIXED! Door Manager should now show docks.');
    
  } catch (error) {
    console.error('Error fixing tenant mapping:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixTenantFacilityMapping(); 