/**
 * Comprehensive unit tests for the calculateAvailabilitySlots function
 * 
 * These tests cover:
 * - Basic facility operations (hours, closures)
 * - Appointment duration and buffer logic
 * - Maximum concurrency and capacity logic
 * - Break periods handling (with/without allowAppointmentsThroughBreaks)
 * - Timezone handling
 * - Tenant isolation and security
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IStorage } from "../../storage";
import { parseISO, addHours } from "date-fns";

// Import the DrizzleDBInstance type 
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// Setup appointments mock that will be returned by mocked fetchRelevantAppointmentsForDay
const mockAppointments = vi.fn().mockResolvedValue([]);

// Create a proper database mock that has the methods needed by the function
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  $transaction: vi.fn().mockImplementation(async callback => {
    return callback(mockDb);
  }),
  // Add additional DB-related methods needed
  _: {},
  query: vi.fn(),
  execute: vi.fn(),
  // When the query is executed, return our mock appointments
  then: vi.fn((resolve) => resolve(mockAppointments()))
} as unknown as PostgresJsDatabase<any>;

// Import the module directly - we'll use testAppointments option instead of mocking
import { calculateAvailabilitySlots, AvailabilityOptions } from "./availability";

/**
 * Creates a mock storage implementation with helper methods to set up test fixtures
 */
function createMockStorage() {
  const facilitiesMap = new Map();
  const appointmentTypesMap = new Map();
  
  const storage = {
    // Core methods used by the function under test
    getFacility: vi.fn().mockImplementation(
      async (facilityId: number, tenantId?: number) => facilitiesMap.get(`${facilityId}_${tenantId}`)
    ),
    getAppointmentType: vi.fn().mockImplementation(
      async (appointmentTypeId: number) => appointmentTypesMap.get(appointmentTypeId)
    ),
    
    // Helper methods for test setup
    _setFacility: (facilityId: number, tenantId: number, facilityData: any) => {
      facilitiesMap.set(`${facilityId}_${tenantId}`, facilityData);
    },
    _setAppointmentType: (appointmentTypeId: number, appointmentTypeData: any) => {
      appointmentTypesMap.set(appointmentTypeId, appointmentTypeData);
    }
  };
  
  return storage as typeof storage & Partial<IStorage>;
}

/**
 * Creates a standard test facility with configurable overrides
 */
function createTestFacility(overrides = {}) {
  return {
    id: 7,
    name: "Test Facility",
    timezone: "America/New_York",
    
    // Default operating schedule (Mon-Fri 8am-5pm with lunch break 12-1pm)
    sundayOpen: false,
    mondayOpen: true, 
    mondayStart: "08:00", 
    mondayEnd: "17:00",
    mondayBreakStart: "12:00",
    mondayBreakEnd: "13:00",
    
    tuesdayOpen: true,
    tuesdayStart: "08:00", 
    tuesdayEnd: "17:00",
    tuesdayBreakStart: "12:00",
    tuesdayBreakEnd: "13:00",
    
    wednesdayOpen: true,
    wednesdayStart: "08:00", 
    wednesdayEnd: "17:00",
    wednesdayBreakStart: "12:00",
    wednesdayBreakEnd: "13:00",
    
    thursdayOpen: true,
    thursdayStart: "08:00", 
    thursdayEnd: "17:00",
    thursdayBreakStart: "12:00",
    thursdayBreakEnd: "13:00",
    
    fridayOpen: true,
    fridayStart: "08:00", 
    fridayEnd: "17:00",
    fridayBreakStart: "12:00",
    fridayBreakEnd: "13:00",
    
    saturdayOpen: false,
    
    ...overrides
  };
}

/**
 * Creates a standard test appointment type with configurable overrides
 */
function createTestAppointmentType(overrides = {}) {
  return {
    id: 17,
    name: "Standard Appointment",
    duration: 60, // 1 hour by default
    bufferTime: 0,
    maxConcurrent: 2, // Up to 2 appointments at once
    tenantId: 5,
    allowAppointmentsThroughBreaks: false,
    overrideFacilityHours: false,
    ...overrides
  };
}

/**
 * Creates a test appointment with specified start and end times
 */
function createTestAppointment(id: number, startTime: Date, endTime: Date) {
  return { id, startTime, endTime };
}

describe("calculateAvailabilitySlots", () => {
  // Set up fresh mocks before each test
  let storage: ReturnType<typeof createMockStorage>;
  
  // Use a fixed date for consistent testing (Wednesday, May 7, 2025)
  const testDate = "2025-05-07";
  const testFacilityId = 7;
  const testAppointmentTypeId = 17;
  const testTenantId = 5;
  
  beforeEach(() => {
    vi.clearAllMocks();
    storage = createMockStorage();
    mockAppointments.mockClear();
    mockAppointments.mockResolvedValue([]);
  });
  
  describe("Basic Functionality", () => {
    it("returns empty slots if the facility is marked as closed for the day", async () => {
      // Arrange: Set up a facility that's closed on Sundays
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType();
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Sunday, May 11, 2025
      const sundayDate = "2025-05-11";
      
      // Act
      const options: AvailabilityOptions = {
        testAppointments: []
      };
      
      const slots = await calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        sundayDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId,
        options
      );
      
      // Assert
      expect(slots).toEqual([]);
    });
    
    it("returns correctly generated slots based on facility operating hours and slotIntervalMinutes", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType();
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const options: AvailabilityOptions = {
        testAppointments: []
      };
      
      const slots = await calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId,
        options
      );
      
      // Assert
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].time).toBe("08:00");
      
      // All slots should be within facility hours
      slots.forEach(slot => {
        const hour = parseInt(slot.time.split(":")[0], 10);
        expect(hour).toBeGreaterThanOrEqual(8);
        expect(hour).toBeLessThanOrEqual(16);
      });
    });
  });
  
  describe("Concurrency & Capacity", () => {
    it("correctly calculates remainingCapacity when no appointments exist", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        maxConcurrent: 3 // Allow 3 concurrent appointments
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const options: AvailabilityOptions = {
        testAppointments: []
      };
      
      const slots = await calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId,
        options
      );
      
      // Assert
      expect(slots.length).toBeGreaterThan(0);
      // All slots should have the full capacity (3)
      expect(slots.every(slot => slot.remainingCapacity === 3)).toBe(true);
    });
    
    it("correctly calculates remainingCapacity when some appointments exist but don't fill the slot", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        maxConcurrent: 3 // Allow 3 concurrent appointments
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Create an appointment at 9:00 AM
      const appointmentDate = parseISO(`${testDate}T09:00:00`);
      const appointment = createTestAppointment(
        1, 
        appointmentDate, 
        addHours(appointmentDate, 1)
      );
      
      // Create options with test appointments
      const options: AvailabilityOptions = {
        testAppointments: [appointment]
      };
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId,
        options
      );
      
      // Assert
      const nineAmSlot = slots.find(slot => slot.time === "09:00");
      expect(nineAmSlot).toBeDefined();
      expect(nineAmSlot?.remainingCapacity).toBe(2); // 3 max - 1 taken = 2 remaining
      expect(nineAmSlot?.available).toBe(true); // Should still be available
    });
    
    it("correctly marks a slot as unavailable and remainingCapacity 0 when maxConcurrent is reached", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        maxConcurrent: 2 // Allow 2 concurrent appointments
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Create 2 appointments at 10:00 AM to fill capacity
      const appointmentDate = parseISO(`${testDate}T10:00:00`);
      const appointments = [
        createTestAppointment(1, appointmentDate, addHours(appointmentDate, 1)),
        createTestAppointment(2, appointmentDate, addHours(appointmentDate, 1))
      ];
      
      // Create options with test appointments
      const options: AvailabilityOptions = {
        testAppointments: appointments
      };
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId,
        options
      );
      
      // Assert
      const tenAmSlot = slots.find(slot => slot.time === "10:00");
      expect(tenAmSlot).toBeDefined();
      expect(tenAmSlot?.remainingCapacity).toBe(0); // All slots taken
      expect(tenAmSlot?.available).toBe(false); // Should be unavailable
      expect(tenAmSlot?.reason).toContain("fully booked"); // Should indicate it's booked
    });
  });
  
  describe("Appointment Type Rules", () => {
    it("overrideFacilityHours: true results in slots being generated outside standard facility hours", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        overrideFacilityHours: true,
        // Define custom hours that extend beyond facility hours
        openingTime: "06:00",
        closingTime: "20:00"
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const options: AvailabilityOptions = {
        testAppointments: []
      };
      
      const slots = await calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId,
        options
      );
      
      // Assert
      // Should have slots outside facility hours if overrideFacilityHours is true
      const earlySlot = slots.find(slot => slot.time === "06:00");
      const lateSlot = slots.find(slot => slot.time === "19:00");
      
      expect(earlySlot).toBeDefined();
      expect(lateSlot).toBeDefined();
      expect(earlySlot?.available).toBe(true);
      expect(lateSlot?.available).toBe(true);
    });
    
    it("uses correct slotIntervalMinutes calculation based on appointmentType.bufferTime", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        duration: 60, // 1 hour
        bufferTime: 30 // Should generate slots every 30 minutes
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      // Should have slots at 30-minute intervals
      expect(slots.some(slot => slot.time === "08:00")).toBe(true);
      expect(slots.some(slot => slot.time === "08:30")).toBe(true);
      expect(slots.some(slot => slot.time === "09:00")).toBe(true);
      expect(slots.some(slot => slot.time === "09:30")).toBe(true);
    });
    
    it("uses appointmentType.duration when no bufferTime is specified", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        duration: 120, // 2 hour duration
        bufferTime: 0  // No buffer time, so use duration
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      // Should have slots at 2-hour intervals
      expect(slots.some(slot => slot.time === "08:00")).toBe(true);
      expect(slots.some(slot => slot.time === "10:00")).toBe(true);
      expect(slots.some(slot => slot.time === "12:00")).toBe(true);
      expect(slots.some(slot => slot.time === "14:00")).toBe(true);
      expect(slots.some(slot => slot.time === "16:00")).toBe(true);
      
      // Should NOT have slots at intermediate hours
      expect(slots.some(slot => slot.time === "09:00")).toBe(false);
      expect(slots.some(slot => slot.time === "11:00")).toBe(false);
      expect(slots.some(slot => slot.time === "13:00")).toBe(false);
      expect(slots.some(slot => slot.time === "15:00")).toBe(false);
    });
  });
  
  describe("Break Time Logic", () => {
    it("slots overlapping with facility break times are marked unavailable if allowAppointmentsThroughBreaks is false", async () => {
      // Arrange
      const facility = createTestFacility({
        // Break from 12:00 to 13:00
        wednesdayBreakStart: "12:00",
        wednesdayBreakEnd: "13:00"
      });
      
      const appointmentType = createTestAppointmentType({
        allowAppointmentsThroughBreaks: false
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      const noonSlot = slots.find(slot => slot.time === "12:00");
      expect(noonSlot).toBeDefined();
      expect(noonSlot?.available).toBe(false);
      expect(noonSlot?.reason).toContain("Break Time");
    });
    
    it("slots overlapping with facility break times remain available if allowAppointmentsThroughBreaks is true", async () => {
      // Arrange
      const facility = createTestFacility({
        // Break from 12:00 to 13:00
        wednesdayBreakStart: "12:00",
        wednesdayBreakEnd: "13:00"
      });
      
      const appointmentType = createTestAppointmentType({
        allowAppointmentsThroughBreaks: true
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      const noonSlot = slots.find(slot => slot.time === "12:00");
      expect(noonSlot).toBeDefined();
      expect(noonSlot?.available).toBe(true); // Should remain available
    });
  });
  
  describe("Timezone Handling", () => {
    it("correctly calculates slots for a facility in a different timezone", async () => {
      // Arrange: Create a facility in a different timezone
      const facility = createTestFacility({
        timezone: "America/Los_Angeles" // Pacific time (3 hours behind NY)
      });
      
      const appointmentType = createTestAppointmentType();
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].time).toBe("08:00"); // 8am in Los Angeles
    });
  });
  
  describe("Tenant Isolation", () => {
    it("throws an error when trying to access a facility from another tenant", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType();
      
      // Set facility to belong to tenant 5
      storage._setFacility(testFacilityId, 5, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act & Assert
      // Try to access with tenant ID 6 (wrong tenant)
      await expect(calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        6
      )).rejects.toThrow('Facility not found or access denied');
    });
  });
  
  describe("Edge Cases", () => {
    it("handles appointments that overlap with multiple time slots correctly", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        maxConcurrent: 1 // Only 1 appointment at a time
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Create an appointment that spans 9:00-11:00 (overlaps multiple slots)
      const appointmentDate = parseISO(`${testDate}T09:00:00`);
      const appointment = createTestAppointment(
        1, 
        appointmentDate, 
        addHours(appointmentDate, 2)
      );
      
      // Create options with test appointments
      const options: AvailabilityOptions = {
        testAppointments: [appointment]
      };
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb as any, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId,
        options
      );
      
      // Assert
      const nineAmSlot = slots.find(slot => slot.time === "09:00");
      const tenAmSlot = slots.find(slot => slot.time === "10:00");
      
      // Both slots should be marked unavailable
      expect(nineAmSlot?.available).toBe(false);
      expect(tenAmSlot?.available).toBe(false);
      expect(nineAmSlot?.remainingCapacity).toBe(0);
      expect(tenAmSlot?.remainingCapacity).toBe(0);
    });
  });
});