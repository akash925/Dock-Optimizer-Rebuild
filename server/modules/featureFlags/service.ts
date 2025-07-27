import { db } from '../../db.js';
import { tenants, featureFlags } from '@shared/schema';
import { AvailableModule } from '@shared/types/modules';
import { eq, and } from 'drizzle-orm';

// In-memory module configuration for when database is not available
const defaultEnabledModules: AvailableModule[] = [
  'companyAssets',
  'calendar',
  'analytics'
];

// Flag to track if we should bypass DB operations when tables don't exist
let useInMemoryFallback = false;

export class FeatureFlagService {
  /**
   * Check if error is related to missing tables and set fallback flag
   */
  private checkTableError(error: any) {
    if (error && 
        (error.code === '42P01' || // relation does not exist
         error.code === '42703')) { // column does not exist
      if (!useInMemoryFallback) {
        console.log('Tables or columns missing, switching to in-memory feature flag fallback');
        useInMemoryFallback = true;
      }
    }
  }

  /**
   * Check if a specific module is enabled for a tenant
   */
  async isModuleEnabled(tenantId: number, moduleName: AvailableModule): Promise<boolean> {
    // Default all modules enabled in development mode
    if (useInMemoryFallback) {
      return defaultEnabledModules.includes(moduleName);
    }
    
    try {
      const [featureFlag] = await db
        .select()
        .from(featureFlags)
        .where(
          and(
            eq(featureFlags.tenantId, tenantId),
            eq(featureFlags.module, moduleName)
          )
        );

      return featureFlag?.enabled || false;
    } catch (error) {
      console.error(`Error checking module ${moduleName} for tenant ${tenantId}:`, error);
      this.checkTableError(error);
      // Return default if we can't access the database
      return defaultEnabledModules.includes(moduleName);
    }
  }

  /**
   * Get all enabled modules for a tenant
   */
  async getEnabledModules(tenantId: number): Promise<AvailableModule[]> {
    if (useInMemoryFallback) {
      return [...defaultEnabledModules];
    }
    
    try {
      const flags = await db
        .select()
        .from(featureFlags)
        .where(
          and(
            eq(featureFlags.tenantId, tenantId),
            eq(featureFlags.enabled, true)
          )
        );

      return flags.map((flag: any) => flag.module as AvailableModule);
    } catch (error) {
      console.error(`Error getting enabled modules for tenant ${tenantId}:`, error);
      this.checkTableError(error);
      return [...defaultEnabledModules];
    }
  }

  /**
   * Enable a module for a tenant
   */
  async enableModule(tenantId: number, moduleName: AvailableModule, settings: Record<string, any> = {}): Promise<boolean> {
    if (useInMemoryFallback) {
      // In memory mode, consider the operation successful but actually do nothing
      return defaultEnabledModules.includes(moduleName) || defaultEnabledModules.push(moduleName) > 0;
    }
    
    try {
      // Check if the feature flag already exists
      const [existingFlag] = await db
        .select()
        .from(featureFlags)
        .where(
          and(
            eq(featureFlags.tenantId, tenantId),
            eq(featureFlags.module, moduleName)
          )
        );

      if (existingFlag) {
        // Update existing flag
        await db
          .update(featureFlags)
          .set({ 
            enabled: true,
            settings: settings,
            updatedAt: new Date()
          })
          .where(eq(featureFlags.id, existingFlag.id));
      } else {
        // Create new flag
        await db
          .insert(featureFlags)
          .values({
            tenantId,
            module: moduleName,
            enabled: true,
            settings: settings
          });
      }
      
      return true;
    } catch (error) {
      console.error(`Error enabling module ${moduleName} for tenant ${tenantId}:`, error);
      this.checkTableError(error);
      
      // For in-memory fallback, consider it enabled
      if (useInMemoryFallback) {
        if (!defaultEnabledModules.includes(moduleName)) {
          defaultEnabledModules.push(moduleName);
        }
        return true;
      }
      
      return false;
    }
  }

  /**
   * Disable a module for a tenant
   */
  async disableModule(tenantId: number, moduleName: AvailableModule): Promise<boolean> {
    if (useInMemoryFallback) {
      // In memory mode, remove from defaultEnabledModules list
      const index = defaultEnabledModules.indexOf(moduleName);
      if (index !== -1) {
        defaultEnabledModules.splice(index, 1);
      }
      return true;
    }
    
    try {
      // Check if the feature flag exists
      const [existingFlag] = await db
        .select()
        .from(featureFlags)
        .where(
          and(
            eq(featureFlags.tenantId, tenantId),
            eq(featureFlags.module, moduleName)
          )
        );

      if (existingFlag) {
        // Update existing flag
        await db
          .update(featureFlags)
          .set({ 
            enabled: false,
            updatedAt: new Date()
          })
          .where(eq(featureFlags.id, existingFlag.id));
      } else {
        // Create disabled flag
        await db
          .insert(featureFlags)
          .values({
            tenantId,
            module: moduleName,
            enabled: false
          });
      }
      
      return true;
    } catch (error) {
      console.error(`Error disabling module ${moduleName} for tenant ${tenantId}:`, error);
      this.checkTableError(error);
      
      // For in-memory fallback, remove from enabled modules list
      if (useInMemoryFallback) {
        const index = defaultEnabledModules.indexOf(moduleName);
        if (index !== -1) {
          defaultEnabledModules.splice(index, 1);
        }
        return true;
      }
      
      return false;
    }
  }

  /**
   * Update settings for a module
   */
  async updateModuleSettings(tenantId: number, moduleName: AvailableModule, settings: Record<string, any>): Promise<boolean> {
    // For in-memory mode, we don't have anywhere to store settings
    if (useInMemoryFallback) {
      return true;
    }
    
    try {
      // Check if the feature flag exists
      const [existingFlag] = await db
        .select()
        .from(featureFlags)
        .where(
          and(
            eq(featureFlags.tenantId, tenantId),
            eq(featureFlags.module, moduleName)
          )
        );

      if (existingFlag) {
        // Update existing flag
        await db
          .update(featureFlags)
          .set({ 
            settings: settings,
            updatedAt: new Date()
          })
          .where(eq(featureFlags.id, existingFlag.id));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error updating settings for module ${moduleName} for tenant ${tenantId}:`, error);
      this.checkTableError(error);
      return useInMemoryFallback || false;
    }
  }
}

// Export a singleton instance
export const featureFlagService = new FeatureFlagService();