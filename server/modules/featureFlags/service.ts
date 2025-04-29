import { db } from '../../db';
import { tenants, featureFlags, AvailableModule } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export class FeatureFlagService {
  /**
   * Check if a specific module is enabled for a tenant
   */
  async isModuleEnabled(tenantId: number, moduleName: AvailableModule): Promise<boolean> {
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
      return false;
    }
  }

  /**
   * Get all enabled modules for a tenant
   */
  async getEnabledModules(tenantId: number): Promise<AvailableModule[]> {
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

      return flags.map(flag => flag.module as AvailableModule);
    } catch (error) {
      console.error(`Error getting enabled modules for tenant ${tenantId}:`, error);
      return [];
    }
  }

  /**
   * Enable a module for a tenant
   */
  async enableModule(tenantId: number, moduleName: AvailableModule, settings: Record<string, any> = {}): Promise<boolean> {
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
      return false;
    }
  }

  /**
   * Disable a module for a tenant
   */
  async disableModule(tenantId: number, moduleName: AvailableModule): Promise<boolean> {
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
      return false;
    }
  }

  /**
   * Update settings for a module
   */
  async updateModuleSettings(tenantId: number, moduleName: AvailableModule, settings: Record<string, any>): Promise<boolean> {
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
      return false;
    }
  }
}

// Export a singleton instance
export const featureFlagService = new FeatureFlagService();