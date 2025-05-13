// Import Vitest testing utilities
import { describe, it, expect, vi, beforeEach } from "vitest";

// Import storage interface and types
import { IStorage } from "../../storage";
import type { Schedule } from "@shared/schema";

// Import timezone utilities and date-fns utilities
import { toZonedTime } from "date-fns-tz";
import { addDays, parseISO, getDay, format, addMinutes } from "date-fns";

// --- Mocking Setup ---
// Import the actual function we want to test FIRST
import {
  calculateAvailabilitySlots as actualCalculateAvailabilitySlots,
  // fetchRelevantAppointmentsForDay as originalFetchRelevantAppointmentsForDay, // Not needed directly
  type AvailabilitySlot,
  type AvailabilityOptions
} from './availability';

// Mock the './availability' module BEFORE other imports from it
vi.mock('./availability', async (importActual) => {
  const originalModule = await importActual() as typeof import('./availability');
  return {
    ...originalModule, // Keep the actual calculateAvailabilitySlots etc.
    // Replace fetchRelevantAppointmentsForDay with a Vitest mock function export
    fetchRelevantAppointmentsForDay: vi.fn(),
  };
});

// Import the MOCKED function AFTER vi.mock
import { fetchRelevantAppointmentsForDay } from './availability';
const mockedFetchRelevantAppointmentsForDay = fetchRelevantAppointmentsForDay as vi.Mock;
// --- End Mocking Setup ---


// Mock the Drizzle DB instance realistically
const mockQueryResult = {
    select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(async (resolve) => resolve(await mockedFetchRelevantAppointmentsForDay())),
    execute: vi.fn().mockImplementation(async () => await mockedFetchRelevantAppointmentsForDay()),
};
const mockDb = {
    select: vi.fn(() => mockQueryResult),
    $transaction: vi.fn().mockImplementation(async (cb) => await cb(mockDb))
};


// --- Test Fixtures & Helpers ---
// ** FIXED: Simplified createMockStorage - Configure mocks per test **
function createMockStorage(): IStorage {
    const storageMock: Partial<IStorage> = {
      getFacility: vi.fn(), // To be configured in each test using .mockResolvedValue()
      getAppointmentType: vi.fn(), // To be configured in each test using .mockResolvedValue()
    // --- Add stubs for ALL methods defined in IStorage ---
     getUsers: vi.fn().mockResolvedValue([]), getUser: vi.fn().mockResolvedValue(null),
     createUser: vi.fn().mockResolvedValue({ id: 1 }), updateUser: vi.fn().mockResolvedValue({ id: 1 }),
     deleteUser: vi.fn().mockResolvedValue(true), getUserByUsername: vi.fn().mockResolvedValue(null),
     getUsersByOrganizationId: vi.fn().mockResolvedValue([]), getTenants: vi.fn().mockResolvedValue([]),
     getTenantById: vi.fn().mockResolvedValue(null), createTenant: vi.fn().mockResolvedValue({ id: 1 }),
     updateTenant: vi.fn().mockResolvedValue({ id: 1 }), deleteTenant: vi.fn().mockResolvedValue(true),
     getFacilities: vi.fn().mockResolvedValue([]), createFacility: vi.fn().mockResolvedValue({ id: 1 }),
     updateFacility: vi.fn().mockResolvedValue({ id: 1 }), deleteFacility: vi.fn().mockResolvedValue(true),
     getFacilitiesByOrganizationId: vi.fn().mockResolvedValue([]), getOrganizationFacilities: vi.fn().mockResolvedValue([]),
     addFacilityToOrganization: vi.fn().mockResolvedValue(true), removeFacilityFromOrganization: vi.fn().mockResolvedValue(true),
     getFacilityTenantId: vi.fn().mockResolvedValue(null), getDocks: vi.fn().mockResolvedValue([]),
     getDock: vi.fn().mockResolvedValue(null), createDock: vi.fn().mockResolvedValue({ id: 1 }),
     updateDock: vi.fn().mockResolvedValue({ id: 1 }), deleteDock: vi.fn().mockResolvedValue(true),
     getDocksByFacility: vi.fn().mockResolvedValue([]), getSchedules: vi.fn().mockResolvedValue([]),
     getSchedule: vi.fn().mockResolvedValue(null), createSchedule: vi.fn().mockResolvedValue({ id: 1 }),
     updateSchedule: vi.fn().mockResolvedValue({ id: 1 }), deleteSchedule: vi.fn().mockResolvedValue(true),
     getSchedulesByDock: vi.fn().mockResolvedValue([]), getSchedulesByDateRange: vi.fn().mockResolvedValue([]),
     searchSchedules: vi.fn().mockResolvedValue([]), getScheduleByConfirmationCode: vi.fn().mockResolvedValue(null),
     getEnhancedSchedule: vi.fn().mockResolvedValue(null), getCarriers: vi.fn().mockResolvedValue([]),
     getCarrier: vi.fn().mockResolvedValue(null), createCarrier: vi.fn().mockResolvedValue({ id: 1 }),
     updateCarrier: vi.fn().mockResolvedValue({ id: 1 }), deleteCarrier: vi.fn().mockResolvedValue(true),
     getNotifications: vi.fn().mockResolvedValue([]), getNotification: vi.fn().mockResolvedValue(null),
     createNotification: vi.fn().mockResolvedValue({ id: 1 }), markNotificationAsRead: vi.fn().mockResolvedValue(null),
     getNotificationsByUser: vi.fn().mockResolvedValue([]), getAppointmentSettings: vi.fn().mockResolvedValue(null),
     createAppointmentSettings: vi.fn().mockResolvedValue({ id: 1 }), updateAppointmentSettings: vi.fn().mockResolvedValue(null),
     getAppointmentTypes: vi.fn().mockResolvedValue([]), createAppointmentType: vi.fn().mockResolvedValue({ id: 1 }),
     updateAppointmentType: vi.fn().mockResolvedValue({ id: 1 }), deleteAppointmentType: vi.fn().mockResolvedValue(true),
     getAppointmentTypesByFacility: vi.fn().mockResolvedValue([]), getOrganizationByAppointmentTypeId: vi.fn().mockResolvedValue(null),
     getAppointmentTypeWithTenant: vi.fn().mockResolvedValue(null), getDailyAvailability: vi.fn().mockResolvedValue(null),
     getDailyAvailabilityByAppointmentType: vi.fn().mockResolvedValue([]), createDailyAvailability: vi.fn().mockResolvedValue({ id: 1 }),
     updateDailyAvailability: vi.fn().mockResolvedValue(null), deleteDailyAvailability: vi.fn().mockResolvedValue(true),
     getCustomQuestions: vi.fn().mockResolvedValue([]), getCustomQuestion: vi.fn().mockResolvedValue(null),
     createCustomQuestion: vi.fn().mockResolvedValue({ id: 1 }), updateCustomQuestion: vi.fn().mockResolvedValue({ id: 1 }),
     deleteCustomQuestion: vi.fn().mockResolvedValue(true), getCustomQuestionsByAppointmentType: vi.fn().mockResolvedValue([]),
     getStandardQuestions: vi.fn().mockResolvedValue([]), getStandardQuestion: vi.fn().mockResolvedValue(null),
     createStandardQuestion: vi.fn().mockResolvedValue({ id: 1 }), createStandardQuestionWithId: vi.fn().mockResolvedValue({ id: 1 }),
     updateStandardQuestion: vi.fn().mockResolvedValue({ id: 1 }), deleteStandardQuestion: vi.fn().mockResolvedValue(true),
     getStandardQuestionsByAppointmentType: vi.fn().mockResolvedValue([]), getBookingPages: vi.fn().mockResolvedValue([]),
     getBookingPage: vi.fn().mockResolvedValue(null), getBookingPageBySlug: vi.fn().mockResolvedValue(null),
     createBookingPage: vi.fn().mockResolvedValue({ id: 1 }), updateBookingPage: vi.fn().mockResolvedValue({ id: 1 }),
     deleteBookingPage: vi.fn().mockResolvedValue(true), getBookingPagesForOrganization: vi.fn().mockResolvedValue([]),
     getUserPreferences: vi.fn().mockResolvedValue(null), createUserPreferences: vi.fn().mockResolvedValue({ id: 1 }),
     updateUserPreferences: vi.fn().mockResolvedValue(null), getHolidays: vi.fn().mockResolvedValue([]),
     createHoliday: vi.fn().mockResolvedValue({ id: 1 }), updateHoliday: vi.fn().mockResolvedValue({ id: 1 }),
     deleteHoliday: vi.fn().mockResolvedValue(true), getOrganizationModules: vi.fn().mockResolvedValue([]),
     setOrganizationModuleEnabled: vi.fn().mockResolvedValue(true),
    // --- End IStorage stubs ---
    };
    return storageMock as IStorage;
}
// ** REMOVED _setFacility and _setAppointmentType helpers **

// Mock data generators
function createFacility(overrides?: Partial<ReturnType<typeof createFacility>>) {
    return {
      id: 7, name: "Test Facility", timezone: "America/New_York",
      organizationId: 5, // Assuming default tenant is 5
      sundayOpen: false, sundayStart: null, sundayEnd: null, sundayBreakStart: null, sundayBreakEnd: null,
      mondayOpen: true, mondayStart: "08:00", mondayEnd: "17:00", mondayBreakStart: "12:00", mondayBreakEnd: "13:00",
      tuesdayOpen: true, tuesdayStart: "08:00", tuesdayEnd: "17:00", tuesdayBreakStart: "12:00", tuesdayBreakEnd: "13:00",
      wednesdayOpen: true, wednesdayStart: "08:00", wednesdayEnd: "17:00", wednesdayBreakStart: "12:00", wednesdayBreakEnd: "13:00",
      thursdayOpen: true, thursdayStart: "08:00", thursdayEnd: "17:00", thursdayBreakStart: "12:00", thursdayBreakEnd: "13:00",
      fridayOpen: true, fridayStart: "08:00", fridayEnd: "17:00", fridayBreakStart: "12:00", fridayBreakEnd: "13:00",
      saturdayOpen: false, saturdayStart: null, saturdayEnd: null, saturdayBreakStart: null, saturdayBreakEnd: null,
      ...overrides,
    };
}
function createAppointmentType(overrides?: Partial<ReturnType<typeof createAppointmentType>>) {
    return {
      id: 17, name: "4 Hour Container Appointment", duration: 240, bufferTime: 30,
      maxConcurrent: 2, tenantId: 5, allowAppointmentsThroughBreaks: false, overrideFacilityHours: false,
      ...overrides,
    };
}
type TestAppointment = { id: number; startTime: Date; endTime: Date };
function createAppointment(startTime: Date, endTime: Date): TestAppointment {
    return { id: Math.floor(Math.random() * 1000), startTime, endTime };
}
// --- End Test Fixtures ---

// --- Start Test Suite ---
describe("calculateAvailabilitySlots", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Clears storage mocks etc.
    mockedFetchRelevantAppointmentsForDay.mockClear();
    mockedFetchRelevantAppointmentsForDay.mockResolvedValue([]); // Default

    // Reset Drizzle chain mocks
    mockDb.select.mockClear();
    mockQueryResult.select.mockClear();
    mockQueryResult.from.mockClear();
    mockQueryResult.leftJoin.mockClear();
    mockQueryResult.where.mockClear();
    mockQueryResult.then.mockClear();
    mockQueryResult.execute.mockClear();
    // Re-apply default resolution
    mockQueryResult.then.mockImplementation(async (resolve) => resolve(await mockedFetchRelevantAppointmentsForDay()));
    mockQueryResult.execute.mockImplementation(async () => await mockedFetchRelevantAppointmentsForDay());
  });

  // --- Test Cases ---
  // ** NOTE: ALL tests below need getFacility/getAppointmentType configured **
  describe("Basic Functionality", () => {
    it("returns empty slots if the facility is marked as closed for the day", async () => {
        const mockStorage = createMockStorage();
        const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const sunday = "2025-05-11";
        // ** Configure mocks directly **
        (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility({ sundayOpen: false }));
        (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType());

        const slots = await actualCalculateAvailabilitySlots(
           mockDb as any, mockStorage, sunday, facilityId, appointmentTypeId, tenantId
        );

        expect(slots).toEqual([]);
        expect(mockStorage.getFacility).toHaveBeenCalledWith(7, 5);
        expect(mockStorage.getAppointmentType).toHaveBeenCalledWith(17);
    });

    it("returns correctly generated slots based on facility operating hours and slotIntervalMinutes", async () => {
      const mockStorage = createMockStorage();
      const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
      // ** Configure mocks directly **
      (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility());
      (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType({ bufferTime: 30 }));
      mockedFetchRelevantAppointmentsForDay.mockResolvedValue([]);

      const slots = await actualCalculateAvailabilitySlots(
        mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId
      );

      expect(slots.length).toBe(16);
      const slotTimes = slots.map((s) => s.time);
      expect(slotTimes[0]).toBe("08:00");
      expect(slotTimes[slotTimes.length - 1]).toBe("16:30");
      expect(slotTimes).toContain("08:30");
      expect(slots.find(s => s.time === '12:00')?.available).toBe(false);
      expect(slots.find(s => s.time === '12:30')?.available).toBe(false);
      expect(mockedFetchRelevantAppointmentsForDay).toHaveBeenCalledTimes(1);
    });
   });

  describe("Concurrency & Capacity", () => {
    it("correctly calculates remainingCapacity when no appointments exist", async () => {
        const mockStorage = createMockStorage();
        const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
        (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility());
        (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType({ maxConcurrent: 3 }));
        const testAppointments: TestAppointment[] = [];

        const slots = await actualCalculateAvailabilitySlots(
            mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId, { testAppointments }
        );

        slots.forEach((slot) => {
            if (slot.available) { expect(slot.remainingCapacity).toBe(3); }
        });
    });

    it("correctly calculates remainingCapacity when some appointments exist but don't fill the slot", async () => {
        const mockStorage = createMockStorage();
        const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
        const facilityTimezone = "America/New_York";
        (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility({ timezone: facilityTimezone }));
        (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType({ maxConcurrent: 3 }));

        const nineAM = toZonedTime(parseISO(`${wednesday}T09:00:00`), facilityTimezone);
        const tenAM = toZonedTime(parseISO(`${wednesday}T10:00:00`), facilityTimezone);
        const testAppointments = [ createAppointment(nineAM, tenAM) ];

        const slots = await actualCalculateAvailabilitySlots(
            mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId, { testAppointments }
        );

        const nineAmSlot = slots.find((s) => s.time === "09:00");
        expect(nineAmSlot).toBeDefined();
        expect(nineAmSlot?.remainingCapacity).toBe(2);
        expect(nineAmSlot?.available).toBe(true);
        const eightAmSlot = slots.find((s) => s.time === "08:00");
        expect(eightAmSlot?.remainingCapacity).toBe(3);
        expect(eightAmSlot?.available).toBe(true);
    });

    it("correctly marks a slot as unavailable and remainingCapacity 0 when maxConcurrent is reached", async () => {
        const mockStorage = createMockStorage();
        const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
        const facilityTimezone = "America/New_York";
        (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility({ timezone: facilityTimezone }));
        (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType({ maxConcurrent: 2 }));

        const nineAM = toZonedTime(parseISO(`${wednesday}T09:00:00`), facilityTimezone);
        const tenAM = toZonedTime(parseISO(`${wednesday}T10:00:00`), facilityTimezone);
        const testAppointments = [ createAppointment(nineAM, tenAM), createAppointment(nineAM, tenAM) ];

        const slots = await actualCalculateAvailabilitySlots(
            mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId, { testAppointments }
        );

        const nineAmSlot = slots.find((s) => s.time === "09:00");
        expect(nineAmSlot).toBeDefined();
        expect(nineAmSlot?.remainingCapacity).toBe(0);
        expect(nineAmSlot?.available).toBe(false);
        expect(nineAmSlot?.reason).toBe("Capacity full");
        const eightAmSlot = slots.find((s) => s.time === "08:00");
        expect(eightAmSlot?.remainingCapacity).toBe(2);
        expect(eightAmSlot?.available).toBe(true);
    });
  });

  describe("Appointment Type Rules", () => {
      it("overrideFacilityHours: true results in slots being generated outside standard facility hours", async () => {
          const mockStorage = createMockStorage();
          const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
          (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility());
          (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType({ overrideFacilityHours: true, bufferTime: 60 }));
          const testAppointments: TestAppointment[] = [];

          const slots = await actualCalculateAvailabilitySlots(
              mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId, { testAppointments }
          );

          expect(slots.length).toBe(24);
          expect(slots[0].time).toBe('00:00');
          expect(slots[slots.length - 1].time).toBe('23:00');
      });

      it("uses correct slotIntervalMinutes calculation based on appointmentType.bufferTime", async () => {
          const mockStorage = createMockStorage();
          const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
          (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility());
          (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType({ bufferTime: 45 }));
          const testAppointments: TestAppointment[] = [];

          const slots = await actualCalculateAvailabilitySlots(
              mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId, { testAppointments }
          );

          const slotTimes = slots.map(s => s.time);
          expect(slotTimes).toContain('08:00');
          expect(slotTimes).toContain('08:45');
          expect(slotTimes[slotTimes.length-1]).toBe('16:15');
      });

      it("uses appointmentType.duration when no bufferTime is specified", async () => {
          const mockStorage = createMockStorage();
          const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
          (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility());
          (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType({ bufferTime: 0, duration: 60 }));
          const testAppointments: TestAppointment[] = [];

          const slots = await actualCalculateAvailabilitySlots(
              mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId, { testAppointments }
          );

          const slotTimes = slots.map(s => s.time);
          expect(slotTimes).toContain('08:00');
          expect(slotTimes).toContain('09:00');
          expect(slotTimes[slotTimes.length-1]).toBe('16:00');
      });
  });

  describe("Break Time Logic", () => {
    it("slots overlapping with facility break times are marked unavailable if allowAppointmentsThroughBreaks is false", async () => {
      const mockStorage = createMockStorage();
      const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
      (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility({ wednesdayBreakStart: "12:00", wednesdayBreakEnd: "13:00" }));
      (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType({ allowAppointmentsThroughBreaks: false, bufferTime: 30 }));
      const testAppointments: TestAppointment[] = [];

      const slots = await actualCalculateAvailabilitySlots(
        mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId, { testAppointments }
      );

      const breakTimeSlots = slots.filter(s => s.time === '12:00' || s.time === '12:30');
      expect(breakTimeSlots.length).toBe(2);
      breakTimeSlots.forEach(slot => {
        expect(slot.available).toBe(false);
        expect(slot.reason).toBe('Break Time');
      });
      expect(slots.find(s => s.time === '11:30')?.available).toBe(true);
      expect(slots.find(s => s.time === '13:00')?.available).toBe(true);
    });

    it("slots overlapping with facility break times remain available if allowAppointmentsThroughBreaks is true", async () => {
      const mockStorage = createMockStorage();
      const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
      (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility({ wednesdayBreakStart: "12:00", wednesdayBreakEnd: "13:00" }));
      (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType({ allowAppointmentsThroughBreaks: true, bufferTime: 30 }));
      const testAppointments: TestAppointment[] = [];

      const slots = await actualCalculateAvailabilitySlots(
        mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId, { testAppointments }
      );

      const breakTimeSlots = slots.filter(s => s.time === '12:00' || s.time === '12:30');
      expect(breakTimeSlots.length).toBe(2);
      breakTimeSlots.forEach(slot => {
        expect(slot.available).toBe(true);
        expect(slot.reason).toBe('Spans through break time'); // Corrected assertion
      });
    });
  });

  describe("Timezone Handling", () => {
    it("correctly calculates slots for a facility in a different timezone", async () => {
      const mockStorage = createMockStorage();
      const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
      (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility({ timezone: "America/Los_Angeles", wednesdayStart: "08:00", wednesdayEnd: "17:00" }));
      (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType({ bufferTime: 30 }));
      const testAppointments: TestAppointment[] = [];

      const slots = await actualCalculateAvailabilitySlots(
        mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId, { testAppointments }
      );

      expect(slots.length).toBe(16);
      expect(slots[0].time).toBe("08:00");
      expect(slots[slots.length - 1].time).toBe("16:30");
      const slotTimes = slots.map(s => s.time);
      expect(slotTimes).toContain('08:30');
    });
  });

  describe("Tenant Isolation", () => {
    it("throws an error when trying to access a facility from another tenant", async () => {
        const mockStorage = createMockStorage();
        const facilityId = 7; const correctTenantId = 5; const wrongTenantId = 999; const appointmentTypeId = 17; const wednesday = "2025-05-07";
        (mockStorage.getFacility as vi.Mock).mockResolvedValue(null); // Simulate not found for wrong tenant
        (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType()); // Doesn't matter
        const testAppointments: TestAppointment[] = [];

        await expect(
            actualCalculateAvailabilitySlots(mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, wrongTenantId, { testAppointments })
        ).rejects.toThrow("Facility not found or access denied.");
        expect(mockStorage.getFacility).toHaveBeenCalledWith(facilityId, wrongTenantId);
        expect(mockStorage.getAppointmentType).not.toHaveBeenCalled();
    });

     it("throws an error when trying to access an appointment type from another tenant", async () => {
        const mockStorage = createMockStorage();
        const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
        (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility()); // Facility OK
        (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(null); // App Type Not Found
        const testAppointments: TestAppointment[] = [];

        await expect(
            actualCalculateAvailabilitySlots(mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId, { testAppointments })
        ).rejects.toThrow("Appointment type not found or access denied.");
        expect(mockStorage.getFacility).toHaveBeenCalledWith(facilityId, tenantId);
        expect(mockStorage.getAppointmentType).toHaveBeenCalledWith(appointmentTypeId);
    });

    it("enforces tenant isolation when fetching relevant appointments", async () => {
      const mockStorage = createMockStorage();
      const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
      const facilityTimezone = "America/New_York";
      (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility({ timezone: facilityTimezone }));
      (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType());
      // ** FIXED: Configure IMPORTED mock **
      mockedFetchRelevantAppointmentsForDay.mockResolvedValue([]);

      await actualCalculateAvailabilitySlots(
        mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId
      );

      const dayStartExpected = toZonedTime(parseISO(`${wednesday}T00:00:00`), facilityTimezone);
      const nextDate = addDays(parseISO(wednesday), 1);
      const dayEndExpected = toZonedTime(parseISO(`${format(nextDate, 'yyyy-MM-dd')}T00:00:00`), facilityTimezone);

      expect(mockedFetchRelevantAppointmentsForDay).toHaveBeenCalledTimes(1);
      expect(mockedFetchRelevantAppointmentsForDay).toHaveBeenCalledWith(
        mockDb, facilityId,
        expect.any(Date), expect.any(Date),
        tenantId
      );
       const callArgs = mockedFetchRelevantAppointmentsForDay.mock.calls[0];
       expect(callArgs[2].getTime()).toBeCloseTo(dayStartExpected.getTime(), -4);
       expect(callArgs[3].getTime()).toBeCloseTo(dayEndExpected.getTime(), -4);
    });
  });

  describe("Edge Cases", () => {
    it("correctly handles appointments that perfectly align with slot start/end times", async () => {
      const mockStorage = createMockStorage();
      const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
      const facilityTimezone = "America/New_York";
      (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility({ timezone: facilityTimezone }));
      (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType({ maxConcurrent: 2, bufferTime: 60 }));

      // Use direct date-fns/tz
      const nineAM = toZonedTime(parseISO(`${wednesday}T09:00:00`), facilityTimezone);
      const tenAM = toZonedTime(parseISO(`${wednesday}T10:00:00`), facilityTimezone);
      const elevenAM = toZonedTime(parseISO(`${wednesday}T11:00:00`), facilityTimezone);
      const testAppointments: TestAppointment[] = [ createAppointment(nineAM, tenAM), createAppointment(tenAM, elevenAM) ];

      const slots = await actualCalculateAvailabilitySlots(
        mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId, { testAppointments }
      );

      const nineAmSlot = slots.find((s) => s.time === "09:00");
      expect(nineAmSlot).toBeDefined();
      expect(nineAmSlot?.remainingCapacity).toBe(1);
      expect(nineAmSlot?.available).toBe(true);

      const tenAmSlot = slots.find((s) => s.time === "10:00");
      expect(tenAmSlot).toBeDefined();
      expect(tenAmSlot?.remainingCapacity).toBe(1);
      expect(tenAmSlot?.available).toBe(true);

      const eightAmSlot = slots.find((s) => s.time === "08:00");
      expect(eightAmSlot?.remainingCapacity).toBe(2);

      const elevenAmSlot = slots.find((s) => s.time === "11:00");
      expect(elevenAmSlot?.remainingCapacity).toBe(2);
    });

    it("correctly handles appointments that span across multiple potential slots", async () => {
      const mockStorage = createMockStorage();
      const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
      const facilityTimezone = "America/New_York";
      (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility({ timezone: facilityTimezone }));
      (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType({ maxConcurrent: 2, bufferTime: 30 }));

      // Use direct date-fns/tz
      const nineAM = toZonedTime(parseISO(`${wednesday}T09:00:00`), facilityTimezone);
      const elevenAM = toZonedTime(parseISO(`${wednesday}T11:00:00`), facilityTimezone);
      const testAppointments: TestAppointment[] = [ createAppointment(nineAM, elevenAM) ];

      const slots = await actualCalculateAvailabilitySlots(
        mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId, { testAppointments }
      );

      const affectedSlots = ["09:00", "09:30", "10:00", "10:30"];
      affectedSlots.forEach((time) => {
        const slot = slots.find((s) => s.time === time);
        expect(slot).toBeDefined();
        expect(slot?.remainingCapacity).toBe(1);
        expect(slot?.available).toBe(true);
      });

      const eightThirtySlot = slots.find((s) => s.time === "08:30");
      expect(eightThirtySlot?.remainingCapacity).toBe(2);

      const elevenThirtySlot = slots.find((s) => s.time === "11:30");
      expect(elevenThirtySlot?.remainingCapacity).toBe(2);
    });
  });

   it("handles errors from fetchRelevantAppointmentsForDay gracefully", async () => {
      const mockStorage = createMockStorage();
      const facilityId = 7; const tenantId = 5; const appointmentTypeId = 17; const wednesday = "2025-05-07";
      // ** Configure mocks directly **
      (mockStorage.getFacility as vi.Mock).mockResolvedValue(createFacility());
      (mockStorage.getAppointmentType as vi.Mock).mockResolvedValue(createAppointmentType());

      const fetchError = new Error("Database connection failed");
      // ** FIXED: Configure IMPORTED mock **
      mockedFetchRelevantAppointmentsForDay.mockRejectedValue(fetchError);

      // Act & Assert
      await expect(
          actualCalculateAvailabilitySlots(mockDb as any, mockStorage, wednesday, facilityId, appointmentTypeId, tenantId)
      ).rejects.toThrow("Failed to fetch existing appointments.");

      // ** FIXED: Check IMPORTED mock **
      expect(mockedFetchRelevantAppointmentsForDay).toHaveBeenCalledTimes(1);
  });

}); // End of main describe block