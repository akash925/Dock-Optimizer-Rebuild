import { db } from './db';
import { users, organizationUsers, roles } from "@shared/schema";
import { and, eq } from "drizzle-orm";

/**
 * Enriches a user object with role information from roles table
 * This resolves the mismatch between role as text in users table 
 * and role as reference in organization_users table
 */
export async function enrichUserWithRole(user: any) {
  if (!user) return null;

  try {
    // Check if the user has a role_id from organization_users
    const [orgUser] = await db
      .select()
      .from(organizationUsers)
      .where(eq(organizationUsers.userId, user.id));

    // If we found an organization association with role_id
    if (orgUser) {
      // Get the role record
      const [roleRecord] = await db
        .select()
        .from(roles)
        .where(eq(roles.id, orgUser.roleId));

      if (roleRecord) {
        // Override the role field with the role name from the roles table
        console.log(`Enriching user ${user.username} with role ${roleRecord.name}`);
        user.role = roleRecord.name;
      }
      
      // Set the tenantId (organizationId) for the user - critical for module visibility
      if (orgUser.organizationId) {
        console.log(`Setting tenantId ${orgUser.organizationId} for user ${user.username}`);
        user.tenantId = orgUser.organizationId;
      }
    }

    return user;
  } catch (error) {
    console.error('Error enriching user with role:', error);
    return user; // Return original user if enrichment fails
  }
}