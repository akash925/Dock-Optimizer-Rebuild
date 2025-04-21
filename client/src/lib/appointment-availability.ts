import { format, parse, addMinutes, isWithinInterval, setHours, setMinutes, isBefore, isAfter } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export interface AvailabilityRule {
  id: number;
  appointmentTypeId: number;
  dayOfWeek: number | null; // 0-6, null for any day
  startDate: string | null; // specific date range start, null for recurring
  endDate: string | null; // specific date range end, null for recurring
  startTime: string; // format: "HH:MM"
  endTime: string; // format: "HH:MM" 
  isActive: boolean;
  facilityId: number;
  maxConcurrent: number;
  maxAppointmentsPerDay?: number | null; // daily capacity
  bufferTime?: number | null; // buffer in minutes between appointments
  gracePeriod?: number | null; // grace period in minutes
  showRemainingSlots?: boolean; // whether to show remaining slot count in UI
}

export interface AvailabilitySlot {
  time: string; // "HH:MM" format
  available: boolean;
  reason?: string;
  remaining?: number; // number of remaining slots available
}

interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Fetch availability rules from the server
 */
export async function fetchAvailabilityRules(typeId: number, facilityId: number): Promise<AvailabilityRule[]> {
  // Using typeId as parameter name to match server API expectations
  const response = await fetch(`/api/appointment-master/availability-rules?typeId=${typeId}&facilityId=${facilityId}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch availability rules');
  }
  
  return await response.json();
}

/**
 * Check if a specific time slot is available
 */
export function isTimeSlotAvailable(
  date: string, // "YYYY-MM-DD"
  time: string, // "HH:MM"
  rules: AvailabilityRule[],
  durationMinutes: number,
  timezone: string = 'UTC'
): ValidationResult {
  try {
    // Validate input parameters
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error('Invalid date format for availability check:', date);
      return { valid: false, message: 'Invalid date format' };
    }
    
    if (!time || typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
      console.error('Invalid time format for availability check:', time);
      return { valid: false, message: 'Invalid time format' };
    }
    
    // If no rules, assume available for maximum flexibility
    if (!rules || rules.length === 0) {
      return { valid: true };
    }

    // Parse the date
    const appointmentDate = parse(date, 'yyyy-MM-dd', new Date());
    const dayOfWeek = appointmentDate.getDay();
    
    // Parse the time with safety checks
    const [hoursStr, minutesStr] = time.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.error('Invalid time values for availability check:', { hours, minutes });
      return { valid: false, message: 'Invalid time values' };
    }
    
    const appointmentStartTime = setHours(setMinutes(appointmentDate, minutes), hours);
    const appointmentEndTime = addMinutes(appointmentStartTime, durationMinutes);
    
    // Convert to facility timezone for proper comparison
    const zonedStartTime = timezone ? toZonedTime(appointmentStartTime, timezone) : appointmentStartTime;
    const zonedEndTime = timezone ? toZonedTime(appointmentEndTime, timezone) : appointmentEndTime;
    
    // Filter to active rules that apply to this day and date
    const applicableRules = rules.filter(rule => {
      // Filter by active status
      if (!rule.isActive) return false;
      
      // Filter by day of week if specified
      if (rule.dayOfWeek !== null && rule.dayOfWeek !== dayOfWeek) return false;
      
      // Filter by date range if specified
      if (rule.startDate && rule.endDate) {
        const ruleStartDate = new Date(rule.startDate);
        const ruleEndDate = new Date(rule.endDate);
        
        if (!isWithinInterval(appointmentDate, { start: ruleStartDate, end: ruleEndDate })) {
          return false;
        }
      }
      
      return true;
    });
    
    // If no applicable rules, assume timeslot is not available
    if (applicableRules.length === 0) {
      return { 
        valid: false, 
        message: 'No availability rules found for this date' 
      };
    }
    
    // Check each applicable rule
    for (const rule of applicableRules) {
      // Validate rule time format
      if (!rule.startTime || !rule.endTime || 
          !(/^\d{2}:\d{2}$/.test(rule.startTime)) || 
          !(/^\d{2}:\d{2}$/.test(rule.endTime))) {
        console.warn('Rule has invalid time format, skipping:', rule);
        continue;
      }
      
      // Parse rule times
      const ruleStart = parse(rule.startTime, 'HH:mm', appointmentDate);
      const ruleEnd = parse(rule.endTime, 'HH:mm', appointmentDate);
      
      // Check if the appointment time falls within the rule hours
      if (isWithinInterval(zonedStartTime, { start: ruleStart, end: ruleEnd }) && 
          isWithinInterval(zonedEndTime, { start: ruleStart, end: ruleEnd })) {
        return { valid: true };
      }
    }
    
    return { 
      valid: false, 
      message: 'The selected time is outside of available hours' 
    };
  } catch (error) {
    console.error('Error checking time slot availability:', error);
    return {
      valid: false,
      message: 'Error checking availability'
    };
  }
}

/**
 * Generate available time slots based on rules
 */
export function generateAvailableTimeSlots(
  date: string, // "YYYY-MM-DD"
  rules: AvailabilityRule[],
  durationMinutes: number,
  timezone: string = 'UTC',
  intervalMinutes: number = 15
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  
  try {
    // Validate date format - should be YYYY-MM-DD
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error('Invalid date format for availability generation:', date);
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }
    
    // If no rules, generate all slots as available for maximum flexibility
    if (!rules || rules.length === 0) {
      console.log('No availability rules found, generating all slots as available');
      // Generate all time slots as available
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += intervalMinutes) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          slots.push({
            time: timeString,
            available: true,
            reason: 'No rules configured',
            remaining: 1 // Default when no rules provided
          });
        }
      }
      return slots;
    }
    
    // Generate all possible time slots for the day
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        // Ensure valid time values before proceeding
        if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
          console.warn('Skipping invalid time values:', { hour, minute });
          continue;
        }
        
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Check availability for this slot
        const validation = isTimeSlotAvailable(date, timeString, rules, durationMinutes, timezone);
        
        // Get the first matching rule to determine max concurrent capacity
        const rule = rules.find(r => r.isActive);
        const maxConcurrent = rule?.maxConcurrent || 1;
        
        slots.push({
          time: timeString,
          available: validation.valid,
          reason: validation.valid ? undefined : validation.message,
          remaining: validation.valid ? maxConcurrent : 0 // Set capacity if slot is available
        });
      }
    }
    
    return slots;
  } catch (error) {
    console.error('Error generating availability time slots:', error);
    
    // In case of error, return a safe fallback with all slots unavailable
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({
          time: timeString,
          available: false,
          reason: 'Error generating slots',
          remaining: 0
        });
      }
    }
    
    return slots;
  }
}

/**
 * Validate a specific date and time against availability rules
 */
export function validateAppointmentDateTime(
  date: string, // "YYYY-MM-DD"
  time: string, // "HH:MM"
  rules: AvailabilityRule[],
  durationMinutes: number,
  timezone: string = 'UTC'
): ValidationResult {
  try {
    // Validate input parameters
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error('Invalid date format for appointment validation:', date);
      return { valid: false, message: 'Invalid date format' };
    }
    
    if (!time || typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
      console.error('Invalid time format for appointment validation:', time);
      return { valid: false, message: 'Invalid time format' };
    }
    
    // Check if date is in the past
    const now = new Date();
    
    try {
      const appointmentDate = parse(`${date}T${time}`, 'yyyy-MM-ddTHH:mm', new Date());
      
      if (isBefore(appointmentDate, now)) {
        return {
          valid: false,
          message: 'Cannot schedule appointments in the past'
        };
      }
    } catch (err) {
      console.error('Error parsing appointment date/time:', err);
      return { 
        valid: false, 
        message: 'Invalid date/time format' 
      };
    }
    
    // Check against availability rules
    return isTimeSlotAvailable(date, time, rules, durationMinutes, timezone);
  } catch (error) {
    console.error('Error validating appointment date/time:', error);
    return {
      valid: false,
      message: 'Error validating appointment time'
    };
  }
}

/**
 * Convert a local date and time to UTC ISO string
 */
export function dateTimeToUtcIso(
  date: string, // "YYYY-MM-DD"
  time: string, // "HH:MM"
  timezone: string = 'UTC'
): string {
  try {
    // Validate input parameters
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error('Invalid date format for UTC conversion:', date);
      throw new Error('Invalid date format');
    }
    
    if (!time || typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
      console.error('Invalid time format for UTC conversion:', time);
      throw new Error('Invalid time format');
    }
    
    // Parse the date and time
    const localDateTime = parse(`${date}T${time}`, 'yyyy-MM-ddTHH:mm', new Date());
    
    if (isNaN(localDateTime.getTime())) {
      console.error('Failed to parse date time:', { date, time });
      throw new Error('Invalid date or time');
    }
    
    // Format in the target timezone, then parse as UTC
    const utcString = timezone 
      ? formatInTimeZone(localDateTime, timezone, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") 
      : localDateTime.toISOString();
      
    const utcDateTime = new Date(utcString);
    
    // Check if the resulting date is valid
    if (isNaN(utcDateTime.getTime())) {
      console.error('Invalid UTC date after conversion:', utcString);
      throw new Error('Invalid result after timezone conversion');
    }
    
    // Return as ISO string
    return utcDateTime.toISOString();
  } catch (error) {
    console.error('Error converting date/time to UTC:', error);
    // Return current time as fallback in ISO format
    return new Date().toISOString();
  }
}