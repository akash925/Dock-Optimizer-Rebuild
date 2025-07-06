import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculateAvailabilitySlots } from '../src/services/availability';
import { getStorage } from '../storage';
import { MockStorage } from '../__mocks__/storage';

// Mock storage implementation for testing
const mockStorage = new MockStorage();

describe('Appointment Availability Logic Verification', () => {
  beforeEach(() => {
    // Reset mock storage state
    mockStorage.reset();
  });

  describe('Holiday Logic Verification', () => {
    it('should block appointments on organization holidays', async () => {
      // Setup test data
      const date = '2024-12-25'; // Christmas Day
      const facilityId = 1;
      const appointmentTypeId = 1;
      const tenantId = 1;

      // Mock organization with holiday
      mockStorage.setOrganization(1, {
        id: 1,
        name: 'Test Organization',
        tenantId: 1
      });

      // Mock holiday
      mockStorage.setOrganizationHolidays(1, [
        {
          id: 1,
          tenantId: 1,
          name: 'Christmas Day',
          date: '2024-12-25',
          isRecurring: true
        }
      ]);

      // Mock facility with normal hours
      mockStorage.setFacility(1, {
        id: 1,
        name: 'Test Facility',
        tenantId: 1,
        timezone: 'America/New_York',
        tuesdayOpen: true,
        tuesdayStart: '08:00',
        tuesdayEnd: '17:00'
      });

      // Mock appointment type
      mockStorage.setAppointmentType(1, {
        id: 1,
        name: 'Standard Appointment',
        duration: 60,
        bufferTime: 15,
        maxConcurrent: 1,
        tenantId: 1
      });

      const slots = await calculateAvailabilitySlots(
        null, // db not needed for this test
        mockStorage,
        date,
        facilityId,
        appointmentTypeId,
        tenantId,
        { testAppointments: [] }
      );

      // Should return no slots due to holiday
      expect(slots).toHaveLength(0);
    });

    it('should allow appointments when facility overrides organization holiday', async () => {
      const date = '2024-12-25'; // Christmas Day
      const facilityId = 1;
      const appointmentTypeId = 1;
      const tenantId = 1;

      // Mock organization with holiday
      mockStorage.setOrganization(1, {
        id: 1,
        name: 'Test Organization',
        tenantId: 1
      });

      // Mock organization holiday
      mockStorage.setOrganizationHolidays(1, [
        {
          id: 1,
          tenantId: 1,
          name: 'Christmas Day',
          date: '2024-12-25',
          isRecurring: true
        }
      ]);

      // Mock facility with override
      mockStorage.setFacility(1, {
        id: 1,
        name: 'Test Facility',
        tenantId: 1,
        timezone: 'America/New_York',
        tuesdayOpen: true,
        tuesdayStart: '08:00',
        tuesdayEnd: '17:00',
        holidays: [
          {
            date: '2024-12-25',
            overrideOrgHoliday: true
          }
        ]
      });

      // Mock appointment type
      mockStorage.setAppointmentType(1, {
        id: 1,
        name: 'Emergency Appointment',
        duration: 60,
        bufferTime: 15,
        maxConcurrent: 1,
        tenantId: 1
      });

      const slots = await calculateAvailabilitySlots(
        null,
        mockStorage,
        date,
        facilityId,
        appointmentTypeId,
        tenantId,
        { testAppointments: [] }
      );

      // Should have slots due to facility override
      expect(slots.length).toBeGreaterThan(0);
    });
  });

  describe('Working Hours Logic Verification', () => {
    it('should respect organization default hours when facility has no custom hours', async () => {
      const date = '2024-01-15'; // Monday
      const facilityId = 1;
      const appointmentTypeId = 1;
      const tenantId = 1;

      // Mock organization default hours
      mockStorage.setOrganizationDefaultHours(1, [
        {
          dayOfWeek: 1, // Monday
          isOpen: true,
          openTime: '09:00',
          closeTime: '18:00',
          breakStart: '12:00',
          breakEnd: '13:00'
        }
      ]);

      // Mock facility without custom hours
      mockStorage.setFacility(1, {
        id: 1,
        name: 'Test Facility',
        tenantId: 1,
        timezone: 'America/New_York'
        // No custom hours set
      });

      // Mock appointment type
      mockStorage.setAppointmentType(1, {
        id: 1,
        name: 'Standard Appointment',
        duration: 60,
        bufferTime: 0,
        maxConcurrent: 1,
        tenantId: 1,
        allowAppointmentsThroughBreaks: false
      });

      const slots = await calculateAvailabilitySlots(
        null,
        mockStorage,
        date,
        facilityId,
        appointmentTypeId,
        tenantId,
        { testAppointments: [] }
      );

      // Should have slots from 09:00-12:00 and 13:00-17:00 (avoiding break)
      expect(slots.length).toBeGreaterThan(0);
      
      // First slot should be at 09:00
      expect(slots[0].time).toBe('09:00');
      
      // Should not have slots during break time (12:00-13:00)
      const breakSlots = slots.filter(s => s.time >= '12:00' && s.time < '13:00');
      expect(breakSlots.every(s => !s.available)).toBe(true);
    });

    it('should override organization hours with facility-specific hours', async () => {
      const date = '2024-01-15'; // Monday
      const facilityId = 1;
      const appointmentTypeId = 1;
      const tenantId = 1;

      // Mock organization default hours (09:00-18:00)
      mockStorage.setOrganizationDefaultHours(1, [
        {
          dayOfWeek: 1, // Monday
          isOpen: true,
          openTime: '09:00',
          closeTime: '18:00'
        }
      ]);

      // Mock facility with custom hours (08:00-16:00)
      mockStorage.setFacility(1, {
        id: 1,
        name: 'Test Facility',
        tenantId: 1,
        timezone: 'America/New_York',
        mondayOpen: true,
        mondayStart: '08:00',
        mondayEnd: '16:00'
      });

      // Mock appointment type
      mockStorage.setAppointmentType(1, {
        id: 1,
        name: 'Standard Appointment',
        duration: 60,
        bufferTime: 0,
        maxConcurrent: 1,
        tenantId: 1
      });

      const slots = await calculateAvailabilitySlots(
        null,
        mockStorage,
        date,
        facilityId,
        appointmentTypeId,
        tenantId,
        { testAppointments: [] }
      );

      // Should use facility hours, not organization hours
      expect(slots[0].time).toBe('08:00'); // Facility starts earlier
      expect(slots[slots.length - 1].time).toBe('15:00'); // Facility ends earlier (last slot for 1-hour appointment)
    });

    it('should apply appointment type hour overrides with highest priority', async () => {
      const date = '2024-01-15'; // Monday
      const facilityId = 1;
      const appointmentTypeId = 1;
      const tenantId = 1;

      // Mock organization default hours
      mockStorage.setOrganizationDefaultHours(1, [
        {
          dayOfWeek: 1, // Monday
          isOpen: true,
          openTime: '09:00',
          closeTime: '18:00'
        }
      ]);

      // Mock facility hours
      mockStorage.setFacility(1, {
        id: 1,
        name: 'Test Facility',
        tenantId: 1,
        timezone: 'America/New_York',
        mondayOpen: true,
        mondayStart: '08:00',
        mondayEnd: '16:00'
      });

      // Mock appointment type with hour override
      mockStorage.setAppointmentType(1, {
        id: 1,
        name: 'After Hours Appointment',
        duration: 60,
        bufferTime: 0,
        maxConcurrent: 1,
        tenantId: 1,
        mondayOpen: true,
        mondayStart: '07:00',
        mondayEnd: '20:00',
        overrideFacilityHours: true
      });

      const slots = await calculateAvailabilitySlots(
        null,
        mockStorage,
        date,
        facilityId,
        appointmentTypeId,
        tenantId,
        { testAppointments: [] }
      );

      // Should use appointment type hours (07:00-20:00)
      expect(slots[0].time).toBe('07:00');
      expect(slots[slots.length - 1].time).toBe('19:00'); // Last slot for 1-hour appointment
    });
  });

  describe('Weekend Rule Verification', () => {
    it('should block weekends when enforce weekend rule is enabled', async () => {
      const date = '2024-01-13'; // Saturday
      const facilityId = 1;
      const appointmentTypeId = 1;
      const tenantId = 1;

      // Mock with weekend rule enforced
      process.env.ENFORCE_WEEKEND_RULE = 'true';

      // Mock facility with Saturday hours configured
      mockStorage.setFacility(1, {
        id: 1,
        name: 'Test Facility',
        tenantId: 1,
        timezone: 'America/New_York',
        saturdayOpen: true,
        saturdayStart: '10:00',
        saturdayEnd: '14:00'
      });

      // Mock appointment type
      mockStorage.setAppointmentType(1, {
        id: 1,
        name: 'Standard Appointment',
        duration: 60,
        bufferTime: 0,
        maxConcurrent: 1,
        tenantId: 1
      });

      const slots = await calculateAvailabilitySlots(
        null,
        mockStorage,
        date,
        facilityId,
        appointmentTypeId,
        tenantId,
        { testAppointments: [] }
      );

      // Should have no slots due to weekend rule enforcement
      expect(slots).toHaveLength(0);
    });

    it('should allow weekends when enforce weekend rule is disabled', async () => {
      const date = '2024-01-13'; // Saturday
      const facilityId = 1;
      const appointmentTypeId = 1;
      const tenantId = 1;

      // Mock with weekend rule disabled
      process.env.ENFORCE_WEEKEND_RULE = 'false';

      // Mock facility with Saturday hours configured
      mockStorage.setFacility(1, {
        id: 1,
        name: 'Test Facility',
        tenantId: 1,
        timezone: 'America/New_York',
        saturdayOpen: true,
        saturdayStart: '10:00',
        saturdayEnd: '14:00'
      });

      // Mock appointment type
      mockStorage.setAppointmentType(1, {
        id: 1,
        name: 'Standard Appointment',
        duration: 60,
        bufferTime: 0,
        maxConcurrent: 1,
        tenantId: 1
      });

      const slots = await calculateAvailabilitySlots(
        null,
        mockStorage,
        date,
        facilityId,
        appointmentTypeId,
        tenantId,
        { testAppointments: [] }
      );

      // Should have slots since weekend rule is disabled
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0].time).toBe('10:00');
    });
  });

  describe('Buffer Time and Concurrent Appointment Logic', () => {
    it('should respect appointment type buffer time for booking advance', async () => {
      const today = new Date();
      const date = today.toISOString().split('T')[0]; // Today's date
      const facilityId = 1;
      const appointmentTypeId = 1;
      const tenantId = 1;

      // Mock facility
      mockStorage.setFacility(1, {
        id: 1,
        name: 'Test Facility',
        tenantId: 1,
        timezone: 'America/New_York'
      });

      // Mock appointment type with 2-hour buffer
      mockStorage.setAppointmentType(1, {
        id: 1,
        name: 'Buffered Appointment',
        duration: 60,
        bufferTime: 120, // 2 hours buffer
        maxConcurrent: 1,
        tenantId: 1
      });

      const slots = await calculateAvailabilitySlots(
        null,
        mockStorage,
        date,
        facilityId,
        appointmentTypeId,
        tenantId,
        { testAppointments: [] }
      );

      // For today's slots, should not include times within the next 2 hours
      const now = new Date();
      const currentHour = now.getHours();
      const bufferCutoffHour = currentHour + 2;

      const tooSoonSlots = slots.filter(s => {
        const slotHour = parseInt(s.time.split(':')[0]);
        return slotHour <= bufferCutoffHour && !s.available && s.reason.includes('buffer');
      });

      expect(tooSoonSlots.length).toBeGreaterThan(0);
    });

    it('should properly handle max concurrent appointments', async () => {
      const date = '2024-01-15'; // Monday
      const facilityId = 1;
      const appointmentTypeId = 1;
      const tenantId = 1;

      // Mock facility
      mockStorage.setFacility(1, {
        id: 1,
        name: 'Test Facility',
        tenantId: 1,
        timezone: 'America/New_York',
        mondayOpen: true,
        mondayStart: '09:00',
        mondayEnd: '17:00'
      });

      // Mock appointment type with max 2 concurrent
      mockStorage.setAppointmentType(1, {
        id: 1,
        name: 'Concurrent Appointment',
        duration: 60,
        bufferTime: 0,
        maxConcurrent: 2,
        tenantId: 1
      });

      // Mock existing appointments - 2 at 10:00 AM (full capacity)
      const existingAppointments = [
        {
          id: 1,
          startTime: new Date('2024-01-15T10:00:00'),
          endTime: new Date('2024-01-15T11:00:00'),
          appointmentTypeId: 1
        },
        {
          id: 2,
          startTime: new Date('2024-01-15T10:00:00'),
          endTime: new Date('2024-01-15T11:00:00'),
          appointmentTypeId: 1
        }
      ];

      const slots = await calculateAvailabilitySlots(
        null,
        mockStorage,
        date,
        facilityId,
        appointmentTypeId,
        tenantId,
        { testAppointments: existingAppointments }
      );

      // 10:00 slot should be unavailable (capacity full)
      const tenAmSlot = slots.find(s => s.time === '10:00');
      expect(tenAmSlot?.available).toBe(false);
      expect(tenAmSlot?.remainingCapacity).toBe(0);
      expect(tenAmSlot?.reason).toContain('Capacity full');

      // 11:00 slot should be available (no conflicting appointments)
      const elevenAmSlot = slots.find(s => s.time === '11:00');
      expect(elevenAmSlot?.available).toBe(true);
      expect(elevenAmSlot?.remainingCapacity).toBe(2);
    });

    it('should only count same appointment type for concurrent limits', async () => {
      const date = '2024-01-15'; // Monday
      const facilityId = 1;
      const appointmentTypeId = 1;
      const tenantId = 1;

      // Mock facility
      mockStorage.setFacility(1, {
        id: 1,
        name: 'Test Facility',
        tenantId: 1,
        timezone: 'America/New_York',
        mondayOpen: true,
        mondayStart: '09:00',
        mondayEnd: '17:00'
      });

      // Mock appointment type with max 1 concurrent
      mockStorage.setAppointmentType(1, {
        id: 1,
        name: 'Type A Appointment',
        duration: 60,
        bufferTime: 0,
        maxConcurrent: 1,
        tenantId: 1
      });

      // Mock existing appointments - different types at same time
      const existingAppointments = [
        {
          id: 1,
          startTime: new Date('2024-01-15T10:00:00'),
          endTime: new Date('2024-01-15T11:00:00'),
          appointmentTypeId: 2 // Different type
        },
        {
          id: 2,
          startTime: new Date('2024-01-15T10:00:00'),
          endTime: new Date('2024-01-15T11:00:00'),
          appointmentTypeId: 3 // Different type
        }
      ];

      const slots = await calculateAvailabilitySlots(
        null,
        mockStorage,
        date,
        facilityId,
        appointmentTypeId,
        tenantId,
        { testAppointments: existingAppointments }
      );

      // 10:00 slot should be available since existing appointments are different types
      const tenAmSlot = slots.find(s => s.time === '10:00');
      expect(tenAmSlot?.available).toBe(true);
      expect(tenAmSlot?.remainingCapacity).toBe(1); // Full capacity for this appointment type
    });
  });

  describe('Break Time Logic Verification', () => {
    it('should block appointments during break time when not allowed through breaks', async () => {
      const date = '2024-01-15'; // Monday
      const facilityId = 1;
      const appointmentTypeId = 1;
      const tenantId = 1;

      // Mock organization default hours with break
      mockStorage.setOrganizationDefaultHours(1, [
        {
          dayOfWeek: 1, // Monday
          isOpen: true,
          openTime: '09:00',
          closeTime: '17:00',
          breakStart: '12:00',
          breakEnd: '13:00'
        }
      ]);

      // Mock facility
      mockStorage.setFacility(1, {
        id: 1,
        name: 'Test Facility',
        tenantId: 1,
        timezone: 'America/New_York'
      });

      // Mock appointment type that doesn't allow appointments through breaks
      mockStorage.setAppointmentType(1, {
        id: 1,
        name: 'Standard Appointment',
        duration: 60,
        bufferTime: 0,
        maxConcurrent: 1,
        tenantId: 1,
        allowAppointmentsThroughBreaks: false
      });

      const slots = await calculateAvailabilitySlots(
        null,
        mockStorage,
        date,
        facilityId,
        appointmentTypeId,
        tenantId,
        { testAppointments: [] }
      );

      // 12:00 slot should be unavailable due to break time
      const noonSlot = slots.find(s => s.time === '12:00');
      expect(noonSlot?.available).toBe(false);
      expect(noonSlot?.reason).toContain('break');
    });

    it('should allow appointments during break time when explicitly allowed', async () => {
      const date = '2024-01-15'; // Monday
      const facilityId = 1;
      const appointmentTypeId = 1;
      const tenantId = 1;

      // Mock organization default hours with break
      mockStorage.setOrganizationDefaultHours(1, [
        {
          dayOfWeek: 1, // Monday
          isOpen: true,
          openTime: '09:00',
          closeTime: '17:00',
          breakStart: '12:00',
          breakEnd: '13:00'
        }
      ]);

      // Mock facility
      mockStorage.setFacility(1, {
        id: 1,
        name: 'Test Facility',
        tenantId: 1,
        timezone: 'America/New_York'
      });

      // Mock appointment type that allows appointments through breaks
      mockStorage.setAppointmentType(1, {
        id: 1,
        name: 'Emergency Appointment',
        duration: 60,
        bufferTime: 0,
        maxConcurrent: 1,
        tenantId: 1,
        allowAppointmentsThroughBreaks: true
      });

      const slots = await calculateAvailabilitySlots(
        null,
        mockStorage,
        date,
        facilityId,
        appointmentTypeId,
        tenantId,
        { testAppointments: [] }
      );

      // 12:00 slot should be available since appointments are allowed through breaks
      const noonSlot = slots.find(s => s.time === '12:00');
      expect(noonSlot?.available).toBe(true);
    });
  });
}); 