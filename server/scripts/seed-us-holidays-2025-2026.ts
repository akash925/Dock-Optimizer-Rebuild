#!/usr/bin/env node

/**
 * Seed US Federal Holidays 2025-2026 for all tenants
 * 
 * This script populates the organization_holidays table with US federal holidays
 * for all existing tenants.
 */

import { getStorage } from '../storage';
import { InsertOrganizationHoliday } from '@shared/schema';

// US Federal Holidays for 2025-2026
const US_FEDERAL_HOLIDAYS = [
  // 2025 Holidays
  { date: '2025-01-01', name: "New Year's Day", description: 'Federal Holiday' },
  { date: '2025-01-20', name: 'Martin Luther King Jr. Day', description: 'Federal Holiday - Third Monday in January' },
  { date: '2025-02-17', name: "Presidents' Day", description: 'Federal Holiday - Third Monday in February' },
  { date: '2025-05-26', name: 'Memorial Day', description: 'Federal Holiday - Last Monday in May' },
  { date: '2025-06-19', name: 'Juneteenth', description: 'Federal Holiday' },
  { date: '2025-07-04', name: 'Independence Day', description: 'Federal Holiday' },
  { date: '2025-09-01', name: 'Labor Day', description: 'Federal Holiday - First Monday in September' },
  { date: '2025-10-13', name: 'Columbus Day', description: 'Federal Holiday - Second Monday in October' },
  { date: '2025-11-11', name: 'Veterans Day', description: 'Federal Holiday' },
  { date: '2025-11-27', name: 'Thanksgiving Day', description: 'Federal Holiday - Fourth Thursday in November' },
  { date: '2025-11-28', name: 'Day after Thanksgiving', description: 'Black Friday - Many businesses closed' },
  { date: '2025-12-25', name: 'Christmas Day', description: 'Federal Holiday' },
  
  // 2026 Holidays
  { date: '2026-01-01', name: "New Year's Day", description: 'Federal Holiday' },
  { date: '2026-01-19', name: 'Martin Luther King Jr. Day', description: 'Federal Holiday - Third Monday in January' },
  { date: '2026-02-16', name: "Presidents' Day", description: 'Federal Holiday - Third Monday in February' },
  { date: '2026-05-25', name: 'Memorial Day', description: 'Federal Holiday - Last Monday in May' },
  { date: '2026-06-19', name: 'Juneteenth', description: 'Federal Holiday' },
  { date: '2026-07-04', name: 'Independence Day', description: 'Federal Holiday' },
  { date: '2026-09-07', name: 'Labor Day', description: 'Federal Holiday - First Monday in September' },
  { date: '2026-10-12', name: 'Columbus Day', description: 'Federal Holiday - Second Monday in October' },
  { date: '2026-11-11', name: 'Veterans Day', description: 'Federal Holiday' },
  { date: '2026-11-26', name: 'Thanksgiving Day', description: 'Federal Holiday - Fourth Thursday in November' },
  { date: '2026-11-27', name: 'Day after Thanksgiving', description: 'Black Friday - Many businesses closed' },
  { date: '2026-12-25', name: 'Christmas Day', description: 'Federal Holiday' },
];

async function seedHolidays() {
  console.log('🎄 Starting US Federal Holidays seeding for 2025-2026...');
  
  try {
    const storage = await getStorage();
    
    // Get all tenants
    const tenants = await storage.getAllTenants();
    console.log(`📋 Found ${tenants.length} tenants to seed holidays for`);
    
    let totalHolidaysCreated = 0;
    let totalSkipped = 0;
    
    for (const tenant of tenants) {
      console.log(`\n🏢 Processing tenant: ${tenant.name} (ID: ${tenant.id})`);
      
      let tenantHolidaysCreated = 0;
      let tenantSkipped = 0;
      
      for (const holiday of US_FEDERAL_HOLIDAYS) {
        try {
          const holidayData = {
            organizationId: tenant.id,
            name: holiday.name,
            date: holiday.date,
            description: holiday.description,
            isRecurring: false,
          };
          
          // Check if holiday already exists for this tenant
          const existingHolidays = await storage.getOrganizationHolidays(tenant.id);
          const alreadyExists = existingHolidays.some((h: any) => 
            h.date === holiday.date && h.name === holiday.name
          );
          
          if (alreadyExists) {
            console.log(`  ⏭️  Skipping ${holiday.name} (${holiday.date}) - already exists`);
            tenantSkipped++;
            continue;
          }
          
          await storage.createOrganizationHoliday(tenant.id, holidayData as any); // Schema mismatch in seed data
          console.log(`  ✅ Created ${holiday.name} (${holiday.date})`);
          tenantHolidaysCreated++;
          
        } catch (error) {
          console.error(`  ❌ Error creating holiday ${holiday.name} for tenant ${tenant.name}:`, error);
        }
      }
      
      console.log(`  📊 Tenant ${tenant.name}: ${tenantHolidaysCreated} created, ${tenantSkipped} skipped`);
      totalHolidaysCreated += tenantHolidaysCreated;
      totalSkipped += tenantSkipped;
    }
    
    console.log(`\n🎉 Holiday seeding completed!`);
    console.log(`📈 Summary:`);
    console.log(`  - Total holidays created: ${totalHolidaysCreated}`);
    console.log(`  - Total holidays skipped: ${totalSkipped}`);
    console.log(`  - Tenants processed: ${tenants.length}`);
    
  } catch (error) {
    console.error('❌ Error seeding holidays:', error);
    process.exit(1);
  }
}

// Run the seeding if this script is executed directly
if (require.main === module) {
  seedHolidays()
    .then(() => {
      console.log('✨ Holiday seeding script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Holiday seeding script failed:', error);
      process.exit(1);
    });
}

export { seedHolidays }; 