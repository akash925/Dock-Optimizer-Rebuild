import { neon } from '@neondatabase/serverless';

const sql = neon("postgresql://neondb_owner:npg_fha53NmqtcSl@ep-white-sunset-a5uf7anh-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require");

async function fixDatabase() {
  try {
    console.log('🔧 Fixing database tenant issues...');
    
    // Create default organization
    await sql`INSERT INTO tenants (id, name, subdomain, status, timezone) VALUES (1, 'Default Organization', 'default', 'active', 'America/New_York') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`;
    console.log('✅ Created/updated default organization');
    
    // Update users to belong to default tenant
    const userResult = await sql`UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL`;
    console.log(`✅ Updated ${userResult.length} users to default tenant`);
    
    // Update facilities to belong to default tenant  
    const facilityResult = await sql`UPDATE facilities SET tenant_id = 1 WHERE tenant_id IS NULL`;
    console.log(`✅ Updated ${facilityResult.length} facilities to default tenant`);
    
    // Check results
    const results = await sql`
      SELECT 'Users' as type, count(*)::int as count FROM users WHERE tenant_id = 1
      UNION ALL
      SELECT 'Facilities' as type, count(*)::int as count FROM facilities WHERE tenant_id = 1  
      UNION ALL
      SELECT 'Tenants' as type, count(*)::int as count FROM tenants
    `;
    
    console.log('\n📊 Database status:');
    results.forEach(r => console.log(`  ${r.type}: ${r.count}`));
    
  } catch (error) {
    console.error('❌ Error fixing database:', error);
  }
}

fixDatabase(); 