// Import Vitest testing utilities
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Import the functions from the actual module FIRST
import { calculateAvailabilitySlots as actualCalculateAvailabilitySlots, fetchRelevantAppointmentsForDay as originalFetchRelevantAppointmentsForDay } from './availability';

// Import storage interface
import { IStorage } from "../../storage";
// Import timezone utilities
import { toZonedTime, format as tzFormat } from "date-fns-tz";
// Import date-fns utilities
import { addDays, parseISO, format, getDay } from "date-fns";

// Define a replacement for the zonedTimeToUtc function that's not in date-fns-tz v3.2.0
function zonedTimeToUtc(dateString: string, timeZone: string): Date {
  // Parse the string to a date object using the specified timezone
  const zonedDate = toZonedTime(parseISO(dateString), timeZone);
  // Return as UTC date
  return new Date(zonedDate);
}

// Now, mock the module to replace only fetchRelevantAppointmentsForDay
vi.mock('./availability', async (importOriginal) => {
  const actualModule = await importOriginal(); // Gets the original module
  return {
    ...(actualModule as any), // Spread all exports from the original module
    fetchRelevantAppointmentsForDay: vi.fn(), // This is the function we want to mock
  };
});

// Import the mocked version of fetchRelevantAppointmentsForDay for use in tests
import { fetchRelevantAppointmentsForDay } from './availability';
const mockedFetchRelevantAppointmentsForDay = fetchRelevantAppointmentsForDay as vi.Mock;

// Mock dependencies with a more complete Drizzle-like query chain
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue([]),
  prepare: vi.fn().mockReturnThis(),
  all: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
  values: vi.fn().mockReturnThis(),
  onConflictDo: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  $transaction: vi.fn().mockImplementation((cb) => cb(mockDb))
};

// Create a reusable test fixture with a mock storage
function createMockStorage(): IStorage {
  const facilitiesMap = new Map();
  const appointmentTypesMap = new Map();
  const docksMap = new Map();
  const schedules = [];
  
  return {
    // Mock any IStorage methods needed by the test
    getFacility: vi.fn().mockImplementation((facilityId, tenantId) => {
      const key = `${facilityId}_${tenantId || 'any'}`;
      return Promise.resolve(facilitiesMap.get(key));
    }),
    
    getAppointmentType: vi.fn().mockImplementation((appointmentTypeId) => {
      return Promise.resolve(appointmentTypesMap.get(appointmentTypeId));
    }),
    
    // Helper methods to set up test data
    _setFacility: (facilityId, tenantId, facility) => {
      const key = `${facilityId}_${tenantId || 'any'}`;
      facilitiesMap.set(key, facility);
    },
    
    _setAppointmentType: (appointmentTypeId, appointmentType) => {
      appointmentTypesMap.set(appointmentTypeId, appointmentType);
    },
    
    // Add any other required methods from IStorage interface with mock implementations
    getUserFacilities: vi.fn().mockResolvedValue([]),
    getUserStores: vi.fn().mockResolvedValue([]),
    getUser: vi.fn().mockResolvedValue(null),
    // Include other required methods with minimal implementations
  };
}

// Helper functions to create test data
function createFacility(overrides?: any) {
  return {
    id: 7,
    name: "Fresh Connect HQ",
    tenantId: 5,
    timezone: "America/New_York",

    // Monday - Friday with break
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
    saturdayStart: null,
    saturdayEnd: null,
    saturdayBreakStart: null,
    saturdayBreakEnd: null,

    ...overrides,
  };
}

function createAppointmentType(overrides?: any) {
  return {
    id: 17,
    name: "4 Hour Container Appointment",
    duration: 240, // 4 hours in minutes
    bufferTime: 30,
    maxConcurrent: 2, // Use schema-accurate field 'maxConcurrent'
    tenantId: 5,
    allowAppointmentsThroughBreaks: false,
    overrideFacilityHours: false,
    ...overrides,
  };
}

function createAppointment(startTime: Date, endTime: Date) {
  return {
    id: Math.floor(Math.random() * 1000),
    startTime,
    endTime,
  };
}

describe("calculateAvailabilitySlots", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  it("returns empty array when facility is closed", async () => {
    // Arrange
    const mockStorage = createMockStorage();
    
    // Set up a closed facility
    const facilityId = 7;
    const tenantId = 5;
    const facility = createFacility({ mondayOpen: false });
    mockStorage._setFacility(facilityId, tenantId, facility);
    
    // Set up appointment type
    const appointmentTypeId = 17;
    const appointmentType = createAppointmentType();
    mockStorage._setAppointmentType(appointmentTypeId, appointmentType);
    
    // Set up a Monday date
    const monday = "2025-05-05"; // First Monday in May 2025
    
    // Act - call the real function
    const slots = await actualCalculateAvailabilitySlots(
      mockDb,
      mockStorage,
      monday,
      facilityId,
      appointmentTypeId,
      tenantId
    );
    
    // Assert
    expect(slots).toEqual([]);
  });

  it("provides slots within facility operating hours when facility is open", async () => {
    // Arrange
    const mockStorage = createMockStorage();
    
    // Set up an open facility
    const facilityId = 7;
    const tenantId = 5;
    const facility = createFacility({ 
      mondayOpen: true,
      mondayStart: "09:00",
      mondayEnd: "17:00",
      mondayBreakStart: null, // No break
      mondayBreakEnd: null
    });
    mockStorage._setFacility(facilityId, tenantId, facility);
    
    // Set up appointment type with 1-hour duration and 30-min buffer
    const appointmentTypeId = 17;
    const appointmentType = createAppointmentType({
      duration: 60,
      bufferTime: 30,
      maxConcurrent: 1
    });
    mockStorage._setAppointmentType(appointmentTypeId, appointmentType);
    
    // Set up a Monday date
    const monday = "2025-05-05"; // First Monday in May 2025
    
    // Mock no existing appointments
    mockedFetchRelevantAppointmentsForDay.mockResolvedValue([]);
    
    // Act - call the real function
    const slots = await actualCalculateAvailabilitySlots(
      mockDb,
      mockStorage,
      monday,
      facilityId,
      appointmentTypeId,
      tenantId
    );
    
    // Assert
    expect(slots.length).toBeGreaterThan(0);
    
    // First slot should be at 9:00
    expect(slots[0].time).toBe("09:00");
    expect(slots[0].available).toBe(true);
    
    // Last slot should be no later than 17:00
    const lastSlot = slots[slots.length - 1];
    const lastSlotHour = parseInt(lastSlot.time.split(':')[0], 10);
    const lastSlotMinute = parseInt(lastSlot.time.split(':')[1], 10);
    const lastSlotTime = lastSlotHour * 60 + lastSlotMinute;
    
    // The last valid starting time should be at or before 16:00,
    // because a 1-hour appointment starting at 16:00 would end at 17:00
    expect(lastSlotTime).toBeLessThanOrEqual(16 * 60);
  });

  it("correctly marks slots during break time as unavailable when allowAppointmentsThroughBreaks is false", async () => {
    // Arrange
    const mockStorage = createMockStorage();
    
    // Set up facility with break time
    const facilityId = 7;
    const tenantId = 5;
    const facility = createFacility({ 
      mondayOpen: true,
      mondayStart: "09:00",
      mondayEnd: "17:00",
      mondayBreakStart: "12:00",
      mondayBreakEnd: "13:00"
    });
    mockStorage._setFacility(facilityId, tenantId, facility);
    
    // Set up appointment type that does NOT allow appointments through breaks
    const appointmentTypeId = 16;
    const appointmentType = createAppointmentType({
      id: 16,
      name: "1 Hour Trailer Appointment",
      duration: 60,
      bufferTime: 30,
      allowAppointmentsThroughBreaks: false,
      maxConcurrent: 1
    });
    mockStorage._setAppointmentType(appointmentTypeId, appointmentType);
    
    // Set up a Monday date
    const monday = "2025-05-05";
    
    // Mock no existing appointments
    mockedFetchRelevantAppointmentsForDay.mockResolvedValue([]);
    
    // Act - call the real function
    const slots = await actualCalculateAvailabilitySlots(
      mockDb,
      mockStorage,
      monday,
      facilityId,
      appointmentTypeId,
      tenantId
    );
    
    // Assert
    // Find the 12:00 slot
    const breakTimeSlot = slots.find(slot => slot.time === "12:00");
    expect(breakTimeSlot).toBeDefined();
    expect(breakTimeSlot?.available).toBe(false);
    expect(breakTimeSlot?.reason).toBe("During break time");
    
    // Slots before and after break should be available
    const beforeBreakSlot = slots.find(slot => slot.time === "11:30");
    expect(beforeBreakSlot?.available).toBe(true);
    
    const afterBreakSlot = slots.find(slot => slot.time === "13:00");
    expect(afterBreakSlot?.available).toBe(true);
  });

  it("correctly keeps slots during break time as available when allowAppointmentsThroughBreaks is true", async () => {
    // Arrange
    const mockStorage = createMockStorage();
    
    // Set up facility with break time
    const facilityId = 7;
    const tenantId = 5;
    const facility = createFacility({ 
      mondayOpen: true,
      mondayStart: "09:00",
      mondayEnd: "17:00",
      mondayBreakStart: "12:00",
      mondayBreakEnd: "13:00"
    });
    mockStorage._setFacility(facilityId, tenantId, facility);
    
    // Set up appointment type that DOES allow appointments through breaks
    const appointmentTypeId = 17;
    const appointmentType = createAppointmentType({
      allowAppointmentsThroughBreaks: true,
      duration: 60,
      bufferTime: 30,
      maxConcurrent: 1
    });
    mockStorage._setAppointmentType(appointmentTypeId, appointmentType);
    
    // Set up a Monday date
    const monday = "2025-05-05";
    
    // Mock no existing appointments
    mockedFetchRelevantAppointmentsForDay.mockResolvedValue([]);
    
    // Act - call the real function
    const slots = await actualCalculateAvailabilitySlots(
      mockDb,
      mockStorage,
      monday,
      facilityId,
      appointmentTypeId,
      tenantId
    );
    
    // Assert
    // The 12:00 slot should be available
    const breakTimeSlot = slots.find(slot => slot.time === "12:00");
    expect(breakTimeSlot).toBeDefined();
    expect(breakTimeSlot?.available).toBe(true);
    expect(breakTimeSlot?.reason).toBe("");
  });

  it("correctly calculates remainingCapacity when some appointments exist but don't fill the slot", async () => {
    // Arrange
    const mockStorage = createMockStorage();
    
    // Set up facility
    const facilityId = 7;
    const tenantId = 5;
    const facility = createFacility({ 
      mondayOpen: true,
      mondayStart: "09:00",
      mondayEnd: "17:00"
    });
    mockStorage._setFacility(facilityId, tenantId, facility);
    
    // Set up appointment type with maxConcurrent = 3
    const appointmentTypeId = 17;
    const appointmentType = createAppointmentType({
      maxConcurrent: 3,
      duration: 60,
      bufferTime: 30
    });
    mockStorage._setAppointmentType(appointmentTypeId, appointmentType);
    
    // Set up a Monday date
    const monday = "2025-05-05";
    
    // Create an appointment from 9:00 to 10:00
    const nineAM = new Date(`${monday}T09:00:00Z`);
    const tenAM = new Date(`${monday}T10:00:00Z`);
    const appointment = createAppointment(nineAM, tenAM);
    
    // Mock one existing appointment
    mockedFetchRelevantAppointmentsForDay.mockResolvedValue([appointment]);
    
    // Act - call the real function
    const slots = await actualCalculateAvailabilitySlots(
      mockDb,
      mockStorage,
      monday,
      facilityId,
      appointmentTypeId,
      tenantId
    );
    
    // Assert
    // The 9:00 slot should have reduced capacity
    const nineAMSlot = slots.find(slot => slot.time === "09:00");
    expect(nineAMSlot).toBeDefined();
    expect(nineAMSlot?.remainingCapacity).toBe(2); // 3 max - 1 booked = 2 remaining
    expect(nineAMSlot?.available).toBe(true);
    
    // Slots outside the appointment time should have full capacity
    const tenAMSlot = slots.find(slot => slot.time === "10:00");
    expect(tenAMSlot?.remainingCapacity).toBe(3);
    expect(tenAMSlot?.available).toBe(true);
  });

  it("correctly marks a slot as unavailable and remainingCapacity 0 when maxConcurrent is reached", async () => {
    // Arrange
    const mockStorage = createMockStorage();
    
    // Set up facility
    const facilityId = 7;
    const tenantId = 5;
    const facility = createFacility({ 
      mondayOpen: true,
      mondayStart: "09:00",
      mondayEnd: "17:00"
    });
    mockStorage._setFacility(facilityId, tenantId, facility);
    
    // Set up appointment type with maxConcurrent = 2
    const appointmentTypeId = 17;
    const appointmentType = createAppointmentType({
      maxConcurrent: 2,
      duration: 60,
      bufferTime: 30
    });
    mockStorage._setAppointmentType(appointmentTypeId, appointmentType);
    
    // Set up a Monday date
    const monday = "2025-05-05";
    
    // Create two appointments from 9:00 to 10:00
    const nineAM = new Date(`${monday}T09:00:00Z`);
    const tenAM = new Date(`${monday}T10:00:00Z`);
    const appointment1 = createAppointment(nineAM, tenAM);
    const appointment2 = createAppointment(nineAM, tenAM);
    
    // Mock two existing appointments
    mockedFetchRelevantAppointmentsForDay.mockResolvedValue([appointment1, appointment2]);
    
    // Act - call the real function
    const slots = await actualCalculateAvailabilitySlots(
      mockDb,
      mockStorage,
      monday,
      facilityId,
      appointmentTypeId,
      tenantId
    );
    
    // Assert
    // The 9:00 slot should be fully booked
    const nineAMSlot = slots.find(slot => slot.time === "09:00");
    expect(nineAMSlot).toBeDefined();
    expect(nineAMSlot?.remainingCapacity).toBe(0);
    expect(nineAMSlot?.available).toBe(false);
    expect(nineAMSlot?.reason).toBe("Slot already booked");
    
    // Slots outside the appointment time should have full capacity
    const tenAMSlot = slots.find(slot => slot.time === "10:00");
    expect(tenAMSlot?.remainingCapacity).toBe(2);
    expect(tenAMSlot?.available).toBe(true);
  });

  it("correctly handles appointments that perfectly align with slot start/end times", async () => {
    // Arrange
    const mockStorage = createMockStorage();
    
    // Set up facility
    const facilityId = 7;
    const tenantId = 5;
    const facility = createFacility({ 
      mondayOpen: true,
      mondayStart: "08:00",
      mondayEnd: "17:00"
    });
    mockStorage._setFacility(facilityId, tenantId, facility);
    
    // Set up appointment type with 1-hour duration and 60-min buffer (for 1-hour slot intervals)
    const appointmentTypeId = 17;
    const appointmentType = createAppointmentType({
      maxConcurrent: 3,
      duration: 60,
      bufferTime: 60 // This creates 1-hour slots
    });
    mockStorage._setAppointmentType(appointmentTypeId, appointmentType);
    
    // Set up a Monday date
    const monday = "2025-05-05";
    
    // Create two appointments:
    // 1. 9:00 to 10:00 (perfectly aligns with the 9:00 slot)
    // 2. 10:00 to 11:00 (perfectly aligns with the 10:00 slot)
    const nineAM = new Date(`${monday}T09:00:00Z`);
    const tenAM = new Date(`${monday}T10:00:00Z`);
    const elevenAM = new Date(`${monday}T11:00:00Z`);
    
    const appointment1 = createAppointment(nineAM, tenAM);
    const appointment2 = createAppointment(tenAM, elevenAM);
    
    // Mock two existing appointments
    mockedFetchRelevantAppointmentsForDay.mockResolvedValue([appointment1, appointment2]);
    
    // Act - call the real function
    const slots = await actualCalculateAvailabilitySlots(
      mockDb,
      mockStorage,
      monday,
      facilityId,
      appointmentTypeId,
      tenantId
    );
    
    // Assert
    // The 9:00 slot should have capacity reduced by 1
    const nineAMSlot = slots.find(slot => slot.time === "09:00");
    expect(nineAMSlot).toBeDefined();
    expect(nineAMSlot?.remainingCapacity).toBe(2); // 3 max - 1 booked = 2 remaining
    expect(nineAMSlot?.available).toBe(true);
    
    // The 10:00 slot should have capacity reduced by 1
    const tenAMSlot = slots.find(slot => slot.time === "10:00");
    expect(tenAMSlot?.remainingCapacity).toBe(2); // 3 max - 1 booked = 2 remaining
    expect(tenAMSlot?.available).toBe(true);
    
    // Slots outside the appointment times should have full capacity
    const eightAMSlot = slots.find(slot => slot.time === "08:00");
    expect(eightAMSlot?.remainingCapacity).toBe(3);
    
    const elevenAMSlot = slots.find(slot => slot.time === "11:00");
    expect(elevenAMSlot?.remainingCapacity).toBe(3);
  });

  it("enforces tenant isolation when checking availability", async () => {
    // Arrange
    const mockStorage = createMockStorage();
    
    // Set up two facilities with different tenant IDs
    const facilityId = 7;
    const tenant1Id = 5;
    const tenant2Id = 6;
    
    const facility = createFacility({ 
      tenantId: tenant1Id,
      mondayOpen: true,
      mondayStart: "09:00",
      mondayEnd: "17:00"
    });
    
    // Only register the facility for tenant 5
    mockStorage._setFacility(facilityId, tenant1Id, facility);
    
    // Set up appointment type 
    const appointmentTypeId = 17;
    const appointmentType = createAppointmentType({
      tenantId: tenant1Id
    });
    mockStorage._setAppointmentType(appointmentTypeId, appointmentType);
    
    // Set up a Monday date
    const monday = "2025-05-05";
    
    // Mock no existing appointments
    mockedFetchRelevantAppointmentsForDay.mockResolvedValue([]);
    
    // Act - call the real function for the correct tenant
    const slotsForTenant1 = await actualCalculateAvailabilitySlots(
      mockDb,
      mockStorage,
      monday,
      facilityId,
      appointmentTypeId,
      tenant1Id
    );
    
    // Assert that slots are returned for the correct tenant
    expect(slotsForTenant1.length).toBeGreaterThan(0);
    
    // Check that the function was called with correct tenantId
    expect(mockStorage.getFacility).toHaveBeenCalledWith(facilityId, tenant1Id);
    
    // Try to access with wrong tenant - should fail with error
    await expect(actualCalculateAvailabilitySlots(
      mockDb,
      mockStorage,
      monday,
      facilityId,
      appointmentTypeId,
      tenant2Id
    )).rejects.toThrow('Facility not found or access denied.');
  });

  it("handles appointments spanning multiple slots correctly", async () => {
    // Arrange
    const mockStorage = createMockStorage();
    
    // Set up facility
    const facilityId = 7;
    const tenantId = 5;
    const facility = createFacility({ 
      wednesdayOpen: true,
      wednesdayStart: "08:00",
      wednesdayEnd: "17:00"
    });
    mockStorage._setFacility(facilityId, tenantId, facility);
    
    // Set up appointment type with 30-min intervals
    const appointmentTypeId = 17;
    const appointmentType = createAppointmentType({
      maxConcurrent: 3,
      duration: 60,
      bufferTime: 30 // This creates 30-min slots
    });
    mockStorage._setAppointmentType(appointmentTypeId, appointmentType);
    
    // Set up a Wednesday date
    const wednesday = "2025-05-07"; // First Wednesday in May 2025
    
    // Create an appointment that spans several slots: 9:00 to 11:00 (2 hours)
    const nineAM = new Date(`${wednesday}T09:00:00Z`);
    const elevenAM = new Date(`${wednesday}T11:00:00Z`);
    const appointment = createAppointment(nineAM, elevenAM);
    
    // Mock one existing appointment
    mockedFetchRelevantAppointmentsForDay.mockResolvedValue([appointment]);
    
    // Act - call the real function
    const slots = await actualCalculateAvailabilitySlots(
      mockDb,
      mockStorage,
      wednesday,
      facilityId,
      appointmentTypeId,
      tenantId
    );
    
    // Assert
    // All slots between 9am and 11am should have capacity reduced by 1
    const affectedSlots = ["09:00", "09:30", "10:00", "10:30"];
    affectedSlots.forEach((time) => {
      const slot = slots.find((s) => s.time === time);
      expect(slot).toBeDefined();
      expect(slot?.remainingCapacity).toBe(2); // 3 max - 1 booked = 2 remaining
      expect(slot?.available).toBe(true);
    });
    
    // Slots before 9am and after 11am should still have full capacity
    const eightThirtySlot = slots.find((s) => s.time === "08:30");
    expect(eightThirtySlot?.remainingCapacity).toBe(3);
    
    const elevenThirtySlot = slots.find((s) => s.time === "11:30");
    expect(elevenThirtySlot?.remainingCapacity).toBe(3);
  });
});