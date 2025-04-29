import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Use a test-specific database URL
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/testdb';

export const testPool = new Pool({ connectionString: TEST_DATABASE_URL });
export const testDb = drizzle({ client: testPool, schema });

// Helper function to clean up test data
export async function cleanupTestData() {
  try {
    // Only delete test-related data, not production data
    // This assumes we're using a test-specific database or test-specific identifiers
    
    // Clean up feature flags and organization modules
    await testDb.delete(schema.featureFlags).where("1=1");
    await testDb.delete(schema.organizationModules).where("1=1");
    
    // Clean up organizations (tenants)
    await testDb.delete(schema.tenants).where("1=1");
    
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