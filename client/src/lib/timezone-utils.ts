import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { addMinutes, differenceInMinutes, format } from 'date-fns';

// Get the user's local time zone
export const getUserTimeZone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

// Convert UTC date to user's local time zone
export const utcToUserTime = (utcDate: Date | string): Date => {
  if (!utcDate) return new Date();
  const userTimeZone = getUserTimeZone();
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return toZonedTime(date, userTimeZone);
};

// Convert UTC date to facility time zone
export const utcToFacilityTime = (utcDate: Date | string, facilityTimeZone: string): Date => {
  if (!utcDate) return new Date();
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return toZonedTime(date, facilityTimeZone);
};

// Convert date from facility time zone to UTC
export const facilityTimeToUtc = (date: Date | string, facilityTimeZone: string): Date => {
  if (!date) return new Date();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // Use alternative approach since zonedTimeToUtc is not available
  const isoStringWithOffset = formatInTimeZone(dateObj, facilityTimeZone, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  return new Date(isoStringWithOffset);
};

// Convert date from user time zone to UTC
export const userTimeToUtc = (date: Date | string): Date => {
  if (!date) return new Date();
  const userTimeZone = getUserTimeZone();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // Use alternative approach since zonedTimeToUtc is not available
  const isoStringWithOffset = formatInTimeZone(dateObj, userTimeZone, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  return new Date(isoStringWithOffset);
};

// Format the date in the user's time zone
export const formatInUserTimeZone = (date: Date | string, formatStr: string): string => {
  if (!date) return '';
  const userTimeZone = getUserTimeZone();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, userTimeZone, formatStr);
};

// Format the date in the facility's time zone
export const formatInFacilityTimeZone = (date: Date | string, facilityTimeZone: string, formatStr: string): string => {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, facilityTimeZone, formatStr);
};

// Format the date for display in both time zones
export const formatForDualTimeZoneDisplay = (
  date: Date | string,
  facilityTimeZone: string,
  formatStr: string = 'h:mm a'
): { userTime: string; facilityTime: string; userZone: string; facilityZone: string } => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const userTimeZone = getUserTimeZone();
  
  return {
    userTime: formatInTimeZone(dateObj, userTimeZone, formatStr),
    facilityTime: formatInTimeZone(dateObj, facilityTimeZone, formatStr),
    userZone: userTimeZone,
    facilityZone: facilityTimeZone
  };
};

// Get time zone abbreviation (e.g., EST, PDT)
export const getTimeZoneAbbreviation = (timeZone: string, date: Date = new Date()): string => {
  // Extract abbreviation from formatted date
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  });
  
  const formatted = formatter.format(date);
  // Extract abbreviation (usually the last 3-4 characters after a space)
  const parts = formatted.split(' ');
  return parts[parts.length - 1] || timeZone;
};

// Calculate the duration in minutes from a UTC start to end time
export const getDurationFromUtcTimes = (start: Date | string, end: Date | string): number => {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  return differenceInMinutes(endDate, startDate);
};

// Calculate the end time based on a UTC start time and duration in minutes
export const calculateEndTimeFromDuration = (start: Date | string, durationMinutes: number): Date => {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  return addMinutes(startDate, durationMinutes);
};

// Format a date range for display in a single time zone
export const formatDateRangeInTimeZone = (
  start: Date | string,
  end: Date | string,
  timeZone: string,
  dateFormat: string = 'MMM d, yyyy',
  timeFormat: string = 'h:mm a'
): string => {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  
  const startDateStr = formatInTimeZone(startDate, timeZone, dateFormat);
  const startTimeStr = formatInTimeZone(startDate, timeZone, timeFormat);
  const endTimeStr = formatInTimeZone(endDate, timeZone, timeFormat);
  
  return `${startDateStr}, ${startTimeStr} - ${endTimeStr} ${getTimeZoneAbbreviation(timeZone, startDate)}`;
};

// Format a time-only range for display in both time zones
export const formatTimeRangeForDualZones = (
  start: Date | string,
  end: Date | string,
  facilityTimeZone: string
): { 
  userTimeRange: string; 
  facilityTimeRange: string;
  userZoneAbbr: string;
  facilityZoneAbbr: string;
} => {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  const userTimeZone = getUserTimeZone();
  
  const timeFormat = 'h:mm a';
  
  const userStartTime = formatInTimeZone(startDate, userTimeZone, timeFormat);
  const userEndTime = formatInTimeZone(endDate, userTimeZone, timeFormat);
  const facilityStartTime = formatInTimeZone(startDate, facilityTimeZone, timeFormat);
  const facilityEndTime = formatInTimeZone(endDate, facilityTimeZone, timeFormat);
  
  const userZoneAbbr = getTimeZoneAbbreviation(userTimeZone, startDate);
  const facilityZoneAbbr = getTimeZoneAbbreviation(facilityTimeZone, startDate);
  
  return {
    userTimeRange: `${userStartTime} - ${userEndTime}`,
    facilityTimeRange: `${facilityStartTime} - ${facilityEndTime}`,
    userZoneAbbr,
    facilityZoneAbbr
  };
};