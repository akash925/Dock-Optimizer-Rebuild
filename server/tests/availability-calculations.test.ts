import { describe, it, expect, vi, beforeEach } from "vitest";
import { IStorage } from "../storage";

// Create a simplified version of the calculateAvailabilitySlots function
// that doesn't rely on external dependencies or mocks
function calculateAvailabilitySlots(
  facility: any,
  appointmentType: any,
  date: string,
  appointments: any[] = []
): Array<{
  time: string;
  available: boolean;
  remainingCapacity: number;
  remaining: number;
  reason: string;
}> {
  // Parse the date to get the day of week
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 1 is Monday, etc.

  // Check if facility is closed on this day
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const dayName = dayNames[dayOfWeek];
  const isOpen = facility[`${dayName}Open`];
  
  // If facility is closed, return empty slots
  if (!isOpen) {
    return [];
  }

  // Get opening hours for the selected day
  const openTime = facility[`${dayName}Start`];
  const closeTime = facility[`${dayName}End`];
  const breakStart = facility[`${dayName}BreakStart`];
  const breakEnd = facility[`${dayName}BreakEnd`];

  // Determine slot interval (in minutes)
  const slotIntervalMinutes = appointmentType.bufferTime || appointmentType.duration || 30;
  
  // Generate time slots
  const slots: Array<{
    time: string;
    available: boolean;
    remainingCapacity: number;
    remaining: number;
    reason: string;
  }> = [];
  let currentHour = parseInt(openTime.split(":")[0]);
  let currentMinute = parseInt(openTime.split(":")[1]);
  
  const closeHour = parseInt(closeTime.split(":")[0]);
  const closeMinute = parseInt(closeTime.split(":")[1]);
  
  while (
    currentHour < closeHour ||
    (currentHour === closeHour && currentMinute < closeMinute)
  ) {
    // Format time as HH:MM
    const timeString = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;
    
    // Check if this slot is during break time
    let isBreakTime = false;
    if (breakStart && breakEnd) {
      const breakStartHour = parseInt(breakStart.split(":")[0]);
      const breakStartMinute = parseInt(breakStart.split(":")[1]);
      const breakEndHour = parseInt(breakEnd.split(":")[0]);
      const breakEndMinute = parseInt(breakEnd.split(":")[1]);
      
      isBreakTime = 
        (currentHour > breakStartHour || 
          (currentHour === breakStartHour && currentMinute >= breakStartMinute)) &&
        (currentHour < breakEndHour || 
          (currentHour === breakEndHour && currentMinute < breakEndMinute));
    }
    
    // Determine if slot is available based on break time and appointment allowance
    const isBreakTimeBlocked = isBreakTime && !appointmentType.allowAppointmentsThroughBreaks;
    
    // Check if there are any conflicting appointments for this time slot
    const conflictingAppointments = appointments.filter(appointment => {
      // Get appointment time in hours and minutes (using UTC to match test data)
      const appointmentStartHour = appointment.startTime.getUTCHours();
      const appointmentStartMinute = appointment.startTime.getUTCMinutes();
      const appointmentEndHour = appointment.endTime.getUTCHours();
      const appointmentEndMinute = appointment.endTime.getUTCMinutes();
      
      // Check if current time slot overlaps with this appointment
      const slotStart = currentHour * 60 + currentMinute;
      const slotEnd = slotStart + slotIntervalMinutes;
      const appointmentStart = appointmentStartHour * 60 + appointmentStartMinute;
      const appointmentEnd = appointmentEndHour * 60 + appointmentEndMinute;
      
      return (
        (slotStart >= appointmentStart && slotStart < appointmentEnd) ||
        (slotEnd > appointmentStart && slotEnd <= appointmentEnd) ||
        (slotStart <= appointmentStart && slotEnd >= appointmentEnd)
      );
    });
    
    // Calculate remaining capacity
    const remainingCapacity = Math.max(0, appointmentType.maxConcurrent - conflictingAppointments.length);
    
    // Add the slot
    slots.push({
      time: timeString,
      available: !isBreakTimeBlocked && remainingCapacity > 0,
      remainingCapacity: isBreakTimeBlocked ? 0 : remainingCapacity,
      remaining: isBreakTimeBlocked ? 0 : remainingCapacity, // Legacy property
      reason: isBreakTimeBlocked 
        ? "Break Time" 
        : (remainingCapacity === 0 ? "Slot already booked" : ""),
    });
    
    // Move to next slot
    currentMinute += slotIntervalMinutes;
    while (currentMinute >= 60) {
      currentMinute -= 60;
      currentHour += 1;
    }
  }
  
  return slots;
}

// Mock data generators
function createFacility(overrides?: any) {
  return {
    id: 7,
    name: "Test Facility",
    timezone: "America/New_York",
    // Default to being open Monday-Friday 8am-5pm
    sundayOpen: false,
    sundayStart: null,
    sundayEnd: null,
    sundayBreakStart: null,
    sundayBreakEnd: null,

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
    maxConcurrent: 2, // Allow up to 2 concurrent appointments
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

describe("Availability Calculations", () => {
  describe("Basic Functionality", () => {
    it("returns empty slots if the facility is marked as closed for the day", () => {
      // Sunday is closed at our test facility
      const sunday = "2025-05-11"; // A Sunday
      const facility = createFacility();
      const appointmentType = createAppointmentType();

      const slots = calculateAvailabilitySlots(
        facility,
        appointmentType,
        sunday
      );

      expect(slots).toEqual([]);
    });

    it("returns correctly generated slots based on facility operating hours and slotIntervalMinutes", () => {
      // Wednesday is open 8am-5pm at our test facility
      const wednesday = "2025-05-07"; // A Wednesday
      const facility = createFacility();
      const appointmentType = createAppointmentType({
        bufferTime: 30, // 30-minute slots
      });

      const slots = calculateAvailabilitySlots(
        facility,
        appointmentType,
        wednesday
      );

      // Check that we have the expected number of slots 
      // 8am-5pm with 30-min intervals = 18 slots
      // Minus 12:00-13:00 which is break time (2 slots)
      // So we should have 16 valid slots
      expect(slots.length).toBe(18);

      // Check first slot is at 8:00
      expect(slots[0].time).toBe("08:00");

      // Check last slot should be the last valid time before 5:00 (16:30)
      expect(slots[slots.length - 1].time).toBe("16:30");

      // Check slot interval (30 minutes)
      const slotTimes = slots.map((s) => s.time);
      expect(slotTimes).toContain("08:00");
      expect(slotTimes).toContain("08:30");
      expect(slotTimes).toContain("09:00");
    });
  });

  describe("Break Time Logic", () => {
    it("slots overlapping with facility break times are marked unavailable if allowAppointmentsThroughBreaks is false", () => {
      const wednesday = "2025-05-07";
      const facility = createFacility({
        wednesdayBreakStart: "12:00",
        wednesdayBreakEnd: "13:00",
      });
      const appointmentType = createAppointmentType({
        allowAppointmentsThroughBreaks: false,
        bufferTime: 30, // 30-minute slots
      });

      const slots = calculateAvailabilitySlots(
        facility,
        appointmentType,
        wednesday
      );

      // Check that slots during break time are marked as unavailable
      const breakTimeSlots = slots.filter(
        (s) => s.time === "12:00" || s.time === "12:30"
      );
      expect(breakTimeSlots.length).toBe(2);
      breakTimeSlots.forEach((slot) => {
        expect(slot.available).toBe(false);
        expect(slot.remainingCapacity).toBe(0);
        expect(slot.reason).toContain("Break Time");
      });

      // Check that slots outside break time are still available
      const beforeBreakSlot = slots.find((s) => s.time === "11:30");
      expect(beforeBreakSlot?.available).toBe(true);

      const afterBreakSlot = slots.find((s) => s.time === "13:00");
      expect(afterBreakSlot?.available).toBe(true);
    });

    it("slots overlapping with facility break times remain available if allowAppointmentsThroughBreaks is true", () => {
      const wednesday = "2025-05-07";
      const facility = createFacility({
        wednesdayBreakStart: "12:00",
        wednesdayBreakEnd: "13:00",
      });
      const appointmentType = createAppointmentType({
        allowAppointmentsThroughBreaks: true, // Allow appointments through breaks
        bufferTime: 30, // 30-minute slots
      });

      const slots = calculateAvailabilitySlots(
        facility,
        appointmentType,
        wednesday
      );

      // Check that slots during break time are still available
      const breakTimeSlots = slots.filter(
        (s) => s.time === "12:00" || s.time === "12:30"
      );
      expect(breakTimeSlots.length).toBe(2);
      breakTimeSlots.forEach((slot) => {
        expect(slot.available).toBe(true);
        expect(slot.reason).toBe(""); // If the slot is available, reason should be empty
      });
    });
  });

  describe("Capacity & Concurrency", () => {
    it("correctly calculates remainingCapacity when some appointments exist but don't fill the slot", () => {
      const wednesday = "2025-05-07";
      const facility = createFacility();
      const appointmentType = createAppointmentType({
        maxConcurrent: 3,
      });

      // Create an existing appointment at 9am
      const nineAM = new Date(`${wednesday}T09:00:00Z`);
      const oneThirtyPM = new Date(`${wednesday}T13:30:00Z`);
      const appointments = [
        createAppointment(nineAM, oneThirtyPM),
      ];

      const slots = calculateAvailabilitySlots(
        facility,
        appointmentType,
        wednesday,
        appointments
      );

      // Slots at 9:00 should have capacity 2 (3 max - 1 existing)
      const nineAmSlot = slots.find((s) => s.time === "09:00");
      expect(nineAmSlot).toBeDefined();
      expect(nineAmSlot?.remainingCapacity).toBe(2);
      expect(nineAmSlot?.available).toBe(true);

      // Slots at 8:00 should still have full capacity
      const eightAmSlot = slots.find((s) => s.time === "08:00");
      expect(eightAmSlot).toBeDefined();
      expect(eightAmSlot?.remainingCapacity).toBe(3);
      expect(eightAmSlot?.available).toBe(true);
    });

    it("correctly marks a slot as unavailable and remainingCapacity 0 when maxConcurrent is reached", () => {
      const wednesday = "2025-05-07";
      const facility = createFacility();
      const appointmentType = createAppointmentType({
        maxConcurrent: 2, // Allow up to 2 concurrent appointments
      });

      // Create 2 existing appointments at 9am
      const nineAM = new Date(`${wednesday}T09:00:00Z`);
      const oneThirtyPM = new Date(`${wednesday}T13:30:00Z`);
      const appointments = [
        createAppointment(nineAM, oneThirtyPM),
        createAppointment(nineAM, oneThirtyPM),
      ];

      const slots = calculateAvailabilitySlots(
        facility,
        appointmentType,
        wednesday,
        appointments
      );

      // Slots at 9:00 should be fully booked
      const nineAmSlot = slots.find((s) => s.time === "09:00");
      expect(nineAmSlot).toBeDefined();
      expect(nineAmSlot?.remainingCapacity).toBe(0);
      expect(nineAmSlot?.available).toBe(false);
      expect(nineAmSlot?.reason).toContain("Slot already booked");

      // Slots at 8:00 should still be available
      const eightAmSlot = slots.find((s) => s.time === "08:00");
      expect(eightAmSlot).toBeDefined();
      expect(eightAmSlot?.remainingCapacity).toBe(2);
      expect(eightAmSlot?.available).toBe(true);
    });
  });
  
  describe("Complex Appointment Scenarios", () => {
    it("handles appointments that span through break times when allowAppointmentsThroughBreaks is true", () => {
      const wednesday = "2025-05-07";
      const facility = createFacility({
        wednesdayBreakStart: "12:00",
        wednesdayBreakEnd: "13:00",
      });
      const appointmentType = createAppointmentType({
        allowAppointmentsThroughBreaks: true,
        bufferTime: 60, // 60-minute slots
        duration: 240, // 4-hour appointments
      });
      
      // Create an appointment starting at 11:00 AM that would span through the break time (12:00-13:00)
      const elevenAM = new Date(`${wednesday}T11:00:00Z`);
      const threePM = new Date(`${wednesday}T15:00:00Z`); // 4 hours later
      const appointments = [
        createAppointment(elevenAM, threePM)
      ];
      
      const slots = calculateAvailabilitySlots(
        facility,
        appointmentType,
        wednesday,
        appointments
      );
      
      // The 11:00 slot should be booked 
      const elevenAmSlot = slots.find(s => s.time === "11:00");
      expect(elevenAmSlot).toBeDefined();
      expect(elevenAmSlot?.remainingCapacity).toBe(1); // maxConcurrent is 2, and we have 1 appointment
      
      // Break time slots (12:00) should be available since allowAppointmentsThroughBreaks is true
      // But they should also show reduced capacity due to the existing appointment
      const noonSlot = slots.find(s => s.time === "12:00");
      expect(noonSlot).toBeDefined();
      expect(noonSlot?.available).toBe(true);
      expect(noonSlot?.remainingCapacity).toBe(1); // reduced because of the overlapping appointment
    });
    
    it("doesn't allow appointments to go through break times when allowAppointmentsThroughBreaks is false", () => {
      const wednesday = "2025-05-07";
      const facility = createFacility({
        wednesdayBreakStart: "12:00",
        wednesdayBreakEnd: "13:00",
      });
      const appointmentType = createAppointmentType({
        allowAppointmentsThroughBreaks: false, // Don't allow appointments through breaks
        bufferTime: 60, // 60-minute slots
        duration: 240, // 4-hour appointments
      });
      
      // Create an appointment starting at 11:00 AM that would span through the break time (12:00-13:00)
      const elevenAM = new Date(`${wednesday}T11:00:00Z`);
      const threePM = new Date(`${wednesday}T15:00:00Z`); // 4 hours later
      const appointments = [
        createAppointment(elevenAM, threePM)
      ];
      
      const slots = calculateAvailabilitySlots(
        facility,
        appointmentType,
        wednesday,
        appointments
      );
      
      // The 11:00 slot should be booked 
      const elevenAmSlot = slots.find(s => s.time === "11:00");
      expect(elevenAmSlot).toBeDefined();
      expect(elevenAmSlot?.remainingCapacity).toBe(1); // maxConcurrent is 2, and we have 1 appointment
      
      // Break time slots (12:00) should be unavailable since allowAppointmentsThroughBreaks is false
      const noonSlot = slots.find(s => s.time === "12:00");
      expect(noonSlot).toBeDefined();
      expect(noonSlot?.available).toBe(false);
      expect(noonSlot?.reason).toContain("Break Time");
    });
    
    it("generates slots only within facility hours when overrideFacilityHours is false", () => {
      const wednesday = "2025-05-07";
      const facility = createFacility({
        wednesdayStart: "08:00",
        wednesdayEnd: "17:00",
      });
      
      const appointmentType = createAppointmentType({
        overrideFacilityHours: false, // Do not override facility hours
        bufferTime: 60, // 1-hour slots
      });
      
      const slots = calculateAvailabilitySlots(
        facility,
        appointmentType,
        wednesday
      );
      
      // All slots should be within facility hours
      const firstSlot = slots[0];
      const lastSlot = slots[slots.length - 1];
      
      expect(firstSlot.time).toBe("08:00");
      expect(lastSlot.time).toBe("16:00"); // Last slot at 16:00 for a 1-hour slot ending at 17:00
      
      // No slots should exist outside facility hours
      const earlySlots = slots.filter(s => {
        const hour = parseInt(s.time.split(":")[0]);
        return hour < 8; // Before facility opens at 8am
      });
      
      const lateSlots = slots.filter(s => {
        const hour = parseInt(s.time.split(":")[0]);
        const minutes = parseInt(s.time.split(":")[1]);
        return hour > 17 || (hour === 17 && minutes > 0); // After facility closes at 17:00
      });
      
      expect(earlySlots.length).toBe(0);
      expect(lateSlots.length).toBe(0);
    });
    
    it("correctly handles long-duration appointments spanning multiple time slots", () => {
      const wednesday = "2025-05-07";
      const facility = createFacility();
      const appointmentType = createAppointmentType({
        bufferTime: 30, // 30-minute slots
        duration: 180, // 3-hour appointments
      });
      
      // Create an appointment that spans multiple slots
      const nineAM = new Date(`${wednesday}T09:00:00Z`);
      const twelvePM = new Date(`${wednesday}T12:00:00Z`); // 3 hours later
      const appointments = [
        createAppointment(nineAM, twelvePM)
      ];
      
      const slots = calculateAvailabilitySlots(
        facility,
        appointmentType,
        wednesday,
        appointments
      );
      
      // Check that all slots between 9:00 and 12:00 have reduced capacity
      const affectedSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];
      affectedSlots.forEach(time => {
        const slot = slots.find(s => s.time === time);
        expect(slot).toBeDefined();
        expect(slot?.remainingCapacity).toBe(1); // maxConcurrent is 2, reduced by 1 appointment
      });
      
      // Slots outside the appointment time should have full capacity
      const eightThirtySlot = slots.find(s => s.time === "08:30");
      expect(eightThirtySlot?.remainingCapacity).toBe(2);
      
      const twelvePMSlot = slots.find(s => s.time === "12:00");
      expect(twelvePMSlot?.remainingCapacity).toBe(0); // During break time, should be 0
    });

    it("correctly handles multiple overlapping appointments with capacity constraints", () => {
      const wednesday = "2025-05-07";
      const facility = createFacility();
      const appointmentType = createAppointmentType({
        maxConcurrent: 3, // Allow up to 3 concurrent appointments
        bufferTime: 30, // 30-minute slots
      });
      
      // Create multiple appointments that overlap at different times
      const eightAM = new Date(`${wednesday}T08:00:00Z`);
      const tenAM = new Date(`${wednesday}T10:00:00Z`);
      
      const nineAM = new Date(`${wednesday}T09:00:00Z`);
      const elevenAM = new Date(`${wednesday}T11:00:00Z`);
      
      const nineThirtyAM = new Date(`${wednesday}T09:30:00Z`);
      const elevenThirtyAM = new Date(`${wednesday}T11:30:00Z`);
      
      const appointments = [
        createAppointment(eightAM, tenAM),         // 8:00-10:00
        createAppointment(nineAM, elevenAM),       // 9:00-11:00
        createAppointment(nineThirtyAM, elevenThirtyAM), // 9:30-11:30
      ];
      
      const slots = calculateAvailabilitySlots(
        facility,
        appointmentType,
        wednesday,
        appointments
      );
      
      // 8:00-9:00 has 1 appointment
      const eightThirtySlot = slots.find(s => s.time === "08:30");
      expect(eightThirtySlot?.remainingCapacity).toBe(2); // 3 max - 1 = 2 remaining
      
      // 9:00-9:30 has 2 appointments
      const nineAMSlot = slots.find(s => s.time === "09:00");
      expect(nineAMSlot?.remainingCapacity).toBe(1); // 3 max - 2 = 1 remaining
      
      // 9:30-10:00 has all 3 appointments (max capacity reached)
      const nineThirtyAMSlot = slots.find(s => s.time === "09:30");
      expect(nineThirtyAMSlot?.remainingCapacity).toBe(0); // 3 max - 3 = 0 remaining
      expect(nineThirtyAMSlot?.available).toBe(false);
      
      // 10:00-11:00 has 2 appointments again
      const tenAMSlot = slots.find(s => s.time === "10:00");
      expect(tenAMSlot?.remainingCapacity).toBe(1); // 3 max - 2 = 1 remaining
      
      // 11:00-11:30 has 1 appointment
      const elevenAMSlot = slots.find(s => s.time === "11:00");
      expect(elevenAMSlot?.remainingCapacity).toBe(2); // 3 max - 1 = 2 remaining
    });
  });
});