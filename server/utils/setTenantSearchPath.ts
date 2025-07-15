import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Sets the PostgreSQL search_path to include both tenant-specific schema and public schema
 * This ensures tenant isolation while maintaining access to core tables in public schema
 * 
 * @param tenantId - The tenant ID to set schema for
 * @throws Error if the search path cannot be set (fatal error that should abort startup)
 */
export const setTenantSearchPath = async (tenantId: number): Promise<void> => {
  try {
    console.log(`[SearchPath] Setting search path for tenant: ${tenantId}`);
    
    // Set search_path to both tenant schema and public schema
    // Order matters: tenant_${tenantId} is searched first, then public
    await db.execute(sql`SET search_path TO ${sql.raw(`tenant_${tenantId}`)}, public`);
    
    console.log(`[SearchPath] ✅ Successfully set search path to: tenant_${tenantId}, public`);
  } catch (error) {
    // Log the fatal error with full context
    console.error(`[SearchPath] ❌ FATAL: Failed to set search path for tenant ${tenantId}:`, error);
    console.error(`[SearchPath] ❌ This is a critical security issue - tenant isolation is broken!`);
    console.error(`[SearchPath] ❌ Application startup should be aborted.`);
    
    // Throw error to abort the operation
    throw new Error(
      `Failed to set search path for tenant ${tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Resets the search_path to default (public only)
 * Used for cleanup or when no tenant context is needed
 */
export const resetSearchPath = async (): Promise<void> => {
  try {
    console.log(`[SearchPath] Resetting search path to default (public only)`);
    
    await db.execute(sql`SET search_path TO public`);
    
    console.log(`[SearchPath] ✅ Successfully reset search path to: public`);
  } catch (error) {
    console.error(`[SearchPath] ❌ Failed to reset search path:`, error);
    throw new Error(
      `Failed to reset search path: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Gets the current search_path from PostgreSQL
 * Useful for debugging and testing
 */
export const getCurrentSearchPath = async (): Promise<string[]> => {
  try {
    const result = await db.execute(sql`SHOW search_path`);
    const row = result.rows[0] as { search_path?: string } | undefined;
    const searchPath = row?.search_path || '';
    
    // Parse the search_path string into an array
    const paths = searchPath
      .split(',')
      .map((path: string) => path.trim().replace(/"/g, ''))
      .filter((path: string) => path.length > 0);
    
    console.log(`[SearchPath] Current search path: ${paths.join(', ')}`);
    return paths;
  } catch (error) {
    console.error(`[SearchPath] ❌ Failed to get current search path:`, error);
    throw new Error(
      `Failed to get search path: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}; 