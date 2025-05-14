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
  date: Date,
  timezone: string,
  config: SchedulingConfig
): string[] {
  const slots: string[] = [];
  
  // Format date to YYYY-MM-DD string for combining with time
  const dateStr = format(date, 'yyyy-MM-dd');
  
  // Parse facility hours with timezone awareness
  const start = toZonedTime(parse(`${dateStr} ${hours.start}`, 'yyyy-MM-dd HH:mm', new Date()), timezone);
  const end = toZonedTime(parse(`${dateStr} ${hours.end}`, 'yyyy-MM-dd HH:mm', new Date()), timezone);
  
  // Parse break times with timezone awareness
  const breakStart = hours.breakStart 
    ? toZonedTime(parse(`${dateStr} ${hours.breakStart}`, 'yyyy-MM-dd HH:mm', new Date()), timezone) 
    : null;
  const breakEnd = hours.breakEnd 
    ? toZonedTime(parse(`${dateStr} ${hours.breakEnd}`, 'yyyy-MM-dd HH:mm', new Date()), timezone)
    : null;

  // Current time and buffer cutoff in the facility timezone
  const now = toZonedTime(new Date(), timezone);
  const bufferCutoff = addMinutes(now, config.bookingBufferMinutes);

  console.log(`[generateTimeSlots] Facility hours: ${tzFormat(start, 'HH:mm', { timeZone: timezone })} - ${tzFormat(end, 'HH:mm', { timeZone: timezone })}`);
  if (breakStart && breakEnd) {
    console.log(`[generateTimeSlots] Facility break: ${tzFormat(breakStart, 'HH:mm', { timeZone: timezone })} - ${tzFormat(breakEnd, 'HH:mm', { timeZone: timezone })}`);
  }
  console.log(`[generateTimeSlots] Current time: ${tzFormat(now, 'HH:mm', { timeZone: timezone })}, Buffer cutoff: ${tzFormat(bufferCutoff, 'HH:mm', { timeZone: timezone })}`);

  let current = start;
  while (!isAfter(current, end)) {
    // Check if current time is in break
    const inBreak = breakStart && breakEnd && 
                   !isAfter(breakStart, current) && 
                   isAfter(breakEnd, current);
    
    // Check if current time is after buffer cutoff
    const pastBuffer = !isAfter(bufferCutoff, current);

    if (!inBreak && pastBuffer) {
      slots.push(tzFormat(current, 'HH:mm', { timeZone: timezone }));
    }

    current = addMinutes(current, config.intervalMinutes);
  }

  return slots;
}

export function getAvailableTimeSlotsForDay(
  date: Date,
  ctx: AvailabilityContext,
  timezone: string,
  config?: Partial<SchedulingConfig>
): string[] {
  const day = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const mergedConfig = { ...defaultConfig, ...config };

  const today = new Date();
  if (differenceInCalendarDays(date, today) > mergedConfig.maxAdvanceDays) return [];

  const hours = getEffectiveHours(day, ctx);
  if (!hours) return [];

  return generateTimeSlots(hours, date, timezone, mergedConfig);
}

export async function calculateAvailabilitySlots(
  db: DrizzleDBInstance,
  storage: IStorage,
  date: string, // YYYY-MM-DD
  facilityId: number,
  appointmentTypeId: number,
  effectiveTenantId: number,
  options?: AvailabilityOptions,
  config?: Partial<SchedulingConfig>,
  customTimezone?: string // Allow passing a custom timezone
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

  // Use provided timezone or fall back to facility timezone
  const facilityTimezone = facility.timezone || 'America/New_York';
  const effectiveTimezone = customTimezone || facilityTimezone;
  console.log(`[AvailabilityService] Using timezone: ${effectiveTimezone} (facility default: ${facilityTimezone})`);
  
  const zonedDate = toZonedTime(parseISO(`${date}T00:00:00`), effectiveTimezone);
  const dayOfWeek = getDay(zonedDate);
  console.log(`[AvailabilityService] Date ${date} in ${effectiveTimezone} is day of week: ${dayOfWeek}`);

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

  // Use effectiveTimezone instead of facilityTimezone for timezone-aware calculations
  const dayStart = toZonedTime(parseISO(`${date}T00:00:00`), effectiveTimezone);
  const nextDateStr = format(addDays(parseISO(date), 1), 'yyyy-MM-dd');
  const dayEnd = toZonedTime(parseISO(`${nextDateStr}T00:00:00`), effectiveTimezone);
  
  console.log(`[AvailabilityService] Day boundaries in ${effectiveTimezone}: start=${dayStart.toISOString()}, end=${dayEnd.toISOString()}`);

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
  
  // For testing purposes, uncomment to log detailed appointment info
  // existingAppointments.forEach((appt, idx) => {
  //   console.log(`[AvailabilityService] Appointment ${idx + 1}: ID=${appt.id}, Start=${tzFormat(appt.startTime, 'yyyy-MM-dd HH:mm', { timeZone: facilityTimezone })}, End=${tzFormat(appt.endTime, 'yyyy-MM-dd HH:mm', { timeZone: facilityTimezone })}`);
  // });

  const result: AvailabilitySlot[] = [];
  
  // Use interval from config with fallback to appointment type settings
  const slotIntervalMinutes = mergedConfig.intervalMinutes || Math.max(
    appointmentTypeBufferTime > 0 ? appointmentTypeBufferTime : appointmentTypeDuration, 15
  );

  const operatingStartDateTime = toZonedTime(parseISO(`${date}T${operatingStartTimeStr}`), effectiveTimezone);
  let operatingEndDateTime = toZonedTime(parseISO(`${date}T${operatingEndTimeStr}`), effectiveTimezone);

  // Adjust end time for loop comparison
  if (operatingEndTimeStr === "23:59") {
      operatingEndDateTime = dayEnd; // Use start of next day as exclusive upper bound
  } else if (operatingEndDateTime <= operatingStartDateTime) {
      operatingEndDateTime = addDays(operatingEndDateTime, 1);
  }

  console.log(`[AvailabilityService] Operating hours in ${effectiveTimezone}: ${operatingStartDateTime.toISOString()} to ${operatingEndDateTime.toISOString()}`);

  let breakStartDateTime: Date | null = null;
  let breakEndDateTime: Date | null = null;
  // Only process break times when both are properly defined with non-empty strings
  if (breakStartTimeStr && breakEndTimeStr && 
      breakStartTimeStr.trim() !== "" && breakEndTimeStr.trim() !== "" && 
      breakStartTimeStr.includes(':') && breakEndTimeStr.includes(':')) {
      try {
          breakStartDateTime = toZonedTime(parseISO(`${date}T${breakStartTimeStr}`), effectiveTimezone);
          breakEndDateTime = toZonedTime(parseISO(`${date}T${breakEndTimeStr}`), effectiveTimezone);
          if (breakEndDateTime <= breakStartDateTime) { breakEndDateTime = addDays(breakEndDateTime, 1); }
          console.log(`[AvailabilityService] Break time for ${date} in ${effectiveTimezone}: ${breakStartDateTime.toISOString()} to ${breakEndDateTime.toISOString()}`);
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
  // Use the effective timezone to ensure consistency in time calculations
  const now = toZonedTime(new Date(), effectiveTimezone);
  const bufferCutoff = addMinutes(now, mergedConfig.bookingBufferMinutes);
  console.log(`[AvailabilityService] Current time in ${effectiveTimezone}: ${now.toISOString()}`);
  console.log(`[AvailabilityService] Buffer cutoff in ${effectiveTimezone}: ${bufferCutoff.toISOString()}`);
  console.log(`[AvailabilityService] Buffer minutes: ${mergedConfig.bookingBufferMinutes}`);

  let currentSlotStartTime = new Date(operatingStartDateTime);

  while (currentSlotStartTime < operatingEndDateTime) {
    const currentSlotEndTime = addMinutes(currentSlotStartTime, appointmentTypeDuration);

    // Early slot end check - if the appointment would extend beyond operating hours
    if (currentSlotEndTime > operatingEndDateTime) {
        // If this appointment type can override facility hours, allow it
        if (overrideFacilityHours) {
            console.log(`[AvailabilityService] Slot starting at ${tzFormat(currentSlotStartTime, 'HH:mm', { timeZone: effectiveTimezone })} ends after hours (${operatingEndTimeStr}) but override is ENABLED.`);
            // Continue with generation since override is allowed
        } else {
            console.log(`[AvailabilityService] Slot starting at ${tzFormat(currentSlotStartTime, 'HH:mm', { timeZone: effectiveTimezone })} ends after operating end ${operatingEndTimeStr}. Stopping.`);
            break; // Stop generating slots
        }
    }

    let isSlotAvailable = true;
    let reason = "";
    let conflictingApptsCount = 0;

    // Apply booking buffer - don't allow slots that start too soon
    // Consider both the global booking buffer and appointment type buffer time
    const effectiveBufferMinutes = Math.max(mergedConfig.bookingBufferMinutes, appointmentTypeBufferTime);
    const appointmentTypeBufferCutoff = addMinutes(now, appointmentTypeBufferTime);
    const effectiveBufferCutoff = appointmentTypeBufferTime > mergedConfig.bookingBufferMinutes 
        ? appointmentTypeBufferCutoff : bufferCutoff;
    
    if (currentSlotStartTime < effectiveBufferCutoff) {
        // Format times to display in logs using the effective timezone
        const slotTimeStr = tzFormat(currentSlotStartTime, 'HH:mm', { timeZone: effectiveTimezone });
        const bufferTimeStr = tzFormat(effectiveBufferCutoff, 'HH:mm', { timeZone: effectiveTimezone });
        console.log(`[AvailabilityService] Slot at ${slotTimeStr} is too soon (before buffer cutoff ${bufferTimeStr}, using ${effectiveBufferMinutes}min buffer)`);
        isSlotAvailable = false;
        reason = "Too soon (buffer)";
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
    if (breakStartDateTime && breakEndDateTime) {
        // Calculate if the appointment would overlap with a break
        const slotOverlapsBreak = currentSlotStartTime.getTime() < breakEndDateTime.getTime() && 
                                 currentSlotEndTime.getTime() > breakStartDateTime.getTime();
        
        // Check if appointment starts within a break
        const slotStartsDuringBreak = currentSlotStartTime.getTime() >= breakStartDateTime.getTime() && 
                                      currentSlotStartTime.getTime() < breakEndDateTime.getTime();
        
        // Check if appointment ends during a break
        const slotEndsDuringBreak = currentSlotEndTime.getTime() > breakStartDateTime.getTime() && 
                                    currentSlotEndTime.getTime() <= breakEndDateTime.getTime();
        
        // For improved logging
        const timeStr = tzFormat(currentSlotStartTime, 'HH:mm', { timeZone: effectiveTimezone });
        
        if (slotOverlapsBreak) {
            // If slot spans break time and appointments through breaks not allowed
            if (!allowAppointmentsThroughBreaks) {
                isSlotAvailable = false;
                reason = "Break Time";
                console.log(`[AvailabilityService] Slot ${timeStr} overlaps break time and is NOT allowed through breaks.`);
            } else {
                // Spans break but is allowed - add helpful reason for UI while keeping availability true
                if (slotStartsDuringBreak) {
                    // This is specifically starting within a break time
                    reason = "Spans through break";
                    console.log(`[AvailabilityService] Slot ${timeStr} starts during break time but IS allowed through breaks.`);
                } else if (slotEndsDuringBreak) {
                    // This ends within a break time
                    reason = "Spans through break";
                    console.log(`[AvailabilityService] Slot ${timeStr} ends during break time but IS allowed through breaks.`);
                } else {
                    // This spans completely over a break time
                    reason = "Spans through break";
                    console.log(`[AvailabilityService] Slot ${timeStr} spans completely over break time but IS allowed through breaks.`);
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
      time: tzFormat(currentSlotStartTime, 'HH:mm', { timeZone: effectiveTimezone }),
      available: isSlotAvailable,
      remainingCapacity: remainingCapacity,
      remaining: remainingCapacity,
      reason: isSlotAvailable ? (reason === "Spans through break time" ? reason : "") : reason,
    });

    currentSlotStartTime = addMinutes(currentSlotStartTime, slotIntervalMinutes);
  }

  return result;
}