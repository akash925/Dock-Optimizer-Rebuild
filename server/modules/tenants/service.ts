import { db } from '../../db';
import { tenants, TenantStatus, InsertTenant, featureFlags, AvailableModule } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { featureFlagService } from '../featureFlags/service';

export class TenantService {
  /**
   * Get all tenants
   */
  async getTenants() {
    try {
      return await db.select().from(tenants);
    } catch (error) {
      console.error('Error getting tenants:', error);
      return [];
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenant(id: number) {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
      return tenant;
    } catch (error) {
      console.error(`Error getting tenant ${id}:`, error);
      return null;
    }
  }

  /**
   * Get tenant by subdomain
   */
  async getTenantBySubdomain(subdomain: string) {
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain));
      return tenant;
    } catch (error) {
      console.error(`Error getting tenant by subdomain ${subdomain}:`, error);
      return null;
    }
  }

  /**
   * Create a new tenant
   */
  async createTenant(tenantData: InsertTenant, initialModules: AvailableModule[] = []) {
    try {
      const [newTenant] = await db.insert(tenants).values(tenantData).returning();
      
      if (newTenant && initialModules.length > 0) {
        // Enable initial modules for the tenant
        for (const moduleName of initialModules) {
          await featureFlagService.enableModule(newTenant.id, moduleName);
        }
      }
      
      return newTenant;
    } catch (error) {
      console.error('Error creating tenant:', error);
      return null;
    }
  }

  /**
   * Update a tenant
   */
  async updateTenant(id: number, tenantData: Partial<InsertTenant>) {
    try {
      const [updatedTenant] = await db
        .update(tenants)
        .set({
          ...tenantData,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id))
        .returning();
      
      return updatedTenant;
    } catch (error) {
      console.error(`Error updating tenant ${id}:`, error);
      return null;
    }
  }

  /**
   * Update tenant status
   */
  async updateTenantStatus(id: number, status: TenantStatus) {
    try {
      const [updatedTenant] = await db
        .update(tenants)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, id))
        .returning();
      
      return updatedTenant;
    } catch (error) {
      console.error(`Error updating tenant status ${id}:`, error);
      return null;
    }
  }

  /**
   * Delete a tenant
   */
  async deleteTenant(id: number) {
    try {
      // This will cascade delete all related feature flags due to foreign key constraint
      await db.delete(tenants).where(eq(tenants.id, id));
      return true;
    } catch (error) {
      console.error(`Error deleting tenant ${id}:`, error);
      return false;
    }
  }
}

// Export a singleton instance
export const tenantService = new TenantService();