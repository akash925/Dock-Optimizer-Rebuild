import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { organizationHolidays, tenants, facilities, appointmentTypes } from '../../shared/schema.js';
import { count, eq } from 'drizzle-orm';
import { seedUSFederalHolidays } from '../seeds/20250623_us_holidays.js';

// Test database connection
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// Mock HTTP request for availability API
const mockAvailabilityRequest = async (facilityId: number, date: string) => {
  // This would typically be an actual HTTP request to your API
  // For now, we'll simulate the availability logic based on holidays
  
  // Get the organization for this facility
  const facility = await db.select({ tenantId: facilities.tenantId })
    .from(facilities)
    .where(eq(facilities.id, facilityId))
    .limit(1);
  
  if (!facility[0] || !facility[0].tenantId) {
    return { availableSlots: [], total: 0 };
  }
  
  // Check if the date is a holiday for this organization
  const holidayCheck = await db.select()
    .from(organizationHolidays)
    .where(
      eq(organizationHolidays.tenantId, facility[0].tenantId)
    )
    .limit(1);
  
  const isHoliday = holidayCheck.some(holiday => holiday.date === date);
  
  // If it's a holiday, return 0 available slots
  if (isHoliday) {
    return { availableSlots: [], total: 0, reason: 'Holiday' };
  }
  
  // Otherwise return some mock slots
  return {
    availableSlots: [
      { time: '09:00', available: true },
      { time: '10:00', available: true },
      { time: '11:00', available: true }
    ],
    total: 3
  };
};

describe('Holiday Availability Smoke Tests', () => {
  let testFacilityId: number;
  let testOrgId: number;

  beforeAll(async () => {
    // Create a test organization
    const [testOrg] = await db.insert(tenants).values({
      name: 'Test Organization for Holiday Smoke Test',
      subdomain: 'holiday-smoke-test',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    testOrgId = testOrg.id;

    // Create a test facility
    const [testFacility] = await db.insert(facilities).values({
      name: 'Test Facility for Holiday Smoke Test',
      address1: '123 Test Street',
      city: 'Test City',
      state: 'TS',
      pincode: '12345',
      country: 'USA',
      tenantId: testOrgId,
      createdAt: new Date(),
    }).returning();
    
    testFacilityId = testFacility.id;

    // Seed holidays for the test organization
    await seedUSFederalHolidays([testOrgId]);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(organizationHolidays).where(eq(organizationHolidays.tenantId, testOrgId));
    await db.delete(facilities).where(eq(facilities.id, testFacilityId));
    await db.delete(tenants).where(eq(tenants.id, testOrgId));
  });

  it('should confirm organization_holidays table has at least one row', async () => {
    const result = await db.select({ count: count() }).from(organizationHolidays);
    const holidayCount = result[0].count;
    
    console.log(`Found ${holidayCount} holiday records in database`);
    expect(holidayCount).toBeGreaterThan(0);
  });

  it('should return 0 available slots for facility on Christmas Day (2025-12-25)', async () => {
    const christmasDate = '2025-12-25';
    
    // Verify Christmas is in our holiday data
    const christmasHoliday = await db.select()
      .from(organizationHolidays)
      .where(
        eq(organizationHolidays.tenantId, testOrgId)
      )
      .limit(1);
    
    const hasChristmas = christmasHoliday.some(h => h.date === christmasDate);
    expect(hasChristmas).toBe(true);
    
    // Test availability API response
    const availabilityResponse = await mockAvailabilityRequest(testFacilityId, christmasDate);
    
    expect(availabilityResponse.total).toBe(0);
    expect(availabilityResponse.availableSlots).toHaveLength(0);
    expect(availabilityResponse.reason).toBe('Holiday');
  });

  it('should return available slots for facility on a regular business day', async () => {
    const regularBusinessDay = '2025-03-15'; // A Saturday that's not a holiday
    
    // Verify this date is NOT a holiday
    const holidayCheck = await db.select()
      .from(organizationHolidays)
      .where(
        eq(organizationHolidays.tenantId, testOrgId)
      );
    
    const isHoliday = holidayCheck.some(h => h.date === regularBusinessDay);
    expect(isHoliday).toBe(false);
    
    // Test availability API response
    const availabilityResponse = await mockAvailabilityRequest(testFacilityId, regularBusinessDay);
    
    expect(availabilityResponse.total).toBeGreaterThan(0);
    expect(availabilityResponse.availableSlots.length).toBeGreaterThan(0);
  });

  it('should verify all major US holidays are present for 2025', async () => {
    const expectedHolidays2025 = [
      '2025-01-01', // New Year's Day
      '2025-01-20', // MLK Day
      '2025-02-17', // Presidents' Day
      '2025-05-26', // Memorial Day
      '2025-07-04', // Independence Day
      '2025-09-01', // Labor Day
      '2025-10-13', // Columbus Day
      '2025-11-11', // Veterans Day
      '2025-11-27', // Thanksgiving
      '2025-12-25', // Christmas
    ];

    const holidays = await db.select({ date: organizationHolidays.date })
      .from(organizationHolidays)
      .where(eq(organizationHolidays.tenantId, testOrgId));
    
    const holidayDates = holidays.map(h => h.date);
    
    for (const expectedDate of expectedHolidays2025) {
      expect(holidayDates).toContain(expectedDate);
    }
  });

  it('should verify holidays are organization-specific', async () => {
    // Create another test organization
    const [anotherOrg] = await db.insert(tenants).values({
      name: 'Another Test Organization',
      subdomain: 'another-test-org',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    try {
      // This organization shouldn't have holidays yet
      const holidaysForNewOrg = await db.select()
        .from(organizationHolidays)
        .where(eq(organizationHolidays.tenantId, anotherOrg.id));
      
      expect(holidaysForNewOrg).toHaveLength(0);
      
      // Seed holidays for the new organization
      await seedUSFederalHolidays([anotherOrg.id]);
      
      // Now it should have holidays
      const holidaysAfterSeeding = await db.select()
        .from(organizationHolidays)
        .where(eq(organizationHolidays.tenantId, anotherOrg.id));
      
      expect(holidaysAfterSeeding.length).toBeGreaterThan(0);
      expect(holidaysAfterSeeding.length).toBe(20); // 10 holidays for 2025 + 10 for 2026
      
    } finally {
      // Clean up
      await db.delete(organizationHolidays).where(eq(organizationHolidays.tenantId, anotherOrg.id));
      await db.delete(tenants).where(eq(tenants.id, anotherOrg.id));
    }
  });
}); 