import { format, parse, addMinutes, parseISO, addDays, isAfter, isValid, getDay, differenceInCalendarDays } from 'date-fns';
import { formatInTimeZone as tzFormat, toZonedTime } from 'date-fns-tz';
import { and, eq, gt, gte, lt, lte, ne, notInArray, or, sql, isNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { schedules, docks, facilities, appointmentTypes } from '@shared/schema';
import type { IStorage } from '../../storage';
import { pool } from '../../db.js';

// Safe date formatting function to prevent "Invalid time value" errors
function safeFormat(date: Date | null | undefined, formatStr: string, fallback = 'Invalid Date'): string {
  if (!date || !isValid(date)) {
    console.warn('[AvailabilityService] Invalid date encountered:', date);
    return fallback;
  }
  try {
    return format(date, formatStr);
  } catch (error) {
    console.error('[AvailabilityService] Date formatting error:', error);
    return fallback;
  }
}

// Helper function to parse ISO dates with timezone options
function tzParseISO(dateStr: string, options?: { timeZone?: string }): Date {
  const parsedDate = parseISO(dateStr);
  if (options?.timeZone) {
    return toZonedTime(parsedDate, options.timeZone);
  }
  return parsedDate;
}

// Helper function to check for holidays and special closures
async function checkHolidaysAndClosures(
  date: string,
  currentHours: DayHours,
  organization: any,
  facility: any,
  appointmentType: any
): Promise<DayHours> {
  console.log(`[AvailabilityService] Checking holidays and closures for ${date}`);
  
  // Check organization holidays
  const orgHolidays = organization.holidays || [];
  const isOrgHoliday = orgHolidays.some((holiday: any) => {
    return holiday.date === date || (holiday.startDate <= date && holiday.endDate >= date);
  });
  
  if (isOrgHoliday) {
    console.log(`[AvailabilityService] Organization holiday detected for ${date}`);
    return { ...currentHours, open: false };
  }
  
  // Check facility-specific closures
  const facilityClosures = facility.closures || [];
  const isFacilityClosed = facilityClosures.some((closure: any) => {
    return closure.date === date || (closure.startDate <= date && closure.endDate >= date);
  });
  
  if (isFacilityClosed) {
    console.log(`[AvailabilityService] Facility closure detected for ${date}`);
    return { ...currentHours, open: false };
  }
  
  // Check appointment type specific restrictions
  const appointmentTypeRestrictions = appointmentType.dateRestrictions || [];
  const isRestrictedForAppointmentType = appointmentTypeRestrictions.some((restriction: any) => {
    if (restriction.type === 'blackout') {
      return restriction.date === date || (restriction.startDate <= date && restriction.endDate >= date);
    }
    return false;
  });
  
  if (isRestrictedForAppointmentType) {
    console.log(`[AvailabilityService] Appointment type restriction detected for ${date}`);
    return { ...currentHours, open: false };
  }
  
  console.log(`[AvailabilityService] No holidays or closures found for ${date}`);
  return currentHours;
}

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
  testAppointments?: { id: number; startTime: Date; endTime: Date; appointmentTypeId: number; }[];
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
): Promise<{ id: number; startTime: Date; endTime: Date; appointmentTypeId: number; }[]> {

  console.log(`[fetchRelevantAppointmentsForDay] Fetching for facility ${facilityId}, tenant ${effectiveTenantId}, between ${dayStart.toISOString()} and ${dayEnd.toISOString()}`);
  try {
    // ** Ensure db object is valid and has expected methods **
    if (!db || typeof db.select !== 'function') {
        console.error('[fetchRelevantAppointmentsForDay] Invalid db object:', db);
        return [];
    }

    // 🔥 CRITICAL FIX: Use corrected SQL query without s.facility_id reference
    // The schedules table doesn't have a facility_id column directly
    console.log(`[fetchRelevantAppointmentsForDay] Executing raw SQL query for facility ${facilityId}`);
    
    const rawQuery = `
      SELECT 
        s.id,
        s.start_time,
        s.end_time, 
        s.appointment_type_id
      FROM schedules s
      LEFT JOIN docks d ON s.dock_id = d.id
      LEFT JOIN appointment_types at ON s.appointment_type_id = at.id
      LEFT JOIN facilities f ON d.facility_id = f.id
      LEFT JOIN organization_facilities of ON f.id = of.facility_id
      WHERE (
        d.facility_id = $1 OR 
        at.facility_id = $1
      )
      AND s.start_time >= $2
      AND s.start_time < $3
      AND (
        of.organization_id = $4 OR 
        at.tenant_id = $4
      )
      AND s.status != 'cancelled'
    `;
    
    const result = await pool.query(rawQuery, [facilityId, dayStart.toISOString(), dayEnd.toISOString(), effectiveTenantId]);
    
    // Convert the raw result to the expected format
    const appointments = result.rows.map((row: any) => ({
      id: row.id,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      appointmentTypeId: row.appointment_type_id
    }));
    
    console.log(`[fetchRelevantAppointmentsForDay] Found ${appointments.length} appointments for facility ${facilityId}`);
    appointments.forEach((apt: { id: number; startTime: Date; endTime: Date; appointmentTypeId: number }) => {
      console.log(`  - Appointment ${apt.id}: ${apt.startTime.toISOString()} (type: ${apt.appointmentTypeId})`);
    });
    
    return appointments;

  } catch (error) {
    console.error(`[fetchRelevantAppointmentsForDay] Error querying appointments:`, error);
    throw error;
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

  console.log(`[generateTimeSlots] Facility hours: ${tzFormat(start, timezone, 'HH:mm')} - ${tzFormat(end, timezone, 'HH:mm')}`);
  if (breakStart && breakEnd) {
    console.log(`[generateTimeSlots] Facility break: ${tzFormat(breakStart, timezone, 'HH:mm')} - ${tzFormat(breakEnd, timezone, 'HH:mm')}`);
  }
  console.log(`[generateTimeSlots] Current time: ${tzFormat(now, timezone, 'HH:mm')}, Buffer cutoff: ${tzFormat(bufferCutoff, timezone, 'HH:mm')}`);

  let current = start;
  while (!isAfter(current, end)) {
    // Check if current time is in break
    const inBreak = breakStart && breakEnd && 
                   !isAfter(breakStart, current) && 
                   isAfter(breakEnd, current);
    
    // Check if current time is after buffer cutoff
    const pastBuffer = !isAfter(bufferCutoff, current);

    if (!inBreak && pastBuffer) {
      slots.push(tzFormat(current, timezone, 'HH:mm'));
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
  
  // First, parse the date parts
  const [year, month, day] = date.split('-').map(num => parseInt(num, 10));
  
  // FIXED: Use more robust date parsing that avoids timezone conversion issues
  // Start with a simple Date object and then determine day of week
  const appointmentDate = new Date(year, month - 1, day, 12, 0, 0);
  
  // Validate the date was created correctly
  if (!isValid(appointmentDate)) {
    throw new Error(`Invalid date provided: ${date}`);
  }
  
  const dayOfWeek = getDay(appointmentDate);
  
  // Enhanced debugging for date calculation
  console.log(`[AvailabilityService] Date calculation for ${date} in ${effectiveTimezone}:`);
  console.log(`- Date parts: Year=${year}, Month=${month}, Day=${day}`);
  console.log(`- Calculated day of week: ${dayOfWeek} (${dayOfWeek === 1 ? 'Monday' : dayOfWeek === 0 ? 'Sunday' : 'Other Day'})`);
  console.log(`- Appointment date object: ${appointmentDate.toString()}`);
  
  // Use the original date string since we already validated it above
  const facilityTZDateStr = date; // This is already in YYYY-MM-DD format
  console.log(`- Facility TZ date string: ${facilityTZDateStr}`);
  
  // Debug logging for final day calculation
  console.log(`[AvailabilityService] Using day of week: ${dayOfWeek} for calculations`);

  const getObjectField = (obj: any, camelCase: string, snakeCase: string, defaultValue: any = undefined): any => {
    // Check both camelCase and snake_case field names
    let value;
    let source = "";
    
    if (obj?.[camelCase] !== undefined) {
      value = obj[camelCase];
      source = "camelCase";
    } else if (obj?.[snakeCase] !== undefined) {
      value = obj[snakeCase];
      source = "snakeCase";
    } else {
      value = defaultValue;
      source = "default";
    }
    
    return { value, source };
  };
  
  const getFacilityField = (camelCase: string, snakeCase: string, defaultValue: any = undefined): any => {
    const result = getObjectField(facility, camelCase, snakeCase, defaultValue);
    return result.value;
  };
  
  const getAppTypeField = (camelCase: string, snakeCase: string, defaultValue: any = undefined): any => {
    const result = getObjectField(appointmentType, camelCase, snakeCase, defaultValue);
    console.log(`[AvailabilityService] Using ${camelCase} = ${result.value} (source: ${result.source})`);
    return result.value;
  };

  // Extract appointment type settings with proper field name handling
  const appointmentTypeDuration = getAppTypeField('duration', 'duration', 60); // Default to 60 minutes
  const appointmentTypeBufferTime = getAppTypeField('bufferTime', 'buffer_time', 0); // Default to 0 minutes
  
  // FIXED: Use correct field name for maxConcurrent - from your screenshots it shows "Max Concurrent Appointments = 2"
  const maxConcurrent = getAppTypeField('maxConcurrent', 'max_concurrent', 1); // Default to 1 concurrent appointment
  
  // Log the extracted values for debugging
  console.log(`[AvailabilityService] Appointment type settings: duration=${appointmentTypeDuration}min, buffer=${appointmentTypeBufferTime}min, maxConcurrent=${maxConcurrent}`);
  
  const allowAppointmentsThroughBreaks = getAppTypeField('allowAppointmentsThroughBreaks', 'allow_appointments_through_breaks', false);
  const overrideFacilityHours = getAppTypeField('overrideFacilityHours', 'override_facility_hours', false);

  console.log(`[AvailabilityService] APPOINTMENT TYPE SETTINGS SUMMARY:`);
  console.log(`[AvailabilityService] - Type ID: ${appointmentTypeId}`);
  console.log(`[AvailabilityService] - Name: ${appointmentType.name}`);
  console.log(`[AvailabilityService] - Duration: ${appointmentTypeDuration} minutes`);
  console.log(`[AvailabilityService] - Buffer Time: ${appointmentTypeBufferTime} minutes`);
  console.log(`[AvailabilityService] - Max Concurrent: ${maxConcurrent}`);
  console.log(`[AvailabilityService] - Override Facility Hours: ${overrideFacilityHours}`);
  console.log(`[AvailabilityService] - Allow Through Breaks: ${allowAppointmentsThroughBreaks}`);

  // Build hours context with proper hierarchy
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayKey = dayKeys[dayOfWeek];
  
  console.log(`[AvailabilityService] Using day key: ${dayKey} from day of week: ${dayOfWeek}`);
  
  // STEP 1: Get organization default hours 
  const organization = await storage.getOrganizationByFacilityId(facilityId);
  if (!organization) {
    throw new Error('Organization not found for this facility');
  }
  
  // For now, skip organization holidays check until we implement that feature
  // TODO: Check organization holidays when getOrganizationHolidays is implemented
  
  // STEP 2: Build organization default hours (fully configurable, no hardcoded defaults)
  const orgHours: Record<string, DayHours> = {};
  
  for (const day of dayKeys) {
    const dayOpenField = getObjectField(organization, `${day}Open`, `${day}_open`);
    const dayStartField = getObjectField(organization, `${day}Start`, `${day}_start`);
    const dayEndField = getObjectField(organization, `${day}End`, `${day}_end`);
    const dayBreakStartField = getObjectField(organization, `${day}BreakStart`, `${day}_break_start`);
    const dayBreakEndField = getObjectField(organization, `${day}BreakEnd`, `${day}_break_end`);
    
    // Use configured values, or reasonable fallbacks only if nothing is configured
    const isOpen = dayOpenField?.value !== undefined ? dayOpenField.value : false;
    const startTime = dayStartField?.value || "08:00";
    const endTime = dayEndField?.value || "17:00";
    const breakStartTime = dayBreakStartField?.value || "";
    const breakEndTime = dayBreakEndField?.value || "";
    
    orgHours[day] = {
      open: isOpen,
      start: startTime,
      end: endTime,
      breakStart: breakStartTime,
      breakEnd: breakEndTime,
    };
    
    console.log(`[AvailabilityService] Organization hours for ${day}:`, {
      rawField: dayOpenField,
      computed: isOpen,
      hours: `${startTime} - ${endTime}`,
      source: dayOpenField?.source || 'default'
    });
  }
  
  // STEP 3: Check facility hours (facilities can override organization hours)
  let effectiveHours = orgHours[dayKey]; // Start with org default
  
  // Check if facility has its own hours configured (any day-specific fields)
  const facilityDayOpen = getObjectField(facility, `${dayKey}Open`, `${dayKey}_open`);
  const facilityDayStart = getObjectField(facility, `${dayKey}Start`, `${dayKey}_start`);
  const facilityDayEnd = getObjectField(facility, `${dayKey}End`, `${dayKey}_end`);
  const facilityBreakStart = getObjectField(facility, `${dayKey}BreakStart`, `${dayKey}_break_start`);
  const facilityBreakEnd = getObjectField(facility, `${dayKey}BreakEnd`, `${dayKey}_break_end`);
  
  // If facility has any hours configured, use them instead of org defaults
  if (facilityDayOpen?.value !== undefined || facilityDayStart?.value || facilityDayEnd?.value) {
    console.log(`[AvailabilityService] Facility ${facility.name} has configured hours for ${dayKey}`);
    
    effectiveHours = {
      open: facilityDayOpen?.value !== undefined ? facilityDayOpen.value : orgHours[dayKey].open,
      start: facilityDayStart?.value || orgHours[dayKey].start,
      end: facilityDayEnd?.value || orgHours[dayKey].end,
      breakStart: facilityBreakStart?.value || orgHours[dayKey].breakStart,
      breakEnd: facilityBreakEnd?.value || orgHours[dayKey].breakEnd,
    };
    
    console.log(`[AvailabilityService] Using facility hours:`, effectiveHours);
  } else {
    console.log(`[AvailabilityService] Using organization default hours for ${facility.name}`);
  }

  // STEP 4: Check appointment type hours (highest priority - can override facility/org hours)
  const appointmentTypeHoursOverride = getAppTypeField('hoursOverride', 'hours_override', null);
  const appointmentTypeDayOpen = getAppTypeField(`${dayKey}Open`, `${dayKey}_open`, null);
  const appointmentTypeDayStart = getAppTypeField(`${dayKey}Start`, `${dayKey}_start`, null);
  const appointmentTypeDayEnd = getAppTypeField(`${dayKey}End`, `${dayKey}_end`, null);
  const appointmentTypeBreakStart = getAppTypeField(`${dayKey}BreakStart`, `${dayKey}_break_start`, null);
  const appointmentTypeBreakEnd = getAppTypeField(`${dayKey}BreakEnd`, `${dayKey}_break_end`, null);

  // If appointment type has specific hours configured, they take highest priority
  if (appointmentTypeHoursOverride || appointmentTypeDayOpen !== null || appointmentTypeDayStart || appointmentTypeDayEnd) {
    console.log(`[AvailabilityService] Appointment type ${appointmentType.name} has configured hours for ${dayKey}`);
    
    effectiveHours = {
      open: appointmentTypeDayOpen !== null ? appointmentTypeDayOpen : effectiveHours.open,
      start: appointmentTypeDayStart || effectiveHours.start,
      end: appointmentTypeDayEnd || effectiveHours.end,
      breakStart: appointmentTypeBreakStart || effectiveHours.breakStart,
      breakEnd: appointmentTypeBreakEnd || effectiveHours.breakEnd,
    };
    
    console.log(`[AvailabilityService] Using appointment type hours override:`, effectiveHours);
  }

  // STEP 5: Check for holidays and special closures
  effectiveHours = await checkHolidaysAndClosures(date, effectiveHours, organization, facility, appointmentType);
  
  // STEP 6: Check if facility is open on this day
  if (!effectiveHours || !effectiveHours.open) {
    console.log(`[AvailabilityService] Facility ${facility.name} closed on ${date} (${dayKey})`);
    return [];
  }
  
  // Now these should be simple strings since we extract .value above
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

  let existingAppointments: { id: number; startTime: Date; endTime: Date; appointmentTypeId: number; }[] = [];
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
  
  // IMPORTANT: Use appointment type buffer time as the primary factor that determines slot interval
  // This ensures consistency between availability calculation and UI display
  const slotIntervalMinutes = appointmentTypeBufferTime > 0 
    ? appointmentTypeBufferTime  // Use appointment type's buffer time as the interval
    : (mergedConfig.intervalMinutes || Math.max(appointmentTypeDuration, 15));
    
  console.log(`[AvailabilityService] Using slot interval of ${slotIntervalMinutes} minutes based on appointment type buffer time`);

  // Step 1: Create facility-local date objects that represent the actual intended times
  // NEW FIX: Create date objects that properly represent the intended times in facility timezone
  // This approach avoids the timezone conversion issues by working with local time directly
  
  // Start by creating a date-less base time in facility timezone
  const facilityTZDate = tzParseISO(date, { timeZone: effectiveTimezone });
  
  // Important: Always interpret facility hours in their local timezone as entered in DB
  // Use parse instead of parseISO with the facility timezone to ensure correct time interpretation
  const dateInFacilityTZ = new Date(year, month - 1, day, 0, 0, 0);
  
  // 🔥 TIMEZONE FIX: Parse facility hours as being ALREADY in facility timezone
  // The facility hours (08:00, 17:00) are stored in the facility's local time
  // We need to create Date objects that represent 08:00 Eastern, not 08:00 UTC
  
  // SIMPLE FIX: Create dates by parsing hour/minute and building in facility timezone
  const [startHour, startMinute] = operatingStartTimeStr.split(':').map(Number);
  const [endHour, endMinute] = operatingEndTimeStr.split(':').map(Number);
  
  // Create base date in facility timezone
  const baseDate = toZonedTime(parseISO(`${facilityTZDateStr}T00:00:00`), effectiveTimezone);
  
  // Set the correct hours/minutes for start and end times
  const operatingStartDateTime = new Date(baseDate);
  operatingStartDateTime.setHours(startHour, startMinute, 0, 0);
  
  let operatingEndDateTime = new Date(baseDate);
  operatingEndDateTime.setHours(endHour, endMinute, 0, 0);
  
  // DEBUG: Log time values for debugging
  console.log(`[AvailabilityService] DEBUG TIME VALUES:`);
  console.log(`  Original hours from DB: ${operatingStartTimeStr} - ${operatingEndTimeStr}`);
  console.log(`  Parsed time (local): ${safeFormat(operatingStartDateTime, 'HH:mm')} - ${safeFormat(operatingEndDateTime, 'HH:mm')}`);
  console.log(`  Direct parse with TZ: ${operatingStartDateTime.toISOString()} - ${operatingEndDateTime.toISOString()}`);
  console.log(`  Formatted in ${effectiveTimezone}: ${tzFormat(operatingStartDateTime, effectiveTimezone, 'HH:mm')} - ${tzFormat(operatingEndDateTime, effectiveTimezone, 'HH:mm')}`);
  
  // Adjust end time for loop comparison
  if (operatingEndTimeStr === "23:59") {
      operatingEndDateTime = addDays(dateInFacilityTZ, 1); // Use start of next day as exclusive upper bound
  } else if (operatingEndDateTime <= operatingStartDateTime) {
      operatingEndDateTime = addDays(operatingEndDateTime, 1);
  }
  
  // IMPORTANT: Let's explicitly use the facility hours as they are stored in the database
  // These times are in the facility's local time and should be displayed exactly as they appear in the DB
  // This is most accurate representation of the actual facility operating hours
  console.log(`[AvailabilityService] Operating hours in ${effectiveTimezone}: ${operatingStartTimeStr} to ${operatingEndTimeStr} (from DB)`);
  
  // Additional debugging for UTC time reference
  console.log(`[AvailabilityService] Operating hours in UTC: ${operatingStartDateTime.toISOString()} to ${operatingEndDateTime.toISOString()}`);

  // Step 2: Parse break times if they exist
  let breakStartDateTime: Date | null = null;
  let breakEndDateTime: Date | null = null;
  
  // Only process break times when both are properly defined with non-empty strings
  if (breakStartTimeStr && breakEndTimeStr && 
      breakStartTimeStr.trim() !== "" && breakEndTimeStr.trim() !== "" && 
      breakStartTimeStr.includes(':') && breakEndTimeStr.includes(':')) {
      try {
          // 🔥 TIMEZONE FIX: Use same approach as operating hours
          // Parse break times using the same timezone-aware method
          const [breakStartHour, breakStartMinute] = breakStartTimeStr.split(':').map(Number);
          const [breakEndHour, breakEndMinute] = breakEndTimeStr.split(':').map(Number);
          
          breakStartDateTime = new Date(baseDate);
          breakStartDateTime.setHours(breakStartHour, breakStartMinute, 0, 0);
          
          breakEndDateTime = new Date(baseDate);
          breakEndDateTime.setHours(breakEndHour, breakEndMinute, 0, 0);
          
          // Adjust if break spans midnight
          if (breakEndDateTime && breakStartDateTime && breakEndDateTime <= breakStartDateTime) { 
              breakEndDateTime = addDays(breakEndDateTime, 1); 
          }
          
          // DEBUG: Log break time details for debugging
          console.log(`[AvailabilityService] DEBUG BREAK TIME VALUES:`);
          console.log(`  Original break time from DB: ${breakStartTimeStr} - ${breakEndTimeStr}`);
          console.log(`  Parsed time (local): ${breakStartDateTime ? format(breakStartDateTime, 'HH:mm') : 'null'} - ${breakEndDateTime ? format(breakEndDateTime, 'HH:mm') : 'null'}`);
          console.log(`  Direct parse with TZ: ${breakStartDateTime ? breakStartDateTime.toISOString() : 'null'} - ${breakEndDateTime ? breakEndDateTime.toISOString() : 'null'}`);
          console.log(`  Formatted in ${effectiveTimezone}: ${breakStartDateTime ? tzFormat(breakStartDateTime, effectiveTimezone, 'HH:mm') : 'null'} - ${breakEndDateTime ? tzFormat(breakEndDateTime, effectiveTimezone, 'HH:mm') : 'null'}`);
          
          
          if (breakStartDateTime && breakEndDateTime) {
            // Just like with operating hours, use the exact break times from the database for accuracy
            // These times are already in the facility's local timezone
            console.log(`[AvailabilityService] Break time in ${effectiveTimezone}: ${breakStartTimeStr} to ${breakEndTimeStr} (from DB)`);
            
            // Additional debug info for UTC reference
            console.log(`[AvailabilityService] Break time in UTC: ${breakStartDateTime.toISOString()} to ${breakEndDateTime.toISOString()}`);
          }
      } catch (e) { 
          console.error(`[AvailabilityService] Error parsing break times: ${breakStartTimeStr} - ${breakEndTimeStr}`, e); 
          // Reset to null if parsing failed
          breakStartDateTime = null;
          breakEndDateTime = null;
      }
  } else {
      console.log(`[AvailabilityService] No valid break times configured for ${date}: "${breakStartTimeStr}" - "${breakEndTimeStr}"`);
  }

  // Step 3: Set up current time to check against buffer during slot generation
  // Convert current time to facility timezone to ensure proper buffer calculation
  const now = toZonedTime(new Date(), effectiveTimezone);
  
  // Log the current time for debugging
  console.log(`[AvailabilityService] Current time in ${effectiveTimezone}: ${tzFormat(now, effectiveTimezone, 'HH:mm')}`);
  
  // Buffer minutes and cutoff will be calculated during slot generation
  // based on appointment type settings

  let currentSlotStartTime = new Date(operatingStartDateTime);

  while (currentSlotStartTime < operatingEndDateTime) {
    const currentSlotEndTime = addMinutes(currentSlotStartTime, appointmentTypeDuration);

    // Early slot end check - if the appointment would extend beyond operating hours
    if (currentSlotEndTime > operatingEndDateTime) {
        // If this appointment type can override facility hours, allow it
        if (overrideFacilityHours) {
            console.log(`[AvailabilityService] Slot starting at ${tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm')} ends after hours (${operatingEndTimeStr}) but override is ENABLED.`);
            // Continue with generation since override is allowed
        } else {
            console.log(`[AvailabilityService] Slot starting at ${tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm')} ends after operating end ${operatingEndTimeStr}. Stopping.`);
            break; // Stop generating slots
        }
    }

    let isSlotAvailable = true;
    let reason = "";
    let conflictingApptsCount = 0;

    // Apply booking buffer - don't allow slots that start too soon
    // IMPORTANT: Always use the appointment type's buffer time for both 
    // slot interval and minimum advance booking time
    // This creates consistency between the UI display and buffer rules
    const effectiveBufferMinutes = appointmentTypeBufferTime > 0 
      ? appointmentTypeBufferTime  // Use appointment type's buffer if set
      : mergedConfig.bookingBufferMinutes;  // Otherwise fall back to system default
    
    // Log the buffer setting source for debugging
    console.log(`[AvailabilityService] Using buffer time of ${effectiveBufferMinutes} minutes from ${
      appointmentTypeBufferTime > 0 ? 'appointment type settings' : 'system default config'
    }`);
      
    // Calculate buffer cutoff based on the effective buffer minutes
    const effectiveBufferCutoff = addMinutes(now, effectiveBufferMinutes);
    
    // Check if the requested date is today or a future date
    // If a future date, we don't need to apply the buffer time check
    const isToday = safeFormat(dateInFacilityTZ, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
    
    // Only apply buffer time check if we're checking today's availability
    if (isToday && currentSlotStartTime < effectiveBufferCutoff) {
        // Format times to display in logs using the effective timezone
        const slotTimeStr = tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm');
        const bufferTimeStr = tzFormat(effectiveBufferCutoff, effectiveTimezone, 'HH:mm');
        console.log(`[AvailabilityService] Slot at ${slotTimeStr} is too soon (before buffer cutoff ${bufferTimeStr}, using ${effectiveBufferMinutes}min buffer from ${appointmentTypeBufferTime > 0 ? 'appointment type' : 'global config'})`);
        isSlotAvailable = false;
        reason = `Too soon (${effectiveBufferMinutes}min buffer)`;
    }

    // Enhanced concurrent slot validation with detailed logging
    if (isSlotAvailable && existingAppointments && existingAppointments.length > 0) {
        console.log(`[AvailabilityService] Checking conflicts for slot ${tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm')} against ${existingAppointments.length} existing appointments`);
        console.log(`[AvailabilityService] Appointment type max concurrent: ${maxConcurrent || 'unlimited'}`);
        
        conflictingApptsCount = existingAppointments.filter((appt) => {
            const apptStart = appt.startTime.getTime();
            const apptEnd = appt.endTime.getTime();
            const slotStart = currentSlotStartTime.getTime();
            const slotEnd = currentSlotEndTime.getTime();
            
            // Check if there's any time overlap between slot and existing appointment
            const hasOverlap = (slotStart < apptEnd && slotEnd > apptStart);
            
            if (hasOverlap) {
                console.log(`[AvailabilityService] Found overlapping appointment: ID ${appt.id}, type: ${appt.appointmentTypeId}, time: ${tzFormat(new Date(apptStart), effectiveTimezone, 'HH:mm')} - ${tzFormat(new Date(apptEnd), effectiveTimezone, 'HH:mm')}`);
                
                // For concurrent slot calculation, only count appointments of the same type
                if (maxConcurrent !== null && appt.appointmentTypeId === appointmentTypeId) {
                    console.log(`[AvailabilityService] Counting towards concurrent limit (same appointment type: ${appointmentTypeId})`);
                    return true;
                }
                
                // For different appointment types or unlimited concurrent, check if it's a true conflict
                // (i.e., appointments that completely block the time slot)
                const isCompleteConflict = (slotStart >= apptStart && slotEnd <= apptEnd) || 
                                         (apptStart >= slotStart && apptEnd <= slotEnd);
                
                if (isCompleteConflict) {
                    console.log(`[AvailabilityService] Found complete time conflict with appointment ID ${appt.id}`);
                    return true;
                }
                
                console.log(`[AvailabilityService] Partial overlap with appointment ID ${appt.id}, not blocking slot (different types or concurrent allowed)`);
            }
            
            return false;
        }).length;
        
        console.log(`[AvailabilityService] Total conflicting appointments for slot: ${conflictingApptsCount}`);
        
        // Apply concurrent slot limits
        if (maxConcurrent !== null && conflictingApptsCount >= maxConcurrent) {
            console.log(`[AvailabilityService] Slot exceeded max concurrent limit: ${conflictingApptsCount} >= ${maxConcurrent}`);
            isSlotAvailable = false;
        } else if (maxConcurrent !== null) {
            console.log(`[AvailabilityService] Slot within concurrent limit: ${conflictingApptsCount} < ${maxConcurrent}`);
        } else {
            console.log(`[AvailabilityService] No concurrent limit set, allowing overlapping appointments`);
        }
        
        // Additional validation: Check for hard conflicts (same exact time, regardless of type)
        const exactTimeConflicts = existingAppointments.filter((appt) => {
            const apptStart = appt.startTime.getTime();
            const apptEnd = appt.endTime.getTime();
            const slotStart = currentSlotStartTime.getTime();
            const slotEnd = currentSlotEndTime.getTime();
            
            // Exact time match
            return (apptStart === slotStart && apptEnd === slotEnd);
        }).length;
        
        if (exactTimeConflicts > 0) {
            console.log(`[AvailabilityService] Found ${exactTimeConflicts} appointments with exact same time slot - checking if this should block availability`);
            
            // If max concurrent is 1 or null (meaning exclusive), block the slot
            if (maxConcurrent === null || maxConcurrent <= 1) {
                console.log(`[AvailabilityService] Blocking slot due to exact time conflict and exclusive/single concurrent setting`);
                isSlotAvailable = false;
            }
        }
    } else if (existingAppointments && existingAppointments.length === 0) {
        console.log(`[AvailabilityService] No existing appointments for slot ${tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm')} - slot available`);
    }

    // Check capacity with detailed logging
    const currentCapacity = maxConcurrent - conflictingApptsCount;
    console.log(`[AvailabilityService] Capacity calculation for slot ${tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm')}: maxConcurrent=${maxConcurrent}, conflictingAppts=${conflictingApptsCount}, remainingCapacity=${currentCapacity}`);
    
    if (isSlotAvailable && currentCapacity <= 0) {
        isSlotAvailable = false;
        reason = "Capacity full";
        console.log(`[AvailabilityService] Slot ${tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm')} marked unavailable due to full capacity (${conflictingApptsCount}/${maxConcurrent})`);
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
        const timeStr = tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm');
        
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
                    reason = "Spans through break time";
                    console.log(`[AvailabilityService] Slot ${timeStr} starts during break time but IS allowed through breaks.`);
                } else if (slotEndsDuringBreak) {
                    // This ends within a break time
                    reason = "Spans through break time";
                    console.log(`[AvailabilityService] Slot ${timeStr} ends during break time but IS allowed through breaks.`);
                } else {
                    // This spans completely over a break time
                    reason = "Spans through break time";
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

    // For debugging our break time reason
    if (reason === "Spans through break time") {
      console.log(`[AvailabilityService] DEBUG: Adding slot ${tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm')} with reason=${reason}`);
    }
    
    // Create the slot result object with facility-local time in HH:mm format
    // This ensures times are always shown in the facility's timezone regardless of user's timezone
    const slotResult = {
      time: tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm'),
      available: isSlotAvailable,
      remainingCapacity: remainingCapacity,
      remaining: remainingCapacity,
      reason: isSlotAvailable && reason === "Spans through break time" ? reason : (isSlotAvailable ? "" : reason),
    };
    
    // For debugging time conversions and slot generation
    console.log(`[AvailabilityService] Generated slot: ${slotResult.time} (${slotResult.available ? 'Available' : 'Unavailable'}) with reason: ${slotResult.reason || 'None'}`);
    
    // Add debug info about interval for traceability
    const nextSlotTime = tzFormat(addMinutes(currentSlotStartTime, slotIntervalMinutes), effectiveTimezone, 'HH:mm');
    console.log(`[AvailabilityService] Next slot will be at ${nextSlotTime} (using ${slotIntervalMinutes}min interval)`);
    
    result.push(slotResult);

    currentSlotStartTime = addMinutes(currentSlotStartTime, slotIntervalMinutes);
  }

  return result;
}