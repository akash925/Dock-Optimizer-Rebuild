import { db } from '../db';
import { organizationModules } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Utility function to clean up test data from database
 * Used by tests to ensure they start with a clean state
 */
export async function cleanupTestData() {
  try {
    // Clean up test organization modules
    // Only clear test entries (organizationId >= 9000)
    await db.delete(organizationModules)
      .where(eq(organizationModules.organizationId, 9999));
    
    // Add more cleanup for other test data as needed
    
    console.log('Test data cleanup completed');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    throw error;
  }
}