import { apiRequest } from "@/lib/queryClient";
import { format, parse, isWithinInterval, startOfDay, endOfDay, setHours, setMinutes, addMinutes } from "date-fns";
import { utcToFacilityTime, facilityTimeToUtc } from "./timezone-utils";

// Types for availability rules
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

// Fetch availability rules for a specific appointment type and facility
export async function fetchAvailabilityRules(appointmentTypeId: number, facilityId: number): Promise<AvailabilityRule[]> {
  try {
    const response = await apiRequest(
      "GET", 
      `/api/appointment-master/availability-rules?typeId=${appointmentTypeId}&facilityId=${facilityId}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch availability rules:", error);
    return [];
  }
}

// Check if a specific date and time falls within any availability rule
export function isTimeSlotAvailable(
  date: Date | string,
  time: string,
  rules: AvailabilityRule[],
  facilityTimezone: string
): { available: boolean; reason?: string } {
  // Convert to date object if string
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  // Only consider active rules
  const activeRules = rules.filter(rule => rule.isActive);
  
  if (activeRules.length === 0) {
    return { available: false, reason: "No active availability rules found" };
  }
  
  // Get day of week (0-6, Sunday is 0)
  const dayOfWeek = dateObj.getDay();
  
  // Parse the time string to hours and minutes
  const [hours, minutes] = time.split(":").map(Number);
  
  // Create a full datetime by combining the date and time
  const targetDateTime = new Date(dateObj);
  targetDateTime.setHours(hours, minutes, 0, 0);
  
  // Convert to facility timezone for comparison with rules
  const facilityDateTime = utcToFacilityTime(targetDateTime, facilityTimezone);
  
  // Check against each rule
  for (const rule of activeRules) {
    // Check day of week constraint if specified
    if (rule.dayOfWeek !== null && rule.dayOfWeek !== dayOfWeek) {
      continue;
    }
    
    // Check date range constraint if specified
    if (rule.startDate && rule.endDate) {
      const startDate = new Date(rule.startDate);
      const endDate = new Date(rule.endDate);
      
      if (!isWithinInterval(dateObj, { start: startOfDay(startDate), end: endOfDay(endDate) })) {
        continue;
      }
    }
    
    // Parse rule times
    const ruleStartTime = rule.startTime.split(":");
    const ruleEndTime = rule.endTime.split(":");
    
    const ruleStartHour = parseInt(ruleStartTime[0], 10);
    const ruleStartMinute = parseInt(ruleStartTime[1], 10);
    const ruleEndHour = parseInt(ruleEndTime[0], 10);
    const ruleEndMinute = parseInt(ruleEndTime[1], 10);
    
    // Create rule timeframe for today
    const ruleStart = new Date(dateObj);
    ruleStart.setHours(ruleStartHour, ruleStartMinute, 0, 0);
    
    const ruleEnd = new Date(dateObj);
    ruleEnd.setHours(ruleEndHour, ruleEndMinute, 0, 0);
    
    // Check if target time is within rule timeframe
    if (facilityDateTime >= ruleStart && facilityDateTime <= ruleEnd) {
      // Check concurrent appointment limit logic here (would need to fetch existing appointments)
      // This is a simplified version
      return { available: true };
    }
  }
  
  return { 
    available: false, 
    reason: "The selected time is outside available booking hours" 
  };
}

// Generate available time slots for a specific date based on rules
export function generateAvailableTimeSlots(
  date: Date | string,
  rules: AvailabilityRule[],
  appointmentDuration: number,
  facilityTimezone: string,
  intervalMinutes: number = 15
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = [];
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  // Loop through all possible time slots in the day (every 15 mins by default)
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += intervalMinutes) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Check if this slot is available
      const availability = isTimeSlotAvailable(dateObj, timeString, rules, facilityTimezone);
      
      // For multi-hour appointments, we need to check if the entire duration is available
      if (availability.available && appointmentDuration > intervalMinutes) {
        // Create a slot end time
        const slotStart = new Date(dateObj);
        slotStart.setHours(hour, minute, 0, 0);
        const slotEnd = addMinutes(slotStart, appointmentDuration);
        
        // Check every 15-min increment within the appointment duration
        let allIncrementAvailable = true;
        let currentTime = addMinutes(slotStart, intervalMinutes);
        
        while (currentTime < slotEnd) {
          const incrementTimeString = format(currentTime, "HH:mm");
          const incrementAvailability = isTimeSlotAvailable(
            dateObj, 
            incrementTimeString, 
            rules, 
            facilityTimezone
          );
          
          if (!incrementAvailability.available) {
            allIncrementAvailable = false;
            availability.available = false;
            availability.reason = incrementAvailability.reason;
            break;
          }
          
          currentTime = addMinutes(currentTime, intervalMinutes);
        }
      }
      
      slots.push({
        time: timeString,
        available: availability.available,
        reason: availability.reason
      });
    }
  }
  
  return slots;
}

// Validate a selected date and time against availability rules before form submission
export function validateAppointmentDateTime(
  date: string,
  time: string, 
  rules: AvailabilityRule[],
  appointmentDuration: number,
  facilityTimezone: string
): { valid: boolean; message?: string } {
  // First check if the simple time slot is available
  const availability = isTimeSlotAvailable(date, time, rules, facilityTimezone);
  
  if (!availability.available) {
    return { 
      valid: false, 
      message: availability.reason || "The selected time is not available for booking"
    };
  }
  
  // Then check if the entire appointment duration is available
  const dateObj = new Date(date);
  const [hours, minutes] = time.split(":").map(Number);
  dateObj.setHours(hours, minutes, 0, 0);
  
  const endDateTime = addMinutes(dateObj, appointmentDuration);
  const endTimeString = format(endDateTime, "HH:mm");
  
  const endAvailability = isTimeSlotAvailable(date, endTimeString, rules, facilityTimezone);
  
  if (!endAvailability.available) {
    return {
      valid: false,
      message: "The appointment duration extends beyond available booking hours"
    };
  }
  
  // Check every 15 minutes during the appointment
  for (let i = 15; i < appointmentDuration; i += 15) {
    const incrementDateTime = addMinutes(dateObj, i);
    const incrementTimeString = format(incrementDateTime, "HH:mm");
    
    const incrementAvailability = isTimeSlotAvailable(
      date, 
      incrementTimeString, 
      rules, 
      facilityTimezone
    );
    
    if (!incrementAvailability.available) {
      return {
        valid: false,
        message: "The appointment overlaps with unavailable time periods"
      };
    }
  }
  
  return { valid: true };
}

// Convert date and time strings to UTC ISO string with timezone consideration
export function dateTimeToUtcIso(
  dateString: string, 
  timeString: string, 
  facilityTimezone: string
): string {
  // Parse the date string (expected format: YYYY-MM-DD)
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Parse the time string (expected format: HH:MM)
  const [hours, minutes] = timeString.split(':').map(Number);
  
  // Create a date object in the facility's timezone
  const facilityTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  // Convert to UTC
  const utcTime = facilityTimeToUtc(facilityTime, facilityTimezone);
  
  // Return ISO string
  return utcTime.toISOString();
}