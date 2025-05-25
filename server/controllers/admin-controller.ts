import { getStorage } from '../storage';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

/**
 * Creates a hash of a password
 */
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

/**
 * Creates a super-admin user if one doesn't exist
 */
export async function createSuperAdmin() {
  try {
    console.log("Checking for existing super-admin user...");
    const storage = getStorage();
    const users = await storage.getUsers();
    
    // Check if a super-admin user already exists
    const superAdmin = users.find(user => user.role === 'super-admin');
    
    if (superAdmin) {
      console.log("Super-admin user already exists:", superAdmin.id);
      return superAdmin;
    }
    
    console.log("No super-admin found, creating new super-admin user");
    
    // Create a new super-admin user
    const hashedPassword = await hashPassword("password123");
    const newSuperAdmin = await storage.createUser({
      username: "akash.agarwal@conmitto.io",
      password: hashedPassword,
      email: "akash.agarwal@conmitto.io",
      firstName: "Akash",
      lastName: "Agarwal",
      role: "super-admin",
      tenantId: null
    });
    
    console.log("New super-admin user created:", newSuperAdmin.id);
    return newSuperAdmin;
  } catch (error) {
    console.error("Error creating super-admin:", error);
    throw error;
  }
}

/**
 * Creates standard roles if they don't exist
 */
export async function seedRoles() {
  try {
    console.log("Checking for existing roles...");
    const storage = getStorage();
    
    // Check if roles already exist
    const roles = await storage.getRoles();
    
    if (roles && roles.length > 0) {
      console.log(`${roles.length} roles already exist, skipping role creation`);
      return roles;
    }
    
    console.log("No roles found, creating standard roles");
    
    // Create standard roles
    const standardRoles = [
      { name: 'admin', description: 'Organization administrator with full access' },
      { name: 'manager', description: 'Facility manager with scheduling access' },
      { name: 'staff', description: 'Facility staff with limited access' },
      { name: 'driver', description: 'Driver with check-in access only' }
    ];
    
    const createdRoles = [];
    
    for (const role of standardRoles) {
      const newRole = await storage.createRole(role);
      console.log(`Created role: ${newRole.name} with ID ${newRole.id}`);
      createdRoles.push(newRole);
    }
    
    return createdRoles;
  } catch (error) {
    console.error("Error seeding roles:", error);
    throw error;
  }
}

/**
 * Ensures the test admin user has a known password
 */
export async function fixAdminPassword() {
  try {
    console.log("Checking for test admin user...");
    const storage = getStorage();
    
    // Find the test admin user
    const testAdmin = await storage.getUserByUsername("testadmin");
    
    if (!testAdmin) {
      console.log("Test admin user not found, creating new test admin");
      const hashedPassword = await hashPassword("password123");
      const newAdmin = await storage.createUser({
        username: "testadmin",
        password: hashedPassword,
        email: "testadmin@example.com",
        firstName: "Test",
        lastName: "Admin",
        role: "admin",
        tenantId: 2  // Hanzo Logistics tenant ID
      });
      
      console.log("New test admin user created:", newAdmin.id);
      
      // Make sure the user is associated with Hanzo Logistics organization
      const hanzoOrg = await storage.getOrganizationByTenantId(2);
      if (hanzoOrg) {
        console.log("Associating user with Hanzo Logistics organization");
        const adminRole = await storage.getRoleByName("admin");
        
        if (adminRole) {
          await storage.addUserToOrganization({
            organizationId: hanzoOrg.id, 
            userId: newAdmin.id, 
            roleId: adminRole.id
          });
          console.log("Test admin associated with Hanzo Logistics with admin role");
        }
      }
      
      return newAdmin;
    }
    
    console.log("Test admin user found, updating password");
    
    // Update the password to ensure it's correct
    const hashedPassword = await hashPassword("password123");
    const updatedAdmin = await storage.updateUser(testAdmin.id, {
      password: hashedPassword
    });
    
    console.log("Test admin password updated:", testAdmin.id);
    return updatedAdmin;
  } catch (error) {
    console.error("Error fixing admin password:", error);
    throw error;
  }
}

/**
 * Gets booking page styles by tenant ID
 */
export async function getBookingStyles(tenantId: number) {
  // Default styles
  const defaultStyles = {
    primaryColor: "#3498db",
    secondaryColor: "#2c3e50",
    accentColor: "#e74c3c",
    fontFamily: "Inter, sans-serif",
    logo: "/tenant-assets/default-logo.png",
    background: "/tenant-assets/default-background.jpg"
  };
  
  try {
    const storage = getStorage();
    const organization = await storage.getOrganizationByTenantId(tenantId);
    
    if (!organization || !organization.bookingStyles) {
      return defaultStyles;
    }
    
    return {
      ...defaultStyles,
      ...organization.bookingStyles
    };
  } catch (error) {
    console.error("Error fetching booking styles:", error);
    return defaultStyles;
  }
}