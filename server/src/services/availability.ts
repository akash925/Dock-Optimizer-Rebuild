import { and, eq, gt, lt, ne, notInArray, or } from 'drizzle-orm';
import { toZonedTime, format as tzFormat } from 'date-fns-tz';
import { getDay, parseISO, addDays } from 'date-fns';
import { db } from '../../db';
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { IStorage } from '../../storage';
import { schedules, docks, appointmentTypes, organizationFacilities } from '@shared/schema';

/**
 * Interface for availability time slots returned to clients
 */
export interface AvailabilitySlot {
  time: string;
  available: boolean;
  remainingCapacity: number;
  remaining: number; // For compatibility with older code
  reason: string;
  isBufferTime?: boolean;
}

/**
 * Fetches appointments for a specific facility and date with proper tenant isolation
 * @param db The Drizzle database instance
 * @param facilityId The facility ID to fetch appointments for
 * @param date The date in YYYY-MM-DD format
 * @param effectiveTenantId The tenant ID for isolation
 * @returns Promise resolving to an array of appointments with id, startTime, and endTime
 */
export async function fetchRelevantAppointmentsForDay(
  db: any, 
  facilityId: number, 
  date: string, 
  effectiveTenantId: number
): Promise<{ id: number; startTime: Date; endTime: Date; }[]> {
  // Calculate start and end of the requested day (in UTC)
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T00:00:00Z`);
  dayEnd.setDate(dayEnd.getDate() + 1); // Move to start of next day

  // Build and execute query with proper joins and filters
  return await db
    .select({
      id: schedules.id,
      startTime: schedules.startTime,
      endTime: schedules.endTime,
    })
    .from(schedules)
    .leftJoin(docks, eq(schedules.dockId, docks.id))
    .leftJoin(appointmentTypes, eq(schedules.appointmentTypeId, appointmentTypes.id))
    .leftJoin(organizationFacilities, eq(docks.facilityId, organizationFacilities.facilityId))
    .where(
      and(
        // Filter by facility
        eq(docks.facilityId, facilityId),
        
        // Filter schedules that overlap with the day
        lt(schedules.startTime, dayEnd),
        gt(schedules.endTime, dayStart),
        
        // Exclude cancelled and rejected appointments
        notInArray(schedules.status, ['cancelled', 'rejected']),
        
        // Apply tenant isolation - appointment must belong to this tenant via either:
        or(
          // The facility belongs to this tenant
          eq(organizationFacilities.organizationId, effectiveTenantId),
          
          // The appointment type belongs to this tenant
          eq(appointmentTypes.tenantId, effectiveTenantId)
        )
      )
    );
}

/**
 * Calculates available time slots for a specific date, facility, and appointment type
 * with proper timezone handling and tenant isolation
 */
export async function calculateAvailabilitySlots(
  db: any,
  storage: IStorage,
  date: string,
  facilityId: number,
  appointmentTypeId: number,
  effectiveTenantId: number
): Promise<AvailabilitySlot[]> {
  console.log(`[AvailabilityService] Starting calculation for date=${date}, facilityId=${facilityId}, appointmentTypeId=${appointmentTypeId}, tenantId=${effectiveTenantId}`);
  
  // 1. Fetch the facility with tenant isolation
  let facility = await storage.getFacility(facilityId, effectiveTenantId);
  if (!facility) {
    throw new Error('Facility not found or access denied.');
  }
  
  console.log(`[AvailabilityService] Facility found: ${facility.name}, timezone: ${facility.timezone}`);

  // 2. Fetch the appointment type with tenant isolation
  // Check if the storage implementation has a getAppointmentType method
  let appointmentType;
  
  try {
    // Always use the regular method which should exist on all storage implementations
    appointmentType = await storage.getAppointmentType(appointmentTypeId);
    
    // Manual tenant check if needed
    if (appointmentType && appointmentType.tenantId && appointmentType.tenantId !== effectiveTenantId) {
      console.log(`[AvailabilityService] Tenant mismatch: appointment type ${appointmentTypeId} belongs to tenant ${appointmentType.tenantId}, but request is for tenant ${effectiveTenantId}`);
      appointmentType = null;
    }
  } catch (error) {
    console.error('[AvailabilityService] Error fetching appointment type:', error);
    appointmentType = null;
  }
  
  if (!appointmentType) {
    throw new Error('Appointment type not found or access denied.');
  }

  // 3. Determine operating rules
  // Use facility timezone for all date/time calculations or fall back to Eastern Time
  const facilityTimezone = facility.timezone || 'America/New_York';
  
  // Convert date to the facility's timezone, then determine day of week (0=Sunday, 6=Saturday)
  // This ensures we're calculating the correct day in the facility's local time
  const dateObj = parseISO(`${date}T00:00:00Z`);
  const zonedDate = toZonedTime(dateObj, facilityTimezone);
  const dayOfWeek = getDay(zonedDate);
  
  console.log(`[AvailabilityService] Date ${date} in ${facilityTimezone} is day of week: ${dayOfWeek}`);
  
  // Using a direct type assertion to handle both snake_case and camelCase for facility and appointment type
  const facilityObj: any = facility;
  const appointmentTypeObj: any = appointmentType;
  
  // General helper function to get field value in either camelCase or snake_case format
  const getObjectField = (obj: any, camelCase: string, snakeCase: string, defaultValue: any = undefined): any => {
    // If snake_case version exists, use it, otherwise use camelCase version, or fallback to default
    return obj[snakeCase] !== undefined 
      ? obj[snakeCase] 
      : (obj[camelCase] !== undefined ? obj[camelCase] : defaultValue);
  };
  
  // Specific helper functions for facility and appointment type fields
  const getField = (camelCase: string, snakeCase: string, defaultValue: any = undefined): any => {
    return getObjectField(facilityObj, camelCase, snakeCase, defaultValue);
  };
  
  const getAppointmentTypeField = (camelCase: string, snakeCase: string, defaultValue: any = undefined): any => {
    return getObjectField(appointmentTypeObj, camelCase, snakeCase, defaultValue);
  };
  
  // Normalize appointment type fields that we'll use in the calculation
  const overrideFacilityHours = getAppointmentTypeField('overrideFacilityHours', 'override_facility_hours', false);
  const allowAppointmentsThroughBreaks = getAppointmentTypeField('allowAppointmentsThroughBreaks', 'allow_appointments_through_breaks', false);
  const appointmentTypeDuration = getAppointmentTypeField('duration', 'duration', 60); // Default to 60 minutes
  const appointmentTypeBufferTime = getAppointmentTypeField('bufferTime', 'buffer_time', 0); // Default to 0 minutes
  
  console.log(`[AvailabilityService] Appointment type settings: overrideFacilityHours=${overrideFacilityHours}, allowAppointmentsThroughBreaks=${allowAppointmentsThroughBreaks}, duration=${appointmentTypeDuration}, bufferTime=${appointmentTypeBufferTime}`);
  
  // Now when we need facility values, we'll use the appropriate accessor methods
  // For open/closed status
  const sundayIsOpen = getField('sundayOpen', 'sunday_open');
  const mondayIsOpen = getField('mondayOpen', 'monday_open');
  const tuesdayIsOpen = getField('tuesdayOpen', 'tuesday_open');
  const wednesdayIsOpen = getField('wednesdayOpen', 'wednesday_open');
  const thursdayIsOpen = getField('thursdayOpen', 'thursday_open');
  const fridayIsOpen = getField('fridayOpen', 'friday_open');
  const saturdayIsOpen = getField('saturdayOpen', 'saturday_open');
  
  console.log(`[AvailabilityService] Day status: Sunday=${sundayIsOpen}, Monday=${mondayIsOpen}, Tuesday=${tuesdayIsOpen}, Wednesday=${wednesdayIsOpen}, Thursday=${thursdayIsOpen}, Friday=${fridayIsOpen}, Saturday=${saturdayIsOpen}`);
  
  console.log(`[AvailabilityService] Day status (using normalized fields): Sunday=${facility.sundayOpen}, Monday=${facility.mondayOpen}, Tuesday=${facility.tuesdayOpen}, Wednesday=${facility.wednesdayOpen}, Thursday=${facility.thursdayOpen}, Friday=${facility.fridayOpen}, Saturday=${facility.saturdayOpen}`);
  
  // Initialize operating time variables
  let operatingStartTime = "09:00"; // Default value
  let operatingEndTime = "17:00";   // Default value
  let isOpen = false;               // Default closed
  
  // Check if appointment type overrides facility hours
  if (overrideFacilityHours) {
    // If override is enabled, use 24-hour availability
    operatingStartTime = "00:00";
    operatingEndTime = "23:59";
    isOpen = true;
  } else {
    // Otherwise, determine facility hours based on day of week
    switch (dayOfWeek) {
      case 0: // Sunday
        operatingStartTime = getField('sundayStart', 'sunday_start') || "09:00";
        operatingEndTime = getField('sundayEnd', 'sunday_end') || "17:00";
        isOpen = sundayIsOpen === true;
        break;
      case 1: // Monday
        operatingStartTime = getField('mondayStart', 'monday_start') || "09:00";
        operatingEndTime = getField('mondayEnd', 'monday_end') || "17:00";
        isOpen = mondayIsOpen === true;
        break;
      case 2: // Tuesday
        operatingStartTime = getField('tuesdayStart', 'tuesday_start') || "09:00";
        operatingEndTime = getField('tuesdayEnd', 'tuesday_end') || "17:00";
        isOpen = tuesdayIsOpen === true;
        break;
      case 3: // Wednesday
        operatingStartTime = getField('wednesdayStart', 'wednesday_start') || "09:00";
        operatingEndTime = getField('wednesdayEnd', 'wednesday_end') || "17:00";
        isOpen = wednesdayIsOpen === true;
        break;
      case 4: // Thursday
        operatingStartTime = getField('thursdayStart', 'thursday_start') || "09:00";
        operatingEndTime = getField('thursdayEnd', 'thursday_end') || "17:00";
        isOpen = thursdayIsOpen === true;
        break;
      case 5: // Friday
        operatingStartTime = getField('fridayStart', 'friday_start') || "09:00";
        operatingEndTime = getField('fridayEnd', 'friday_end') || "17:00";
        isOpen = fridayIsOpen === true;
        break;
      case 6: // Saturday
        operatingStartTime = getField('saturdayStart', 'saturday_start') || "09:00";
        operatingEndTime = getField('saturdayEnd', 'saturday_end') || "17:00";
        isOpen = saturdayIsOpen === true;
        break;
      default:
        // Fallback already set with defaults above
        break;
    }
  }
  
  // If facility is closed on this day, return empty array
  if (!isOpen) {
    console.log(`[AvailabilityService] Facility ${facility.name} is closed on ${date} (day of week: ${dayOfWeek})`);
    return [];
  }
  
  console.log(`[AvailabilityService] Facility ${facility.name} is open on ${date} with hours ${operatingStartTime} to ${operatingEndTime}`);
  
  // Calculate slot interval in minutes
  // Use appointment type buffer time if available, otherwise use duration
  // Ensure a minimum slot interval (15 minutes)
  const slotIntervalMinutes = Math.max(
    appointmentTypeBufferTime > 0 ? appointmentTypeBufferTime : appointmentTypeDuration,
    15
  );

  // 4. Calculate timezone-aware date boundaries
  // Start of day in facility's timezone (00:00:00)
  const dateForStart = parseISO(`${date}T00:00:00Z`);
  const zonedDateStart = toZonedTime(dateForStart, facilityTimezone);
  const dayStart = new Date(zonedDateStart);
  
  // Start of next day in facility's timezone (00:00:00 of day+1)
  const nextDate = addDays(parseISO(`${date}T00:00:00Z`), 1);
  const zonedNextDate = toZonedTime(nextDate, facilityTimezone);
  const dayEnd = new Date(zonedNextDate);
  
  // 5. Calculate time slots based on operating hours
  const result: AvailabilitySlot[] = [];
  
  // Parse operating hours into Date objects 
  const startHour = parseInt(operatingStartTime.split(':')[0], 10);
  const startMinute = parseInt(operatingStartTime.split(':')[1], 10);
  const endHour = parseInt(operatingEndTime.split(':')[0], 10);
  const endMinute = parseInt(operatingEndTime.split(':')[1], 10);
  
  // Create a copy of dayStart to use for slot calculation
  const slotTime = new Date(dayStart);
  slotTime.setHours(startHour, startMinute, 0, 0);
  
  // Create end time
  const operatingEnd = new Date(dayStart);
  operatingEnd.setHours(endHour, endMinute, 0, 0);
  
  // 6. Fetch existing appointments for this day that match our constraints
  // For easier testing, allow an optional parameter to override the appointments fetching
  let existingAppointments = [];
  
  // Normal DB fetching path
  if (!options?.testAppointments) {
    existingAppointments = await fetchRelevantAppointmentsForDay(
      db,
      facilityId,
      date,
      effectiveTenantId
    );
  } else {
    // Test path - use provided appointments list
    existingAppointments = options.testAppointments;
    console.log(`[AvailabilityService] Using ${existingAppointments.length} test appointments`);
  }
  
  // 7. Generate slots from start time to end time with slotIntervalMinutes spacing
  while (slotTime < operatingEnd) {
    const timeStr = tzFormat(slotTime, 'HH:mm', { timeZone: facilityTimezone });
    
    // Check if slot overlaps with existing appointments
    const conflictingAppts = existingAppointments.filter(appt => {
      const apptStart = new Date(appt.startTime);
      const apptEnd = new Date(appt.endTime);
      
      // Check if this slot time is within an existing appointment's time range
      return slotTime >= apptStart && slotTime < apptEnd;
    });
    
    // Get max slots per time slot from appointment type
    // Default to 1 if not specified
    const maxSlotsPerTime = getAppointmentTypeField('maxPerSlot', 'max_per_slot', 1);
    
    // Calculate end time for this slot (for break time overlap checks)
    const currentSlotEndTime = new Date(slotTime);
    currentSlotEndTime.setMinutes(currentSlotEndTime.getMinutes() + appointmentTypeDuration);
    
    // Create an availability slot with appropriate availability flag
    result.push({
      time: timeStr,
      available: conflictingAppts.length === 0,
      remainingCapacity: Math.max(0, maxSlotsPerTime - conflictingAppts.length),
      remaining: Math.max(0, maxSlotsPerTime - conflictingAppts.length), // Compatibility
      reason: conflictingAppts.length > 0 ? 'Slot already booked' : '',
      isBufferTime: false
    });
    
    // Determine break times for this day of the week
    let breakStartTimeStr = "";
    let breakEndTimeStr = "";
    
    switch (dayOfWeek) {
      case 0: // Sunday
        breakStartTimeStr = getField('sundayBreakStart', 'sunday_break_start') || "";
        breakEndTimeStr = getField('sundayBreakEnd', 'sunday_break_end') || "";
        break;
      case 1: // Monday
        breakStartTimeStr = getField('mondayBreakStart', 'monday_break_start') || "";
        breakEndTimeStr = getField('mondayBreakEnd', 'monday_break_end') || "";
        break;
      case 2: // Tuesday
        breakStartTimeStr = getField('tuesdayBreakStart', 'tuesday_break_start') || "";
        breakEndTimeStr = getField('tuesdayBreakEnd', 'tuesday_break_end') || "";
        break;
      case 3: // Wednesday
        breakStartTimeStr = getField('wednesdayBreakStart', 'wednesday_break_start') || "";
        breakEndTimeStr = getField('wednesdayBreakEnd', 'wednesday_break_end') || "";
        break;
      case 4: // Thursday
        breakStartTimeStr = getField('thursdayBreakStart', 'thursday_break_start') || "";
        breakEndTimeStr = getField('thursdayBreakEnd', 'thursday_break_end') || "";
        break;
      case 5: // Friday
        breakStartTimeStr = getField('fridayBreakStart', 'friday_break_start') || "";
        breakEndTimeStr = getField('fridayBreakEnd', 'friday_break_end') || "";
        break;
      case 6: // Saturday
        breakStartTimeStr = getField('saturdayBreakStart', 'saturday_break_start') || "";
        breakEndTimeStr = getField('saturdayBreakEnd', 'saturday_break_end') || "";
        break;
    }
    
    // If break times are defined, check if they affect this slot
    if (
      breakStartTimeStr && 
      breakEndTimeStr && 
      breakStartTimeStr.includes(':') && 
      breakEndTimeStr.includes(':')
    ) {
      console.log(`[AvailabilityService] Processing break time for slot ${timeStr}, break time: ${breakStartTimeStr}-${breakEndTimeStr}, allowAppointmentsThroughBreaks: ${allowAppointmentsThroughBreaks}`);
      try {
        // Create break time Date objects in the facility's timezone
        // Create start and end time objects for the current day in facility's local time
        const breakStartHour = parseInt(breakStartTimeStr.split(':')[0], 10);
        const breakStartMinute = parseInt(breakStartTimeStr.split(':')[1], 10);
        const breakStartDateTime = new Date(dayStart);
        breakStartDateTime.setHours(breakStartHour, breakStartMinute, 0, 0);
        
        const breakEndHour = parseInt(breakEndTimeStr.split(':')[0], 10);
        const breakEndMinute = parseInt(breakEndTimeStr.split(':')[1], 10);
        const breakEndDateTime = new Date(dayStart);
        breakEndDateTime.setHours(breakEndHour, breakEndMinute, 0, 0);
        
        // Check if current slot overlaps with break time
        // Overlap condition: currentSlotStartTime < breakEndDateTime && currentSlotEndTime > breakStartDateTime
        if (slotTime < breakEndDateTime && currentSlotEndTime > breakStartDateTime) {
          // Check if this appointment type allows appointments to span through breaks
          if (!allowAppointmentsThroughBreaks) {
            // Find the last added slot (which should be the one we just added)
            const lastIndex = result.length - 1;
            if (lastIndex >= 0) {
              const slot = result[lastIndex];
              
              // Update slot to mark it as unavailable due to break time
              slot.available = false;
              slot.remainingCapacity = 0;
              slot.remaining = 0;
              slot.reason = slot.reason ? `${slot.reason}, Break Time` : 'Break Time';
            }
          } else {
            // This appointment type allows spanning through breaks
            // We'll leave the slot as available, but add a note that it spans through a break
            console.log(`[AvailabilityService] Slot ${timeStr} spans through break time, but appointment type allows it`);
            const lastIndex = result.length - 1;
            if (lastIndex >= 0) {
              const slot = result[lastIndex];
              if (slot.available) {
                // Only add a note if the slot is already available
                slot.reason = 'Spans through break time';
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error processing break times for ${date}:`, error);
        // Continue execution even if break time processing fails
      }
    }
    
    // Move to next slot
    slotTime.setMinutes(slotTime.getMinutes() + slotIntervalMinutes);
  }
  
  return result;
}