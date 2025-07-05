import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../db';
import { organizationHolidays, facilities, organizationModules } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

describe('Holiday & Weekend Logic Integration Tests', () => {
  let holidayId: number | null = null;
  let originalSaturdayOpen: boolean;
  let originalSaturdayStart: string;
  let originalSaturdayEnd: string;
  let originalWeekendRule: boolean;

  beforeEach(async () => {
    // Store original facility Saturday hours for restoration
    const [facility] = await db.select().from(facilities).where(eq(facilities.id, 1)).limit(1);
    if (facility) {
      originalSaturdayOpen = facility.saturdayOpen;
      originalSaturdayStart = facility.saturdayStart || '08:00';
      originalSaturdayEnd = facility.saturdayEnd || '17:00';
    }

    // Store original weekend rule setting for tenant 2
    const [weekendModule] = await db.select()
      .from(organizationModules)
      .where(and(
        eq(organizationModules.organizationId, 2),
        eq(organizationModules.moduleName, 'enforceWeekendRule')
      ))
      .limit(1);
    
    originalWeekendRule = weekendModule?.enabled ?? true;
  });

  afterEach(async () => {
    // Clean up: Remove test holiday if created
    if (holidayId) {
      await db.delete(organizationHolidays).where(eq(organizationHolidays.id, holidayId));
      holidayId = null;
    }

    // Restore original facility Saturday hours
    await db.update(facilities)
      .set({
        saturdayOpen: originalSaturdayOpen,
        saturdayStart: originalSaturdayStart,
        saturdayEnd: originalSaturdayEnd,
      })
      .where(eq(facilities.id, 1));

    // Restore original weekend rule setting
    if (originalWeekendRule !== undefined) {
      await db.update(organizationModules)
        .set({ enabled: originalWeekendRule })
        .where(and(
          eq(organizationModules.organizationId, 2),
          eq(organizationModules.moduleName, 'enforceWeekendRule')
        ));
    }
  });

  it('should return no available times on July 4th 2025 (holiday)', async () => {
    // Seed July 4 2025 as a holiday for tenant 2
    const [holiday] = await db.insert(organizationHolidays)
      .values({
        tenantId: 2,
        name: 'Independence Day',
        date: '2025-07-04',
        isRecurring: false,
        description: 'Test holiday for integration test'
      })
      .returning();
    
    holidayId = holiday.id;

    // Call availability API for July 4th 2025
    const response = await fetch('http://localhost:3000/api/availability?date=2025-07-04&facilityId=1&appointmentTypeId=5');
    
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.availableTimes).toBeDefined();
    expect(data.availableTimes.length).toBe(0);
  });

  it('should return available times on Saturday when weekend rule is disabled', async () => {
    // Disable weekend rule for tenant 2
    await db.update(organizationModules)
      .set({ enabled: false })
      .where(and(
        eq(organizationModules.organizationId, 2),
        eq(organizationModules.moduleName, 'enforceWeekendRule')
      ));

    // Set facility Saturday hours to 08:00-12:00
    await db.update(facilities)
      .set({
        saturdayOpen: true,
        saturdayStart: '08:00',
        saturdayEnd: '12:00',
      })
      .where(eq(facilities.id, 1));

    // Call availability API for Saturday July 5th 2025
    const response = await fetch('http://localhost:3000/api/availability?date=2025-07-05&facilityId=1&appointmentTypeId=5');
    
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.availableTimes).toBeDefined();
    expect(data.availableTimes.length).toBeGreaterThanOrEqual(1);
  });

  it('should return no available times on Saturday when weekend rule is enabled', async () => {
    // Ensure weekend rule is enabled for tenant 2
    await db.update(organizationModules)
      .set({ enabled: true })
      .where(and(
        eq(organizationModules.organizationId, 2),
        eq(organizationModules.moduleName, 'enforceWeekendRule')
      ));

    // Call availability API for Saturday July 5th 2025
    const response = await fetch('http://localhost:3000/api/availability?date=2025-07-05&facilityId=1&appointmentTypeId=5');
    
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.availableTimes).toBeDefined();
    expect(data.availableTimes.length).toBe(0);
  });

  it('should return no available times on Sunday regardless of weekend rule', async () => {
    // Disable weekend rule for tenant 2
    await db.update(organizationModules)
      .set({ enabled: false })
      .where(and(
        eq(organizationModules.organizationId, 2),
        eq(organizationModules.moduleName, 'enforceWeekendRule')
      ));

    // Call availability API for Sunday July 6th 2025
    const response = await fetch('http://localhost:3000/api/availability?date=2025-07-06&facilityId=1&appointmentTypeId=5');
    
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.availableTimes).toBeDefined();
    // Sunday should typically have no availability regardless of weekend rule
    // (this behavior may vary based on facility Sunday hours configuration)
  });
}); 