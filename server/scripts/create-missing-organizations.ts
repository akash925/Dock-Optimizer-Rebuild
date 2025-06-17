import { db, safeQuery } from "../db";
import { tenants, users, organizationUsers, roles } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * CREATE MISSING ORGANIZATIONS SCRIPT
 * Ensures proper tenant/organization structure matches frontend expectations
 */

export async function createMissingOrganizations() {
  try {
    console.log("🏢 CREATING MISSING ORGANIZATIONS");
    console.log("=================================");
    
    // Get existing organizations
    const existingOrgs = await safeQuery(() => db.select().from(tenants));
    console.log(`📊 Found ${existingOrgs.length} existing organizations:`);
    existingOrgs.forEach(org => {
      console.log(`   🏢 ID ${org.id}: ${org.name}`);
    });
    
    // Check for missing organization ID 2 (Hanzo)
    const hanzoOrg = existingOrgs.find(org => org.id === 2);
    
    if (!hanzoOrg) {
      console.log("\n🔧 Creating missing Hanzo organization (ID: 2)...");
      
      // Create Hanzo organization with explicit ID
      await safeQuery(() => 
        db.insert(tenants).values({
          id: 2,
          name: 'Hanzo Logistics',
          subdomain: 'hanzo',
          status: 'active' as any,
          contactEmail: 'admin@hanzo.com',
          contactPhone: '+1-555-0123',
          billingEmail: 'billing@hanzo.com',
          billingAddress: '123 Logistics Way, Commerce City, CO 80022',
          timezone: 'America/Denver',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 1
        })
      );
      
      console.log("✅ Created Hanzo Logistics organization (ID: 2)");
    } else {
      console.log("✅ Hanzo organization already exists");
    }
    
    // Update testadmin user to use tenant ID 2
    console.log("\n🔧 Updating testadmin user to use tenant ID 2...");
    
    await safeQuery(() => 
      db.update(users)
        .set({ tenantId: 2 })
        .where(eq(users.username, 'testadmin'))
    );
    
    console.log("✅ Updated testadmin to tenant ID 2");
    
    // Get admin role
    const adminRole = await safeQuery(() => 
      db.select().from(roles).where(eq(roles.name, 'admin')).limit(1)
    );
    
    if (adminRole.length === 0) {
      throw new Error("Admin role not found");
    }
    
    // Create organization-user mapping for testadmin → Hanzo
    console.log("\n🔧 Creating testadmin → Hanzo organization mapping...");
    
    // Get testadmin user
    const testadminUser = await safeQuery(() => 
      db.select().from(users).where(eq(users.username, 'testadmin')).limit(1)
    );
    
    if (testadminUser.length === 0) {
      throw new Error("testadmin user not found");
    }
    
    // Remove old mapping to organization 1
    await safeQuery(() => 
      db.delete(organizationUsers).where(and(
        eq(organizationUsers.userId, testadminUser[0].id),
        eq(organizationUsers.organizationId, 1)
      ))
    );
    
    // Create new mapping to organization 2
    await safeQuery(() => 
      db.insert(organizationUsers).values({
        userId: testadminUser[0].id,
        organizationId: 2,
        roleId: adminRole[0].id,
        createdAt: new Date()
      })
    );
    
    console.log("✅ Created testadmin → Hanzo mapping");
    
    // Verify final state
    console.log("\n🔍 VERIFICATION - Final organization state:");
    
    const finalOrgs = await safeQuery(() => db.select().from(tenants));
    for (const org of finalOrgs) {
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
    
    console.log("\n" + "=".repeat(50));
    console.log("🎉 ORGANIZATIONS SETUP COMPLETE!");
    console.log("✅ Frontend tenant ID 2 now properly mapped to Hanzo Logistics");
    
    return { success: true };
    
  } catch (error) {
    console.error("❌ FAILED TO CREATE MISSING ORGANIZATIONS:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createMissingOrganizations()
    .then((result) => {
      console.log("✅ Script completed successfully:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
} 