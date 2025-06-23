import { db, safeQuery } from "../server/db";
import { standardQuestions, appointmentTypes } from "@shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Seed default standard questions for all appointment types that belong to tenant 2.
 *
 * Usage: pnpm tsx scripts/seed-standard-questions.ts
 */
export async function seedStandardQuestions() {
  const TENANT_ID = 2;
  console.log(`🚀  Seeding standard questions for tenant ${TENANT_ID}`);

  // Fetch appointment types that belong to tenant 2
  const types = await safeQuery(() =>
    db
      .select()
      .from(appointmentTypes)
      .where(eq(appointmentTypes.tenantId, TENANT_ID))
  );

  if (types.length === 0) {
    console.log("ℹ️  No appointment types found for tenant 2 – aborting.");
    return { inserted: 0 };
  }

  const defaultQuestions = [
    { fieldKey: "customerName", label: "Customer Name", fieldType: "text" },
    { fieldKey: "carrierName", label: "Carrier Name", fieldType: "text" },
    { fieldKey: "truckNumber", label: "Truck #", fieldType: "text" },
    { fieldKey: "trailerNumber", label: "Trailer #", fieldType: "text" },
    { fieldKey: "driverName", label: "Driver Name", fieldType: "text" },
    { fieldKey: "driverPhone", label: "Driver Phone", fieldType: "phone" },
  ];

  let inserted = 0;

  for (const type of types) {
    console.log(`\n📅 Appointment Type: ${type.name} (ID: ${type.id})`);

    for (let i = 0; i < defaultQuestions.length; i++) {
      const q = defaultQuestions[i];

      // Skip if already exists
      const [existing] = await safeQuery(() =>
        db
          .select()
          .from(standardQuestions)
          .where(
            and(
              eq(standardQuestions.appointmentTypeId, type.id),
              eq(standardQuestions.fieldKey, q.fieldKey)
            )
          )
          .limit(1)
      );

      if (existing) {
        console.log(`   ➖  ${q.fieldKey} already present – skipping`);
        continue;
      }

      await safeQuery(() =>
        db.insert(standardQuestions).values({
          appointmentTypeId: type.id,
          fieldKey: q.fieldKey,
          label: q.label,
          fieldType: q.fieldType as any,
          included: true,
          required: false,
          orderPosition: i + 1,
        })
      );

      console.log(`   ✅  Inserted ${q.fieldKey}`);
      inserted++;
    }
  }

  console.log(`\n🎉  Standard question seeding complete – inserted ${inserted} rows.`);
  return { inserted };
}

// Run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedStandardQuestions()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌  Failed to seed standard questions", err);
      process.exit(1);
    });
} 