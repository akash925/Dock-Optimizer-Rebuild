import { and, eq, gt, lt, ne, notInArray, or } from 'drizzle-orm';
import { toZonedTime, format as tzFormat } from 'date-fns-tz';
import { getDay, parseISO, addDays } from 'date-fns';
import { db } from '../../db';
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
  // 1. Fetch the facility with tenant isolation
  const facility = await storage.getFacility(facilityId, effectiveTenantId);
  if (!facility) {
    throw new Error('Facility not found or access denied.');
  }

  // 2. Fetch the appointment type with tenant isolation
  // Check storage implementation to see if it expects a second parameter for tenant isolation
  // and adjust accordingly
  let appointmentType;
  try {
    // Try with tenant isolation (newer implementation)
    appointmentType = await storage.getAppointmentType(appointmentTypeId, effectiveTenantId);
  } catch (error) {
    // If that fails, try without tenant parameter (older implementation)
    appointmentType = await storage.getAppointmentType(appointmentTypeId);
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
  
  // Initialize operating time variables
  let operatingStartTime = "09:00"; // Default value
  let operatingEndTime = "17:00";   // Default value
  let isOpen = false;               // Default closed
  
  // Check if appointment type overrides facility hours
  if (appointmentType.overrideFacilityHours) {
    // If override is enabled, use 24-hour availability
    operatingStartTime = "00:00";
    operatingEndTime = "23:59";
    isOpen = true;
  } else {
    // Otherwise, determine facility hours based on day of week
    switch (dayOfWeek) {
      case 0: // Sunday
        operatingStartTime = facility.sundayStart || "09:00";
        operatingEndTime = facility.sundayEnd || "17:00";
        isOpen = facility.sundayOpen === true;
        break;
      case 1: // Monday
        operatingStartTime = facility.mondayStart || "09:00";
        operatingEndTime = facility.mondayEnd || "17:00";
        isOpen = facility.mondayOpen === true;
        break;
      case 2: // Tuesday
        operatingStartTime = facility.tuesdayStart || "09:00";
        operatingEndTime = facility.tuesdayEnd || "17:00";
        isOpen = facility.tuesdayOpen === true;
        break;
      case 3: // Wednesday
        operatingStartTime = facility.wednesdayStart || "09:00";
        operatingEndTime = facility.wednesdayEnd || "17:00";
        isOpen = facility.wednesdayOpen === true;
        break;
      case 4: // Thursday
        operatingStartTime = facility.thursdayStart || "09:00";
        operatingEndTime = facility.thursdayEnd || "17:00";
        isOpen = facility.thursdayOpen === true;
        break;
      case 5: // Friday
        operatingStartTime = facility.fridayStart || "09:00";
        operatingEndTime = facility.fridayEnd || "17:00";
        isOpen = facility.fridayOpen === true;
        break;
      case 6: // Saturday
        operatingStartTime = facility.saturdayStart || "09:00";
        operatingEndTime = facility.saturdayEnd || "17:00";
        isOpen = facility.saturdayOpen === true;
        break;
      default:
        // Fallback already set with defaults above
        break;
    }
  }
  
  // If facility is closed on this day, return empty array
  if (!isOpen) {
    return [];
  }
  
  // Calculate slot interval in minutes
  // Use appointment type buffer time if available, otherwise use duration
  // Ensure a minimum slot interval (15 minutes)
  const slotIntervalMinutes = Math.max(
    appointmentType.bufferTime > 0 ? appointmentType.bufferTime : appointmentType.duration,
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
  const existingAppointments = await fetchRelevantAppointmentsForDay(
    db,
    facilityId,
    date,
    effectiveTenantId
  );
  
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
    
    // Create an availability slot with appropriate availability flag
    result.push({
      time: timeStr,
      available: conflictingAppts.length === 0,
      remainingCapacity: Math.max(0, appointmentType.maxPerSlot - conflictingAppts.length),
      remaining: Math.max(0, appointmentType.maxPerSlot - conflictingAppts.length), // Compatibility
      reason: conflictingAppts.length > 0 ? 'Slot already booked' : '',
      isBufferTime: false
    });
    
    // Move to next slot
    slotTime.setMinutes(slotTime.getMinutes() + slotIntervalMinutes);
  }
  
  return result;
}