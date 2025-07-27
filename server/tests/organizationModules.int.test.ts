import { db } from '../db.js';
import { organizationModules } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { cleanupTestData } from './test-db.js';

describe('Organization Modules', () => {
  const testOrgId = 9999;
  
  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Basic CRUD operations', () => {
    it('creates organization module entries', async () => {
      // Insert test module entries
      await db.insert(organizationModules).values([
        { 
          organizationId: testOrgId, 
          moduleName: 'calendar', 
          enabled: true 
        },
        { 
          organizationId: testOrgId, 
          moduleName: 'companyAssets', 
          enabled: false 
        }
      ]);

      // Retrieve the entries and check
      const modules = await db.select()
        .from(organizationModules)
        .where(eq(organizationModules.organization_id, testOrgId));
      
      expect(modules.length).toBe(2);
      expect(modules.some(m => m.module_name === 'calendar' && m.enabled === true)).toBe(true);
      expect(modules.some(m => m.module_name === 'companyAssets' && m.enabled === false)).toBe(true);
    });

    it('reads organization module entries', async () => {
      // Retrieve a specific module
      const [calendarModule] = await db.select()
        .from(organizationModules)
        .where(and(
          eq(organizationModules.organization_id, testOrgId),
          eq(organizationModules.module_name, 'calendar')
        ));
      
      expect(calendarModule).toBeDefined();
      expect(calendarModule.enabled).toBe(true);
    });

    it('updates organization module entries', async () => {
      // Update a module's status
      await db.update(organizationModules)
        .set({ enabled: false })
        .where(and(
          eq(organizationModules.organization_id, testOrgId),
          eq(organizationModules.module_name, 'calendar')
        ));
      
      // Verify the update
      const [updatedModule] = await db.select()
        .from(organizationModules)
        .where(and(
          eq(organizationModules.organization_id, testOrgId),
          eq(organizationModules.module_name, 'calendar')
        ));
      
      expect(updatedModule.enabled).toBe(false);
    });

    it('deletes organization module entries', async () => {
      // Delete a specific module
      await db.delete(organizationModules)
        .where(and(
          eq(organizationModules.organization_id, testOrgId),
          eq(organizationModules.module_name, 'companyAssets')
        ));
      
      // Verify the deletion
      const modules = await db.select()
        .from(organizationModules)
        .where(eq(organizationModules.organization_id, testOrgId));
      
      expect(modules.length).toBe(1);
      expect(modules.some(m => m.module_name === 'companyAssets')).toBe(false);
    });
  });
});