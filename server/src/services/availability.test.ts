import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseISO } from "date-fns";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { calculateAvailabilitySlots, AvailabilityOptions } from "./availability";

const mockDb = {} as PostgresJsDatabase<any>;

function createMockStorage() {
  const facilities = new Map();
  const appointmentTypes = new Map();

  return {
    getFacility: vi.fn(async (facilityId: number, tenantId: number) => {
      return facilities.get(`${facilityId}_${tenantId}`);
    }),
    getAppointmentType: vi.fn(async (appointmentTypeId: number) => {
      return appointmentTypes.get(appointmentTypeId);
    }),
    _setFacility: (facilityId: number, tenantId: number, data: any) => {
      facilities.set(`${facilityId}_${tenantId}`, data);
    },
    _setAppointmentType: (appointmentTypeId: number, data: any) => {
      appointmentTypes.set(appointmentTypeId, data);
    },
  };
}

const facilityId = 7;
const tenantId = 5;
const appointmentTypeId = 17;
const date = "2025-05-07"; // Wednesday

describe("calculateAvailabilitySlots", () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();

    storage._setFacility(facilityId, tenantId, {
      id: facilityId,
      name: "Test Facility",
      timezone: "America/New_York",
      wednesday_open: true,
      wednesday_start: "08:00",
      wednesday_end: "17:00",
      wednesday_break_start: "12:00",
      wednesday_break_end: "13:00",
    });

    storage._setAppointmentType(appointmentTypeId, {
      id: appointmentTypeId,
      duration: 60,
      buffer_time: 0,
      max_concurrent: 2,
      allow_appointments_through_breaks: false,
      tenantId,
    });
  });

  it("generates slots within facility hours", async () => {
    const slots = await calculateAvailabilitySlots(
      mockDb,
      storage,
      date,
      facilityId,
      appointmentTypeId,
      tenantId,
      { testAppointments: [] },
    );

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].time).toBe("08:00");
    expect(slots[slots.length - 1].time).toBe("16:00");
  });

  it("respects break times correctly", async () => {
    const slots = await calculateAvailabilitySlots(
      mockDb,
      storage,
      date,
      facilityId,
      appointmentTypeId,
      tenantId,
      { testAppointments: [] },
    );

    const noonSlot = slots.find((s) => s.time === "12:00");
    expect(noonSlot).toBeDefined();
    expect(noonSlot?.available).toBe(false);
    expect(noonSlot?.reason).toContain("Break Time");
  });

  it("handles tenant mismatch correctly", async () => {
    await expect(
      calculateAvailabilitySlots(
        mockDb,
        storage,
        date,
        facilityId,
        appointmentTypeId,
        999, // wrong tenant
        { testAppointments: [] },
      ),
    ).rejects.toThrow("Facility not found or access denied");
  });
});
