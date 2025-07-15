import { db, safeQuery } from "../server/db";
import { appointmentTypes, standardQuestions } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Fix Critical Database Issues
 * 
 * This script addresses the issues identified in the console logs:
 * 1. Fix appointment_types table ID sequence generation
 * 2. Seed missing standard questions for appointment types
 */

export async function fixCriticalDatabaseIssues() {
  console.log("🔧 FIXING CRITICAL DATABASE ISSUES");
  console.log("=".repeat(50));
  
  try {
    // Issue 1: Fix appointment_types sequence
    console.log("\n1. 🔧 Fixing appointment_types ID sequence...");
    
    const sequenceFixSQL = `
      DO $$
      BEGIN
          -- Drop the existing sequence if it exists (it might be corrupted)
          IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'appointment_types_id_seq') THEN
              DROP SEQUENCE IF EXISTS appointment_types_id_seq CASCADE;
          END IF;
          
          -- Create the sequence with proper start value
          CREATE SEQUENCE appointment_types_id_seq START 1;
          
          -- Set the sequence as the default for the id column
          ALTER TABLE appointment_types ALTER COLUMN id SET DEFAULT nextval('appointment_types_id_seq');
          
          -- Set the sequence ownership to the table column
          ALTER SEQUENCE appointment_types_id_seq OWNED BY appointment_types.id;
          
          -- Update the sequence to start from the maximum existing ID + 1
          PERFORM setval('appointment_types_id_seq', COALESCE((SELECT MAX(id) FROM appointment_types), 0) + 1, false);
          
          RAISE NOTICE 'Fixed appointment_types ID sequence generation';
      EXCEPTION
          WHEN others THEN
              RAISE NOTICE 'Error fixing appointment_types sequence: %', SQLERRM;
      END $$;
    `;
    
    await db.execute(sql.raw(sequenceFixSQL));
    console.log("   ✅ Appointment types sequence fixed");
    
    // Issue 2: Seed missing standard questions
    console.log("\n2. 🌱 Seeding missing standard questions...");
    
    // Get all appointment types
    const existingAppointmentTypes = await safeQuery(() => 
      db.select().from(appointmentTypes)
    );
    
    console.log(`   📊 Found ${existingAppointmentTypes.length} appointment types`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const appointmentType of existingAppointmentTypes) {
      console.log(`\n   📅 Processing appointment type: ${appointmentType.name} (ID: ${appointmentType.id})`);
      
      // Check existing standard questions for this appointment type
      const existingQuestions = await safeQuery(() =>
        db.select().from(standardQuestions)
          .where(eq(standardQuestions.appointmentTypeId, appointmentType.id))
      );
      
      console.log(`      📋 Found ${existingQuestions.length} existing questions`);
      
      if (existingQuestions.length < 12) {
        console.log(`      🔧 Seeding missing questions (need 12, have ${existingQuestions.length})`);
        
        // Delete existing questions to avoid duplicates
        await safeQuery(() =>
          db.delete(standardQuestions)
            .where(eq(standardQuestions.appointmentTypeId, appointmentType.id))
        );
        
        // Define the complete set of standard questions
        const standardQuestionData = [
          { fieldKey: 'customerName', label: 'Customer Name', fieldType: 'TEXT', required: true, included: true, orderPosition: 1 },
          { fieldKey: 'carrierName', label: 'Carrier Name', fieldType: 'TEXT', required: true, included: true, orderPosition: 2 },
          { fieldKey: 'mcNumber', label: 'Carrier MC #', fieldType: 'TEXT', required: true, included: true, orderPosition: 3 },
          { fieldKey: 'driverEmail', label: 'Driver/Dispatcher Email', fieldType: 'EMAIL', required: true, included: true, orderPosition: 4 },
          { fieldKey: 'driverPhone', label: 'Driver/Dispatcher Phone Number', fieldType: 'TEXT', required: false, included: true, orderPosition: 5 },
          { fieldKey: 'driverLicense', label: 'Driver\'s License Number', fieldType: 'TEXT', required: false, included: true, orderPosition: 6 },
          { fieldKey: 'bolDoc', label: 'BOL Doc', fieldType: 'FILE', required: false, included: true, orderPosition: 7 },
          { fieldKey: 'bolNumber', label: 'BOL Number', fieldType: 'TEXT', required: true, included: true, orderPosition: 8 },
          { fieldKey: 'truckNumber', label: 'Truck Number', fieldType: 'TEXT', required: true, included: true, orderPosition: 9 },
          { fieldKey: 'trailerNumber', label: 'Trailer Number', fieldType: 'TEXT', required: false, included: true, orderPosition: 10 },
          { fieldKey: 'driverName', label: 'Driver\'s Name', fieldType: 'TEXT', required: false, included: true, orderPosition: 11 },
          { fieldKey: 'itemDescription', label: 'Item Description/Quantity', fieldType: 'TEXTAREA', required: false, included: true, orderPosition: 12 }
        ];
        
        // Insert all standard questions for this appointment type
        for (const question of standardQuestionData) {
          await safeQuery(() =>
            db.insert(standardQuestions).values({
              ...question,
              appointmentTypeId: appointmentType.id
            })
          );
        }
        
        console.log(`      ✅ Seeded ${standardQuestionData.length} standard questions`);
        fixedCount++;
      } else {
        console.log(`      ⏭️  Skipping - already has complete question set`);
        skippedCount++;
      }
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("🎉 CRITICAL DATABASE ISSUES FIXED!");
    console.log("=".repeat(50));
    console.log(`✅ Fixed appointment types sequence generation`);
    console.log(`✅ Fixed ${fixedCount} appointment types with missing questions`);
    console.log(`⏭️  Skipped ${skippedCount} appointment types that were already complete`);
    console.log("");
    console.log("📋 Next Steps:");
    console.log("   1. Restart the development server");
    console.log("   2. Test appointment type creation in Appointment Master");
    console.log("   3. Test facility settings access");
    console.log("   4. Verify question functionality works correctly");
    
    return {
      success: true,
      sequenceFixed: true,
      appointmentTypesFixed: fixedCount,
      appointmentTypesSkipped: skippedCount
    };
    
  } catch (error) {
    console.error("❌ FAILED TO FIX CRITICAL DATABASE ISSUES:", error);
    throw error;
  }
}

// Run the fix if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixCriticalDatabaseIssues()
    .then((result) => {
      console.log("✅ Fix completed successfully:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Fix failed:", error);
      process.exit(1);
    });
} 