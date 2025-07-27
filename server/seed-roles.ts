import { getStorage } from "./storage.js";
import { RoleName } from "@shared/schema";

// Export the function for use in running directly
export async function seedRoles() {
  console.log("Seeding roles...");
  
  try {
    const storage = await getStorage();
    
    // Add the new roles
    const extraRoles = [
      { name: RoleName.manager,          description: "Can edit all data but cannot delete orgs or users" },
      { name: RoleName.facility_manager, description: "Can edit data for assigned facilities only" },
      { name: RoleName.staff,            description: "Read‐only across all functionality" },
      { name: RoleName.facility_staff,   description: "Read‐only for assigned facilities only" },
      { name: RoleName.maintenance,      description: "Access only the Asset Manager module" },
    ];

    for (const { name, description } of extraRoles) {
      let role = await storage.getRoleByName(name);
      if (!role) {
        role = await storage.createRole({ name, description });
        console.log(`Created ${name} role:`, role.id);
      } else {
        console.log(`Role ${name} already exists with ID:`, role.id);
      }
    }
    
    console.log("Role seeding completed successfully");
  } catch (error) {
    console.error("Error seeding roles:", error);
    throw error; // Re-throw to allow calling code to handle the error
  }
}

// Run if this file is executed directly
if (process.argv[1].endsWith('seed-roles.ts')) {
  seedRoles()
    .then(() => {
      console.log('Roles seeded successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error seeding roles:', err);
      process.exit(1);
    });
}