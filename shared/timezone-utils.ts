import { formatInTimeZone as formatInTZ, toZonedTime } from 'date-fns-tz';
import { addMinutes, differenceInMinutes, format } from 'date-fns';

/**
 * Unified Timezone Utilities
 * Shared between client and server for consistent timezone handling
 */

/**
 * Gets the user's timezone - browser detection on client, fallback on server
 * @param fallbackTimezone - Fallback timezone if detection fails
 * @returns IANA timezone identifier
 */
export const getUserTimeZone = (fallbackTimezone: string = 'America/New_York'): string => {
  // Browser environment - detect user timezone
  if (typeof window !== 'undefined' && typeof Intl !== 'undefined') {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      console.warn('Failed to detect user timezone, using fallback:', fallbackTimezone);
      return fallbackTimezone;
    }
  }
  
  // Server environment - return fallback (should be passed from client)
  return fallbackTimezone;
};

/**
 * Converts a UTC date to a specific timezone
 * @param utcDate - The UTC date to convert
 * @param timeZone - The IANA timezone identifier  
 * @returns Date object in the target timezone
 */
export const utcToTimeZone = (utcDate: Date | string, timeZone: string): Date => {
  if (!utcDate) return new Date();
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return toZonedTime(date, timeZone);
};

/**
 * Formats a date in a specific timezone
 * @param date - The date to format
 * @param timeZone - The IANA timezone identifier
 * @param formatStr - The date-fns format string
 * @returns Formatted date string
 */
export const formatDateInTimeZone = (
  date: Date | string,
  timeZone: string,
  formatStr: string
): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date provided to formatDateInTimeZone:', date);
      return '—';
    }
    
    return formatInTZ(dateObj, timeZone, formatStr);
  } catch (error) {
    console.error('Error formatting date in timezone:', error);
    return '—';
  }
};

/**
 * Gets timezone abbreviation (e.g., EDT, PDT)
 * @param timeZone - The IANA timezone identifier
 * @param date - Date for DST determination
 * @returns Timezone abbreviation
 */
export const getTimeZoneAbbreviation = (timeZone: string, date: Date = new Date()): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    });
    
    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    
    if (timeZonePart?.value) {
      return timeZonePart.value;
    }
    
    // Fallback to extracting from formatted string
    const formatted = formatter.format(date);
    const match = formatted.match(/\b([A-Z]{3,4})\b$/);
    if (match) {
      return match[1];
    }
    
    // Ultimate fallback to timezone mapping
    return getTimezoneAbbreviationFallback(timeZone);
  } catch (error) {
    console.error(`Error getting timezone abbreviation for ${timeZone}:`, error);
    return getTimezoneAbbreviationFallback(timeZone);
  }
};

/**
 * Fallback timezone abbreviation mapping
 */
const getTimezoneAbbreviationFallback = (timeZone: string): string => {
  const region = timeZone.split('/').pop() || '';
  
  switch(region) {
    case 'New_York': return 'ET';
    case 'Chicago': return 'CT';  
    case 'Denver': return 'MT';
    case 'Phoenix': return 'MST';
    case 'Los_Angeles': return 'PT';
    case 'Anchorage': return 'AKST';
    case 'Honolulu': return 'HST';
    default: return region.replace('_', ' ') || 'GMT';
  }
};

/**
 * Gets friendly timezone name
 * @param timeZone - IANA timezone identifier
 * @returns Human-readable timezone name
 */
export const getTimeZoneName = (timeZone: string): string => {
  const timeZoneMap: Record<string, string> = {
    'America/New_York': 'Eastern Time',
    'America/Chicago': 'Central Time',
    'America/Denver': 'Mountain Time', 
    'America/Los_Angeles': 'Pacific Time',
    'America/Phoenix': 'Mountain Standard Time',
    'America/Anchorage': 'Alaska Time',
    'Pacific/Honolulu': 'Hawaii Time'
  };
  
  return timeZoneMap[timeZone] || timeZone;
};

/**
 * Formats a date range in a specific timezone
 * @param start - Start date
 * @param end - End date
 * @param timeZone - IANA timezone identifier
 * @param dateFormat - Date format string
 * @param timeFormat - Time format string
 * @returns Formatted date range string
 */
export const formatDateRangeInTimeZone = (
  start: Date | string,
  end: Date | string,
  timeZone: string,
  dateFormat: string = 'MMM d, yyyy',
  timeFormat: string = 'h:mm a'
): string => {
  if (!start || !end) return '—';
  
  try {
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = typeof end === 'string' ? new Date(end) : end;
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return '—';
    }
    
    const startDateStr = formatDateInTimeZone(startDate, timeZone, dateFormat);
    const startTimeStr = formatDateInTimeZone(startDate, timeZone, timeFormat);
    const endTimeStr = formatDateInTimeZone(endDate, timeZone, timeFormat);
    const tzAbbr = getTimeZoneAbbreviation(timeZone, startDate);
    
    return `${startDateStr}, ${startTimeStr} - ${endTimeStr} ${tzAbbr}`;
  } catch (error) {
    console.error('Error formatting date range:', error);
    return '—';
  }
};

/**
 * Formats time range for dual timezone display
 * @param start - Start date
 * @param end - End date  
 * @param facilityTimeZone - Facility timezone
 * @param userTimeZone - User timezone (optional, auto-detected if not provided)
 * @returns Object with formatted time ranges and metadata
 */
export const formatTimeRangeForDualZones = (
  start: Date | string,
  end: Date | string,
  facilityTimeZone: string,
  userTimeZone?: string
): {
  userTimeRange: string;
  facilityTimeRange: string;
  userZoneAbbr: string;
  facilityZoneAbbr: string;
  showBothTimezones: boolean;
} => {
  const actualUserTimeZone = userTimeZone || getUserTimeZone();
  
  // Check if timezones are different
  const showBothTimezones = actualUserTimeZone !== facilityTimeZone;
  
  const defaultReturn = {
    userTimeRange: '—',
    facilityTimeRange: '—',
    userZoneAbbr: getTimeZoneAbbreviation(actualUserTimeZone),
    facilityZoneAbbr: getTimeZoneAbbreviation(facilityTimeZone),
    showBothTimezones
  };
  
  if (!start || !end) return defaultReturn;
  
  try {
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = typeof end === 'string' ? new Date(end) : end;
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return defaultReturn;
    }
    
    const timeFormat = 'h:mm a';
    
    const userStartTime = formatDateInTimeZone(startDate, actualUserTimeZone, timeFormat);
    const userEndTime = formatDateInTimeZone(endDate, actualUserTimeZone, timeFormat);
    const facilityStartTime = formatDateInTimeZone(startDate, facilityTimeZone, timeFormat);
    const facilityEndTime = formatDateInTimeZone(endDate, facilityTimeZone, timeFormat);
    
    const userZoneAbbr = getTimeZoneAbbreviation(actualUserTimeZone, startDate);
    const facilityZoneAbbr = getTimeZoneAbbreviation(facilityTimeZone, startDate);
    
    return {
      userTimeRange: `${userStartTime} - ${userEndTime}`,
      facilityTimeRange: `${facilityStartTime} - ${facilityEndTime}`,
      userZoneAbbr,
      facilityZoneAbbr,
      showBothTimezones
    };
  } catch (error) {
    console.error('Error formatting time range for dual zones:', error);
    return defaultReturn;
  }
};

/**
 * Calculates duration between two dates in minutes
 * @param start - Start date
 * @param end - End date
 * @returns Duration in minutes
 */
export const getDurationFromTimes = (start: Date | string, end: Date | string): number => {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  return differenceInMinutes(endDate, startDate);
};

/**
 * Adds duration to a start time to calculate end time
 * @param start - Start time
 * @param durationMinutes - Duration in minutes
 * @returns Calculated end time
 */
export const calculateEndTimeFromDuration = (start: Date | string, durationMinutes: number): Date => {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  return addMinutes(startDate, durationMinutes);
}; 