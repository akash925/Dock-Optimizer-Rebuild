import { and, eq, gt, gte, lt, lte, ne, notInArray, or } from 'drizzle-orm';
import { toZonedTime, format as tzFormat } from 'date-fns-tz';
import { getDay, parseISO, addDays, format, addMinutes, isEqual } from 'date-fns';
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


export async function calculateAvailabilitySlots(
  db: DrizzleDBInstance,
  storage: IStorage,
  date: string, // YYYY-MM-DD
  facilityId: number,
  appointmentTypeId: number,
  effectiveTenantId: number,
  options?: AvailabilityOptions
): Promise<AvailabilitySlot[]> {

  console.log(`[AvailabilityService] Starting calculation for date=${date}, facilityId=${facilityId}, appointmentTypeId=${appointmentTypeId}, tenantId=${effectiveTenantId}`);

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

  let operatingStartTimeStr = "09:00";
  let operatingEndTimeStr = "17:00";
  let isOpen = false;
  let breakStartTimeStr = "";
  let breakEndTimeStr = "";

  if (overrideFacilityHours) {
    operatingStartTimeStr = "00:00";
    operatingEndTimeStr = "23:59";
    isOpen = true;
  } else {
     const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
     const dayKey = dayKeys[dayOfWeek];
     isOpen = getFacilityField(`${dayKey}Open`, `${dayKey}_open`) === true;
     if (isOpen) {
       operatingStartTimeStr = getFacilityField(`${dayKey}Start`, `${dayKey}_start`) || "09:00";
       operatingEndTimeStr = getFacilityField(`${dayKey}End`, `${dayKey}_end`) || "17:00";
       breakStartTimeStr = getFacilityField(`${dayKey}BreakStart`, `${dayKey}_break_start`, "");
       breakEndTimeStr = getFacilityField(`${dayKey}BreakEnd`, `${dayKey}_break_end`, "");
     }
  }

  if (!isOpen) {
    console.log(`[AvailabilityService] Facility ${facility.name} closed on ${date} (DoW: ${dayOfWeek})`);
    return [];
  }
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
  const slotIntervalMinutes = Math.max(
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
  if (breakStartTimeStr && breakEndTimeStr && breakStartTimeStr.includes(':') && breakEndTimeStr.includes(':')) {
      try {
          breakStartDateTime = toZonedTime(parseISO(`${date}T${breakStartTimeStr}`), facilityTimezone);
          breakEndDateTime = toZonedTime(parseISO(`${date}T${breakEndTimeStr}`), facilityTimezone);
          if (breakEndDateTime <= breakStartDateTime) { breakEndDateTime = addDays(breakEndDateTime, 1); }
          console.log(`[AvailabilityService] Break time for ${date}: ${breakStartDateTime.toISOString()} to ${breakEndDateTime.toISOString()}`);
      } catch (e) { console.error("Error parsing break times", e); }
  }

  let currentSlotStartTime = new Date(operatingStartDateTime);

  while (currentSlotStartTime < operatingEndDateTime) {
    const currentSlotEndTime = addMinutes(currentSlotStartTime, appointmentTypeDuration);

    // ** FIXED: Allow slots that END exactly at the operating end time **
    if (currentSlotEndTime > operatingEndDateTime) {
         console.log(`[AvailabilityService] Slot starting at ${tzFormat(currentSlotStartTime, 'HH:mm', { timeZone: facilityTimezone })} ends after operating end ${operatingEndTimeStr}. Stopping.`);
         break;
    }

    let isSlotAvailable = true;
    let reason = "";
    let conflictingApptsCount = 0;

    // Check for conflicts
    if (existingAppointments && existingAppointments.length > 0) {
        // ** FIXED: Correct Overlap Logic **
        conflictingApptsCount = existingAppointments.filter((appt) => {
            const apptStart = appt.startTime.getTime();
            const apptEnd = appt.endTime.getTime();
            const slotStart = currentSlotStartTime.getTime();
            const slotEnd = currentSlotEndTime.getTime();
            return apptStart < slotEnd && apptEnd > slotStart;
        }).length;
    }

    // Check Capacity FIRST
    const currentCapacity = maxConcurrent - conflictingApptsCount;
    if (currentCapacity <= 0) {
        isSlotAvailable = false;
        reason = "Capacity full";
    }

    // Check break time ONLY IF slot is still potentially available
    if (isSlotAvailable && breakStartDateTime && breakEndDateTime) {
         // ** FIXED: Correct break overlap check **
        if (currentSlotStartTime.getTime() < breakEndDateTime.getTime() && currentSlotEndTime.getTime() > breakStartDateTime.getTime()) {
            if (!allowAppointmentsThroughBreaks) {
                isSlotAvailable = false;
                reason = "Break Time"; // Break reason takes precedence if it makes slot unavailable
            } else {
                 // Only add reason if slot is truly available otherwise
                if (isSlotAvailable) {
                    reason = "Spans through break time";
                }
            }
        }
    }

    const remainingCapacity = isSlotAvailable ? Math.max(0, currentCapacity) : 0;

    // Final status/reason check
    if (remainingCapacity <= 0) {
        isSlotAvailable = false;
        if (reason !== "Break Time") { // Don't overwrite Break Time reason
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