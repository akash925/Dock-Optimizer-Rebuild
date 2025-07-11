/**
 * LEGACY TIMEZONE UTILS - DEPRECATED
 * This file is maintained for backward compatibility only.
 * New code should use @shared/timezone-service instead.
 */

// Re-export everything from the centralized timezone service
export { 
  timezoneService,
  TimezoneService,
  DEFAULT_TIMEZONE,
  UTC_TIMEZONE,
  getUserTimeZone,
  getTimeZoneAbbreviation,
  getTimeZoneName,
  formatInFacilityTimeZone,
  formatForDualTimeZoneDisplay,
  formatInUserTimeZone,
  formatDateRangeInTimeZone,
  convertAppointmentTimeToUTC,
  parseTimeInTimezone,
  getCommonTimezones,
  utcToUserTime,
  utcToFacilityTime,
  facilityTimeToUtc,
  userTimeToUtc,
  getCurrentTimeInTimeZone,
  formatWithTZ,
  formatForEmail,
  formatForCalendar
} from './timezone-service'; 