import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "../../shared/schema";

neonConfig.webSocketConstructor = ws;

// Use the database URL from the environment
const TEST_DATABASE_URL = process.env.DATABASE_URL;

if (!TEST_DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable must be set for running tests");
}

export const testPool = new Pool({ connectionString: TEST_DATABASE_URL });
export const testDb = drizzle({ client: testPool, schema });

// Helper function to clean up test data
export async function cleanupTestData() {
  try {
    // Only delete test-related data, not production data
    // Look for organizations with test-specific names
    const testOrganizations = await testDb
      .select()
      .from(schema.tenants)
      .where(sql`name LIKE 'Test Organization%' OR name LIKE '%Test Org%'`);
    
    // Delete test-related data for these organizations
    for (const org of testOrganizations) {
      // Clean up feature flags
      await testDb.delete(schema.featureFlags)
        .where(sql`organization_id = ${org.id}`);
      
      // Clean up organization modules
      await testDb.delete(schema.organizationModules)
        .where(sql`organization_id = ${org.id}`);
      
      // Clean up organization users
      await testDb.delete(schema.organizationUsers)
        .where(sql`organization_id = ${org.id}`);
    }
    
    // Finally delete the test organizations themselves
    if (testOrganizations.length > 0) {
      const testOrgIds = testOrganizations.map(org => org.id);
      await testDb.delete(schema.tenants)
        .where(sql`id IN (${testOrgIds.join(',')})`);
    }
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}

// Setup function to create test tenant
export async function createTestTenant(name = 'Test Organization') {
  try {
    const [tenant] = await testDb
      .insert(schema.tenants)
      .values({
        name,
        subdomain: `test-${Date.now()}`,
        status: schema.TenantStatus.ACTIVE,
      })
      .returning();
    
    return tenant;
  } catch (error) {
    console.error('Error creating test tenant:', error);
    throw error;
  }
}

// Close pool when tests are done
export async function closeTestDb() {
  await testPool.end();
}