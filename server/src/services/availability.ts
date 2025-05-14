import { and, eq, gt, gte, lt, lte, ne, notInArray, or } from 'drizzle-orm';
import { toZonedTime, format as tzFormat } from 'date-fns-tz';
import { getDay, parseISO, addDays, format, addMinutes, isEqual, isAfter, parse, differenceInCalendarDays } from 'date-fns';
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { IStorage } from '../../storage';
import { schedules, docks, appointmentTypes, organizationFacilities } from '@shared/schema';

// Use your actual Drizzle instance type if available
type DrizzleDBInstance = PostgresJsDatabase<typeof import("@shared/schema")>;

export interface AvailabilitySlot {
  time: string;
  available: boolean;
  remainingCapacity: number;
  remaining: number;
  reason: string;
}

export interface AvailabilityOptions {
  testAppointments?: { id: number; startTime: Date; endTime: Date; }[];
}

export interface SchedulingConfig {
  intervalMinutes: number;        // e.g. 30
  bookingBufferMinutes: number;  // e.g. 60 (no same-hour bookings)
  maxAdvanceDays: number;        // e.g. 30
}

export const defaultConfig: SchedulingConfig = {
  intervalMinutes: 30,
  bookingBufferMinutes: 60,
  maxAdvanceDays: 30,
};

export interface DayHours {
  open: boolean;
  start: string;
  end: string;
  breakStart?: string;
  breakEnd?: string;
}

export interface AvailabilityContext {
  orgHours: Record<string, DayHours>;
  facilityHours?: Record<string, DayHours>;
  facilityOverrides: boolean;
}

export async function fetchRelevantAppointmentsForDay(
  db: DrizzleDBInstance,
  facilityId: number,
  dayStart: Date, // Start of day in facility TZ (represented as UTC Date obj)
  dayEnd: Date,   // Start of NEXT day in facility TZ (represented as UTC Date obj)
  effectiveTenantId: number
): Promise<{ id: number; startTime: Date; endTime: Date; }[]> {

  console.log(`[fetchRelevantAppointmentsForDay] Fetching for facility ${facilityId}, tenant ${effectiveTenantId}, between ${dayStart.toISOString()} and ${dayEnd.toISOString()}`);
  try {
    // ** Ensure db object is valid and has expected methods **
    if (!db || typeof db.select !== 'function') {
        console.error('[fetchRelevantAppointmentsForDay] Invalid DB object passed:', db);
        throw new Error('Invalid database connection object provided.');
    }
    const query = db
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
          ne(schedules.dockId, null),
          eq(docks.facilityId, facilityId),
          lt(schedules.startTime, dayEnd),
          gt(schedules.endTime, dayStart),
          notInArray(schedules.status, ['cancelled', 'rejected']),
          or(
            eq(organizationFacilities.organizationId, effectiveTenantId),
            eq(appointmentTypes.tenantId, effectiveTenantId)
          )
        )
      );

     // ** Check if execute exists before calling, otherwise assume awaitable **
     const relevantSchedules = typeof (query as any).execute === 'function'
        ? await (query as any).execute()
        : await query;

    console.log(`[fetchRelevantAppointmentsForDay] Found ${relevantSchedules?.length ?? 0} relevant appointments.`);
    return Array.isArray(relevantSchedules) ? relevantSchedules : [];
  } catch (error) {
    console.error(`[fetchRelevantAppointmentsForDay] Error fetching appointments:`, error);
    // ** Propagate error correctly **
    throw new Error(`Failed to fetch existing appointments. Original error: ${error instanceof Error ? error.message : String(error)}`);
  }
}


export function getEffectiveHours(day: string, ctx: AvailabilityContext): DayHours | null {
  if (ctx.facilityOverrides && ctx.facilityHours?.[day]?.open) {
    return ctx.facilityHours[day];
  }
  if (ctx.orgHours?.[day]?.open) {
    return ctx.orgHours[day];
  }
  return null;
}

export function generateTimeSlots(
  hours: DayHours,
  baseDate: Date,
  config: SchedulingConfig
): string[] {
  const slots: string[] = [];
  const start = parse(hours.start, 'HH:mm', baseDate);
  const end = parse(hours.end, 'HH:mm', baseDate);
  const breakStart = hours.breakStart ? parse(hours.breakStart, 'HH:mm', baseDate) : null;
  const breakEnd = hours.breakEnd ? parse(hours.breakEnd, 'HH:mm', baseDate) : null;

  const bufferCutoff = addMinutes(new Date(), config.bookingBufferMinutes);

  let current = start;
  while (!isAfter(current, end)) {
    const inBreak = breakStart && breakEnd && current >= breakStart && current < breakEnd;
    const afterBuffer = isAfter(current, bufferCutoff);
    if (!inBreak && afterBuffer) {
      slots.push(format(current, 'HH:mm'));
    }
    current = addMinutes(current, config.intervalMinutes);
  }

  return slots;
}

export function getAvailableTimeSlotsForDay(
  date: Date,
  ctx: AvailabilityContext,
  config?: Partial<SchedulingConfig>
): string[] {
  const day = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const mergedConfig = { ...defaultConfig, ...config };

  const today = new Date();
  if (differenceInCalendarDays(date, today) > mergedConfig.maxAdvanceDays) return [];

  const hours = getEffectiveHours(day, ctx);
  if (!hours) return [];

  return generateTimeSlots(hours, date, mergedConfig);
}

export async function calculateAvailabilitySlots(
  db: DrizzleDBInstance,
  storage: IStorage,
  date: string, // YYYY-MM-DD
  facilityId: number,
  appointmentTypeId: number,
  effectiveTenantId: number,
  options?: AvailabilityOptions,
  config?: Partial<SchedulingConfig>
): Promise<AvailabilitySlot[]> {

  console.log(`[AvailabilityService] Starting calculation for date=${date}, facilityId=${facilityId}, appointmentTypeId=${appointmentTypeId}, tenantId=${effectiveTenantId}`);

  // Apply configuration settings with defaults
  const mergedConfig = { ...defaultConfig, ...config };
  console.log(`[AvailabilityService] Using config: interval=${mergedConfig.intervalMinutes}min, buffer=${mergedConfig.bookingBufferMinutes}min, maxAdvance=${mergedConfig.maxAdvanceDays} days`);

  const facility = await storage.getFacility(facilityId, effectiveTenantId);
  if (!facility) { throw new Error('Facility not found or access denied.'); }
  console.log(`[AvailabilityService] Facility found: ${facility.name}, timezone: ${facility.timezone}`);

  const appointmentType = await storage.getAppointmentType(appointmentTypeId);
  if (!appointmentType) { throw new Error('Appointment type not found or access denied.'); }
  if (appointmentType.tenantId && appointmentType.tenantId !== effectiveTenantId) {
       console.log(`[AvailabilityService] Tenant mismatch for appointment type ${appointmentTypeId}`);
       throw new Error('Appointment type not found or access denied.');
  }

  const facilityTimezone = facility.timezone || 'America/New_York';
  const zonedDate = toZonedTime(parseISO(`${date}T00:00:00`), facilityTimezone);
  const dayOfWeek = getDay(zonedDate);
  console.log(`[AvailabilityService] Date ${date} in ${facilityTimezone} is day of week: ${dayOfWeek}`);

  const getObjectField = (obj: any, camelCase: string, snakeCase: string, defaultValue: any = undefined): any => obj?.[snakeCase] ?? obj?.[camelCase] ?? defaultValue;
  const getFacilityField = (camelCase: string, snakeCase: string, defaultValue: any = undefined): any => getObjectField(facility, camelCase, snakeCase, defaultValue);
  const getAppTypeField = (camelCase: string, snakeCase: string, defaultValue: any = undefined): any => getObjectField(appointmentType, camelCase, snakeCase, defaultValue);

  const overrideFacilityHours = getAppTypeField('overrideFacilityHours', 'override_facility_hours', false);
  const allowAppointmentsThroughBreaks = getAppTypeField('allowAppointmentsThroughBreaks', 'allow_appointments_through_breaks', false);
  const appointmentTypeDuration = getAppTypeField('duration', 'duration', 60);
  const appointmentTypeBufferTime = getAppTypeField('bufferTime', 'buffer_time', 0);
  const maxConcurrent = getAppTypeField('maxConcurrent', 'max_concurrent', 1);

  console.log(`[AvailabilityService] Settings: overrideHours=${overrideFacilityHours}, allowThroughBreaks=${allowAppointmentsThroughBreaks}, duration=${appointmentTypeDuration}, bufferTime=${appointmentTypeBufferTime}, maxConcurrent=${maxConcurrent}`);

  // Build hours context
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayKey = dayKeys[dayOfWeek];
  
  // Get organization hours
  const organization = await storage.getOrganizationByFacilityId(facilityId);
  if (!organization) {
    throw new Error('Organization not found for this facility');
  }
  
  // Build the organization hours record from DB
  const orgHours: Record<string, DayHours> = {};
  
  for (const day of dayKeys) {
    const isOpen = getFacilityField(`${day}Open`, `${day}_open`) === true;
    orgHours[day] = {
      open: isOpen,
      start: getFacilityField(`${day}Start`, `${day}_start`) || "09:00",
      end: getFacilityField(`${day}End`, `${day}_end`) || "17:00",
      breakStart: getFacilityField(`${day}BreakStart`, `${day}_break_start`, ""),
      breakEnd: getFacilityField(`${day}BreakEnd`, `${day}_break_end`, ""),
    };
  }
  
  // Create availability context
  const availabilityContext: AvailabilityContext = {
    orgHours,
    facilityOverrides: overrideFacilityHours
  };
  
  // Check if facility is open on this day
  const effectiveHours = getEffectiveHours(dayKey, availabilityContext);
  if (!effectiveHours || !effectiveHours.open) {
    console.log(`[AvailabilityService] Facility ${facility.name} closed on ${date} (DoW: ${dayOfWeek})`);
    return [];
  }
  
  const operatingStartTimeStr = effectiveHours.start;
  const operatingEndTimeStr = effectiveHours.end;
  const breakStartTimeStr = effectiveHours.breakStart || "";
  const breakEndTimeStr = effectiveHours.breakEnd || "";
  
  console.log(`[AvailabilityService] Facility ${facility.name} open on ${date} (${dayOfWeek}) ${operatingStartTimeStr} - ${operatingEndTimeStr}`);

  const dayStart = toZonedTime(parseISO(`${date}T00:00:00`), facilityTimezone);
  const nextDateStr = format(addDays(parseISO(date), 1), 'yyyy-MM-dd');
  const dayEnd = toZonedTime(parseISO(`${nextDateStr}T00:00:00`), facilityTimezone);

  let existingAppointments: { id: number; startTime: Date; endTime: Date; }[] = [];
  try {
      if (options?.testAppointments == null) {
          existingAppointments = await fetchRelevantAppointmentsForDay(db, facilityId, dayStart, dayEnd, effectiveTenantId);
      } else {
          existingAppointments = options.testAppointments;
          console.log(`[AvailabilityService] Using ${existingAppointments.length} test appointments`);
      }
  } catch (fetchError) {
       // ** FIXED: Catch and re-throw specific error **
       console.error("[AvailabilityService] Error calling fetchRelevantAppointmentsForDay:", fetchError);
       throw new Error(`Failed to fetch existing appointments.`); // Throw consistent error message
  }


  const result: AvailabilitySlot[] = [];
  
  // Use interval from config with fallback to appointment type settings
  const slotIntervalMinutes = mergedConfig.intervalMinutes || Math.max(
    appointmentTypeBufferTime > 0 ? appointmentTypeBufferTime : appointmentTypeDuration, 15
  );

  const operatingStartDateTime = toZonedTime(parseISO(`${date}T${operatingStartTimeStr}`), facilityTimezone);
  let operatingEndDateTime = toZonedTime(parseISO(`${date}T${operatingEndTimeStr}`), facilityTimezone);

  // Adjust end time for loop comparison
  if (operatingEndTimeStr === "23:59") {
      operatingEndDateTime = dayEnd; // Use start of next day as exclusive upper bound
  } else if (operatingEndDateTime <= operatingStartDateTime) {
      operatingEndDateTime = addDays(operatingEndDateTime, 1);
  }

  let breakStartDateTime: Date | null = null;
  let breakEndDateTime: Date | null = null;
  // Only process break times when both are properly defined with non-empty strings
  if (breakStartTimeStr && breakEndTimeStr && 
      breakStartTimeStr.trim() !== "" && breakEndTimeStr.trim() !== "" && 
      breakStartTimeStr.includes(':') && breakEndTimeStr.includes(':')) {
      try {
          breakStartDateTime = toZonedTime(parseISO(`${date}T${breakStartTimeStr}`), facilityTimezone);
          breakEndDateTime = toZonedTime(parseISO(`${date}T${breakEndTimeStr}`), facilityTimezone);
          if (breakEndDateTime <= breakStartDateTime) { breakEndDateTime = addDays(breakEndDateTime, 1); }
          console.log(`[AvailabilityService] Break time for ${date}: ${breakStartDateTime.toISOString()} to ${breakEndDateTime.toISOString()}`);
      } catch (e) { 
          console.error(`[AvailabilityService] Error parsing break times: ${breakStartTimeStr} - ${breakEndTimeStr}`, e); 
          // Reset to null if parsing failed
          breakStartDateTime = null;
          breakEndDateTime = null;
      }
  } else {
      console.log(`[AvailabilityService] No valid break times configured for ${date}: "${breakStartTimeStr}" - "${breakEndTimeStr}"`);
  }

  // Apply booking buffer time (don't show slots too close to current time)
  const bufferCutoff = addMinutes(new Date(), mergedConfig.bookingBufferMinutes);
  console.log(`[AvailabilityService] Buffer cutoff: ${bufferCutoff.toISOString()}`);

  let currentSlotStartTime = new Date(operatingStartDateTime);

  while (currentSlotStartTime < operatingEndDateTime) {
    const currentSlotEndTime = addMinutes(currentSlotStartTime, appointmentTypeDuration);

    // Early slot end check
    if (currentSlotEndTime > operatingEndDateTime) {
         console.log(`[AvailabilityService] Slot starting at ${tzFormat(currentSlotStartTime, 'HH:mm', { timeZone: facilityTimezone })} ends after operating end ${operatingEndTimeStr}. Stopping.`);
         break;
    }

    let isSlotAvailable = true;
    let reason = "";
    let conflictingApptsCount = 0;

    // Apply booking buffer - don't allow slots that start too soon
    if (currentSlotStartTime < bufferCutoff) {
        isSlotAvailable = false;
        reason = "Too soon to book";
    }

    // Check for conflicts with existing appointments
    if (isSlotAvailable && existingAppointments && existingAppointments.length > 0) {
        conflictingApptsCount = existingAppointments.filter((appt) => {
            const apptStart = appt.startTime.getTime();
            const apptEnd = appt.endTime.getTime();
            const slotStart = currentSlotStartTime.getTime();
            const slotEnd = currentSlotEndTime.getTime();
            return apptStart < slotEnd && apptEnd > slotStart;
        }).length;
    }

    // Check capacity
    const currentCapacity = maxConcurrent - conflictingApptsCount;
    if (isSlotAvailable && currentCapacity <= 0) {
        isSlotAvailable = false;
        reason = "Capacity full";
    }

    // Check break time - only apply if valid break times are configured
    if (isSlotAvailable && breakStartDateTime && breakEndDateTime) {
        const slotOverlapsBreak = currentSlotStartTime.getTime() < breakEndDateTime.getTime() && 
                                 currentSlotEndTime.getTime() > breakStartDateTime.getTime();
        
        if (slotOverlapsBreak) {
            // If slot spans break time and appointments through breaks not allowed
            if (!allowAppointmentsThroughBreaks) {
                isSlotAvailable = false;
                reason = "Break Time";
                console.log(`[AvailabilityService] Slot ${tzFormat(currentSlotStartTime, 'HH:mm', { timeZone: facilityTimezone })} overlaps break time and is NOT allowed through breaks.`);
            } else {
                // Spans break but is allowed
                if (isSlotAvailable) {
                    reason = "Spans through break time";
                    console.log(`[AvailabilityService] Slot ${tzFormat(currentSlotStartTime, 'HH:mm', { timeZone: facilityTimezone })} spans break time but IS allowed through breaks.`);
                }
            }
        }
    }

    const remainingCapacity = isSlotAvailable ? Math.max(0, currentCapacity) : 0;

    // Final status check
    if (remainingCapacity <= 0 && isSlotAvailable) {
        isSlotAvailable = false;
        if (reason !== "Break Time") { 
             reason = "Capacity full";
        }
    }

    result.push({
      time: tzFormat(currentSlotStartTime, 'HH:mm', { timeZone: facilityTimezone }),
      available: isSlotAvailable,
      remainingCapacity: remainingCapacity,
      remaining: remainingCapacity,
      reason: isSlotAvailable ? (reason === "Spans through break time" ? reason : "") : reason,
    });

    currentSlotStartTime = addMinutes(currentSlotStartTime, slotIntervalMinutes);
  }

  return result;
}