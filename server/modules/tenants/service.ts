import { db } from '../../db';
import { tenants, TenantStatus, InsertTenant, featureFlags, AvailableModule } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { featureFlagService } from '../featureFlags/service';

// In-memory tenant cache for when database is not available
const defaultTenant = {
  id: 1,
  name: 'Default Tenant',
  subdomain: 'default',
  domain: 'localhost',
  status: TenantStatus.ACTIVE,
  plan: 'enterprise',
  createdAt: new Date(),
  updatedAt: new Date()
};

// Flag to track if we should bypass DB operations when tables don't exist
let useInMemoryFallback = false;

export class TenantService {
  /**
   * Get all tenants
   */
  async getTenants() {
    if (useInMemoryFallback) {
      return [defaultTenant];
    }
    
    try {
      return await db.select().from(tenants);
    } catch (error) {
      console.error('Error getting tenants:', error);
      // Check if this is a table-not-exists type error
      this.checkTableError(error);
      return [defaultTenant];
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenant(id: number) {
    if (useInMemoryFallback) {
      return id === 1 ? defaultTenant : null;
    }
    
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
      return tenant;
    } catch (error) {
      console.error(`Error getting tenant ${id}:`, error);
      this.checkTableError(error);
      return id === 1 ? defaultTenant : null;
    }
  }

  /**
   * Get tenant by subdomain
   */
  async getTenantBySubdomain(subdomain: string) {
    if (useInMemoryFallback) {
      return defaultTenant;
    }
    
    try {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain));
      return tenant;
    } catch (error) {
      console.error(`Error getting tenant by subdomain ${subdomain}:`, error);
      this.checkTableError(error);
      return defaultTenant;
    }
  }
  
  /**
   * Check if error is related to missing tables and set fallback flag
   */
  private checkTableError(error: any) {
    if (error && 
        (error.code === '42P01' || // relation does not exist
         error.code === '42703')) { // column does not exist
      if (!useInMemoryFallback) {
        console.log('Tables or columns missing, switching to in-memory tenant fallback');
        useInMemoryFallback = true;
      }
    }
  }

  /**
   * Create a new tenant
   */
  async createTenant(tenantData: InsertTenant, initialModules: AvailableModule[] = []) {
    try {
      // Cast status to TenantStatus type if present
      const dataToInsert = {
        ...tenantData,
        status: tenantData.status as TenantStatus
      };
      
      const [newTenant] = await db.insert(tenants).values([dataToInsert]).returning();
      
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
      // Prepare the update data with proper type casting
      const updateData: any = {
        ...tenantData,
        updatedAt: new Date(),
      };
      
      // Cast status to TenantStatus if present
      if (updateData.status) {
        updateData.status = updateData.status as TenantStatus;
      }
      
      const [updatedTenant] = await db
        .update(tenants)
        .set(updateData)
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