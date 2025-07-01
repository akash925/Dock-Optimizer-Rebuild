import { DateTime } from 'luxon';

/**
 * Format an ISO date string with proper timezone handling using Luxon
 * @param iso - ISO 8601 date string
 * @param tz - Timezone (e.g., 'America/New_York', 'UTC')
 * @param fmt - Luxon format string (e.g., 'yyyy-MM-dd HH:mm:ss', 'h:mm a')
 * @returns Formatted date string
 */
export const formatWithTZ = (iso: string, tz: string, fmt: string): string => {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone(tz).toFormat(fmt);
};

/**
 * Format a date for email display with timezone information
 * @param iso - ISO 8601 date string
 * @param tz - Timezone (e.g., 'America/New_York')
 * @returns Formatted string like "8:00 AM EDT / 12:00 UTC"
 */
export const formatForEmail = (iso: string, tz: string): string => {
  const dt = DateTime.fromISO(iso, { zone: 'utc' });
  const local = dt.setZone(tz);
  const utc = dt.setZone('utc');
  
  const localTime = local.toFormat('h:mm a');
  const localZone = local.toFormat('ZZZZ'); // e.g., "EDT"
  const utcTime = utc.toFormat('h:mm a');
  
  return `${localTime} ${localZone} / ${utcTime} UTC`;
};

/**
 * Format a date for calendar display
 * @param iso - ISO 8601 date string  
 * @param tz - Timezone
 * @returns Formatted string like "January 15, 2024 at 8:00 AM"
 */
export const formatForCalendar = (iso: string, tz: string): string => {
  return DateTime.fromISO(iso, { zone: 'utc' })
    .setZone(tz)
    .toFormat('MMMM d, yyyy \'at\' h:mm a');
};

/**
 * Get the current time in a specific timezone
 * @param tz - Timezone
 * @returns DateTime object in the specified timezone
 */
export const nowInTZ = (tz: string): DateTime => {
  return DateTime.now().setZone(tz);
};

/**
 * Convert a date from one timezone to another
 * @param iso - ISO 8601 date string
 * @param fromTZ - Source timezone
 * @param toTZ - Target timezone
 * @returns DateTime object in target timezone
 */
export const convertTZ = (iso: string, fromTZ: string, toTZ: string): DateTime => {
  return DateTime.fromISO(iso, { zone: fromTZ }).setZone(toTZ);
}; 