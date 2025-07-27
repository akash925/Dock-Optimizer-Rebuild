import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../db.js';
import { FeatureFlagService } from '../modules/featureFlags/service.js';
import { organizationModules } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { mockStorage } from './__mocks__/storage.js';
import { cleanupTestData } from '../test-utils/test-helpers.js';

// Mock the storage
vi.mock('../storage', () => ({
  getStorage: vi.fn().mockResolvedValue(mockStorage),
}));

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
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('isModuleEnabled', () => {
    it('returns true for enabled modules', async () => {
      const result = await featureFlagService.isModuleEnabled(testOrgId, 'calendar');
      expect(result).toBe(true);
    });

    it('returns false for disabled modules', async () => {
      const result = await featureFlagService.isModuleEnabled(testOrgId, 'companyAssets');
      expect(result).toBe(false);
    });

    it('returns false for non-existent modules', async () => {
      const result = await featureFlagService.isModuleEnabled(testOrgId, 'nonExistentModule');
      expect(result).toBe(false);
    });

    it('returns false for non-existent organizations', async () => {
      const result = await featureFlagService.isModuleEnabled(99999, 'calendar');
      expect(result).toBe(false);
    });
  });

  describe('getEnabledModules', () => {
    it('returns only enabled modules', async () => {
      const result = await featureFlagService.getEnabledModules(testOrgId);
      expect(result).toContain('calendar');
      expect(result).not.toContain('companyAssets');
    });

    it('returns empty array for non-existent organizations', async () => {
      const result = await featureFlagService.getEnabledModules(99999);
      expect(result).toEqual([]);
    });
  });

  // TODO: Uncomment these tests when the methods are implemented in FeatureFlagService
  /*
  describe('getModulesWithStatus', () => {
    it('returns modules with their status', async () => {
      const result = await featureFlagService.getModulesWithStatus(testOrgId);
      
      // Find the calendar module in results
      const calendarModule = result.find(m => m.moduleName === 'calendar');
      expect(calendarModule).toBeDefined();
      expect(calendarModule?.enabled).toBe(true);
      
      // Find the companyAssets module in results
      const companyAssetsModule = result.find(m => m.moduleName === 'companyAssets');
      expect(companyAssetsModule).toBeDefined();
      expect(companyAssetsModule?.enabled).toBe(false);
    });
  });

  describe('updateModuleStatus', () => {
    it('can enable a disabled module', async () => {
      await featureFlagService.updateModuleStatus(testOrgId, 'companyAssets', true);
      
      // Verify it's now enabled
      const module = await db.select()
        .from(organizationModules)
        .where(and(
          eq(organizationModules.organizationId, testOrgId),
          eq(organizationModules.moduleName, 'companyAssets')
        ))
        .then(result => result[0]);
      
      expect(module.enabled).toBe(true);
    });

    it('can disable an enabled module', async () => {
      await featureFlagService.updateModuleStatus(testOrgId, 'calendar', false);
      
      // Verify it's now disabled
      const module = await db.select()
        .from(organizationModules)
        .where(and(
          eq(organizationModules.organizationId, testOrgId),
          eq(organizationModules.moduleName, 'calendar')
        ))
        .then(result => result[0]);
      
      expect(module.enabled).toBe(false);
    });

    it('creates a module entry if it does not exist', async () => {
      // Try toggling a module that doesn't exist yet
      await featureFlagService.updateModuleStatus(testOrgId, 'newModule', true);
      
      // Verify it was created and enabled
      const module = await db.select()
        .from(organizationModules)
        .where(and(
          eq(organizationModules.organizationId, testOrgId),
          eq(organizationModules.moduleName, 'newModule')
        ))
        .then(result => result[0]);
      
      expect(module).toBeDefined();
      expect(module.enabled).toBe(true);
    });
  });
  */
});