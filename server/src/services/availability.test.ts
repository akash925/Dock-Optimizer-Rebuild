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
import { toZonedTime } from "date-fns-tz";
import { addHours, parseISO } from "date-fns";

// Import necessary types
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// First set up the mock for appointment results
const mockedAppointmentsResult = vi.fn().mockResolvedValue([]);

// Instead of mocking the real fetchRelevantAppointmentsForDay, we'll mock the entire module
vi.mock('./availability', async () => {
  // Get the real module to preserve functionality
  const actual = await vi.importActual('./availability');
  
  // Override only the fetchRelevantAppointmentsForDay function
  return {
    ...actual as object,
    fetchRelevantAppointmentsForDay: vi.fn().mockImplementation(
      (db: any, facilityId: number, dayStart: Date, dayEnd: Date, effectiveTenantId: number) => {
        // Track calls for assertions
        dbCallTracker.trackFacilityId(facilityId);
        dbCallTracker.trackTenantId(effectiveTenantId);
        return Promise.resolve(mockedAppointmentsResult());
      }
    )
  };
});

// Import after mocking
import { 
  calculateAvailabilitySlots,
  fetchRelevantAppointmentsForDay,
  AvailabilitySlot
} from './availability';

// Create a DB mock with the bare minimum functionality needed
const mockDb = {
  // Add required properties to satisfy the DrizzleDBInstance type
  select: vi.fn(),
  // Add other necessary methods
  $transaction: vi.fn()
} as unknown as PostgresJsDatabase<any>;

// Track database calls to check isolation enforcement
const dbCallTracker = {
  trackFacilityId: vi.fn(),
  trackTenantId: vi.fn()
};

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
    },
    
    // Stubs for other IStorage methods that aren't directly used
    getUsers: vi.fn().mockResolvedValue([]),
    getUser: vi.fn().mockResolvedValue(null),
    getUserByUsername: vi.fn().mockResolvedValue(null),
    // ... other methods would be stubbed similarly
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
    maxPerSlot: 2, // Up to 2 appointments at once
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
    
    // Reset the mocked function
    mockedAppointmentsResult.mockClear();
    mockedAppointmentsResult.mockResolvedValue([]);
    dbCallTracker.trackFacilityId.mockClear();
    dbCallTracker.trackTenantId.mockClear();
  });
  
  describe("Facility operating hours and closures", () => {
    it("returns correctly generated slots based on facility operating hours", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType();
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].time).toBe("08:00");
      expect(slots[slots.length - 1].time).toBe("16:00");
      
      // All slots should be available by default
      expect(slots.every(slot => slot.available)).toBe(true);
    });
    
    it("returns empty array when facility is closed on the requested day", async () => {
      // Arrange: Set up a facility that's closed on Sundays
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType();
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Sunday, May 11, 2025
      const sundayDate = "2025-05-11";
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        sundayDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      expect(slots).toEqual([]);
    });
  });
  
  describe("Appointment duration and buffer logic", () => {
    it("uses appointment type duration to determine slot spacing", async () => {
      // Arrange: Create an appointment type with 2 hour duration
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        duration: 120, // 2 hours
        bufferTime: 0
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      expect(slots.length).toBeGreaterThan(0);
      
      // Should have slots at 8:00, 10:00, 12:00, 14:00, 16:00 (2 hour intervals)
      // Note: 12:00 slot may be unavailable due to break time
      const times = slots.map(slot => slot.time);
      expect(times).toContain("08:00");
      expect(times).toContain("10:00");
      expect(times).toContain("14:00");
      expect(times).toContain("16:00");
    });
    
    it("uses buffer time when it's specified instead of duration", async () => {
      // Arrange: Create an appointment type with buffer time
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        duration: 60, // 1 hour
        bufferTime: 30 // 30 minute spacing
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      expect(slots.length).toBeGreaterThan(0);
      
      // Should have slots at 30-minute intervals
      const times = slots.map(slot => slot.time);
      expect(times).toContain("08:00");
      expect(times).toContain("08:30");
      expect(times).toContain("09:00");
      // ... and so on
    });
  });
  
  describe("Maximum concurrency and capacity logic", () => {
    it("correctly calculates remainingCapacity when no appointments exist", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        maxPerSlot: 3 // Allow 3 concurrent appointments
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      expect(slots.length).toBeGreaterThan(0);
      // All slots should have the full capacity (3)
      expect(slots.every(slot => slot.remainingCapacity === 3)).toBe(true);
    });
    
    it("correctly reduces remainingCapacity when appointments exist", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        maxPerSlot: 3 // Allow 3 concurrent appointments
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
      
      // Set up the mock to return this appointment
      mockedFetchRelevantAppointmentsForDay.mockResolvedValue([appointment]);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      const nineAmSlot = slots.find(slot => slot.time === "09:00");
      expect(nineAmSlot).toBeDefined();
      expect(nineAmSlot?.remainingCapacity).toBe(2); // 3 max - 1 taken = 2 remaining
      expect(nineAmSlot?.available).toBe(true); // Should still be available
    });
    
    it("marks a slot as unavailable when maximum capacity is reached", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        maxPerSlot: 2 // Allow 2 concurrent appointments
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Create 2 appointments at 10:00 AM to fill capacity
      const appointmentDate = parseISO(`${testDate}T10:00:00`);
      const appointments = [
        createTestAppointment(1, appointmentDate, addHours(appointmentDate, 1)),
        createTestAppointment(2, appointmentDate, addHours(appointmentDate, 1))
      ];
      
      // Set up the mock to return these appointments
      mockedFetchRelevantAppointmentsForDay.mockResolvedValue(appointments);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      const tenAmSlot = slots.find(slot => slot.time === "10:00");
      expect(tenAmSlot).toBeDefined();
      expect(tenAmSlot?.remainingCapacity).toBe(0); // All slots taken
      expect(tenAmSlot?.available).toBe(false); // Should be unavailable
      expect(tenAmSlot?.reason).toContain("booked"); // Should indicate it's booked
    });
  });
  
  describe("Break periods logic", () => {
    it("marks slots unavailable during facility break times when allowAppointmentsThroughBreaks=false", async () => {
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
        mockDb, 
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
    
    it("allows slots during break times when allowAppointmentsThroughBreaks=true", async () => {
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
        mockDb, 
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
    
    it("checks if appointment spanning into break time is blocked correctly", async () => {
      // Arrange: Create an appointment type that spans across the lunch break
      const facility = createTestFacility({
        wednesdayBreakStart: "12:00",
        wednesdayBreakEnd: "13:00"
      });
      
      const appointmentType = createTestAppointmentType({
        duration: 120, // 2 hours
        allowAppointmentsThroughBreaks: false
      });
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      // 11:00 AM slot would span into break time (11:00-13:00)
      const elevenAmSlot = slots.find(slot => slot.time === "11:00");
      expect(elevenAmSlot).toBeDefined();
      expect(elevenAmSlot?.available).toBe(false);
      expect(elevenAmSlot?.reason).toContain("Break Time");
    });
  });
  
  describe("Timezone handling", () => {
    it("correctly generates slots in the facility's timezone", async () => {
      // Arrange: Create a facility in a different timezone
      const facility = createTestFacility({
        timezone: "America/Los_Angeles" // Pacific time (3 hours behind NY)
      });
      
      const appointmentType = createTestAppointmentType();
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      expect(slots.length).toBeGreaterThan(0);
      
      // The slots should be generated according to the facility timezone
      // 8:00 AM in LA is 11:00 AM in NY
      expect(slots[0].time).toBe("08:00");
      
      // Verify that we called fetchRelevantAppointmentsForDay with correct Date objects
      // The day boundaries should be in the LA timezone
      expect(mockedFetchRelevantAppointmentsForDay).toHaveBeenCalled();
      const callArgs = mockedFetchRelevantAppointmentsForDay.mock.calls[0];
      
      // Verify the dayStart and dayEnd are passed correctly
      // These should be Date objects representing midnight in the facility timezone
      const dayStart = callArgs[2] as Date;
      const dayEnd = callArgs[3] as Date;
      
      // 24 hour difference between start and end
      expect(dayEnd.getTime() - dayStart.getTime()).toBe(24 * 60 * 60 * 1000);
    });
  });
  
  describe("Tenant isolation", () => {
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
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        6
      )).rejects.toThrow('Facility not found or access denied');
    });
    
    it("throws an error when trying to access an appointment type from another tenant", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        tenantId: 5
      });
      
      // Facility is accessible to tenant 7
      storage._setFacility(testFacilityId, 7, facility);
      // But appointment type belongs to tenant 5
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act & Assert
      // Try to access with tenant ID 7 (wrong tenant for appointment type)
      await expect(calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        7
      )).rejects.toThrow('Appointment type not found or access denied');
    });
    
    it("enforces tenant isolation when fetching relevant appointments", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType();
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      await calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      // Verify fetchRelevantAppointmentsForDay was called with the correct tenant ID
      expect(mockedFetchRelevantAppointmentsForDay.mock.calls[0][4]).toBe(testTenantId);
    });
  });
  
  describe("Edge Cases", () => {
    it("handles appointments that overlap with multiple time slots correctly", async () => {
      // Arrange
      const facility = createTestFacility();
      const appointmentType = createTestAppointmentType({
        maxPerSlot: 1 // Only 1 appointment at a time
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
      
      // Set up the mock to return this appointment
      mockedFetchRelevantAppointmentsForDay.mockResolvedValue([appointment]);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
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
    
    it("returns appropriate error when facility doesn't exist", async () => {
      // Arrange
      const appointmentType = createTestAppointmentType();
      
      // Don't set any facility
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act & Assert
      await expect(calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      )).rejects.toThrow('Facility not found or access denied');
    });
    
    it("returns appropriate error when appointment type doesn't exist", async () => {
      // Arrange
      const facility = createTestFacility();
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      // Don't set any appointment type
      
      // Act & Assert
      await expect(calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      )).rejects.toThrow('Appointment type not found');
    });
    
    it("correctly handles days with no break times defined", async () => {
      // Arrange: Create a facility with no breaks on Wednesday
      const facility = createTestFacility({
        wednesdayBreakStart: null,
        wednesdayBreakEnd: null
      });
      
      const appointmentType = createTestAppointmentType();
      
      storage._setFacility(testFacilityId, testTenantId, facility);
      storage._setAppointmentType(testAppointmentTypeId, appointmentType);
      
      // Act
      const slots = await calculateAvailabilitySlots(
        mockDb, 
        storage as IStorage, 
        testDate, 
        testFacilityId, 
        testAppointmentTypeId, 
        testTenantId
      );
      
      // Assert
      // All slots should be available since there's no break time
      expect(slots.every(slot => slot.available)).toBe(true);
    });
  });
});