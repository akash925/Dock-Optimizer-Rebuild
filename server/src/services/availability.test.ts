import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateAvailabilitySlots, type AvailabilitySlot } from './availability';
import { IStorage } from '../../storage';

// Mock dependencies
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
};

// Helper to create a mock storage with configurable behavior
function createMockStorage(config: {
  facility?: any;
  appointmentType?: any;
  appointments?: any[];
}) {
  const storage: Partial<IStorage> = {
    getFacility: vi.fn().mockResolvedValue(config.facility || null),
    getAppointmentType: vi.fn().mockResolvedValue(config.appointmentType || null),
  };
  return storage as IStorage;
}

// Mock data generators
function createFacility(overrides?: any) {
  return {
    id: 7,
    name: 'Test Facility',
    timezone: 'America/New_York',
    // Default to being open Monday-Friday 8am-5pm
    sundayOpen: false,
    sundayStart: null,
    sundayEnd: null,
    sundayBreakStart: null,
    sundayBreakEnd: null,
    
    mondayOpen: true,
    mondayStart: '08:00',
    mondayEnd: '17:00',
    mondayBreakStart: '12:00',
    mondayBreakEnd: '13:00',
    
    tuesdayOpen: true,
    tuesdayStart: '08:00',
    tuesdayEnd: '17:00',
    tuesdayBreakStart: '12:00',
    tuesdayBreakEnd: '13:00',
    
    wednesdayOpen: true,
    wednesdayStart: '08:00',
    wednesdayEnd: '17:00',
    wednesdayBreakStart: '12:00',
    wednesdayBreakEnd: '13:00',
    
    thursdayOpen: true,
    thursdayStart: '08:00',
    thursdayEnd: '17:00',
    thursdayBreakStart: '12:00',
    thursdayBreakEnd: '13:00',
    
    fridayOpen: true,
    fridayStart: '08:00',
    fridayEnd: '17:00',
    fridayBreakStart: '12:00',
    fridayBreakEnd: '13:00',
    
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
    name: '4 Hour Container Appointment',
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

// Mock the fetchRelevantAppointmentsForDay function
vi.mock('./availability', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    fetchRelevantAppointmentsForDay: vi.fn().mockResolvedValue([]),
    // We're not mocking calculateAvailabilitySlots as we want to test that
  };
});

// Import the mocked function to control its behavior in tests
import { fetchRelevantAppointmentsForDay } from './availability';

describe('calculateAvailabilitySlots', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear mocks after each test
    vi.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('returns empty slots if the facility is marked as closed for the day', async () => {
      // Sunday is closed at our test facility
      const sunday = '2025-05-11'; // A Sunday
      const mockStorage = createMockStorage({
        facility: createFacility(),
        appointmentType: createAppointmentType(),
      });
      
      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        sunday,
        7, // facilityId
        17, // appointmentTypeId
        5 // tenantId
      );

      expect(slots).toEqual([]);
      expect(mockStorage.getFacility).toHaveBeenCalledWith(7, 5);
      expect(mockStorage.getAppointmentType).toHaveBeenCalledWith(17);
    });

    it('returns correctly generated slots based on facility operating hours and slotIntervalMinutes', async () => {
      // Wednesday is open 8am-5pm at our test facility
      const wednesday = '2025-05-07'; // A Wednesday
      const mockStorage = createMockStorage({
        facility: createFacility(),
        appointmentType: createAppointmentType({ 
          bufferTime: 30 // 30-minute slots
        }),
      });
      
      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5
      );

      // Check that we have the expected number of slots (18 slots for 8am-5pm with 30-min intervals)
      // But exclude 12:00-13:00 which is break time (2 slots)
      // So we should have 16 valid slots
      expect(slots.length).toBeGreaterThan(0);
      
      // Check first slot is at 8:00
      expect(slots[0].time).toBe('08:00');
      
      // Check last slot should be the last valid time before 5:00 (16:30)
      expect(slots[slots.length - 1].time).toBe('16:30');
      
      // Check slot interval (30 minutes)
      const slotTimes = slots.map(s => s.time);
      expect(slotTimes).toContain('08:00');
      expect(slotTimes).toContain('08:30');
      expect(slotTimes).toContain('09:00');
    });
  });

  describe('Concurrency & Capacity', () => {
    it('correctly calculates remainingCapacity when no appointments exist', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: createFacility(),
        appointmentType: createAppointmentType({
          maxConcurrent: 3 // Allow up to 3 concurrent appointments
        }),
      });
      
      // Mock fetchRelevantAppointmentsForDay to return no appointments
      (fetchRelevantAppointmentsForDay as any).mockResolvedValue([]);

      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5
      );

      // Check that all slots have the full capacity available
      slots.forEach(slot => {
        if (slot.available) {
          expect(slot.remainingCapacity).toBe(3);
          expect(slot.remaining).toBe(3); // Legacy property should match
        }
      });
    });

    it('correctly calculates remainingCapacity when some appointments exist but don\'t fill the slot', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: createFacility(),
        appointmentType: createAppointmentType({
          maxPerSlot: 3
        }),
      });
      
      // Mock existing appointment at 9am
      const nineAM = new Date(`${wednesday}T09:00:00Z`);
      const oneThirtyPM = new Date(`${wednesday}T13:30:00Z`);
      (fetchRelevantAppointmentsForDay as any).mockResolvedValue([
        createAppointment(nineAM, oneThirtyPM)
      ]);

      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5
      );

      // Slots at 9:00 should have capacity 2 (3 max - 1 existing)
      const nineAmSlot = slots.find(s => s.time === '09:00');
      expect(nineAmSlot).toBeDefined();
      expect(nineAmSlot?.remainingCapacity).toBe(2);
      expect(nineAmSlot?.available).toBe(true);
      
      // Slots at 8:00 should still have full capacity
      const eightAmSlot = slots.find(s => s.time === '08:00');
      expect(eightAmSlot).toBeDefined();
      expect(eightAmSlot?.remainingCapacity).toBe(3);
      expect(eightAmSlot?.available).toBe(true);
    });

    it('correctly marks a slot as unavailable and remainingCapacity 0 when maxConcurrent is reached', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: createFacility(),
        appointmentType: createAppointmentType({
          maxPerSlot: 2 // Allow up to 2 concurrent appointments
        }),
      });
      
      // Mock 2 existing appointments at 9am
      const nineAM = new Date(`${wednesday}T09:00:00Z`);
      const oneThirtyPM = new Date(`${wednesday}T13:30:00Z`);
      (fetchRelevantAppointmentsForDay as any).mockResolvedValue([
        createAppointment(nineAM, oneThirtyPM),
        createAppointment(nineAM, oneThirtyPM)
      ]);

      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5
      );

      // Slots at 9:00 should be fully booked
      const nineAmSlot = slots.find(s => s.time === '09:00');
      expect(nineAmSlot).toBeDefined();
      expect(nineAmSlot?.remainingCapacity).toBe(0);
      expect(nineAmSlot?.available).toBe(false);
      expect(nineAmSlot?.reason).toContain('Slot already booked');
      
      // Slots at 8:00 should still be available
      const eightAmSlot = slots.find(s => s.time === '08:00');
      expect(eightAmSlot).toBeDefined();
      expect(eightAmSlot?.remainingCapacity).toBe(2);
      expect(eightAmSlot?.available).toBe(true);
    });
  });

  describe('Appointment Type Rules', () => {
    it('overrideFacilityHours: true results in slots being generated outside standard facility hours', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: createFacility(),
        appointmentType: createAppointmentType({
          overrideFacilityHours: true, // Override facility hours
          bufferTime: 60 // 1-hour slots
        }),
      });
      
      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5
      );

      // Check for slots outside regular hours (facility normally opens at 8:00)
      const earlySlots = slots.filter(s => {
        const hourMinute = s.time.split(':').map(Number);
        return hourMinute[0] < 8; // Hours before 8am
      });
      expect(earlySlots.length).toBeGreaterThan(0);
      
      // Check for slots after closing time (facility normally closes at 17:00)
      const lateSlots = slots.filter(s => {
        const hourMinute = s.time.split(':').map(Number);
        return hourMinute[0] >= 17; // Hours at or after 5pm
      });
      expect(lateSlots.length).toBeGreaterThan(0);
    });

    it('uses correct slotIntervalMinutes calculation based on appointmentType.bufferTime', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: createFacility(),
        appointmentType: createAppointmentType({
          bufferTime: 45 // 45-minute slots
        }),
      });
      
      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5
      );

      // Check that slots are spaced 45 minutes apart
      const slotTimes = slots.map(s => s.time);
      
      // Check for specific 45-minute intervals
      expect(slotTimes).toContain('08:00');
      expect(slotTimes).toContain('08:45');
      expect(slotTimes).toContain('09:30');
      expect(slotTimes).toContain('10:15');
    });

    it('uses appointmentType.duration when no bufferTime is specified', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: createFacility(),
        appointmentType: createAppointmentType({
          bufferTime: 0, // No buffer time
          duration: 60 // 1-hour duration
        }),
      });
      
      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5
      );

      // Check that slots are spaced 60 minutes apart
      const slotTimes = slots.map(s => s.time);
      
      // Check for specific 60-minute intervals
      expect(slotTimes).toContain('08:00');
      expect(slotTimes).toContain('09:00');
      expect(slotTimes).toContain('10:00');
      expect(slotTimes).toContain('11:00');
    });
  });

  describe('Break Time Logic', () => {
    it('slots overlapping with facility break times are marked unavailable if allowAppointmentsThroughBreaks is false', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: createFacility({
          wednesdayBreakStart: '12:00',
          wednesdayBreakEnd: '13:00'
        }),
        appointmentType: createAppointmentType({
          allowAppointmentsThroughBreaks: false,
          bufferTime: 30 // 30-minute slots
        }),
      });
      
      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5
      );

      // Check that slots during break time are marked as unavailable
      const breakTimeSlots = slots.filter(s => s.time === '12:00' || s.time === '12:30');
      expect(breakTimeSlots.length).toBe(2);
      breakTimeSlots.forEach(slot => {
        expect(slot.available).toBe(false);
        expect(slot.remainingCapacity).toBe(0);
        expect(slot.reason).toContain('Break Time');
      });
      
      // Check that slots outside break time are still available
      const beforeBreakSlot = slots.find(s => s.time === '11:30');
      expect(beforeBreakSlot?.available).toBe(true);
      
      const afterBreakSlot = slots.find(s => s.time === '13:00');
      expect(afterBreakSlot?.available).toBe(true);
    });

    it('slots overlapping with facility break times remain available if allowAppointmentsThroughBreaks is true', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: createFacility({
          wednesdayBreakStart: '12:00',
          wednesdayBreakEnd: '13:00'
        }),
        appointmentType: createAppointmentType({
          allowAppointmentsThroughBreaks: true, // Allow appointments through breaks
          bufferTime: 30 // 30-minute slots
        }),
      });
      
      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5
      );

      // Check that slots during break time are still available
      const breakTimeSlots = slots.filter(s => s.time === '12:00' || s.time === '12:30');
      expect(breakTimeSlots.length).toBe(2);
      breakTimeSlots.forEach(slot => {
        expect(slot.available).toBe(true);
        expect(slot.reason).toContain('Spans through break time');
      });
    });
  });

  describe('Timezone Handling', () => {
    it('correctly calculates slots for a facility in a different timezone', async () => {
      const wednesday = '2025-05-07'; // This is a Wednesday in most timezones
      const mockStorage = createMockStorage({
        facility: createFacility({
          timezone: 'America/Los_Angeles', // Pacific Time
          // Using Pacific Time hours (8am-5pm PT)
          wednesdayStart: '08:00',
          wednesdayEnd: '17:00',
        }),
        appointmentType: createAppointmentType(),
      });
      
      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5
      );

      // Ensure slots are generated for the facility's local timezone
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].time).toBe('08:00'); // 8am PT
      
      // The exact expected slot count depends on the timezone 
      // implementation but we can check that we have all expected slots
      const slotTimes = slots.map(s => s.time);
      expect(slotTimes).toContain('08:00');
      expect(slotTimes).toContain('08:30'); // Assuming 30-min slots
      expect(slotTimes).toContain('16:30'); // Last slot before 5pm PT
    });
  });

  describe('Tenant Isolation', () => {
    it('throws an error when trying to access a facility from another tenant', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: null, // Facility not found or access denied 
        appointmentType: createAppointmentType(),
      });
      
      await expect(calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        999 // Different tenant ID
      )).rejects.toThrow('Facility not found or access denied.');
      
      expect(mockStorage.getFacility).toHaveBeenCalledWith(7, 999);
    });

    it('throws an error when trying to access an appointment type from another tenant', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: createFacility(),
        appointmentType: null, // Appointment type not found or access denied
      });
      
      await expect(calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        999 // Different tenant ID
      )).rejects.toThrow('Appointment type not found or access denied.');
    });

    it('enforces tenant isolation when fetching relevant appointments', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: createFacility(),
        appointmentType: createAppointmentType(),
      });
      
      await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5 // Tenant ID
      );
      
      // Verify fetchRelevantAppointmentsForDay was called with correct tenant ID
      expect(fetchRelevantAppointmentsForDay).toHaveBeenCalledWith(
        mockDb,
        7, // facilityId
        wednesday,
        5  // effectiveTenantId
      );
    });
  });

  describe('Edge Cases', () => {
    it('correctly handles appointments that perfectly align with slot start/end times', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: createFacility(),
        appointmentType: createAppointmentType({
          maxPerSlot: 2,
          bufferTime: 60 // 1-hour slots
        }),
      });
      
      // Create appointments that align perfectly with slot boundaries
      const nineAM = new Date(`${wednesday}T09:00:00Z`);
      const tenAM = new Date(`${wednesday}T10:00:00Z`);
      const elevenAM = new Date(`${wednesday}T11:00:00Z`);
      
      (fetchRelevantAppointmentsForDay as any).mockResolvedValue([
        createAppointment(nineAM, tenAM),  // 9am-10am
        createAppointment(tenAM, elevenAM) // 10am-11am
      ]);

      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5
      );

      // The 9am slot should have 1 appointment (capacity 1)
      const nineAmSlot = slots.find(s => s.time === '09:00');
      expect(nineAmSlot).toBeDefined();
      expect(nineAmSlot?.remainingCapacity).toBe(1);
      expect(nineAmSlot?.available).toBe(true);
      
      // The 10am slot should have 1 appointment (capacity 1)
      const tenAmSlot = slots.find(s => s.time === '10:00');
      expect(tenAmSlot).toBeDefined();
      expect(tenAmSlot?.remainingCapacity).toBe(1);
      expect(tenAmSlot?.available).toBe(true);
      
      // The 8am and 11am slots should have full capacity
      const eightAmSlot = slots.find(s => s.time === '08:00');
      expect(eightAmSlot?.remainingCapacity).toBe(2);
      
      const elevenAmSlot = slots.find(s => s.time === '11:00');
      expect(elevenAmSlot?.remainingCapacity).toBe(2);
    });

    it('correctly handles appointments that span across multiple potential slots', async () => {
      const wednesday = '2025-05-07';
      const mockStorage = createMockStorage({
        facility: createFacility(),
        appointmentType: createAppointmentType({
          maxPerSlot: 2,
          bufferTime: 30 // 30-minute slots
        }),
      });
      
      // Create a long appointment that spans multiple slots
      const nineAM = new Date(`${wednesday}T09:00:00Z`);
      const elevenAM = new Date(`${wednesday}T11:00:00Z`);
      
      (fetchRelevantAppointmentsForDay as any).mockResolvedValue([
        createAppointment(nineAM, elevenAM) // 9am-11am (spans 4 half-hour slots)
      ]);

      const slots = await calculateAvailabilitySlots(
        mockDb,
        mockStorage,
        wednesday,
        7,
        17,
        5
      );

      // All slots between 9am and 11am should have capacity reduced by 1
      const affectedSlots = ['09:00', '09:30', '10:00', '10:30'];
      affectedSlots.forEach(time => {
        const slot = slots.find(s => s.time === time);
        expect(slot).toBeDefined();
        expect(slot?.remainingCapacity).toBe(1);
        expect(slot?.available).toBe(true);
      });
      
      // Slots before 9am and after 11am should still have full capacity
      const eightThirtySlot = slots.find(s => s.time === '08:30');
      expect(eightThirtySlot?.remainingCapacity).toBe(2);
      
      const elevenThirtySlot = slots.find(s => s.time === '11:30');
      expect(elevenThirtySlot?.remainingCapacity).toBe(2);
    });
  });
});