import { db } from "../db.js.js.js";
import { getStorage } from "../storage.js.js.js";
import { users, organizationUsers, roles } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function fixUserOrganizationAssociations() {
  try {
    console.log("🔧 Fixing user-organization associations...");
    
    const storage = await getStorage();
    
    // Get all users
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users in the system`);
    
    // Get all organizations
    const organizations = await storage.getAllTenants();
    console.log(`Found ${organizations.length} organizations`);
    
    // Get default "admin" role ID
    const adminRole = await storage.getRoleByName("admin");
    if (!adminRole) {
      console.error("❌ Admin role not found! Cannot proceed.");
      return;
    }
    
    let associationsFixed = 0;
    
    for (const user of allUsers) {
      console.log(`\n👤 Processing user: ${user.username} (ID: ${user.id})`);
      
      // Check if user already has organization associations
      const existingAssociations = await storage.getOrganizationUsers(user.id);
      if (existingAssociations.length > 0) {
        console.log(`  ✅ User already has ${existingAssociations.length} organization association(s)`);
        continue;
      }
      
      // Determine organization to associate with based on user data
      let targetOrgId: number | null = null;
      
      // If user has a tenantId, use that
      if (user.tenantId) {
        targetOrgId = user.tenantId;
        console.log(`  📋 Using user's tenantId: ${targetOrgId}`);
      } else {
        // For users without tenantId, we need to make educated guesses based on email
        const userEmail = user.username.toLowerCase();
        
        if (userEmail.includes('hanzo') || userEmail.includes('logistics')) {
          // Find Hanzo organization
          const hanzoOrg = organizations.find(org => 
            org.name.toLowerCase().includes('hanzo') || 
            org.subdomain?.toLowerCase().includes('hanzo')
          );
          if (hanzoOrg) {
            targetOrgId = hanzoOrg.id;
            console.log(`  🏢 Matched to Hanzo organization: ${hanzoOrg.name} (ID: ${targetOrgId})`);
          }
        } else if (userEmail.includes('fresh') || userEmail.includes('connect')) {
          // Find Fresh Connect organization
          const freshOrg = organizations.find(org => 
            org.name.toLowerCase().includes('fresh') || 
            org.subdomain?.toLowerCase().includes('fresh')
          );
          if (freshOrg) {
            targetOrgId = freshOrg.id;
            console.log(`  🏢 Matched to Fresh Connect organization: ${freshOrg.name} (ID: ${targetOrgId})`);
          }
        } else if (userEmail.includes('admin') || userEmail.includes('test')) {
          // Default admin users to the first organization or Global Admin
          const globalAdminOrg = organizations.find(org => 
            org.name.toLowerCase().includes('global') || 
            org.name.toLowerCase().includes('admin')
          );
          if (globalAdminOrg) {
            targetOrgId = globalAdminOrg.id;
            console.log(`  🏢 Matched to Global Admin organization: ${globalAdminOrg.name} (ID: ${targetOrgId})`);
          } else {
            // Fallback to first organization
            targetOrgId = organizations[0]?.id;
            console.log(`  🏢 Fallback to first organization: ${organizations[0]?.name} (ID: ${targetOrgId})`);
          }
        } else {
          // Fallback to first organization for unmatched users
          targetOrgId = organizations[0]?.id;
          console.log(`  🏢 Default assignment to first organization: ${organizations[0]?.name} (ID: ${targetOrgId})`);
        }
      }
      
      if (!targetOrgId) {
        console.log(`  ⚠️ Could not determine organization for user ${user.username}`);
        continue;
      }
      
      // Verify organization exists
      const targetOrg = await storage.getTenantById(targetOrgId);
      if (!targetOrg) {
        console.log(`  ❌ Target organization ${targetOrgId} not found`);
        continue;
      }
      
      try {
        // Add user to organization with admin role
        await storage.addUserToOrganizationWithRole(user.id, targetOrgId, adminRole.id);
        console.log(`  ✅ Added user to "${targetOrg.name}" with admin role`);
        associationsFixed++;
        
        // Update user's tenantId if not set
        if (!user.tenantId) {
          await db
            .update(users)
            .set({ tenantId: targetOrgId })
            .where(eq(users.id, user.id));
          console.log(`  📝 Updated user's tenantId to ${targetOrgId}`);
        }
      } catch (error) {
        console.error(`  ❌ Error adding user to organization:`, error);
      }
    }
    
    console.log(`\n🎉 Fixed ${associationsFixed} user-organization associations!`);
    
    // Summary report
    console.log("\n📊 SUMMARY REPORT:");
    for (const org of organizations) {
      const orgUsers = await storage.getOrganizationUsers(org.id);
      console.log(`  ${org.name}: ${orgUsers.length} users`);
    }
    
  } catch (error) {
    console.error("❌ Script failed:", error);
    throw error;
  }
}

// Allow script to be run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixUserOrganizationAssociations()
    .then(() => {
      console.log("✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
} 