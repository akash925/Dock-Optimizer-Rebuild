import { getStorage } from "./storage";
import { hashPassword } from './auth';

// Fix the testadmin account password
export async function fixAdminPassword() {
  console.log("Fixing admin account password...");
  
  try {
    const storage = await getStorage();
    
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
    } else {
      // Update the existing user's password with proper hashing
      console.log("Admin user exists, updating password...");
      const hashedPassword = await hashPassword("password123");
      await storage.updateUserPassword(existingUser.id, hashedPassword);
      console.log("Updated admin user password");
    }
    
    console.log("Admin account password updated successfully");
    return true;
  } catch (error) {
    console.error("Error fixing admin account password:", error);
    throw error;
  }
}