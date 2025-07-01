import { DateTime } from 'luxon';

/**
 * Format a date object to a human-readable string using Luxon
 * @param date The date to format
 * @returns Formatted date string (e.g. "Apr 23, 2025, 8:30 PM")
 */
export function formatDate(date: Date): string {
  return DateTime.fromJSDate(date).toFormat('LLL d, yyyy, h:mm a');
}

/**
 * Format a date as a short date string using Luxon
 * @param date The date to format
 * @returns Formatted date string (e.g. "Apr 23, 2025")
 */
export function formatShortDate(date: Date): string {
  return DateTime.fromJSDate(date).toFormat('LLL d, yyyy');
}

/**
 * Format a date as a time string using Luxon
 * @param date The date to format
 * @returns Formatted time string (e.g. "8:30 PM")
 */
export function formatTime(date: Date): string {
  return DateTime.fromJSDate(date).toFormat('h:mm a');
}

/**
 * Get a relative time string (e.g. "2 hours ago")
 * @param date The date to compare against the current time
 * @returns Relative time string
 */
export function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  
  const diffInSecs = Math.floor(diffInMs / 1000);
  if (diffInSecs < 60) return rtf.format(-diffInSecs, 'second');
  
  const diffInMins = Math.floor(diffInSecs / 60);
  if (diffInMins < 60) return rtf.format(-diffInMins, 'minute');
  
  const diffInHours = Math.floor(diffInMins / 60);
  if (diffInHours < 24) return rtf.format(-diffInHours, 'hour');
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return rtf.format(-diffInDays, 'day');
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return rtf.format(-diffInMonths, 'month');
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return rtf.format(-diffInYears, 'year');
}

/**
 * Format a date/time string in a specific facility's timezone using Luxon
 * @param dateString The date string to format
 * @param timezone The facility's timezone (e.g. "America/New_York")
 * @returns Formatted time string in facility timezone
 */
export function formatInFacilityTimeZone(dateString: string, timezone?: string): string {
  try {
    const tz = timezone || 'America/New_York';
    return DateTime.fromISO(dateString).setZone(tz).toFormat('h:mm a');
  } catch (e) {
    return formatTime(new Date(dateString));
  }
}

/**
 * Format a date for dual timezone display (facility time + user time)
 * @param dateString The date string to format
 * @param facilityTimezone The facility's timezone
 * @returns Formatted string showing both timezones
 */
export function formatForDualTimeZoneDisplay(dateString: string, facilityTimezone?: string): string {
  try {
    const date = new Date(dateString);
    const facilityTime = formatInFacilityTimeZone(dateString, facilityTimezone);
    const userTime = formatTime(date);
    
    if (facilityTimezone && facilityTimezone !== DateTime.local().zoneName) {
      return `${facilityTime} (${getTimeZoneAbbreviation(facilityTimezone)})`;
    }
    
    return userTime;
  } catch (e) {
    return formatTime(new Date(dateString));
  }
}

/**
 * Get timezone abbreviation from timezone identifier using Luxon
 * @param timezone The timezone identifier (e.g. "America/New_York")
 * @returns Timezone abbreviation (e.g. "EST" or "EDT")
 */
export function getTimeZoneAbbreviation(timezone: string): string {
  try {
    return DateTime.now().setZone(timezone).toFormat('ZZZZ');
  } catch (e) {
    return timezone;
  }
}