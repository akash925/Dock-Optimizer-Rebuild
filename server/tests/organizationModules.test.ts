import { testDb, cleanupTestData, createTestTenant, closeTestDb } from './test-db';
import * as schema from '../../shared/schema';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { eq, and, sql } from 'drizzle-orm';

// Mock storage service for organization modules
const storage = {
  async updateOrganizationModule(orgId: number, moduleName: string, enabled: boolean) {
    try {
      // Check if module exists for this organization
      const [existingModule] = await testDb
        .select()
        .from(schema.organizationModules)
        .where(
          and(
            eq(schema.organizationModules.organizationId, orgId),
            eq(schema.organizationModules.moduleName, moduleName)
          )
        );
      
      if (existingModule) {
        // Update existing module
        const [updated] = await testDb
          .update(schema.organizationModules)
          .set({ enabled })
          .where(eq(schema.organizationModules.id, existingModule.id))
          .returning();
        
        return updated;
      } else {
        // Create new module record
        const [created] = await testDb
          .insert(schema.organizationModules)
          .values({
            organizationId: orgId,
            moduleName,
            enabled
          })
          .returning();
        
        return created;
      }
    } catch (error) {
      console.error(`Error updating organization module:`, error);
      throw error;
    }
  },
  
  async getOrganizationModules(orgId: number) {
    try {
      const modules = await testDb
        .select()
        .from(schema.organizationModules)
        .where(eq(schema.organizationModules.organizationId, orgId));
      
      return modules;
    } catch (error) {
      console.error(`Error getting organization modules:`, error);
      throw error;
    }
  }
};

describe('Organization Modules', () => {
  let testTenantId: number;
  
  // Set up a test tenant before running tests
  beforeAll(async () => {
    try {
      // Clean up any previous test data
      await cleanupTestData();
      
      // Create a test tenant
      const tenant = await createTestTenant('Org Modules Test Org');
      testTenantId = tenant.id;
    } catch (error) {
      console.error('Error in test setup:', error);
      throw error;
    }
  });
  
  // Clean up after all tests are done
  afterAll(async () => {
    await cleanupTestData();
    await closeTestDb();
  });
  
  // Test enabling a module
  test('should enable a module for an organization', async () => {
    // Arrange
    const moduleName = schema.AvailableModule.ASSET_MANAGER;
    
    // Act
    const result = await storage.updateOrganizationModule(testTenantId, moduleName, true);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.moduleName).toBe(moduleName);
    expect(result.enabled).toBe(true);
    
    // Verify by getting all modules
    const modules = await storage.getOrganizationModules(testTenantId);
    const enabledModule = modules.find(m => m.moduleName === moduleName);
    expect(enabledModule).toBeDefined();
    expect(enabledModule.enabled).toBe(true);
  });
  
  // Test disabling a module
  test('should disable a module for an organization', async () => {
    // Arrange
    const moduleName = schema.AvailableModule.CALENDAR;
    
    // First enable the module
    await storage.updateOrganizationModule(testTenantId, moduleName, true);
    
    // Act
    const result = await storage.updateOrganizationModule(testTenantId, moduleName, false);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.moduleName).toBe(moduleName);
    expect(result.enabled).toBe(false);
    
    // Verify by getting all modules
    const modules = await storage.getOrganizationModules(testTenantId);
    const disabledModule = modules.find(m => m.moduleName === moduleName);
    expect(disabledModule).toBeDefined();
    expect(disabledModule.enabled).toBe(false);
  });
  
  // Test toggling multiple modules
  test('should correctly manage multiple module states', async () => {
    // Arrange
    const modulesToEnable = [
      schema.AvailableModule.ANALYTICS,
      schema.AvailableModule.BOOKING_PAGES,
    ];
    
    const modulesToDisable = [
      AvailableModule.FACILITY_MANAGEMENT,
      AvailableModule.USER_MANAGEMENT,
    ];
    
    // Enable modules
    for (const module of modulesToEnable) {
      await storage.updateOrganizationModule(testTenantId, module, true);
    }
    
    // Disable modules
    for (const module of modulesToDisable) {
      await storage.updateOrganizationModule(testTenantId, module, false);
    }
    
    // Act
    const modules = await storage.getOrganizationModules(testTenantId);
    
    // Assert - Enabled modules
    for (const module of modulesToEnable) {
      const enabledModule = modules.find(m => m.moduleName === module);
      expect(enabledModule).toBeDefined();
      expect(enabledModule.enabled).toBe(true);
    }
    
    // Assert - Disabled modules
    for (const module of modulesToDisable) {
      const disabledModule = modules.find(m => m.moduleName === module);
      expect(disabledModule).toBeDefined();
      expect(disabledModule.enabled).toBe(false);
    }
  });
  
  // Test toggling a module from true to false
  test('should toggle a module from true to false', async () => {
    // Arrange
    const moduleName = AvailableModule.EMAIL_NOTIFICATIONS;
    
    // First enable the module
    await storage.updateOrganizationModule(testTenantId, moduleName, true);
    
    // Verify it's enabled
    let modules = await storage.getOrganizationModules(testTenantId);
    let enabledModule = modules.find(m => m.moduleName === moduleName);
    expect(enabledModule).toBeDefined();
    expect(enabledModule.enabled).toBe(true);
    
    // Act - disable it
    await storage.updateOrganizationModule(testTenantId, moduleName, false);
    
    // Assert
    modules = await storage.getOrganizationModules(testTenantId);
    const disabledModule = modules.find(m => m.moduleName === moduleName);
    expect(disabledModule).toBeDefined();
    expect(disabledModule.enabled).toBe(false);
  });
});