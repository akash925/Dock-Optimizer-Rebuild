import { db } from "../db";
import { getStorage } from "../storage";
import { AvailableModule } from "@shared/schema";

export async function initializeOrganizationModules() {
  try {
    console.log("🔧 Initializing organization modules...");
    
    const storage = await getStorage();
    
    // Get all organizations
    const organizations = await storage.getAllTenants();
    console.log(`Found ${organizations.length} organizations`);
    
    // Default modules to enable for all organizations
    const defaultModules = [
      { moduleName: AvailableModule.APPOINTMENTS, enabled: true },
      { moduleName: AvailableModule.DOOR_MANAGER, enabled: true },
      { moduleName: AvailableModule.FACILITY_MANAGEMENT, enabled: true },
      { moduleName: AvailableModule.USER_MANAGEMENT, enabled: true },
      { moduleName: AvailableModule.EMAIL_NOTIFICATIONS, enabled: true },
      { moduleName: AvailableModule.BOOKING_PAGES, enabled: true },
      { moduleName: AvailableModule.CALENDAR, enabled: false },
      { moduleName: AvailableModule.ANALYTICS, enabled: false },
      { moduleName: AvailableModule.ASSET_MANAGER, enabled: false },
    ];
    
    for (const org of organizations) {
      console.log(`\n📋 Processing organization: ${org.name} (ID: ${org.id})`);
      
      // Check if organization already has modules
      const existingModules = await storage.getOrganizationModules(org.id);
      
      if (existingModules.length === 0) {
        console.log(`  ⚠️  No modules found for ${org.name}, initializing defaults...`);
        
        // Create default modules for this organization
        const moduleEntries = defaultModules.map(module => ({
          organizationId: org.id,
          ...module
        }));
        
        await storage.updateOrganizationModules(org.id, moduleEntries);
        console.log(`  ✅ Initialized ${moduleEntries.length} modules for ${org.name}`);
        
        // Verify modules were created
        const newModules = await storage.getOrganizationModules(org.id);
        const enabledCount = newModules.filter(m => m.enabled).length;
        console.log(`  📊 Result: ${enabledCount}/${newModules.length} modules enabled`);
      } else {
        const enabledCount = existingModules.filter(m => m.enabled).length;
        console.log(`  ✅ Organization already has ${enabledCount}/${existingModules.length} modules configured`);
      }
    }
    
    console.log("\n🎉 Organization modules initialization complete!");
    console.log("🔄 Restart the server to see the changes");
    
  } catch (error) {
    console.error("❌ Error initializing organization modules:", error);
    throw error;
  }
}

// Allow script to be run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeOrganizationModules()
    .then(() => {
      console.log("✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
} 