import { getStorage } from "./storage";
import { hashPassword } from './auth';
import { TenantStatus, AvailableModule } from "@shared/schema";

// Fix the testadmin account password and organization association
export async function fixAdminPassword() {
  console.log("Fixing admin account password...");
  
  try {
    const storage = await getStorage();
    let userId: number;
    
    // Check if user exists
    const existingUser = await storage.getUserByUsername("testadmin");
    if (!existingUser) {
      console.log("Admin user doesn't exist, creating it");
      // Create new admin user with proper password hashing
      const hashedPassword = await hashPassword("password123");
      const user = await storage.createUser({
        username: "testadmin",
        email: "testadmin@example.com",
        password: hashedPassword,
        firstName: "Test",
        lastName: "Admin",
        role: "admin"
      });
      console.log("Created admin user:", user.id);
      userId = user.id;
    } else {
      // Update the existing user's password with proper hashing
      console.log("Admin user exists, updating password...");
      const hashedPassword = await hashPassword("password123");
      await storage.updateUserPassword(existingUser.id, hashedPassword);
      console.log("Updated admin user password");
      userId = existingUser.id;
    }
    
    // Check if Hanzo Logistics organization exists, create if it doesn't
    const tenants = await storage.getAllTenants();
    let hanzoOrg = tenants.find(tenant => tenant.name === "Hanzo Logistics");
    if (!hanzoOrg) {
      console.log("Hanzo Logistics organization doesn't exist, creating it");
      hanzoOrg = await storage.createTenant({
        name: "Hanzo Logistics",
        subdomain: "hanzo",
        status: TenantStatus.ACTIVE,
        contactEmail: "contact@hanzo-logistics.com",
        createdBy: userId
      });
      console.log("Created Hanzo Logistics organization:", hanzoOrg.id);
      
      // Enable all modules for the organization
      const modules = Object.values(AvailableModule);
      for (const moduleName of modules) {
        await storage.updateOrganizationModules(hanzoOrg.id, [{
          organizationId: hanzoOrg.id,
          moduleName,
          enabled: true
        }]);
        console.log(`Enabled module ${moduleName} for Hanzo Logistics`);
      }
    } else {
      console.log("Hanzo Logistics organization exists with ID:", hanzoOrg.id);
    }
    
    // Check if admin role exists
    let adminRole = await storage.getRoleByName("admin");
    if (!adminRole) {
      console.log("Admin role doesn't exist, creating it");
      adminRole = await storage.createRole({
        name: "admin",
        description: "Administrator with organization-level access"
      });
      console.log("Created admin role:", adminRole.id);
    }
    
    // Check if user is already associated with the organization
    const existingOrgUser = await storage.getUserOrganizationByIds(userId, hanzoOrg.id);
    if (!existingOrgUser) {
      console.log("User not associated with Hanzo Logistics, adding association");
      await storage.addUserToOrganization({
        organizationId: hanzoOrg.id, 
        userId: userId, 
        roleId: adminRole.id
      });
      console.log("Added testadmin user to Hanzo Logistics with admin role");
    } else {
      console.log("User already associated with Hanzo Logistics organization");
    }
    
    console.log("Admin account password and organization association updated successfully");
    return true;
  } catch (error) {
    console.error("Error fixing admin account:", error);
    throw error;
  }
}