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
}

interface AvailabilitySlot {
  time: string; // "HH:MM" format
  available: boolean;
  reason?: string;
}

interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Fetch availability rules from the server
 */
export async function fetchAvailabilityRules(appointmentTypeId: number, facilityId: number): Promise<AvailabilityRule[]> {
  const response = await fetch(`/api/appointment-master/availability-rules?typeId=${appointmentTypeId}&facilityId=${facilityId}`);
  
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
  // If no rules, assume available
  if (!rules || rules.length === 0) {
    return { valid: true };
  }

  // Parse the date
  const appointmentDate = parse(date, 'yyyy-MM-dd', new Date());
  const dayOfWeek = appointmentDate.getDay();
  
  // Parse the time
  const [hours, minutes] = time.split(':').map(Number);
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
  
  // If no rules, return empty array
  if (!rules || rules.length === 0) {
    // Generate all time slots without availability
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += intervalMinutes) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({
          time: timeString,
          available: false,
          reason: 'No availability rules configured'
        });
      }
    }
    return slots;
  }
  
  // Generate all possible time slots for the day
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Check availability for this slot
      const validation = isTimeSlotAvailable(date, timeString, rules, durationMinutes, timezone);
      
      slots.push({
        time: timeString,
        available: validation.valid,
        reason: validation.valid ? undefined : validation.message
      });
    }
  }
  
  return slots;
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
  // Check if date is in the past
  const now = new Date();
  const appointmentDate = parse(`${date}T${time}`, 'yyyy-MM-ddTHH:mm', new Date());
  
  if (isBefore(appointmentDate, now)) {
    return {
      valid: false,
      message: 'Cannot schedule appointments in the past'
    };
  }
  
  // Check against availability rules
  return isTimeSlotAvailable(date, time, rules, durationMinutes, timezone);
}

/**
 * Convert a local date and time to UTC ISO string
 */
export function dateTimeToUtcIso(
  date: string, // "YYYY-MM-DD"
  time: string, // "HH:MM"
  timezone: string = 'UTC'
): string {
  // Parse the date and time
  const localDateTime = parse(`${date}T${time}`, 'yyyy-MM-ddTHH:mm', new Date());
  
  // Format in the target timezone, then parse as UTC
  const utcString = timezone 
    ? formatInTimeZone(localDateTime, timezone, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") 
    : localDateTime.toISOString();
    
  const utcDateTime = new Date(utcString);
  
  // Return as ISO string
  return utcDateTime.toISOString();
}