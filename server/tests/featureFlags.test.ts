import { featureFlagService } from '../modules/featureFlags/service';
import { AvailableModule } from '@shared/schema';
import { testDb, cleanupTestData, createTestTenant, closeTestDb } from './test-db';

describe('Feature Flag Service', () => {
  let testTenantId: number;

  // Set up a test tenant before running tests
  beforeAll(async () => {
    try {
      // Clean up any previous test data
      await cleanupTestData();
      
      // Create a test tenant
      const tenant = await createTestTenant('Feature Flag Test Org');
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
  test('should enable a module', async () => {
    // Arrange
    const moduleName = AvailableModule.ASSET_MANAGER;
    
    // Act
    const result = await featureFlagService.enableModule(testTenantId, moduleName);
    
    // Assert
    expect(result).toBe(true);
    
    // Verify by checking if module is enabled
    const isEnabled = await featureFlagService.isModuleEnabled(testTenantId, moduleName);
    expect(isEnabled).toBe(true);
  });

  // Test disabling a module
  test('should disable a module', async () => {
    // Arrange
    const moduleName = AvailableModule.CALENDAR;
    
    // First enable the module
    await featureFlagService.enableModule(testTenantId, moduleName);
    
    // Act
    const result = await featureFlagService.disableModule(testTenantId, moduleName);
    
    // Assert
    expect(result).toBe(true);
    
    // Verify by checking if module is disabled
    const isEnabled = await featureFlagService.isModuleEnabled(testTenantId, moduleName);
    expect(isEnabled).toBe(false);
  });

  // Test toggling a module from true to false
  test('should toggle a module from true to false', async () => {
    // Arrange
    const moduleName = AvailableModule.EMAIL_NOTIFICATIONS;
    
    // First enable the module
    await featureFlagService.enableModule(testTenantId, moduleName);
    
    // Verify it's enabled
    let isEnabled = await featureFlagService.isModuleEnabled(testTenantId, moduleName);
    expect(isEnabled).toBe(true);
    
    // Act - disable it
    await featureFlagService.disableModule(testTenantId, moduleName);
    
    // Assert
    isEnabled = await featureFlagService.isModuleEnabled(testTenantId, moduleName);
    expect(isEnabled).toBe(false);
  });

  // Test getting all enabled modules
  test('should return all enabled modules', async () => {
    // Arrange
    const modules = [
      AvailableModule.ANALYTICS,
      AvailableModule.BOOKING_PAGES,
      AvailableModule.DOOR_MANAGER
    ];
    
    // Enable multiple modules
    for (const module of modules) {
      await featureFlagService.enableModule(testTenantId, module);
    }
    
    // Act
    const enabledModules = await featureFlagService.getEnabledModules(testTenantId);
    
    // Assert
    expect(enabledModules.length).toBeGreaterThanOrEqual(modules.length);
    for (const module of modules) {
      expect(enabledModules).toContain(module);
    }
  });

  // Test module settings
  test('should update module settings', async () => {
    // Arrange
    const moduleName = AvailableModule.ANALYTICS;
    const settings = {
      retention: 30,
      enableRealTimeReporting: true,
      customReports: ['utilization', 'performance']
    };
    
    // Enable the module first
    await featureFlagService.enableModule(testTenantId, moduleName);
    
    // Act
    const result = await featureFlagService.updateModuleSettings(
      testTenantId, 
      moduleName, 
      settings
    );
    
    // Assert
    expect(result).toBe(true);
    
    // We can't directly verify the settings since there's no getter method in the service
    // A more comprehensive test would require extending the service or querying the DB directly
  });
});