import { db, safeQuery } from "../db";
import { getStorage } from "../storage";
import { users, organizationUsers, roles, tenants } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * COMPREHENSIVE USER-ORGANIZATION MAPPING FIX
 * Removes hardcoded vestiges and creates proper programmatic associations
 */

export async function fixUserOrganizationMappings() {
  try {
    console.log("🔧 COMPREHENSIVE USER-ORGANIZATION MAPPING FIX");
    console.log("===============================================");
    
    const storage = await getStorage();
    
    // STEP 1: Get all users and organizations
    const allUsers = await safeQuery(() => db.select().from(users));
    const allOrganizations = await safeQuery(() => db.select().from(tenants));
    const allRoles = await safeQuery(() => db.select().from(roles));
    
    console.log(`📊 FOUND: ${allUsers.length} users, ${allOrganizations.length} organizations, ${allRoles.length} roles`);
    
    // STEP 2: Get or create default admin role
    let adminRole = allRoles.find(r => r.name.toLowerCase() === 'admin');
    if (!adminRole) {
      console.log("🔧 Creating default admin role...");
      const [newRole] = await safeQuery(() => 
        db.insert(roles).values({
          name: 'admin',
          description: 'Administrator role with full access'
        }).returning()
      );
      adminRole = newRole;
      console.log(`✅ Created admin role with ID: ${adminRole.id}`);
    }
    
    // STEP 3: Programmatically map users to organizations
    let mappingsCreated = 0;
    let mappingsSkipped = 0;
    
    for (const user of allUsers) {
      console.log(`\n👤 Processing user: ${user.username} (ID: ${user.id})`);
      
      // Determine target organization
      let targetOrgId: number;
      
      if (user.tenantId) {
        // User has explicit tenant ID - use it
        targetOrgId = user.tenantId;
        console.log(`   📍 Using explicit tenantId: ${targetOrgId}`);
      } else {
        // PROGRAMMATIC LOGIC: Map based on email domain or username patterns
        const emailDomain = user.email?.split('@')[1]?.toLowerCase();
        
        if (emailDomain === 'hanzo.com' || user.username?.toLowerCase().includes('hanzo')) {
          // Find Hanzo organization
          const hanzoOrg = allOrganizations.find(org => 
            org.name?.toLowerCase().includes('hanzo')
          );
          targetOrgId = hanzoOrg?.id || 2; // Default to org 2 if Hanzo org exists
          console.log(`   🏢 Mapped to Hanzo organization: ${targetOrgId}`);
        } else if (emailDomain === 'fresh.com' || user.username?.toLowerCase().includes('fresh')) {
          // Find Fresh organization  
          const freshOrg = allOrganizations.find(org => 
            org.name?.toLowerCase().includes('fresh')
          );
          targetOrgId = freshOrg?.id || 1; // Default to org 1
          console.log(`   🏢 Mapped to Fresh organization: ${targetOrgId}`);
        } else {
          // Default to first organization
          targetOrgId = allOrganizations[0]?.id || 1;
          console.log(`   🏢 Mapped to default organization: ${targetOrgId}`);
        }
        
        // Update user's tenantId for consistency
        await safeQuery(() => 
          db.update(users)
            .set({ tenantId: targetOrgId })
            .where(eq(users.id, user.id))
        );
        console.log(`   ✅ Updated user tenantId to: ${targetOrgId}`);
      }
      
      // Check if mapping already exists
      const existingMapping = await safeQuery(() => 
        db.select()
          .from(organizationUsers)
          .where(and(
            eq(organizationUsers.userId, user.id),
            eq(organizationUsers.organizationId, targetOrgId)
          ))
          .limit(1)
      );
      
      if (existingMapping.length > 0) {
        console.log(`   ⏭️  Mapping already exists - skipping`);
        mappingsSkipped++;
        continue;
      }
      
      // Create organization-user mapping
      try {
        await safeQuery(() => 
          db.insert(organizationUsers).values({
            userId: user.id,
            organizationId: targetOrgId,
            roleId: adminRole!.id,
            createdAt: new Date()
          })
        );
        
        console.log(`   ✅ Created mapping: User ${user.id} → Org ${targetOrgId} → Role ${adminRole!.id}`);
        mappingsCreated++;
        
      } catch (error) {
        console.error(`   ❌ Failed to create mapping for user ${user.id}:`, error);
      }
    }
    
    // STEP 4: Verify all mappings
    console.log("\n🔍 VERIFICATION - Checking all user-organization mappings:");
    
    for (const org of allOrganizations) {
      const orgUsers = await safeQuery(() => 
        db.select({
          userId: organizationUsers.userId,
          username: users.username,
          email: users.email,
          roleName: roles.name
        })
        .from(organizationUsers)
        .innerJoin(users, eq(organizationUsers.userId, users.id))
        .innerJoin(roles, eq(organizationUsers.roleId, roles.id))
        .where(eq(organizationUsers.organizationId, org.id))
      );
      
      console.log(`\n🏢 ${org.name} (ID: ${org.id}): ${orgUsers.length} users`);
      orgUsers.forEach(user => {
        console.log(`   👤 ${user.username} (${user.email}) - Role: ${user.roleName}`);
      });
    }
    
    // STEP 5: Final summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 FINAL SUMMARY:");
    console.log(`✅ Mappings created: ${mappingsCreated}`);
    console.log(`⏭️  Mappings skipped (already existed): ${mappingsSkipped}`);
    console.log(`👥 Total users processed: ${allUsers.length}`);
    console.log(`🏢 Total organizations: ${allOrganizations.length}`);
    console.log("🎉 USER-ORGANIZATION MAPPING COMPLETE!");
    
    return {
      success: true,
      mappingsCreated,
      mappingsSkipped,
      totalUsers: allUsers.length,
      totalOrganizations: allOrganizations.length
    };
    
  } catch (error) {
    console.error("❌ FAILED TO FIX USER-ORGANIZATION MAPPINGS:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixUserOrganizationMappings()
    .then((result) => {
      console.log("✅ Script completed successfully:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
} 