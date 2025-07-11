/**
 * CENTRALIZED TIMEZONE SERVICE
 * Single source of truth for all timezone operations across the application
 * Consolidates functionality from multiple scattered timezone utilities
 */

import { format, formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { parseISO, addMinutes, isValid } from 'date-fns';
import { DateTime } from 'luxon';

export const DEFAULT_TIMEZONE = 'America/New_York';
export const UTC_TIMEZONE = 'UTC';

/**
 * Centralized timezone service class
 */
export class TimezoneService {
  private static instance: TimezoneService;
  private userTimezone: string;

  private constructor() {
    this.userTimezone = this.detectUserTimezone();
  }

  public static getInstance(): TimezoneService {
    if (!TimezoneService.instance) {
      TimezoneService.instance = new TimezoneService();
    }
    return TimezoneService.instance;
  }

  /**
   * Detect user's timezone from browser
   */
  private detectUserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
    } catch (error) {
      console.warn('Failed to detect user timezone, using default:', error);
      return DEFAULT_TIMEZONE;
    }
  }

  /**
   * Get user's current timezone
   */
  public getUserTimeZone(): string {
    return this.userTimezone;
  }

  /**
   * Set user's timezone (for testing or user preference)
   */
  public setUserTimeZone(timezone: string): void {
    this.userTimezone = timezone;
  }

  /**
   * Get timezone abbreviation (e.g., EST, PDT, GMT)
   */
  public getTimeZoneAbbreviation(timezone?: string, date?: Date): string {
    const targetTimezone = timezone || this.userTimezone;
    const targetDate = date || new Date();
    
    try {
      // Try Luxon approach first
      const luxonResult = DateTime.fromJSDate(targetDate, { zone: targetTimezone }).toFormat('ZZZZ');
      if (luxonResult && luxonResult !== 'GMT') {
        return luxonResult;
      }

      // Fall back to Intl.DateTimeFormat
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: targetTimezone,
        timeZoneName: 'short'
      });
      
      const parts = formatter.formatToParts(targetDate);
      const timeZonePart = parts.find(part => part.type === 'timeZoneName');
      return timeZonePart?.value || this.getTimezoneAbbreviationFallback(targetTimezone);
    } catch (error) {
      console.warn('Failed to get timezone abbreviation:', error);
      return this.getTimezoneAbbreviationFallback(targetTimezone);
    }
  }

  /**
   * Fallback timezone abbreviation mapping
   */
  private getTimezoneAbbreviationFallback(timezone: string): string {
    const region = timezone.split('/').pop() || '';
    switch(region) {
      case 'New_York': return 'ET';
      case 'Chicago': return 'CT';
      case 'Denver': return 'MT';
      case 'Phoenix': return 'MST';
      case 'Los_Angeles': return 'PT';
      case 'Anchorage': return 'AKST';
      case 'Honolulu': return 'HST';
      case 'London': return 'GMT';
      case 'Paris': return 'CET';
      case 'Tokyo': return 'JST';
      case 'Sydney': return 'AEST';
      default: return region || 'GMT';
    }
  }

  /**
   * Get full timezone name (Eastern Standard Time, etc.)
   */
  public getTimeZoneName(timezone?: string, date?: Date): string {
    const targetTimezone = timezone || this.userTimezone;
    const targetDate = date || new Date();
    
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: targetTimezone,
        timeZoneName: 'long'
      });
      
      const parts = formatter.formatToParts(targetDate);
      const timeZonePart = parts.find(part => part.type === 'timeZoneName');
      return timeZonePart?.value || targetTimezone;
    } catch (error) {
      console.warn('Failed to get timezone name:', error);
      return targetTimezone;
    }
  }

  /**
   * Format date in specific timezone
   */
  public formatInTimeZone(date: Date | string, timezone: string, formatStr: string): string {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return formatInTimeZone(dateObj, timezone, formatStr);
    } catch (error) {
      console.error('Failed to format date in timezone:', error);
      return '—';
    }
  }

  /**
   * Convert UTC date to specific timezone
   */
  public utcToTimezone(utcDate: Date | string, timezone: string): Date {
    if (!utcDate) return new Date();
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    return toZonedTime(date, timezone);
  }

  /**
   * Convert date from specific timezone to UTC
   */
  public timezoneToUtc(date: Date | string, timezone: string): Date {
    if (!date) return new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return fromZonedTime(dateObj, timezone);
  }

  /**
   * Format date for dual timezone display
   */
  public formatForDualTimeZoneDisplay(
    date: Date | string,
    facilityTimezone: string,
    formatStr: string = 'h:mm a'
  ): { userTime: string; facilityTime: string; userZone: string; facilityZone: string } {
    if (!date) {
      return {
        userTime: '—',
        facilityTime: '—',
        userZone: this.userTimezone,
        facilityZone: facilityTimezone
      };
    }
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      if (isNaN(dateObj.getTime())) {
        console.error('Invalid date provided to formatForDualTimeZoneDisplay:', date);
        return {
          userTime: '—',
          facilityTime: '—',
          userZone: this.userTimezone,
          facilityZone: facilityTimezone
        };
      }
      
      return {
        userTime: formatInTimeZone(dateObj, this.userTimezone, formatStr),
        facilityTime: formatInTimeZone(dateObj, facilityTimezone, formatStr),
        userZone: this.userTimezone,
        facilityZone: facilityTimezone
      };
    } catch (error) {
      console.error('Error in formatForDualTimeZoneDisplay:', error);
      return {
        userTime: '—',
        facilityTime: '—',
        userZone: this.userTimezone,
        facilityZone: facilityTimezone
      };
    }
  }

  /**
   * Parse time string in specific timezone
   */
  public parseTimeInTimezone(dateStr: string, timeStr: string, timezone: string): Date {
    try {
      const [hours, minutes] = timeStr.split(':').map(num => parseInt(num, 10));
      
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error(`Invalid time format: ${timeStr}`);
      }
      
      const dateTimeStr = `${dateStr}T${timeStr.padStart(5, '0')}:00`;
      const localDate = parseISO(dateTimeStr);
      
      return fromZonedTime(localDate, timezone);
    } catch (error) {
      console.error('Failed to parse time in timezone:', { dateStr, timeStr, timezone, error });
      throw new Error(`Failed to parse time ${timeStr} in timezone ${timezone}`);
    }
  }

  /**
   * Convert appointment time to UTC (used in booking)
   */
  public convertAppointmentTimeToUTC(date: string, time: string, timezone: string): Date {
    return this.parseTimeInTimezone(date, time, timezone);
  }

  /**
   * Get current time in specific timezone
   */
  public getCurrentTimeInTimeZone(timezone?: string): Date {
    const tz = timezone || this.userTimezone;
    const now = new Date();
    return toZonedTime(now, tz);
  }

  /**
   * Get list of common timezones for dropdowns
   */
  public getCommonTimezones(): Array<{ value: string; label: string; abbreviation: string }> {
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
      abbreviation: this.getTimeZoneAbbreviation(tz)
    }));
  }

  /**
   * Server-side Luxon formatting (for server utilities)
   */
  public formatWithLuxon(iso: string, tz: string, fmt: string): string {
    return DateTime.fromISO(iso, { zone: 'utc' }).setZone(tz).toFormat(fmt);
  }

  /**
   * Format date in user's timezone
   */
  public formatInUserTimeZone(date: Date, formatStr: string): string {
    if (!date || isNaN(date.getTime())) {
      return '—';
    }
    
    try {
      return formatInTimeZone(date, this.userTimezone, formatStr);
    } catch (error) {
      console.error('Error formatting date in user timezone:', error);
      return '—';
    }
  }

  /**
   * Format date range in timezone
   */
  public formatDateRangeInTimeZone(
    startDate: Date, 
    endDate: Date, 
    timezone: string, 
    dateFormat: string, 
    timeFormat: string
  ): string {
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return '—';
    }
    
    try {
      const startFormatted = formatInTimeZone(startDate, timezone, `${dateFormat} ${timeFormat}`);
      const endFormatted = formatInTimeZone(endDate, timezone, timeFormat);
      
      // If same date, show date once: "Dec 25, 2024 9:00 AM - 5:00 PM"
      const startDateOnly = formatInTimeZone(startDate, timezone, dateFormat);
      const endDateOnly = formatInTimeZone(endDate, timezone, dateFormat);
      
      if (startDateOnly === endDateOnly) {
        const startTimeOnly = formatInTimeZone(startDate, timezone, timeFormat);
        const endTimeOnly = formatInTimeZone(endDate, timezone, timeFormat);
        return `${startDateOnly} ${startTimeOnly} - ${endTimeOnly}`;
      } else {
        // Different dates: "Dec 25, 2024 9:00 AM - Dec 26, 2024 5:00 PM"
        return `${startFormatted} - ${endFormatted}`;
      }
    } catch (error) {
      console.error('Error formatting date range:', error);
      return '—';
    }
  }

  /**
   * Format for email notifications
   */
  public formatForEmail(date: Date | string, timezone: string): string {
    return this.formatInTimeZone(date, timezone, 'EEEE, MMMM d, yyyy h:mm aa');
  }

  /**
   * Format for calendar display
   */
  public formatForCalendar(date: Date | string, timezone: string): string {
    return this.formatInTimeZone(date, timezone, 'MMM d, yyyy h:mm a');
  }
}

// Export singleton instance
export const timezoneService = TimezoneService.getInstance();

// Export convenience functions for backward compatibility
export const getUserTimeZone = () => timezoneService.getUserTimeZone();
export const getTimeZoneAbbreviation = (timezone?: string, date?: Date) => 
  timezoneService.getTimeZoneAbbreviation(timezone, date);
export const getTimeZoneName = (timezone?: string, date?: Date) => 
  timezoneService.getTimeZoneName(timezone, date);
export const formatInFacilityTimeZone = (date: Date | string, timezone: string, formatStr?: string) => 
  timezoneService.formatInTimeZone(date, timezone, formatStr || 'h:mm a');
export const formatForDualTimeZoneDisplay = (date: Date | string, facilityTimezone: string, formatStr?: string) => 
  timezoneService.formatForDualTimeZoneDisplay(date, facilityTimezone, formatStr);
export const convertAppointmentTimeToUTC = (date: string, time: string, timezone: string) => 
  timezoneService.convertAppointmentTimeToUTC(date, time, timezone);
export const parseTimeInTimezone = (dateStr: string, timeStr: string, timezone: string) => 
  timezoneService.parseTimeInTimezone(dateStr, timeStr, timezone);
export const getCommonTimezones = () => timezoneService.getCommonTimezones();
export const utcToUserTime = (utcDate: Date | string) => timezoneService.utcToTimezone(utcDate, timezoneService.getUserTimeZone());
export const utcToFacilityTime = (utcDate: Date | string, facilityTimezone: string) => 
  timezoneService.utcToTimezone(utcDate, facilityTimezone);
export const facilityTimeToUtc = (date: Date | string, facilityTimezone: string) => 
  timezoneService.timezoneToUtc(date, facilityTimezone);
export const userTimeToUtc = (date: Date | string) => 
  timezoneService.timezoneToUtc(date, timezoneService.getUserTimeZone());
export const getCurrentTimeInTimeZone = (timezone?: string) => 
  timezoneService.getCurrentTimeInTimeZone(timezone);

// Server-side functions
export const formatWithTZ = (iso: string, tz: string, fmt: string) => 
  timezoneService.formatWithLuxon(iso, tz, fmt);

export const formatInUserTimeZone = (date: Date, formatStr: string) =>
  timezoneService.formatInUserTimeZone(date, formatStr);

export const formatDateRangeInTimeZone = (
  startDate: Date, 
  endDate: Date, 
  timezone: string, 
  dateFormat: string, 
  timeFormat: string
) => timezoneService.formatDateRangeInTimeZone(startDate, endDate, timezone, dateFormat, timeFormat);

export const formatForEmail = (date: Date | string, timezone: string) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return timezoneService.formatWithLuxon(dateObj.toISOString(), timezone, 'MMMM d, yyyy \'at\' h:mm a ZZZZ');
};

export const formatForCalendar = (date: Date | string, timezone: string) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return timezoneService.formatWithLuxon(dateObj.toISOString(), timezone, 'MMM d, h:mm a');
}; 