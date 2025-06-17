import { db, safeQuery } from "../db";
import { getStorage } from "../storage";
import { 
  users, 
  organizationUsers, 
  roles, 
  tenants
} from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * DEBUG USERS API
 * 
 * This script debugs why the /api/users endpoint is still returning empty arrays
 */

export async function debugUsersAPI() {
  try {
    console.log("🔍 DEBUGGING USERS API");
    console.log("=".repeat(50));
    
    const storage = await getStorage();
    const tenantId = 2; // Hanzo Logistics
    
    console.log(`\n1. Testing getOrganizationUsers(${tenantId}):`);
    const tenantUsers = await storage.getOrganizationUsers(tenantId);
    console.log(`   Found ${tenantUsers.length} organization users`);
    console.log("   Data:", tenantUsers);
    
    console.log(`\n2. Testing user and role lookups:`);
    for (const orgUser of tenantUsers) {
      console.log(`\n   Processing orgUser: userId=${orgUser.userId}, roleId=${orgUser.roleId}`);
      
      const user = await storage.getUser(orgUser.userId);
      const role = await storage.getRole(orgUser.roleId);
      
      console.log(`   User lookup result:`, user ? `Found: ${user.username}` : 'NOT FOUND');
      console.log(`   Role lookup result:`, role ? `Found: ${role.name}` : 'NOT FOUND');
      
      if (!user || !role) {
        console.log(`   ❌ ISSUE: Missing user or role data!`);
      } else {
        const { password, ...safeUser } = user;
        const enhancedUser = {
          ...safeUser,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          role: role.name,
          organizationRole: role.name
        };
        console.log(`   ✅ Enhanced user:`, enhancedUser);
      }
    }
    
    console.log(`\n3. Simulating full API logic:`);
    const users = await Promise.all(tenantUsers.map(async (orgUser) => {
      const user = await storage.getUser(orgUser.userId);
      const role = await storage.getRole(orgUser.roleId);
      
      if (!user || !role) {
        return null;
      }
      
      // Return safe user data (no password)
      const { password, ...safeUser } = user;
      return {
        ...safeUser,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        role: role.name,
        organizationRole: role.name
      };
    }));

    // Filter out null entries
    const validUsers = users.filter(user => user !== null);
    
    console.log(`\n   Final result: ${validUsers.length} valid users`);
    console.log("   Users:", validUsers);
    
    console.log("\n" + "=".repeat(50));
    console.log("🔍 DEBUG COMPLETE");
    
    return { 
      success: validUsers.length > 0,
      userCount: validUsers.length,
      users: validUsers
    };
    
  } catch (error) {
    console.error("❌ DEBUG FAILED:", error);
    throw error;
  }
}

// Run the debug
debugUsersAPI()
  .then(() => process.exit(0))
  .catch(() => process.exit(1)); 