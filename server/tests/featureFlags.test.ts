import { db } from '../db';
import { FeatureFlagService } from '../modules/featureFlags/service';
import { organizationModules } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { cleanupTestData } from './test-db';

describe('Feature Flags Service', () => {
  const testOrgId = 9999;
  let featureFlagService: FeatureFlagService;

  beforeAll(async () => {
    featureFlagService = new FeatureFlagService();

    // Clean up any existing test data
    await cleanupTestData();

    // Initialize test data
    await db.insert(organizationModules).values([
      { 
        organization_id: testOrgId, 
        module_name: 'calendar', 
        enabled: true 
      },
      { 
        organization_id: testOrgId, 
        module_name: 'assetManager', 
        enabled: false 
      }
    ]);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('isModuleEnabled', () => {
    it('returns true for enabled modules', async () => {
      const result = await featureFlagsService.isModuleEnabled(testOrgId, 'calendar');
      expect(result).toBe(true);
    });

    it('returns false for disabled modules', async () => {
      const result = await featureFlagsService.isModuleEnabled(testOrgId, 'assetManager');
      expect(result).toBe(false);
    });

    it('returns false for non-existent modules', async () => {
      const result = await featureFlagsService.isModuleEnabled(testOrgId, 'nonExistentModule');
      expect(result).toBe(false);
    });

    it('returns false for non-existent organizations', async () => {
      const result = await featureFlagsService.isModuleEnabled(99999, 'calendar');
      expect(result).toBe(false);
    });
  });

  describe('getEnabledModules', () => {
    it('returns only enabled modules', async () => {
      const result = await featureFlagsService.getEnabledModules(testOrgId);
      expect(result).toContain('calendar');
      expect(result).not.toContain('assetManager');
    });

    it('returns empty array for non-existent organizations', async () => {
      const result = await featureFlagsService.getEnabledModules(99999);
      expect(result).toEqual([]);
    });
  });

  describe('getAllModulesWithStatus', () => {
    it('returns modules with their status', async () => {
      const result = await featureFlagsService.getAllModulesWithStatus(testOrgId);
      
      // Find the calendar module in results
      const calendarModule = result.find(m => m.moduleName === 'calendar');
      expect(calendarModule).toBeDefined();
      expect(calendarModule?.enabled).toBe(true);
      
      // Find the assetManager module in results
      const assetManagerModule = result.find(m => m.moduleName === 'assetManager');
      expect(assetManagerModule).toBeDefined();
      expect(assetManagerModule?.enabled).toBe(false);
    });
  });

  describe('toggleModule', () => {
    it('can enable a disabled module', async () => {
      await featureFlagsService.toggleModule(testOrgId, 'assetManager', true);
      
      // Verify it's now enabled
      const module = await db.select()
        .from(organizationModules)
        .where(and(
          eq(organizationModules.organization_id, testOrgId),
          eq(organizationModules.module_name, 'assetManager')
        ))
        .then(result => result[0]);
      
      expect(module.enabled).toBe(true);
    });

    it('can disable an enabled module', async () => {
      await featureFlagsService.toggleModule(testOrgId, 'calendar', false);
      
      // Verify it's now disabled
      const module = await db.select()
        .from(organizationModules)
        .where(and(
          eq(organizationModules.organization_id, testOrgId),
          eq(organizationModules.module_name, 'calendar')
        ))
        .then(result => result[0]);
      
      expect(module.enabled).toBe(false);
    });

    it('creates a module entry if it does not exist', async () => {
      // Try toggling a module that doesn't exist yet
      await featureFlagsService.toggleModule(testOrgId, 'newModule', true);
      
      // Verify it was created and enabled
      const module = await db.select()
        .from(organizationModules)
        .where(and(
          eq(organizationModules.organization_id, testOrgId),
          eq(organizationModules.module_name, 'newModule')
        ))
        .then(result => result[0]);
      
      expect(module).toBeDefined();
      expect(module.enabled).toBe(true);
    });
  });
});