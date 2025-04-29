import { getStorage } from "./storage";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { TenantStatus, AvailableModule } from "@shared/schema";
import { hashPassword as authHashPassword } from './auth';

const scryptAsync = promisify(scrypt);

async function createSuperAdmin() {
  console.log("Creating super-admin account...");
  
  try {
    const storage = await getStorage();
    
    // Check if user already exists
    const existingUser = await storage.getUserByUsername("akash.agarwal@conmitto.io");
    if (existingUser) {
      console.log("Super-admin user already exists");
      return;
    }
    
    // Create the super-admin user with the auth module's password hashing
    const hashedPassword = await authHashPassword("password123");
    const user = await storage.createUser({
      username: "akash.agarwal@conmitto.io",
      email: "akash.agarwal@conmitto.io",
      password: hashedPassword,
      firstName: "Akash",
      lastName: "Agarwal",
      role: "super-admin"
    });
    
    console.log("Created super-admin user:", user.id);
    
    // Create a Global Admin organization for the super-admin
    const organization = await storage.createTenant({
      name: "Global Admin",
      subdomain: "admin",
      status: TenantStatus.ACTIVE,
      contactEmail: "akash.agarwal@conmitto.io",
      createdBy: user.id
    });
    
    console.log("Created Global Admin organization:", organization.id);
    
    // Create role records if they don't exist
    let superAdminRole = await storage.getRoleByName("super-admin");
    if (!superAdminRole) {
      superAdminRole = await storage.createRole({
        name: "super-admin",
        description: "Super administrator with full system access"
      });
      console.log("Created super-admin role:", superAdminRole.id);
    }
    
    // Add the user to the organization with super-admin role
    await storage.addUserToOrganization({
      organizationId: organization.id, 
      userId: user.id, 
      roleId: superAdminRole.id
    });
    console.log("Added user to organization with super-admin role");
    
    // Enable all modules for the organization
    const modules = Object.values(AvailableModule);
    for (const moduleName of modules) {
      await storage.updateOrganizationModules(organization.id, [{
        organizationId: organization.id,
        moduleName,
        enabled: true
      }]);
      console.log(`Enabled module ${moduleName} for organization`);
    }
    
    console.log("Super-admin account and organization setup completed successfully");
  } catch (error) {
    console.error("Error creating super-admin account:", error);
  }
}

// Execute the function
createSuperAdmin().then(() => {
  console.log("Script completed");
  process.exit(0);
}).catch(error => {
  console.error("Script failed:", error);
  process.exit(1);
});