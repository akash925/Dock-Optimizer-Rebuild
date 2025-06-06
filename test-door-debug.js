import pkg from 'pg';
const { Client } = pkg;

async function testDoorData() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_fha53NmqtcSl@ep-white-sunset-a5uf7anh-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check users
    const usersResult = await client.query('SELECT id, username, tenant_id FROM users ORDER BY id');
    console.log('\n📝 USERS:');
    usersResult.rows.forEach(user => {
      console.log(`  User ${user.id}: ${user.username}, tenantId: ${user.tenant_id}`);
    });

    // Check organizations/tenants
    const tenantsResult = await client.query('SELECT id, name, subdomain FROM tenants ORDER BY id');
    console.log('\n🏢 ORGANIZATIONS:');
    tenantsResult.rows.forEach(tenant => {
      console.log(`  Tenant ${tenant.id}: ${tenant.name} (${tenant.subdomain})`);
    });

    // Check facilities
    const facilitiesResult = await client.query('SELECT id, name, tenant_id FROM facilities ORDER BY id');
    console.log('\n🏭 FACILITIES:');
    facilitiesResult.rows.forEach(facility => {
      console.log(`  Facility ${facility.id}: ${facility.name}, tenantId: ${facility.tenant_id}`);
    });

    // Check docks
    const docksResult = await client.query('SELECT id, name, facility_id, is_active FROM docks ORDER BY facility_id, name');
    console.log('\n🚪 DOCKS:');
    docksResult.rows.forEach(dock => {
      console.log(`  Dock ${dock.id}: ${dock.name}, facilityId: ${dock.facility_id}, active: ${dock.is_active}`);
    });

    // Test door manager filtering logic
    console.log('\n🔍 DOOR MANAGER FILTERING TEST:');
    
    // Simulate the door manager filtering for the user who just registered (user 7)
    const testUserId = 7;
    const testUserResult = await client.query('SELECT id, username, tenant_id FROM users WHERE id = $1', [testUserId]);
    
    if (testUserResult.rows.length > 0) {
      const testUser = testUserResult.rows[0];
      console.log(`  Testing for user: ${testUser.username} (tenantId: ${testUser.tenant_id})`);
      
      if (testUser.tenant_id) {
        // Get facilities for this tenant
        const tenantFacilitiesResult = await client.query('SELECT id, name FROM facilities WHERE tenant_id = $1', [testUser.tenant_id]);
        console.log(`  Facilities for tenant ${testUser.tenant_id}:`);
        tenantFacilitiesResult.rows.forEach(facility => {
          console.log(`    - Facility ${facility.id}: ${facility.name}`);
        });
        
        // Get docks for these facilities
        if (tenantFacilitiesResult.rows.length > 0) {
          const facilityIds = tenantFacilitiesResult.rows.map(f => f.id);
          const tenantDocksResult = await client.query('SELECT id, name, facility_id FROM docks WHERE facility_id = ANY($1)', [facilityIds]);
          console.log(`  Docks for tenant ${testUser.tenant_id} facilities:`);
          tenantDocksResult.rows.forEach(dock => {
            console.log(`    - Dock ${dock.id}: ${dock.name} (facility ${dock.facility_id})`);
          });
          
          if (tenantDocksResult.rows.length === 0) {
            console.log('  ❌ NO DOCKS FOUND for this tenant\'s facilities!');
            console.log('  This explains why the door manager is empty.');
          } else {
            console.log(`  ✅ Found ${tenantDocksResult.rows.length} docks for this tenant`);
          }
        } else {
          console.log('  ❌ NO FACILITIES FOUND for this tenant!');
        }
      } else {
        console.log('  ❌ User has no tenantId - this is the problem!');
      }
    } else {
      console.log(`  ❌ User ${testUserId} not found`);
    }

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await client.end();
  }
}

testDoorData(); 