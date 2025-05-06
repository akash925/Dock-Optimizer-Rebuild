import { and, eq, gt, lt, ne, notInArray, or } from 'drizzle-orm';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { getDay } from 'date-fns';
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
  const appointmentType = await storage.getAppointmentType(appointmentTypeId, effectiveTenantId);
  if (!appointmentType) {
    throw new Error('Appointment type not found or access denied.');
  }

  // 3. Determine operating rules
  // Use facility timezone for all date/time calculations or fall back to Eastern Time
  const facilityTimezone = facility.timezone || 'America/New_York';
  
  // Convert date to the facility's timezone, then determine day of week (0=Sunday, 6=Saturday)
  // This ensures we're calculating the correct day in the facility's local time
  const zonedDate = utcToZonedTime(`${date}T00:00:00Z`, facilityTimezone);
  const dayOfWeek = getDay(zonedDate);
  
  // Initialize operating time variables
  let operatingStartTime: string;
  let operatingEndTime: string;
  let isOpen: boolean;
  
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
        operatingStartTime = facility.sundayStart;
        operatingEndTime = facility.sundayEnd;
        isOpen = facility.sundayOpen;
        break;
      case 1: // Monday
        operatingStartTime = facility.mondayStart;
        operatingEndTime = facility.mondayEnd;
        isOpen = facility.mondayOpen;
        break;
      case 2: // Tuesday
        operatingStartTime = facility.tuesdayStart;
        operatingEndTime = facility.tuesdayEnd;
        isOpen = facility.tuesdayOpen;
        break;
      case 3: // Wednesday
        operatingStartTime = facility.wednesdayStart;
        operatingEndTime = facility.wednesdayEnd;
        isOpen = facility.wednesdayOpen;
        break;
      case 4: // Thursday
        operatingStartTime = facility.thursdayStart;
        operatingEndTime = facility.thursdayEnd;
        isOpen = facility.thursdayOpen;
        break;
      case 5: // Friday
        operatingStartTime = facility.fridayStart;
        operatingEndTime = facility.fridayEnd;
        isOpen = facility.fridayOpen;
        break;
      case 6: // Saturday
        operatingStartTime = facility.saturdayStart;
        operatingEndTime = facility.saturdayEnd;
        isOpen = facility.saturdayOpen;
        break;
      default:
        // Fallback (should never happen)
        operatingStartTime = "09:00";
        operatingEndTime = "17:00";
        isOpen = false;
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
  const dayStart = zonedTimeToUtc(`${date}T00:00:00`, facilityTimezone);
  
  // Start of next day in facility's timezone (00:00:00 of day+1)
  // First create date string for next day by adding 1 to current date
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDateStr = nextDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  const dayEnd = zonedTimeToUtc(`${nextDateStr}T00:00:00`, facilityTimezone);
  
  // The function will need to continue with fetching existing appointments and generating slots
  // This implementation will be completed in a future update
  
  // For now, return an empty array as a placeholder
  return [];
}