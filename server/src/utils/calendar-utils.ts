import { WEEKDAYS, WEEKDAY_NAMES, BUSINESS_DAYS, DEFAULT_BUSINESS_HOURS } from '../constants/enums';

/**
 * Calendar and weekday utility functions to eliminate hardcoded day logic
 */

export interface FacilityHours {
  [key: string]: boolean | string | null | undefined;
  sunday_open?: boolean;
  sunday_start?: string | null;
  sunday_end?: string | null;
  sunday_break_start?: string | null;
  sunday_break_end?: string | null;
  monday_open?: boolean;
  monday_start?: string | null;
  monday_end?: string | null;
  monday_break_start?: string | null;
  monday_break_end?: string | null;
  tuesday_open?: boolean;
  tuesday_start?: string | null;
  tuesday_end?: string | null;
  tuesday_break_start?: string | null;
  tuesday_break_end?: string | null;
  wednesday_open?: boolean;
  wednesday_start?: string | null;
  wednesday_end?: string | null;
  wednesday_break_start?: string | null;
  wednesday_break_end?: string | null;
  thursday_open?: boolean;
  thursday_start?: string | null;
  thursday_end?: string | null;
  thursday_break_start?: string | null;
  thursday_break_end?: string | null;
  friday_open?: boolean;
  friday_start?: string | null;
  friday_end?: string | null;
  friday_break_start?: string | null;
  friday_break_end?: string | null;
  saturday_open?: boolean;
  saturday_start?: string | null;
  saturday_end?: string | null;
  saturday_break_start?: string | null;
  saturday_break_end?: string | null;
}

/**
 * Get weekday name from date
 */
export function getWeekdayName(date: Date): string {
  return WEEKDAY_NAMES[date.getDay()];
}

/**
 * Check if date is a business day (Monday-Friday)
 */
export function isBusinessDay(date: Date): boolean {
  return BUSINESS_DAYS.includes(date.getDay() as 1 | 2 | 3 | 4 | 5);
}

/**
 * Check if facility is open on a specific date
 */
export function isFacilityOpen(date: Date, facility: FacilityHours): boolean {
  const dayName = getWeekdayName(date);
  const openField = `${dayName}_open` as keyof FacilityHours;
  
  // Default behavior: weekdays open unless explicitly closed, weekends closed unless explicitly open
  const isWeekend = !isBusinessDay(date);
  const defaultOpen = !isWeekend;
  
  // Get the facility's setting for this day
  const facilityOpen = facility[openField];
  
  // Handle null/undefined values with sensible defaults
  if (facilityOpen === null || facilityOpen === undefined) {
    return defaultOpen;
  }
  
  return Boolean(facilityOpen);
}

/**
 * Get facility hours for a specific date
 */
export function getFacilityHours(date: Date, facility: FacilityHours): {
  isOpen: boolean;
  startTime: string | null;
  endTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
} {
  const dayName = getWeekdayName(date);
  const isOpen = isFacilityOpen(date, facility);
  
  if (!isOpen) {
    return {
      isOpen: false,
      startTime: null,
      endTime: null,
      breakStart: null,
      breakEnd: null
    };
  }
  
  const startField = `${dayName}_start` as keyof FacilityHours;
  const endField = `${dayName}_end` as keyof FacilityHours;
  const breakStartField = `${dayName}_break_start` as keyof FacilityHours;
  const breakEndField = `${dayName}_break_end` as keyof FacilityHours;
  
  return {
    isOpen,
    startTime: (facility[startField] as string) || DEFAULT_BUSINESS_HOURS.START,
    endTime: (facility[endField] as string) || DEFAULT_BUSINESS_HOURS.END,
    breakStart: (facility[breakStartField] as string) || null,
    breakEnd: (facility[breakEndField] as string) || null
  };
}

/**
 * Get all weekday field names for a facility
 */
export function getWeekdayFields(): {
  [dayName: string]: {
    open: string;
    start: string;
    end: string;
    breakStart: string;
    breakEnd: string;
  };
} {
  const fields: any = {};
  
  WEEKDAY_NAMES.forEach(day => {
    fields[day] = {
      open: `${day}_open`,
      start: `${day}_start`,
      end: `${day}_end`,
      breakStart: `${day}_break_start`,
      breakEnd: `${day}_break_end`
    };
  });
  
  return fields;
}

/**
 * Create default facility hours (business days open 8-5, weekends closed)
 */
export function createDefaultFacilityHours(): Partial<FacilityHours> {
  const hours: Partial<FacilityHours> = {};
  
  WEEKDAY_NAMES.forEach(day => {
    const isBusinessDay = day !== 'sunday' && day !== 'saturday';
    
    hours[`${day}_open` as keyof FacilityHours] = isBusinessDay;
    hours[`${day}_start` as keyof FacilityHours] = isBusinessDay ? DEFAULT_BUSINESS_HOURS.START : null;
    hours[`${day}_end` as keyof FacilityHours] = isBusinessDay ? DEFAULT_BUSINESS_HOURS.END : null;
    hours[`${day}_break_start` as keyof FacilityHours] = null;
    hours[`${day}_break_end` as keyof FacilityHours] = null;
  });
  
  return hours;
}

/**
 * Check if time falls within business hours for a date
 */
export function isWithinBusinessHours(
  dateTime: Date, 
  facility: FacilityHours
): boolean {
  const facilityHours = getFacilityHours(dateTime, facility);
  
  if (!facilityHours.isOpen || !facilityHours.startTime || !facilityHours.endTime) {
    return false;
  }
  
  const timeStr = dateTime.toTimeString().substring(0, 5); // HH:MM format
  
  // Check if within main business hours
  const withinMainHours = timeStr >= facilityHours.startTime && timeStr <= facilityHours.endTime;
  
  // Check if within break time (if break is defined)
  let withinBreak = false;
  if (facilityHours.breakStart && facilityHours.breakEnd) {
    withinBreak = timeStr >= facilityHours.breakStart && timeStr <= facilityHours.breakEnd;
  }
  
  return withinMainHours && !withinBreak;
}

/**
 * Get next business day from a given date
 */
export function getNextBusinessDay(date: Date): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  while (!isBusinessDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}

/**
 * Validate time string format (HH:MM)
 */
export function isValidTimeFormat(timeStr: string): boolean {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);
}

/**
 * Convert time string to minutes since midnight for comparison
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Compare two time strings
 */
export function compareTime(time1: string, time2: string): number {
  return timeToMinutes(time1) - timeToMinutes(time2);
} 