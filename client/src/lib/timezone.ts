import { formatInTimeZone } from 'date-fns-tz';

export const formatDateTimeInTimezone = (date: Date | string, timeZone: string, formatString: string): string => {
  try {
    return formatInTimeZone(date, timeZone, formatString);
  } catch (error) {
    console.error(`Error formatting date in timezone: ${timeZone}`, error);
    // Fallback to UTC if timezone is invalid
    return formatInTimeZone(date, 'Etc/UTC', formatString) + ' (UTC)';
  }
}; 