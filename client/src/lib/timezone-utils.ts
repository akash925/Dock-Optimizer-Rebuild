import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { addMinutes, differenceInMinutes, format } from 'date-fns';

/**
 * Retrieves the user's local time zone from the browser.
 * 
 * @returns {string} The IANA time zone identifier (e.g., 'America/New_York')
 * @example
 * const userTz = getUserTimeZone(); // 'America/Los_Angeles'
 */
export const getUserTimeZone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Converts a UTC date to the user's local time zone.
 * 
 * @param {Date | string} utcDate - The UTC date to convert (Date object or ISO string)
 * @returns {Date} A new Date object representing the same moment in the user's time zone
 * @throws Will return current date if utcDate is falsy
 * @example
 * const localTime = utcToUserTime('2025-04-22T12:00:00Z');
 */
export const utcToUserTime = (utcDate: Date | string): Date => {
  if (!utcDate) return new Date();
  const userTimeZone = getUserTimeZone();
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return toZonedTime(date, userTimeZone);
};

/**
 * Converts a UTC date to a specific facility's time zone.
 * 
 * @param {Date | string} utcDate - The UTC date to convert (Date object or ISO string)
 * @param {string} facilityTimeZone - The IANA time zone identifier for the facility
 * @returns {Date} A new Date object representing the same moment in the facility's time zone
 * @throws Will return current date if utcDate is falsy
 * @example
 * const facilityTime = utcToFacilityTime('2025-04-22T12:00:00Z', 'America/Chicago');
 */
export const utcToFacilityTime = (utcDate: Date | string, facilityTimeZone: string): Date => {
  if (!utcDate) return new Date();
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return toZonedTime(date, facilityTimeZone);
};

/**
 * Converts a date from a facility's time zone to UTC.
 * 
 * @param {Date | string} date - The date in facility time zone to convert
 * @param {string} facilityTimeZone - The IANA time zone identifier for the facility
 * @returns {Date} A new Date object representing the same moment in UTC
 * @throws Will return current date if date is falsy
 * @example
 * const utcDate = facilityTimeToUtc(facilityDate, 'America/Chicago');
 */
export const facilityTimeToUtc = (date: Date | string, facilityTimeZone: string): Date => {
  if (!date) return new Date();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // Use alternative approach since zonedTimeToUtc is not available
  const isoStringWithOffset = formatInTimeZone(dateObj, facilityTimeZone, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  return new Date(isoStringWithOffset);
};

/**
 * Converts a date from the user's time zone to UTC.
 * 
 * @param {Date | string} date - The date in user's time zone to convert
 * @returns {Date} A new Date object representing the same moment in UTC
 * @throws Will return current date if date is falsy
 * @example
 * const utcDate = userTimeToUtc(localDate);
 */
export const userTimeToUtc = (date: Date | string): Date => {
  if (!date) return new Date();
  const userTimeZone = getUserTimeZone();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // Use alternative approach since zonedTimeToUtc is not available
  const isoStringWithOffset = formatInTimeZone(dateObj, userTimeZone, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  return new Date(isoStringWithOffset);
};

/**
 * Formats a date in the user's local time zone according to the specified format string.
 * 
 * @param {Date | string} date - The date to format (Date object or ISO string)
 * @param {string} formatStr - The date-fns format string
 * @returns {string} The formatted date string in the user's time zone
 * @throws Will return empty string if date is falsy
 * @example
 * const formattedDate = formatInUserTimeZone(date, 'yyyy-MM-dd HH:mm');
 */
export const formatInUserTimeZone = (date: Date | string, formatStr: string): string => {
  if (!date) return '';
  try {
    const userTimeZone = getUserTimeZone();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date provided to formatInUserTimeZone:', date);
      return '—';
    }
    return formatInTimeZone(dateObj, userTimeZone, formatStr);
  } catch (error) {
    console.error('Error formatting date in user timezone:', error);
    return '—';
  }
};

/**
 * Formats a date in a specific facility's time zone according to the specified format string.
 * 
 * @param {Date | string} date - The date to format (Date object or ISO string)
 * @param {string} facilityTimeZone - The IANA time zone identifier for the facility
 * @param {string} formatStr - The date-fns format string
 * @returns {string} The formatted date string in the facility's time zone
 * @throws Will return empty string if date is falsy
 * @example
 * const formattedDate = formatInFacilityTimeZone(date, 'America/Chicago', 'yyyy-MM-dd HH:mm');
 */
export const formatInFacilityTimeZone = (date: Date | string, formatStr: string, facilityTimeZone: string): string => {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date provided to formatInFacilityTimeZone:', date);
      return '—';
    }
    return formatInTimeZone(dateObj, facilityTimeZone, formatStr);
  } catch (error) {
    console.error('Error formatting date in facility timezone:', error);
    return '—';
  }
};

/**
 * Formats a date for display in both the user's and facility's time zones.
 * 
 * @param {Date | string} date - The date to format (Date object or ISO string)
 * @param {string} facilityTimeZone - The IANA time zone identifier for the facility
 * @param {string} [formatStr='h:mm a'] - The date-fns format string (defaults to time format)
 * @returns {Object} An object containing formatted strings for both time zones and zone identifiers
 * @returns {string} .userTime - The date formatted in the user's time zone
 * @returns {string} .facilityTime - The date formatted in the facility's time zone
 * @returns {string} .userZone - The user's time zone identifier
 * @returns {string} .facilityZone - The facility's time zone identifier
 * @example
 * const { userTime, facilityTime } = formatForDualTimeZoneDisplay(date, 'America/Chicago');
 */
export const formatForDualTimeZoneDisplay = (
  date: Date | string,
  facilityTimeZone: string,
  formatStr: string = 'h:mm a'
): { userTime: string; facilityTime: string; userZone: string; facilityZone: string } => {
  if (!date) {
    return {
      userTime: '—',
      facilityTime: '—',
      userZone: getUserTimeZone(),
      facilityZone: facilityTimeZone
    };
  }
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const userTimeZone = getUserTimeZone();
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date provided to formatForDualTimeZoneDisplay:', date);
      return {
        userTime: '—',
        facilityTime: '—',
        userZone: userTimeZone,
        facilityZone: facilityTimeZone
      };
    }
    
    return {
      userTime: formatInTimeZone(dateObj, userTimeZone, formatStr),
      facilityTime: formatInTimeZone(dateObj, facilityTimeZone, formatStr),
      userZone: userTimeZone,
      facilityZone: facilityTimeZone
    };
  } catch (error) {
    console.error('Error in formatForDualTimeZoneDisplay:', error);
    return {
      userTime: '—',
      facilityTime: '—',
      userZone: getUserTimeZone(),
      facilityZone: facilityTimeZone
    };
  }
};

/**
 * Gets the abbreviated name of a time zone (e.g., EST, PDT) for the given date.
 * 
 * @param {string} timeZone - The IANA time zone identifier
 * @param {Date} [date=new Date()] - The date for which to get the abbreviation (to account for DST)
 * @returns {string} The time zone abbreviation
 * @example
 * const tzAbbr = getTimeZoneAbbreviation('America/New_York'); // 'EDT' (during daylight saving time)
 */
export const getTimeZoneAbbreviation = (timeZone: string, date: Date = new Date()): string => {
  try {
    // Extract abbreviation from formatted date
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    });
    
    // This gives a format like "4/28/25, 6:07 PM EDT"
    const formatted = formatter.format(date);
    
    // Extract abbreviation (usually the last 3-4 characters after a space)
    const parts = formatted.split(' ');
    const abbr = parts[parts.length - 1];
    
    if (abbr && /^[A-Z]{3,4}$/.test(abbr)) {
      // Return if we have a proper abbreviation (3-4 uppercase letters)
      return abbr;
    }
    
    // Try another approach - using formatToParts
    const formattedParts = formatter.formatToParts(date);
    const timeZonePart = formattedParts.find(part => part.type === 'timeZoneName');
    if (timeZonePart?.value) {
      return timeZonePart.value;
    }
    
    // If all else fails, return a simplified timezone name
    return timeZone.split('/').pop()?.replace('_', ' ') || timeZone;
  } catch (error) {
    console.error(`Error getting timezone abbreviation for ${timeZone}:`, error);
    
    // Fallback to returning the last part of the timezone as an abbreviation
    return timeZone.split('/').pop()?.replace('_', ' ') || timeZone;
  }
};

/**
 * Calculates the duration in minutes between two UTC timestamps.
 * 
 * @param {Date | string} start - The start time (Date object or ISO string)
 * @param {Date | string} end - The end time (Date object or ISO string)
 * @returns {number} The duration in minutes
 * @throws Will throw error if start or end dates are invalid
 * @example
 * const durationInMinutes = getDurationFromUtcTimes(startDate, endDate);
 */
export const getDurationFromUtcTimes = (start: Date | string, end: Date | string): number => {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  return differenceInMinutes(endDate, startDate);
};

/**
 * Calculates the end time by adding a duration to a start time.
 * 
 * @param {Date | string} start - The start time (Date object or ISO string)
 * @param {number} durationMinutes - The duration in minutes to add
 * @returns {Date} A new Date object representing the calculated end time
 * @throws Will throw error if start date is invalid
 * @example
 * const endTime = calculateEndTimeFromDuration(startDate, 60); // 1 hour later
 */
export const calculateEndTimeFromDuration = (start: Date | string, durationMinutes: number): Date => {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  return addMinutes(startDate, durationMinutes);
};

/**
 * Formats a date range for display in a single time zone.
 * 
 * @param {Date | string} start - The start time (Date object or ISO string)
 * @param {Date | string} end - The end time (Date object or ISO string)
 * @param {string} timeZone - The IANA time zone identifier
 * @param {string} [dateFormat='MMM d, yyyy'] - The date-fns format string for the date part
 * @param {string} [timeFormat='h:mm a'] - The date-fns format string for the time part
 * @returns {string} A formatted string representing the date range with time zone abbreviation
 * @example
 * const rangeStr = formatDateRangeInTimeZone(start, end, 'America/Chicago');
 * // "Apr 22, 2025, 9:00 AM - 10:00 AM CDT"
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
    
    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error('Invalid date provided to formatDateRangeInTimeZone:', { start, end });
      return '—';
    }
    
    try {
      const startDateStr = formatInTimeZone(startDate, timeZone, dateFormat);
      const startTimeStr = formatInTimeZone(startDate, timeZone, timeFormat);
      const endTimeStr = formatInTimeZone(endDate, timeZone, timeFormat);
      
      return `${startDateStr}, ${startTimeStr} - ${endTimeStr} ${getTimeZoneAbbreviation(timeZone, startDate)}`;
    } catch (formatError) {
      console.error('Error formatting time in formatDateRangeInTimeZone:', formatError);
      return '—';
    }
  } catch (error) {
    console.error('Error in formatDateRangeInTimeZone:', error);
    return '—';
  }
};

/**
 * Formats a time range for display in both user's and facility's time zones.
 * 
 * @param {Date | string} start - The start time (Date object or ISO string)
 * @param {Date | string} end - The end time (Date object or ISO string)
 * @param {string} facilityTimeZone - The IANA time zone identifier for the facility
 * @returns {Object} An object containing formatted time ranges and time zone abbreviations
 * @returns {string} .userTimeRange - The time range formatted in the user's time zone (e.g., "9:00 AM - 10:00 AM")
 * @returns {string} .facilityTimeRange - The time range formatted in the facility's time zone
 * @returns {string} .userZoneAbbr - The user's time zone abbreviation (e.g., "EDT")
 * @returns {string} .facilityZoneAbbr - The facility's time zone abbreviation
 * @example
 * const { userTimeRange, facilityTimeRange, userZoneAbbr, facilityZoneAbbr } = 
 *   formatTimeRangeForDualZones(start, end, 'America/Chicago');
 */
/**
 * Gets the current time in a specific time zone.
 * 
 * @param {string} timeZone - The IANA time zone identifier, if none provided uses the user's local time zone
 * @returns {Date} A Date object representing the current time in the specified time zone
 * @example
 * const currentLATime = getCurrentTimeInTimeZone('America/Los_Angeles');
 */
export const getCurrentTimeInTimeZone = (timeZone?: string): Date => {
  const tz = timeZone || getUserTimeZone();
  const now = new Date();
  return toZonedTime(now, tz);
};

/**
 * Formats a time range for display in both user's and facility's time zones.
 * Handles different timezone conversions properly.
 * 
 * @param {Date | string} start - The start time (Date object or ISO string)
 * @param {Date | string} end - The end time (Date object or ISO string)
 * @param {string} facilityTimeZone - The IANA time zone identifier for the facility
 * @returns {Object} An object containing formatted time ranges and time zone abbreviations
 * @returns {string} .userTimeRange - The time range formatted in the user's time zone (e.g., "9:00 AM - 10:00 AM")
 * @returns {string} .facilityTimeRange - The time range formatted in the facility's time zone
 * @returns {string} .userZoneAbbr - The user's time zone abbreviation (e.g., "EDT")
 * @returns {string} .facilityZoneAbbr - The facility's time zone abbreviation
 * @returns {boolean} .showBothTimezones - Whether to show both timezones (true if they differ)
 */
export const formatTimeRangeForDualZones = (
  start: Date | string,
  end: Date | string,
  facilityTimeZone: string
): { 
  userTimeRange: string; 
  facilityTimeRange: string;
  userZoneAbbr: string;
  facilityZoneAbbr: string;
  showBothTimezones: boolean;
} => {
  const userTimeZone = getUserTimeZone();
  const showBothTimezones = userTimeZone !== facilityTimeZone;
  
  // Default return object for error cases
  const defaultReturn = {
    userTimeRange: '—',
    facilityTimeRange: '—',
    userZoneAbbr: getTimeZoneAbbreviation(userTimeZone),
    facilityZoneAbbr: getTimeZoneAbbreviation(facilityTimeZone),
    showBothTimezones
  };
  
  if (!start || !end) {
    return defaultReturn;
  }
  
  try {
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = typeof end === 'string' ? new Date(end) : end;
    
    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error('Invalid date provided to formatTimeRangeForDualZones:', { start, end });
      return defaultReturn;
    }
    
    // Safe approach for timezone formatting using date-fns-tz
    const timeFormat = 'h:mm a';
    
    try {
      // Format start and end times in both timezones
      const userStartTime = formatInTimeZone(startDate, userTimeZone, timeFormat);
      const userEndTime = formatInTimeZone(endDate, userTimeZone, timeFormat);
      const facilityStartTime = formatInTimeZone(startDate, facilityTimeZone, timeFormat);
      const facilityEndTime = formatInTimeZone(endDate, facilityTimeZone, timeFormat);
      
      // Get timezone abbreviations
      const userZoneAbbr = getTimeZoneAbbreviation(userTimeZone, startDate);
      const facilityZoneAbbr = getTimeZoneAbbreviation(facilityTimeZone, startDate);
      
      // Log debug info
      console.log(`Time range in ${facilityTimeZone} (facility): ${facilityStartTime} - ${facilityEndTime} ${facilityZoneAbbr}`);
      if (showBothTimezones) {
        console.log(`Time range in ${userTimeZone} (user): ${userStartTime} - ${userEndTime} ${userZoneAbbr}`);
      }
      
      return {
        userTimeRange: `${userStartTime} - ${userEndTime}`,
        facilityTimeRange: `${facilityStartTime} - ${facilityEndTime}`,
        userZoneAbbr,
        facilityZoneAbbr,
        showBothTimezones
      };
    } catch (formatError) {
      console.error('Error formatting time in formatTimeRangeForDualZones:', formatError);
      return defaultReturn;
    }
  } catch (error) {
    console.error('Error in formatTimeRangeForDualZones:', error);
    return defaultReturn;
  }
};