import { db, safeQuery } from "../db";
import { getStorage } from "../storage";
import { 
  appointmentTypes,
  facilities,
  tenants
} from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * CREATE DEFAULT APPOINTMENT TYPES FOR REPLIT LAUNCH
 * 
 * This script creates default appointment types to resolve the
 * "No appointment types have been created yet" issue
 */

export async function createDefaultAppointmentTypes() {
  try {
    console.log("📅 CREATING DEFAULT APPOINTMENT TYPES");
    console.log("=".repeat(50));
    
    const storage = await getStorage();
    
    // Get existing data
    const existingAppointmentTypes = await safeQuery(() => 
      db.select().from(appointmentTypes)
    );
    
    const existingFacilities = await safeQuery(() => 
      db.select().from(facilities)
    );
    
    const existingOrganizations = await safeQuery(() => 
      db.select().from(tenants)
    );
    
    console.log(`📊 Found ${existingAppointmentTypes.length} appointment types, ${existingFacilities.length} facilities, ${existingOrganizations.length} organizations`);
    
    if (existingAppointmentTypes.length > 0) {
      console.log("ℹ️  Appointment types already exist:");
      existingAppointmentTypes.forEach(type => {
        console.log(`   📅 ${type.name} (Duration: ${type.duration} min, Facility: ${type.facilityId})`);
      });
      return { success: true, created: 0, message: "Appointment types already exist" };
    }
    
    if (existingFacilities.length === 0) {
      console.log("❌ No facilities found. Cannot create appointment types without facilities.");
      return { success: false, created: 0, message: "No facilities available" };
    }
    
    // Find Hanzo organization (ID: 2) or default to first organization
    const hanzoOrg = existingOrganizations.find(org => org.id === 2) || existingOrganizations[0];
    if (!hanzoOrg) {
      console.log("❌ No organizations found. Cannot create appointment types without organizations.");
      return { success: false, created: 0, message: "No organizations available" };
    }
    
    console.log(`🏢 Using organization: ${hanzoOrg.name} (ID: ${hanzoOrg.id})`);
    console.log(`🏭 Using facility: ${existingFacilities[0].name} (ID: ${existingFacilities[0].id})`);
    
    // Create default appointment types
    const defaultTypes = [
      {
        name: "1 Hour Trailer Appointment",
        description: "Standard 1 hour appointment for trailers",
        duration: 60,
        color: "#2196F3",
        type: "INBOUND" as const,
        facilityId: existingFacilities[0].id,
        tenantId: hanzoOrg.id,
        showRemainingSlots: true,
        gracePeriod: 15,
        emailReminderTime: 24,
        bufferTime: 60,
        maxConcurrent: 1,
        allowAppointmentsThroughBreaks: false,
        allowAppointmentsPastBusinessHours: false,
        overrideFacilityHours: false
      },
      {
        name: "4 Hour Container Appointment", 
        description: "Extended 4 hour appointment for containers",
        duration: 240,
        color: "#4CAF50",
        type: "OUTBOUND" as const,
        facilityId: existingFacilities[0].id,
        tenantId: hanzoOrg.id,
        showRemainingSlots: true,
        gracePeriod: 15,
        emailReminderTime: 24,
        bufferTime: 240,
        maxConcurrent: 1,
        allowAppointmentsThroughBreaks: false,
        allowAppointmentsPastBusinessHours: false,
        overrideFacilityHours: false
      },
      {
        name: "2 Hour Mixed Appointment",
        description: "Flexible 2 hour appointment for mixed operations",
        duration: 120,
        color: "#FF9800",
        type: "INBOUND" as const,
        facilityId: existingFacilities[0].id,
        tenantId: hanzoOrg.id,
        showRemainingSlots: true,
        gracePeriod: 15,
        emailReminderTime: 24,
        bufferTime: 120,
        maxConcurrent: 2,
        allowAppointmentsThroughBreaks: false,
        allowAppointmentsPastBusinessHours: false,
        overrideFacilityHours: false
      }
    ];
    
    let createdCount = 0;
    
    for (const typeData of defaultTypes) {
      try {
        const [createdType] = await safeQuery(() => 
          db.insert(appointmentTypes).values(typeData).returning()
        );
        console.log(`   ✅ Created: ${createdType.name} (ID: ${createdType.id})`);
        createdCount++;
      } catch (error) {
        console.error(`   ❌ Failed to create appointment type ${typeData.name}:`, error);
      }
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("🎉 DEFAULT APPOINTMENT TYPES CREATION COMPLETE!");
    console.log("=".repeat(50));
    console.log(`✅ Created ${createdCount} appointment types`);
    console.log("");
    console.log("📋 Next Steps:");
    console.log("   1. Refresh the Appointment Master page");
    console.log("   2. You should now see the created appointment types");
    console.log("   3. You can edit or create additional types as needed");
    
    return {
      success: true,
      created: createdCount,
      message: `Successfully created ${createdCount} default appointment types`
    };
    
  } catch (error) {
    console.error("❌ FAILED TO CREATE DEFAULT APPOINTMENT TYPES:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createDefaultAppointmentTypes()
    .then((result) => {
      console.log("✅ Script completed successfully:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
} 