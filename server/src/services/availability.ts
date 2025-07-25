import { isValid, format, addDays, parseISO, getDay, addMinutes, differenceInCalendarDays, isAfter, parse } from 'date-fns';
import { formatInTimeZone as tzFormat, toZonedTime } from 'date-fns-tz';
import { eq, and, gte, lt, or } from 'drizzle-orm';
import { schedules, appointmentTypes, facilities, docks, organizationFacilities } from '@shared/schema';
import type { IStorage } from '../../storage';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '../../db';
import { getRedisInstance } from '../../redis';

const redis = getRedisInstance();
const AVAILABILITY_CACHE_TTL = 300; // 5 minutes

// We'll use drizzle ORM queries instead of raw SQL for better type safety
const AVAILABILITY_DEBUG = process.env.AVAILABILITY_DEBUG === 'true';

// CONFIGURABLE CONSTANTS - Replace hardcoded values
const DEFAULT_TIMEZONE = process.env.DEFAULT_FACILITY_TIMEZONE || 'America/New_York';
const DEFAULT_START_TIME = process.env.DEFAULT_START_TIME || '08:00';
const DEFAULT_END_TIME = process.env.DEFAULT_END_TIME || '17:00';
const DEFAULT_BREAK_START = process.env.DEFAULT_BREAK_START || '12:00';
const DEFAULT_BREAK_END = process.env.DEFAULT_BREAK_END || '13:00';

// Helper function for conditional logging
function debugLog(message: string, ...args: any[]) {
  if (AVAILABILITY_DEBUG) {
    console.log(`[AvailabilityService] ${message}`, ...args);
  }
}

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
  try {
    const parsed = parseISO(dateStr);
    return options?.timeZone ? toZonedTime(parsed, options.timeZone) : parsed;
  } catch (error) {
    console.warn(`[tzParseISO] Error parsing date:`, error);
    return new Date(NaN);
  }
}

// Simplified and more reliable date parsing
function parseTimeInTimezone(date: string, time: string, timezone: string): Date {
  // Direct approach: create date in target timezone using Intl.DateTimeFormat
  const [hour, minute] = time.split(':').map(Number);
  const [year, month, day] = date.split('-').map(Number);
  
  // For America/New_York timezone, we need to account for EST/EDT
  // EST is UTC-5, EDT is UTC-4
  // Let's use a hardcoded offset for now to ensure it works
  let offsetHours = -5; // EST default
  
  // Check if we're in daylight saving time (roughly March to November)
  const dateObj = new Date(year, month - 1, day);
  const marchSecondSunday = new Date(year, 2, 8 + (7 - new Date(year, 2, 1).getDay()) % 7);
  const novemberFirstSunday = new Date(year, 10, 1 + (7 - new Date(year, 10, 1).getDay()) % 7);
  
  if (dateObj >= marchSecondSunday && dateObj < novemberFirstSunday) {
    offsetHours = -4; // EDT
  }
  
  // Create the date in UTC that represents the local time in the target timezone
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  
  // Adjust for timezone offset
  return new Date(utcDate.getTime() - (offsetHours * 60 * 60 * 1000));
}

// Helper function to check for holidays and special closures
async function checkHolidaysAndClosures(
  date: string,
  currentHours: DayHours,
  organization: any,
  facility: any,
  appointmentType: any,
  storage: IStorage
): Promise<DayHours> {
  try {
    // STEP 1: Check organization-level holidays from database
    if (organization?.id) {
      const orgHolidays = await storage.getOrganizationHolidays(organization.id);
      
      if (Array.isArray(orgHolidays)) {
        const isOrgHoliday = orgHolidays.some((holiday: any) => {
          // Use UTC midnight comparison to avoid timezone off-by-ones
          const holidayDate = holiday.date;
          let formattedHolidayDate: string;
          
          if (typeof holidayDate === 'string') {
            formattedHolidayDate = holidayDate.split('T')[0]; // Remove time part if present
          } else if (holidayDate instanceof Date) {
            // Convert to UTC midnight to avoid timezone issues
            const utcMidnight = new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate());
            formattedHolidayDate = utcMidnight.toISOString().split('T')[0];
          } else {
            formattedHolidayDate = holidayDate?.toISOString?.()?.split('T')[0] || '';
          }
          
          return formattedHolidayDate === date;
        });
        
        if (isOrgHoliday) {
          console.log(`[AvailabilityService] ${date} is an organization holiday - facility closed`);
          return { ...currentHours, open: false };
        }
      }
    }

    // STEP 1.5: Check organization metadata holidays and treat undefined as empty array
    if (organization?.metadata?.holidays) {
      const metadataHolidays = Array.isArray(organization.metadata.holidays) ? organization.metadata.holidays : [];
      
      const isMetadataHoliday = metadataHolidays.some((holiday: any) => {
        // Use UTC midnight comparison to avoid timezone off-by-ones
        const holidayDate = holiday.date;
        let formattedHolidayDate: string;
        
        if (typeof holidayDate === 'string') {
          formattedHolidayDate = holidayDate.split('T')[0];
        } else if (holidayDate instanceof Date) {
          const utcMidnight = new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate());
          formattedHolidayDate = utcMidnight.toISOString().split('T')[0];
        } else {
          formattedHolidayDate = holidayDate?.toISOString?.()?.split('T')[0] || '';
        }
        
        return formattedHolidayDate === date;
      });
      
      if (isMetadataHoliday) {
        console.log(`[AvailabilityService] ${date} is an organization metadata holiday - facility closed`);
        return { ...currentHours, open: false };
      }
    }
    
    // STEP 2: Check facility-specific holidays (can override organization holidays)
    if (facility?.holidays && Array.isArray(facility.holidays)) {
      const isFacilityHoliday = facility.holidays.some((holiday: any) => {
        // Use UTC midnight comparison to avoid timezone off-by-ones
        const holidayDate = holiday.date;
        let formattedHolidayDate: string;
        
        if (typeof holidayDate === 'string') {
          formattedHolidayDate = holidayDate.split('T')[0];
        } else if (holidayDate instanceof Date) {
          const utcMidnight = new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate());
          formattedHolidayDate = utcMidnight.toISOString().split('T')[0];
        } else {
          formattedHolidayDate = holidayDate?.toISOString?.()?.split('T')[0] || '';
        }
        
        return formattedHolidayDate === date && holiday.enabled !== false;
      });
      
      if (isFacilityHoliday) {
        console.log(`[AvailabilityService] ${date} is a facility-specific holiday`);
        return { ...currentHours, open: false };
      }
      
      // Check if facility explicitly overrides an org holiday to stay open
      const facilityOverride = facility.holidays.find((holiday: any) => {
        // Use UTC midnight comparison to avoid timezone off-by-ones
        const holidayDate = holiday.date;
        let formattedHolidayDate: string;
        
        if (typeof holidayDate === 'string') {
          formattedHolidayDate = holidayDate.split('T')[0];
        } else if (holidayDate instanceof Date) {
          const utcMidnight = new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate());
          formattedHolidayDate = utcMidnight.toISOString().split('T')[0];
        } else {
          formattedHolidayDate = holidayDate?.toISOString?.()?.split('T')[0] || '';
        }
        
        return formattedHolidayDate === date && holiday.overrideOrgHoliday === true;
      });
      
      if (facilityOverride) {
        console.log(`[AvailabilityService] ${date} - facility overrides organization holiday, staying open`);
        return currentHours; // Keep facility open despite org holiday
      }
    }
    
    // STEP 3: Check for other facility closures
    if (facility?.closures && Array.isArray(facility.closures)) {
      const isClosed = facility.closures.some((closure: any) => {
        const closureDate = closure.date;
        const formattedClosureDate = typeof closureDate === 'string' 
          ? closureDate.split('T')[0]
          : closureDate?.toISOString?.()?.split('T')[0];
        
        return formattedClosureDate === date && closure.closed === true;
      });
      
      if (isClosed) {
        console.log(`[AvailabilityService] ${date} is a facility closure day`);
        return { ...currentHours, open: false };
      }
    }
    
    // STEP 4: Check appointment-type specific holiday overrides
    // TODO: Implement appointment-type level overrides here
    if (appointmentType?.holidayOverrides && Array.isArray(appointmentType.holidayOverrides)) {
      const appointmentOverride = appointmentType.holidayOverrides.find((override: any) => {
        const overrideDate = override.date;
        const formattedOverrideDate = typeof overrideDate === 'string' 
          ? overrideDate.split('T')[0]
          : overrideDate?.toISOString?.()?.split('T')[0];
        
        return formattedOverrideDate === date;
      });
      
      if (appointmentOverride) {
        if (appointmentOverride.forceOpen) {
          console.log(`[AvailabilityService] ${date} - appointment type overrides holiday, staying open`);
          return currentHours;
        } else if (appointmentOverride.forceClosed) {
          console.log(`[AvailabilityService] ${date} - appointment type forces closure`);
          return { ...currentHours, open: false };
        }
      }
    }
    
    return currentHours;
  } catch (error) {
    console.error('[AvailabilityService] Error checking holidays and closures:', error);
    // Return current hours unchanged if there's an error
    return currentHours;
  }
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
    // ** Ensure db object is valid **
    if (!db || typeof db.select !== 'function') {
        console.error('[fetchRelevantAppointmentsForDay] Invalid db object:', db);
        return [];
    }

    // Use proper drizzle ORM query instead of raw SQL
    const rawAppointments = await db
      .select({
        id: schedules.id,
        startTime: schedules.startTime,
        endTime: schedules.endTime,
        appointmentTypeId: schedules.appointmentTypeId,
      })
      .from(schedules)
      .leftJoin(docks, eq(schedules.dockId, docks.id))
      .leftJoin(appointmentTypes, eq(schedules.appointmentTypeId, appointmentTypes.id))
      .leftJoin(facilities, eq(docks.facilityId, facilities.id))
      .where(
        and(
          or(
            eq(docks.facilityId, facilityId),
            eq(appointmentTypes.facilityId, facilityId)
          ),
          gte(schedules.startTime, dayStart),
          lt(schedules.startTime, dayEnd),
          or(
            eq(facilities.tenantId, effectiveTenantId),
            eq(appointmentTypes.tenantId, effectiveTenantId)
          )
        )
      );
    
    // Filter out appointments with null appointmentTypeId and map to correct type
    const appointments = rawAppointments
      .filter((apt: any) => apt.appointmentTypeId !== null)
      .map((apt: any) => ({
      id: apt.id,
      startTime: apt.startTime,
      endTime: apt.endTime,
      appointmentTypeId: apt.appointmentTypeId as number
    }));
    
    console.log(`[fetchRelevantAppointmentsForDay] Found ${appointments.length} appointments for facility ${facilityId}`);
    appointments.forEach((apt: any) => {
      console.log(`  - Appointment ${apt.id}: ${apt.startTime.toISOString()} (type: ${apt.appointmentTypeId})`);
    });
    
    return appointments;

  } catch (error) {
    console.error(`[fetchRelevantAppointmentsForDay] Error querying appointments:`, error);
    // Return empty array instead of throwing to prevent availability calculation from failing
    return [];
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

  const cacheKey = `availability:${date}:${facilityId}:${appointmentTypeId}:${effectiveTenantId}`;
  
  if (redis) {
    try {
      const cachedSlots = await redis.get(cacheKey);
      if (cachedSlots) {
        debugLog(`Cache HIT for key: ${cacheKey}`);
        return JSON.parse(cachedSlots);
      }
    } catch (error) {
      debugLog(`Redis cache read error for key ${cacheKey}:`, error);
    }
  }

  debugLog(`Cache MISS for key: ${cacheKey}. Calculating availability...`);

  debugLog(`Starting calculation for date=${date}, facilityId=${facilityId}, appointmentTypeId=${appointmentTypeId}, tenantId=${effectiveTenantId}`);

  // Apply configuration settings with defaults
  const mergedConfig = { ...defaultConfig, ...config };
  debugLog(`Using config: interval=${mergedConfig.intervalMinutes}min, buffer=${mergedConfig.bookingBufferMinutes}min, maxAdvance=${mergedConfig.maxAdvanceDays} days`);

  const facility = await storage.getFacility(facilityId, effectiveTenantId);
  if (!facility) { throw new Error('Facility not found or access denied.'); }
  debugLog(`Facility found: ${facility.name}, timezone: ${facility.timezone}`);

  const appointmentType = await storage.getAppointmentType(appointmentTypeId);
  if (!appointmentType) { 
    debugLog(`Appointment type ${appointmentTypeId} not found in database`);
    throw new Error('Appointment type not found or access denied.'); 
  }
  
  // CRITICAL: Validate tenant isolation for appointment type
  if (appointmentType.tenantId && appointmentType.tenantId !== effectiveTenantId) {
    debugLog(`Tenant mismatch: appointment type ${appointmentTypeId} belongs to tenant ${appointmentType.tenantId}, but request is for tenant ${effectiveTenantId}`);
    throw new Error('Appointment type not found or access denied.');
  }
  
  // FLEXIBLE: Check if appointment type and facility belong to the same tenant/organization
  // This allows appointment types to be shared across facilities within the same organization
  if (appointmentType.facilityId && appointmentType.facilityId !== facilityId) {
    debugLog(`Appointment type ${appointmentTypeId} belongs to facility ${appointmentType.facilityId}, but request is for facility ${facilityId}. Checking tenant compatibility...`);
    
    // Get organization for the appointment type's facility
    const appointmentTypeFacility = await storage.getFacility(appointmentType.facilityId, effectiveTenantId);
    if (!appointmentTypeFacility) {
      debugLog(`Appointment type's facility ${appointmentType.facilityId} not found or not accessible to tenant ${effectiveTenantId}`);
      throw new Error('Appointment type not found or access denied.');
    }
    
    // Check if both facilities belong to the same tenant - if so, allow cross-facility usage
    const requestedFacilityTenantId = facility.tenantId;
    const appointmentTypeFacilityTenantId = appointmentTypeFacility.tenantId;
    
    if (requestedFacilityTenantId && appointmentTypeFacilityTenantId && 
        requestedFacilityTenantId === appointmentTypeFacilityTenantId && 
        requestedFacilityTenantId === effectiveTenantId) {
      debugLog(`Cross-facility usage allowed: both facilities belong to tenant ${effectiveTenantId}`);
    } else {
      debugLog(`Cross-facility usage denied: tenant mismatch (requested: ${requestedFacilityTenantId}, appointment type: ${appointmentTypeFacilityTenantId}, effective: ${effectiveTenantId})`);
      throw new Error('Appointment type not found or access denied.');
    }
  }
  
  debugLog(`Appointment type validated: ${appointmentType.name} (ID: ${appointmentTypeId}, Tenant: ${appointmentType.tenantId}, Facility: ${appointmentType.facilityId})`);

  // Use provided timezone or fall back to facility timezone
  const facilityTimezone = facility.timezone || DEFAULT_TIMEZONE;
  const effectiveTimezone = customTimezone || facilityTimezone;
  debugLog(`Using timezone: ${effectiveTimezone} (facility default: ${facilityTimezone})`);
  
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
  debugLog(`Date calculation for ${date} in ${effectiveTimezone}:`);
  debugLog(`- Date parts: Year=${year}, Month=${month}, Day=${day}`);
  debugLog(`- Calculated day of week: ${dayOfWeek} (${dayOfWeek === 1 ? 'Monday' : dayOfWeek === 0 ? 'Sunday' : 'Other Day'})`);
  debugLog(`- Appointment date object: ${appointmentDate.toString()}`);
  
  // Use the original date string since we already validated it above
  const facilityTZDateStr = date; // This is already in YYYY-MM-DD format
  debugLog(`- Facility TZ date string: ${facilityTZDateStr}`);
  
  // Debug logging for final day calculation
  debugLog(`Using day of week: ${dayOfWeek} for calculations`);

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
  debugLog(`Appointment type settings: duration=${appointmentTypeDuration}min, buffer=${appointmentTypeBufferTime}min, maxConcurrent=${maxConcurrent}`);
  
  const allowAppointmentsThroughBreaks = getAppTypeField('allowAppointmentsThroughBreaks', 'allow_appointments_through_breaks', false);
  const overrideFacilityHours = getAppTypeField('overrideFacilityHours', 'override_facility_hours', false);

  debugLog(`APPOINTMENT TYPE SETTINGS SUMMARY:`);
  debugLog(`- Type ID: ${appointmentTypeId}`);
  debugLog(`- Name: ${appointmentType.name}`);
  debugLog(`- Duration: ${appointmentTypeDuration} minutes`);
  debugLog(`- Buffer Time: ${appointmentTypeBufferTime} minutes`);
  debugLog(`- Max Concurrent: ${maxConcurrent}`);
  debugLog(`- Override Facility Hours: ${overrideFacilityHours}`);
  debugLog(`- Allow Through Breaks: ${allowAppointmentsThroughBreaks}`);

  // Build hours context with proper hierarchy
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayKey = dayKeys[dayOfWeek];
  
  console.log(`[AvailabilityService] Using day key: ${dayKey} from day of week: ${dayOfWeek}`);
  
  // STEP 1: Get organization and its default hours 
  const organization = await storage.getOrganizationByFacilityId(facilityId);
  if (!organization) {
    throw new Error('Organization not found for this facility');
  }
  
  // STEP 2: Fetch organization default hours from the database
  const organizationDefaultHours = await storage.getOrganizationDefaultHours(effectiveTenantId);
  const hourEntries = Array.isArray(organizationDefaultHours) ? organizationDefaultHours : [];
  console.log(`[AvailabilityService] Retrieved ${hourEntries.length} organization default hour entries`);
  
  // STEP 3: Build organization default hours from database
  const orgHours: Record<string, DayHours> = {};
  
  // Build organization hours based on database entries or defaults
  for (const day of dayKeys) {
    const dayIndex = dayKeys.indexOf(day); // 0=Sunday, 1=Monday, etc.
    const dayHours = hourEntries.find((h: any) => h.dayOfWeek === dayIndex);
    
    let isOpen = false;
    let startTime = "08:00";
    let endTime = "17:00";
    let breakStartTime = "";
    let breakEndTime = "";
    
    if (dayHours) {
      // Use organization default hours from database
      isOpen = dayHours.isOpen === true; // Must be explicitly true
      startTime = dayHours.openTime || "08:00";
      endTime = dayHours.closeTime || "17:00";
      breakStartTime = dayHours.breakStart || "";
      breakEndTime = dayHours.breakEnd || "";
      
      console.log(`[AvailabilityService] Organization hours for ${day} (database):`, {
        dayOfWeek: dayIndex,
        open: isOpen,
        hours: isOpen ? `${startTime} - ${endTime}` : 'Closed',
        breaks: (breakStartTime && breakEndTime) ? `${breakStartTime} - ${breakEndTime}` : 'None',
        source: 'organizationDefaultHours table'
      });
    } else {
      // Fallback to default business hours (Monday-Friday 8-5, weekends closed)
      isOpen = dayIndex >= 1 && dayIndex <= 5; // Monday through Friday only
      startTime = "08:00";
      endTime = "17:00";
      breakStartTime = "";
      breakEndTime = "";
      
      console.log(`[AvailabilityService] Organization hours for ${day} (default):`, {
        dayOfWeek: dayIndex,
        open: isOpen,
        hours: isOpen ? `${startTime} - ${endTime}` : 'Closed',
        source: 'system default (Mon-Fri only)'
      });
    }
    
    orgHours[day] = {
      open: isOpen,
      start: startTime,
      end: endTime,
      breakStart: breakStartTime,
      breakEnd: breakEndTime,
    };
  }
  
  // STEP 4: Check facility hours (facilities can override organization hours)
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

  // STEP 5: Check appointment type hours (highest priority - can override facility/org hours)
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

  // STEP 6: Check for holidays and special closures
  effectiveHours = await checkHolidaysAndClosures(date, effectiveHours, organization, facility, appointmentType, storage);
  
  // STEP 7: Check if facility is open on this day
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

  // SIMPLIFIED: Create proper timezone-aware dates using the parseTimeInTimezone helper
  console.log(`[AvailabilityService] Operating hours: ${operatingStartTimeStr} - ${operatingEndTimeStr} in ${effectiveTimezone}`);
  
  const operatingStartDateTime = parseTimeInTimezone(date, operatingStartTimeStr, effectiveTimezone);
  let operatingEndDateTime = parseTimeInTimezone(date, operatingEndTimeStr, effectiveTimezone);
  
  // Adjust end time if it spans midnight
  if (operatingEndDateTime <= operatingStartDateTime) {
    operatingEndDateTime = addDays(operatingEndDateTime, 1);
  }
  
  console.log(`[AvailabilityService] Operating period: ${operatingStartDateTime.toISOString()} to ${operatingEndDateTime.toISOString()}`);
  console.log(`[AvailabilityService] Timezone conversion debug: ${operatingStartTimeStr} -> ${tzFormat(operatingStartDateTime, effectiveTimezone, 'HH:mm')} (${operatingStartDateTime.toISOString()})`);

  // Parse break times if they exist
  let breakStartDateTime: Date | null = null;
  let breakEndDateTime: Date | null = null;
  
  if (breakStartTimeStr && breakEndTimeStr && 
      breakStartTimeStr.trim() !== "" && breakEndTimeStr.trim() !== "" && 
      breakStartTimeStr.includes(':') && breakEndTimeStr.includes(':')) {
      try {
          breakStartDateTime = parseTimeInTimezone(date, breakStartTimeStr, effectiveTimezone);
          breakEndDateTime = parseTimeInTimezone(date, breakEndTimeStr, effectiveTimezone);
          
          // Adjust if break spans midnight
          if (breakEndDateTime <= breakStartDateTime) { 
              breakEndDateTime = addDays(breakEndDateTime, 1); 
          }
          
          console.log(`[AvailabilityService] Break time: ${breakStartTimeStr} to ${breakEndTimeStr} in ${effectiveTimezone}`);
      } catch (e) { 
          console.error(`[AvailabilityService] Error parsing break times: ${breakStartTimeStr} - ${breakEndTimeStr}`, e); 
          breakStartDateTime = null;
          breakEndDateTime = null;
      }
  } else {
      console.log(`[AvailabilityService] No break times configured`);
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
    const isToday = date === format(now, 'yyyy-MM-dd');
    
    // Only apply buffer time check if we're checking today's availability
    if (isToday && currentSlotStartTime < effectiveBufferCutoff) {
        // Format times to display in logs using the effective timezone
        const slotTimeStr = tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm');
        const bufferTimeStr = tzFormat(effectiveBufferCutoff, effectiveTimezone, 'HH:mm');
        console.log(`[AvailabilityService] Slot at ${slotTimeStr} is too soon (before buffer cutoff ${bufferTimeStr}, using ${effectiveBufferMinutes}min buffer from ${appointmentTypeBufferTime > 0 ? 'appointment type' : 'global config'})`);
        isSlotAvailable = false;
        reason = `Too soon (${effectiveBufferMinutes}min buffer)`;
    }

    // **SIMPLIFIED & AUTHORITATIVE CONCURRENT APPOINTMENTS ENFORCEMENT**
    if (isSlotAvailable && existingAppointments && existingAppointments.length > 0) {
        console.log(`[AvailabilityService] Checking conflicts for slot ${tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm')} against ${existingAppointments.length} existing appointments`);
        console.log(`[AvailabilityService] Appointment type max concurrent: ${maxConcurrent}`);
        
        // Count ALL overlapping appointments for this specific appointment type
        conflictingApptsCount = existingAppointments.filter((appt) => {
            const apptStart = appt.startTime.getTime();
            const apptEnd = appt.endTime.getTime();
            const slotStart = currentSlotStartTime.getTime();
            const slotEnd = currentSlotEndTime.getTime();
            
            // Check if there's ANY time overlap between slot and existing appointment
            const hasOverlap = (slotStart < apptEnd && slotEnd > apptStart);

            console.log(`[DEBUG] Checking overlap: slot [${new Date(slotStart).toISOString()} - ${new Date(slotEnd).toISOString()}] vs appt ${appt.id} [${new Date(apptStart).toISOString()} - ${new Date(apptEnd).toISOString()}] -> hasOverlap: ${hasOverlap}`);
            
            if (hasOverlap) {
                console.log(`[AvailabilityService] Found overlapping appointment: ID ${appt.id}, type: ${appt.appointmentTypeId}, time: ${tzFormat(new Date(apptStart), effectiveTimezone, 'HH:mm')} - ${tzFormat(new Date(apptEnd), effectiveTimezone, 'HH:mm')}`);
                console.log(`[DEBUG] Comparing appt type: ${appt.appointmentTypeId} vs requested type: ${appointmentTypeId}`);
                
                // **AUTHORITATIVE RULE: Only count appointments of the SAME TYPE for concurrent limits**
                if (appt.appointmentTypeId === appointmentTypeId) {
                    console.log(`[AvailabilityService] ✓ Counting towards concurrent limit (same appointment type: ${appointmentTypeId})`);
                    return true;
                } else {
                    console.log(`[AvailabilityService] ✗ Different appointment type (${appt.appointmentTypeId}), not counted towards concurrent limit`);
                    return false;
                }
            }
            
            return false;
        }).length;
        
        console.log(`[AvailabilityService] CONCURRENT CHECK: ${conflictingApptsCount} of ${maxConcurrent} slots used for appointment type ${appointmentTypeId}`);
        
        // **AUTHORITATIVE ENFORCEMENT: Strict concurrent limit check**
        if (conflictingApptsCount >= maxConcurrent) {
            console.log(`[AvailabilityService] ❌ SLOT BLOCKED: Concurrent limit reached (${conflictingApptsCount}/${maxConcurrent})`);
            isSlotAvailable = false;
            reason = `Capacity full (${conflictingApptsCount}/${maxConcurrent})`;
        } else {
            console.log(`[AvailabilityService] ✅ SLOT AVAILABLE: Within concurrent limit (${conflictingApptsCount}/${maxConcurrent})`);
        }
        
    } else if (existingAppointments && existingAppointments.length === 0) {
        console.log(`[AvailabilityService] ✅ No existing appointments - slot available`);
    }

    // **SIMPLIFIED BREAK TIME CHECK**
    if (breakStartDateTime && breakEndDateTime && !allowAppointmentsThroughBreaks) {
        const slotOverlapsBreak = currentSlotStartTime.getTime() < breakEndDateTime.getTime() && 
                                 currentSlotEndTime.getTime() > breakStartDateTime.getTime();
        
        if (slotOverlapsBreak) {
            const timeStr = tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm');
            console.log(`[AvailabilityService] ❌ SLOT BLOCKED: ${timeStr} overlaps with break time`);
            isSlotAvailable = false;
            reason = "During break time";
        }
    }

    // Calculate remaining capacity for display purposes
    const remainingCapacity = isSlotAvailable ? Math.max(0, maxConcurrent - conflictingApptsCount) : 0;
    
    // Create the slot result object with facility-local time in HH:mm format
    // This ensures times are always shown in the facility's timezone regardless of user's timezone
    const slotResult = {
      time: tzFormat(currentSlotStartTime, effectiveTimezone, 'HH:mm'),
      available: isSlotAvailable,
      remainingCapacity: remainingCapacity,
      remaining: remainingCapacity,
      reason: isSlotAvailable ? "" : reason,
    };
    
    // Log the final slot result
    console.log(`[AvailabilityService] ✅ FINAL SLOT: ${slotResult.time} (${slotResult.available ? 'Available' : 'Unavailable'}) - Capacity: ${slotResult.remainingCapacity}/${maxConcurrent} - Reason: ${slotResult.reason || 'None'}`);
    
    result.push(slotResult);

    currentSlotStartTime = addMinutes(currentSlotStartTime, slotIntervalMinutes);
  }

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', AVAILABILITY_CACHE_TTL);
      debugLog(`Cache SET for key: ${cacheKey}`);
    } catch (error) {
      debugLog(`Redis cache write error for key ${cacheKey}:`, error);
    }
  }

  return result;
}