import { neon } from '@neondatabase/serverless';

const sql = neon("postgresql://neondb_owner:npg_fha53NmqtcSl@ep-white-sunset-a5uf7anh-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require");

async function testDoorManagerAPI() {
  try {
    console.log('🔧 Testing Door Manager API logic...');
    
    // Step 1: Get all users and their tenant info
    const users = await sql`SELECT id, username, tenant_id FROM users ORDER BY id`;
    console.log('\n📝 USERS:');
    users.forEach(user => {
      console.log(`  User ${user.id}: ${user.username}, tenantId: ${user.tenant_id}`);
    });
    
    // Step 2: Get all facilities  
    const facilities = await sql`SELECT id, name, tenant_id FROM facilities ORDER BY id`;
    console.log('\n🏭 FACILITIES:');
    facilities.forEach(facility => {
      console.log(`  Facility ${facility.id}: ${facility.name}, tenantId: ${facility.tenant_id}`);
    });
    
    // Step 3: Get all docks
    const docks = await sql`SELECT id, name, facility_id, is_active FROM docks ORDER BY facility_id, name`;
    console.log('\n🚪 DOCKS:');
    docks.forEach(dock => {
      console.log(`  Dock ${dock.id}: ${dock.name}, facilityId: ${dock.facility_id}, active: ${dock.is_active}`);
    });

    // Step 4: Test the EXACT filtering logic from /api/docks for each user
    console.log('\n🔍 TESTING /api/docks FILTERING FOR EACH USER:');
    
    for (const user of users) {
      console.log(`\n--- Testing for User ${user.id}: ${user.username} (tenantId: ${user.tenant_id}) ---`);
      
      if (!user.tenant_id) {
        console.log(`  ❌ User has no tenantId - would get 401/403`);
        continue;
      }
      
      // Filter facilities by tenant (like the API does)
      const tenantFacilities = facilities.filter(facility => facility.tenant_id === user.tenant_id);
      console.log(`  📍 Facilities for tenant ${user.tenant_id}: ${tenantFacilities.length}`);
      tenantFacilities.forEach(facility => {
        console.log(`    - Facility ${facility.id}: ${facility.name}`);
      });
      
      // Get facility IDs (like the API does)
      const tenantFacilityIds = tenantFacilities.map(facility => facility.id);
      console.log(`  🎯 Tenant facility IDs: [${tenantFacilityIds.join(', ')}]`);
      
      // Filter docks by facility IDs (like the API does)
      const tenantDocks = docks.filter(dock => tenantFacilityIds.includes(dock.facility_id));
      console.log(`  🚪 Filtered docks for user: ${tenantDocks.length}`);
      
      if (tenantDocks.length === 0) {
        console.log(`  ❌ NO DOCKS RETURNED for this user`);
        console.log(`  🔍 Debug info:`);
        console.log(`    - User tenantId: ${user.tenant_id}`);
        console.log(`    - Available facility IDs: [${facilities.map(f => f.id).join(', ')}]`);
        console.log(`    - Available dock facilityIds: [${docks.map(d => d.facility_id).join(', ')}]`);
      } else {
        console.log(`  ✅ SUCCESS: ${tenantDocks.length} docks would be returned`);
        tenantDocks.forEach(dock => {
          console.log(`    - Dock ${dock.id}: ${dock.name} (facility ${dock.facility_id})`);
        });
      }
    }
    
    // Step 5: Test if there are any orphaned docks (docks with facility_id that don't exist)
    console.log('\n🔍 CHECKING FOR ORPHANED DOCKS:');
    const facilityIds = facilities.map(f => f.id);
    const orphanedDocks = docks.filter(dock => !facilityIds.includes(dock.facility_id));
    
    if (orphanedDocks.length > 0) {
      console.log(`❌ Found ${orphanedDocks.length} orphaned docks:`);
      orphanedDocks.forEach(dock => {
        console.log(`  - Dock ${dock.id}: ${dock.name} (facility ${dock.facility_id} - DOESN'T EXIST)`);
      });
    } else {
      console.log(`✅ No orphaned docks found`);
    }

  } catch (error) {
    console.error('❌ Database error:', error);
  }
}

testDoorManagerAPI(); 