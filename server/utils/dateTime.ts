import { DateTime } from 'luxon';

// Re-export from centralized timezone service
export { 
  formatWithTZ, 
  formatForEmail, 
  formatForCalendar 
} from '@shared/timezone-service';

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