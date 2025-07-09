/**
 * Comprehensive Timezone Utilities
 * Provides consistent timezone handling across the entire application
 */

import { format, formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { parseISO, addMinutes, isValid } from 'date-fns';

export const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Get the user's current timezone
 */
export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch (error) {
    console.warn('Failed to get user timezone, using default:', error);
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Get timezone abbreviation (EST, PST, etc.)
 */
export function getTimeZoneAbbreviation(timezone: string, date?: Date): string {
  try {
    const dateToUse = date || new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(dateToUse);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart?.value || timezone;
  } catch (error) {
    console.warn('Failed to get timezone abbreviation for', timezone, error);
    return timezone;
  }
}

/**
 * Get full timezone name (Eastern Standard Time, Pacific Daylight Time, etc.)
 */
export function getTimeZoneName(timezone: string, date?: Date): string {
  try {
    const dateToUse = date || new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'long'
    });
    
    const parts = formatter.formatToParts(dateToUse);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart?.value || timezone;
  } catch (error) {
    console.warn('Failed to get timezone name for', timezone, error);
    return timezone;
  }
}

/**
 * Parse a time string (HH:MM) in a specific timezone and date
 * Returns a Date object in UTC
 */
export function parseTimeInTimezone(dateStr: string, timeStr: string, timezone: string): Date {
  try {
    const [hours, minutes] = timeStr.split(':').map(num => parseInt(num, 10));
    
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    
    // Create a date in the target timezone
    const dateTimeStr = `${dateStr}T${timeStr.padStart(5, '0')}:00`;
    const localDate = parseISO(dateTimeStr);
    
    // Convert from the timezone to UTC
    return fromZonedTime(localDate, timezone);
  } catch (error) {
    console.error('Failed to parse time in timezone:', { dateStr, timeStr, timezone, error });
    throw new Error(`Failed to parse time ${timeStr} in timezone ${timezone}`);
  }
}

/**
 * Convert appointment time from facility timezone to UTC for storage
 * This is used when creating appointments from the UI
 */
export function convertAppointmentTimeToUTC(
  dateStr: string, 
  timeStr: string, 
  facilityTimezone: string
): Date {
  try {
    console.log(`[TimezoneUtils] Converting appointment time: ${dateStr} ${timeStr} from ${facilityTimezone} to UTC`);
    
    const utcTime = parseTimeInTimezone(dateStr, timeStr, facilityTimezone);
    
    console.log(`[TimezoneUtils] Converted to UTC: ${utcTime.toISOString()}`);
    return utcTime;
  } catch (error) {
    console.error('Failed to convert appointment time to UTC:', error);
    throw error;
  }
}

/**
 * Convert UTC time to facility timezone for display
 */
export function convertUTCToFacilityTime(
  utcDate: Date, 
  facilityTimezone: string,
  formatStr: string = 'yyyy-MM-dd HH:mm'
): string {
  try {
    return formatInTimeZone(utcDate, facilityTimezone, formatStr);
  } catch (error) {
    console.error('Failed to convert UTC to facility time:', error);
    return format(utcDate, formatStr);
  }
}

/**
 * Convert UTC time to user's local timezone for display
 */
export function convertUTCToUserTime(
  utcDate: Date, 
  userTimezone: string = getUserTimeZone(),
  formatStr: string = 'yyyy-MM-dd HH:mm'
): string {
  try {
    return formatInTimeZone(utcDate, userTimezone, formatStr);
  } catch (error) {
    console.error('Failed to convert UTC to user time:', error);
    return format(utcDate, formatStr);
  }
}

/**
 * Format time for dual timezone display (facility + user)
 */
export function formatForDualTimeZoneDisplay(
  utcDate: Date,
  facilityTimezone: string,
  userTimezone: string = getUserTimeZone(),
  formatStr: string = 'MMM d, h:mm aa'
): {
  facilityTime: string;
  facilityAbbr: string;
  userTime: string;
  userAbbr: string;
  isSameTimezone: boolean;
} {
  const facilityTime = convertUTCToFacilityTime(utcDate, facilityTimezone, formatStr);
  const facilityAbbr = getTimeZoneAbbreviation(facilityTimezone, utcDate);
  
  const userTime = convertUTCToUserTime(utcDate, userTimezone, formatStr);
  const userAbbr = getTimeZoneAbbreviation(userTimezone, utcDate);
  
  const isSameTimezone = facilityTimezone === userTimezone;
  
  return {
    facilityTime,
    facilityAbbr,
    userTime,
    userAbbr,
    isSameTimezone
  };
}

/**
 * Safely parse a date input with fallback handling
 */
export function safeParseDate(dateInput: Date | string | null | undefined): Date {
  if (!dateInput) {
    console.warn('[TimezoneUtils] Null or undefined date input, using current time');
    return new Date();
  }
  
  if (dateInput instanceof Date) {
    if (isValid(dateInput)) {
      return dateInput;
    } else {
      console.warn('[TimezoneUtils] Invalid Date object, using current time');
      return new Date();
    }
  }
  
  try {
    const parsed = new Date(dateInput);
    if (isValid(parsed)) {
      return parsed;
    } else {
      console.warn(`[TimezoneUtils] Invalid date string: ${dateInput}, using current time`);
      return new Date();
    }
  } catch (error) {
    console.error(`[TimezoneUtils] Failed to parse date: ${dateInput}`, error);
    return new Date();
  }
}

/**
 * Check if a timezone is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get a list of common timezones for dropdowns
 */
export function getCommonTimezones(): Array<{ value: string; label: string; abbreviation: string }> {
  const timezones = [
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu',
    'UTC',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ];
  
  return timezones.map(tz => ({
    value: tz,
    label: tz.replace('_', ' '),
    abbreviation: getTimeZoneAbbreviation(tz)
  }));
}

/**
 * Business hours utilities
 */
export interface BusinessHours {
  open: boolean;
  start: string; // HH:MM format
  end: string;   // HH:MM format
  breakStart?: string;
  breakEnd?: string;
}

/**
 * Check if a time falls within business hours in a specific timezone
 */
export function isWithinBusinessHours(
  dateTime: Date,
  businessHours: BusinessHours,
  timezone: string
): boolean {
  if (!businessHours.open) {
    return false;
  }
  
  try {
    const timeInTz = formatInTimeZone(dateTime, timezone, 'HH:mm');
    const [hours, minutes] = timeInTz.split(':').map(num => parseInt(num, 10));
    const timeMinutes = hours * 60 + minutes;
    
    const [startHours, startMinutes] = businessHours.start.split(':').map(num => parseInt(num, 10));
    const startTimeMinutes = startHours * 60 + startMinutes;
    
    const [endHours, endMinutes] = businessHours.end.split(':').map(num => parseInt(num, 10));
    const endTimeMinutes = endHours * 60 + endMinutes;
    
    // Handle overnight business hours
    if (endTimeMinutes <= startTimeMinutes) {
      return timeMinutes >= startTimeMinutes || timeMinutes < endTimeMinutes;
    }
    
    return timeMinutes >= startTimeMinutes && timeMinutes < endTimeMinutes;
  } catch (error) {
    console.error('Failed to check business hours:', error);
    return false;
  }
} 