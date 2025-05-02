import { useCallback, useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

// Types
export interface AvailabilityRule {
  id: number;
  facilityId: number;
  appointmentTypeId?: number;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  maxConcurrent?: number;
  maxAppointmentsPerDay?: number;
  bufferTime?: number;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
  reason?: string;
  remaining?: number;
  isBufferTime?: boolean;
}

export interface UseAppointmentAvailabilityProps {
  facilityId?: number | null;
  typeId?: number | null;
  appointmentTypeId?: number | null;
  mode?: 'trailer' | 'container';
  timezone?: string;
  facilityTimezone?: string;
  date?: string | Date | null;
  duration?: number;
  onTimeSlotGenerated?: (slots: AvailabilitySlot[], firstAvailableSlot: string | null) => void;
}

interface BookedAppointment {
  startTime: string | Date;
  endTime: string | Date;
  appointmentTypeId: number;
}

/**
 * Fixed version of useAppointmentAvailability hook without duplicate declarations
 */
export function useAppointmentAvailability({
  facilityId,
  typeId,
  appointmentTypeId = typeId,
  mode = 'trailer',
  timezone,
  facilityTimezone,
  date,
  duration,
  onTimeSlotGenerated
}: UseAppointmentAvailabilityProps) {
  // State
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);
  const [bookedAppointments, setBookedAppointments] = useState<BookedAppointment[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    date ? (typeof date === 'string' ? date : date.toISOString().split('T')[0]) : null
  );

  // Function to fetch master availability rules
  const fetchAvailabilityRules = useCallback(async () => {
    if (!facilityId) return [];
    
    const effectiveTypeId = appointmentTypeId || typeId;
    
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('facilityId', String(facilityId));
      if (effectiveTypeId) {
        queryParams.append('appointmentTypeId', String(effectiveTypeId));
      }
      
      const url = `/api/appointment-master/availability-rules?${queryParams.toString()}`;
      const response = await apiRequest('GET', url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch availability rules: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching availability rules:", error);
      setError(error instanceof Error ? error : new Error('Failed to fetch availability rules'));
      return [];
    }
  }, [facilityId, appointmentTypeId, typeId]);

  // Function to fetch booked appointments for a specific date
  const fetchBookedAppointments = useCallback(async (dateStr: string) => {
    if (!facilityId) return [];
    
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('facilityId', String(facilityId));
      queryParams.append('date', dateStr);
      
      const url = `/api/schedules/booked?${queryParams.toString()}`;
      const response = await apiRequest('GET', url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch booked appointments: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching booked appointments:", error);
      setError(error instanceof Error ? error : new Error('Failed to fetch booked appointments'));
      return [];
    }
  }, [facilityId]);

  // Generate time slots based on rules & booked appointments
  const generateTimeSlots = useCallback((
    dateStr: string, 
    rules: AvailabilityRule[], 
    booked: BookedAppointment[]
  ): AvailabilitySlot[] => {
    if (!dateStr || !rules || rules.length === 0) {
      return [];
    }
    
    try {
      // Parse date and get day of week (0 = Sunday, 6 = Saturday)
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      
      // Filter rules for this day
      const dayRules = rules.filter(rule => 
        rule.dayOfWeek === undefined || rule.dayOfWeek === null || rule.dayOfWeek === dayOfWeek
      );
      
      if (dayRules.length === 0) {
        return [];
      }
      
      // Get global opening hours from the rules
      const openingHours = dayRules.reduce((hours, rule) => {
        if (rule.startTime && rule.endTime) {
          return {
            start: rule.startTime < hours.start ? rule.startTime : hours.start,
            end: rule.endTime > hours.end ? rule.endTime : hours.end
          };
        }
        return hours;
      }, { 
        start: '23:59:00', 
        end: '00:00:00' 
      });
      
      // Calculate appointment duration (in minutes)
      const appointmentDuration = duration || (mode === 'trailer' ? 60 : 120);
      
      // Generate 15-minute time slots from opening to closing
      const slots: AvailabilitySlot[] = [];
      
      // Start with the opening time
      let currentTime = new Date(`${dateStr}T${openingHours.start}`);
      const closingTime = new Date(`${dateStr}T${openingHours.end}`);
      
      // Ensure we don't generate slots if we're in an invalid state
      if (isNaN(currentTime.getTime()) || isNaN(closingTime.getTime())) {
        console.error("Invalid opening/closing times", openingHours);
        return [];
      }
      
      // Generate time slots until closing time
      // Subtract appointment duration to ensure appointments don't go past closing
      const adjustedClosingTime = new Date(closingTime.getTime() - (appointmentDuration * 60 * 1000));
      
      console.log(`Generating time slots from ${openingHours.start} to ${openingHours.end} (adjusted: ${adjustedClosingTime.toTimeString().substring(0, 5)}) with ${appointmentDuration} minute duration`);
      
      while (currentTime <= adjustedClosingTime) {
        // Format as HH:MM
        const timeString = currentTime.toTimeString().substring(0, 5);
        const appointmentEnd = new Date(currentTime.getTime() + (appointmentDuration * 60 * 1000));
        
        // Check if the time slot is available based on rules and booked appointments
        let isAvailable = true;
        let reason = '';
        let remainingSlots = Number.MAX_SAFE_INTEGER;
        
        // Check max concurrent appointments allowed at this time
        const relevantRules = dayRules.filter(rule => {
          if (!rule.startTime || !rule.endTime) return false;
          
          const ruleStart = new Date(`${dateStr}T${rule.startTime}`);
          const ruleEnd = new Date(`${dateStr}T${rule.endTime}`);
          
          return currentTime >= ruleStart && appointmentEnd <= ruleEnd;
        });
        
        // Find the buffer time from the relevant rules (if any)
        let bufferTime = 0; // Default no buffer
        for (const rule of relevantRules) {
          if (rule.bufferTime && rule.bufferTime > bufferTime) {
            bufferTime = rule.bufferTime;
          }
        }
        
        // If no relevant rules for this time slot, it's unavailable
        if (relevantRules.length === 0) {
          isAvailable = false;
          reason = 'Outside operating hours';
        } else {
          // Count overlapping booked appointments
          const overlappingAppointments = booked.filter(app => {
            const appStart = new Date(app.startTime);
            const appEnd = new Date(app.endTime);
            
            // Check direct overlap with the appointment without buffer zone concept
            // In our new implementation, buffer time only determines the interval between slots,
            // not "dead zones" around existing appointments
            const overlapsAppointment = (
              (currentTime < appEnd && appointmentEnd > appStart) ||
              (appStart < appointmentEnd && appEnd > currentTime)
            );
            
            // Log for debugging (only in development)
            if (process.env.NODE_ENV === 'development') {
              console.log(`[Overlap Check] New appointment: ${currentTime.toTimeString()} - ${appointmentEnd.toTimeString()}`);
              console.log(`[Overlap Check] Booked appointment: ${appStart.toTimeString()} - ${appEnd.toTimeString()}`);
              console.log(`[Overlap Check] Direct overlap: ${overlapsAppointment}`);
            }
            
            // Only check for direct appointment overlap, not buffer zones
            return overlapsAppointment;
          });
          
          // Check max concurrent constraints from rules
          for (const rule of relevantRules) {
            if (typeof rule.maxConcurrent === 'number') {
              const remaining = rule.maxConcurrent - overlappingAppointments.length;
              
              // Update the smallest remaining slots count
              if (remaining < remainingSlots) {
                remainingSlots = remaining;
              }
              
              if (remaining <= 0) {
                isAvailable = false;
                reason = 'No available slots';
                break;
              }
            }
          }
        }
        
        // Buffer time is no longer a property of time slots - it's only used to control interval
        // Remove the isBufferTime concept as it's not needed when using buffer time as intervals
        const isBufferTime = false;
        
        // Add the slot
        slots.push({
          time: timeString,
          available: isAvailable,
          reason: !isAvailable ? reason : undefined,
          remaining: isAvailable ? remainingSlots : 0,
          isBufferTime // Add this property to identify buffer time slots
        });
        
        // Find the buffer time from the relevant rules (for interval calculation)
        let intervalMinutes = 15; // Default interval is 15 minutes
        
        // Use buffer time as interval if available and greater than 0
        if (relevantRules.length > 0) {
          for (const rule of relevantRules) {
            if (rule.bufferTime && rule.bufferTime > 0) {
              intervalMinutes = rule.bufferTime;
              break;
            }
          }
        }
        
        // Use the buffer time as the interval between slots
        console.log(`Using interval of ${intervalMinutes} minutes based on buffer time settings`);
        currentTime = new Date(currentTime.getTime() + intervalMinutes * 60 * 1000);
      }
      
      return slots;
    } catch (error) {
      console.error("Error generating time slots:", error);
      setError(error instanceof Error ? error : new Error('Failed to generate time slots'));
      return [];
    }
  }, [duration, mode]);

  // Function to check if a date is a holiday
  const checkIsHoliday = useCallback(async (dateStr: string): Promise<boolean> => {
    if (!facilityId) return false;
    
    try {
      // First, get the organization ID for this facility
      const orgResponse = await apiRequest('GET', `/api/facilities/${facilityId}/organization`);
      
      if (!orgResponse.ok) {
        console.warn(`Failed to fetch organization for facility ${facilityId}`);
        return false;
      }
      
      const { organizationId } = await orgResponse.json();
      
      if (!organizationId) {
        console.warn(`No organization found for facility ${facilityId}`);
        return false;
      }
      
      // Check if date is a holiday for this organization
      const holidaysResponse = await apiRequest('GET', `/api/organizations/${organizationId}/holidays`);
      
      if (!holidaysResponse.ok) {
        console.warn(`Failed to fetch holidays for organization ${organizationId}`);
        return false;
      }
      
      const holidays = await holidaysResponse.json();
      
      // Check if this date matches any enabled holiday
      return holidays.some((holiday: any) => 
        holiday.enabled && holiday.date === dateStr
      );
    } catch (error) {
      console.error("Error checking if date is a holiday:", error);
      return false;
    }
  }, [facilityId]);
  
  // Main function to fetch availability for a specific date
  const fetchAvailabilityForDate = useCallback(async (dateStr: string) => {
    if (!facilityId) return;
    
    setIsLoading(true);
    setError(null);
    setSelectedDate(dateStr);
    
    try {
      // First check if the selected date is a holiday
      const isHoliday = await checkIsHoliday(dateStr);
      
      if (isHoliday) {
        // If it's a holiday, return empty slots
        setAvailabilityRules([]);
        setBookedAppointments([]);
        setAvailableTimeSlots([{
          time: '00:00',
          available: false,
          reason: 'Organization Holiday',
        }]);
        
        // Call callback if provided
        if (onTimeSlotGenerated) {
          onTimeSlotGenerated([{
            time: '00:00',
            available: false,
            reason: 'Organization Holiday',
          }], null);
        }
        
        return;
      }
      
      // Fetch both rules and booked appointments in parallel
      const [rules, booked] = await Promise.all([
        fetchAvailabilityRules(),
        fetchBookedAppointments(dateStr)
      ]);
      
      // Store in state for reference/debugging
      setAvailabilityRules(rules);
      setBookedAppointments(booked);
      
      // Generate available time slots
      const slots = generateTimeSlots(dateStr, rules, booked);
      
      // Update state with generated slots
      setAvailableTimeSlots(slots);
      
      // Call callback if provided
      if (onTimeSlotGenerated) {
        const firstAvailableSlot = slots.find(slot => slot.available)?.time || null;
        onTimeSlotGenerated(slots, firstAvailableSlot);
      }
    } catch (error) {
      console.error("Error fetching availability for date:", error);
      setError(error instanceof Error ? error : new Error('Failed to fetch availability'));
    } finally {
      setIsLoading(false);
    }
  }, [facilityId, fetchAvailabilityRules, fetchBookedAppointments, generateTimeSlots, onTimeSlotGenerated, checkIsHoliday]);

  // Initial fetch on mount if date is provided
  useEffect(() => {
    if (date && facilityId) {
      const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
      fetchAvailabilityForDate(dateStr);
    }
  }, [date, facilityId, fetchAvailabilityForDate]);

  return {
    availableTimeSlots,
    isLoading,
    error,
    selectedDate,
    fetchAvailabilityForDate,
    // For debugging and reference
    availabilityRules,
    bookedAppointments,
  };
}