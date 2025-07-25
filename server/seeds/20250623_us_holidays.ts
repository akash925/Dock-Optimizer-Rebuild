import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import { organizationHolidays, tenants } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';

// Load environment variables
config();

// Configure Neon WebSocket for better connection handling
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create database pool
const pool = new Pool({ connectionString });
const db = drizzle(pool);

// US Federal Holidays for 2025-2026 (fixed dates and calculated dates)
const US_FEDERAL_HOLIDAYS = [
  // 2025 Holidays
  { name: "New Year's Day", date: "2025-01-01", year: 2025 },
  { name: "Martin Luther King Jr. Day", date: "2025-01-20", year: 2025 }, // 3rd Monday in January
  { name: "Presidents' Day", date: "2025-02-17", year: 2025 }, // 3rd Monday in February
  { name: "Memorial Day", date: "2025-05-26", year: 2025 }, // Last Monday in May
  { name: "Independence Day", date: "2025-07-04", year: 2025 },
  { name: "Labor Day", date: "2025-09-01", year: 2025 }, // 1st Monday in September
  { name: "Columbus Day", date: "2025-10-13", year: 2025 }, // 2nd Monday in October
  { name: "Veterans Day", date: "2025-11-11", year: 2025 },
  { name: "Thanksgiving Day", date: "2025-11-27", year: 2025 }, // 4th Thursday in November
  { name: "Christmas Day", date: "2025-12-25", year: 2025 },

  // 2026 Holidays
  { name: "New Year's Day", date: "2026-01-01", year: 2026 },
  { name: "Martin Luther King Jr. Day", date: "2026-01-19", year: 2026 }, // 3rd Monday in January
  { name: "Presidents' Day", date: "2026-02-16", year: 2026 }, // 3rd Monday in February
  { name: "Memorial Day", date: "2026-05-25", year: 2026 }, // Last Monday in May
  { name: "Independence Day", date: "2026-07-04", year: 2026 },
  { name: "Labor Day", date: "2026-09-07", year: 2026 }, // 1st Monday in September
  { name: "Columbus Day", date: "2026-10-12", year: 2026 }, // 2nd Monday in October
  { name: "Veterans Day", date: "2026-11-11", year: 2026 },
  { name: "Thanksgiving Day", date: "2026-11-26", year: 2026 }, // 4th Thursday in November
  { name: "Christmas Day", date: "2026-12-25", year: 2026 },
];

/**
 * Seeds US Federal Holidays for 2025-2026 for all organizations
 * @param orgIds - Array of organization IDs to seed holidays for
 * @returns Promise<void>
 */
export async function seedUSFederalHolidays(orgIds: number[]): Promise<void> {
  console.log(`[Holiday Seeder] Starting to seed US federal holidays for ${orgIds.length} organizations...`);
  
  try {
    let totalInserted = 0;
    
    for (const orgId of orgIds) {
      console.log(`[Holiday Seeder] Processing organization ${orgId}...`);
      
      for (const holiday of US_FEDERAL_HOLIDAYS) {
        try {
          // Try with description field first (for newer schema)
          await db.insert(organizationHolidays)
            .values({
              tenantId: orgId,
              name: holiday.name,
              date: holiday.date,
              description: `US Federal Holiday - ${holiday.name} ${holiday.year}`,
              isRecurring: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoNothing(); // Handle duplicate entries gracefully
          
          totalInserted++;
        } catch (err: any) {
          // If description column doesn't exist, try without it (for older schema)
          if (err?.code === '42703') {
            console.log(`[Holiday Seeder] Column error detected, trying without description for ${holiday.name}...`);
            try {
              await db.insert(organizationHolidays)
                .values({
                  tenantId: orgId,
                  name: holiday.name,
                  date: holiday.date,
                  isRecurring: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
                .onConflictDoNothing();
              
              totalInserted++;
              console.log(`[Holiday Seeder] ✅ Successfully inserted ${holiday.name} for org ${orgId} without description`);
            } catch (fallbackErr) {
              console.warn(`[Holiday Seeder] Warning: Could not insert ${holiday.name} for org ${orgId}:`, fallbackErr);
            }
          } else {
            // Log other types of errors but continue
            console.warn(`[Holiday Seeder] Warning: Could not insert ${holiday.name} for org ${orgId}:`, err);
          }
        }
      }
    }
    
    console.log(`[Holiday Seeder] ✅ Successfully seeded ${totalInserted} holiday entries`);
    console.log(`[Holiday Seeder] ✅ Seeding complete for ${orgIds.length} organizations`);
    
  } catch (error) {
    console.error('[Holiday Seeder] ❌ Error seeding US federal holidays:', error);
    throw error;
  }
}

/**
 * Standalone script execution - seeds holidays for all existing organizations
 */
async function main() {
  console.log('[Holiday Seeder] Starting standalone execution...');
  
  try {
    // Get all existing organizations
    const organizations = await db.select({ id: tenants.id }).from(tenants);
    const orgIds = organizations.map((org: any) => org.id);
    
    if (orgIds.length === 0) {
      console.log('[Holiday Seeder] ⚠️ No organizations found. Skipping holiday seeding.');
      return;
    }
    
    console.log(`[Holiday Seeder] Found ${orgIds.length} organizations to seed`);
    
    // Seed holidays for all organizations
    await seedUSFederalHolidays(orgIds);
    
    console.log('[Holiday Seeder] 🎉 Standalone execution completed successfully!');
    
  } catch (error) {
    console.error('[Holiday Seeder] ❌ Standalone execution failed:', error);
    process.exit(1);
  } finally {
    // Clean up the database pool
    await pool.end();
  }
}

// Execute if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 