import { useState, useEffect, useCallback } from 'react';
import { format, parse, startOfDay, endOfDay } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { AvailabilityRule, AvailabilitySlot } from '@/lib/appointment-availability';
import { Schedule } from '@shared/schema';

export interface UseAppointmentAvailabilityProps {
  facilityId?: number | null;
  appointmentTypeId?: number | null;
  facilityTimezone?: string;
  date?: string | Date | null;
  duration?: number;
  onTimeSlotGenerated?: (slots: AvailabilitySlot[], firstAvailableSlot: string | null) => void;
}

// Interface for booked appointment data
interface BookedAppointment {
  startTime: string | Date;
  endTime: string | Date;
  appointmentTypeId: number;
}

export function useAppointmentAvailability({
  facilityId,
  appointmentTypeId,
  facilityTimezone = 'America/New_York',
  date,
  duration = 60,
  onTimeSlotGenerated
}: UseAppointmentAvailabilityProps) {
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstAvailableSlot, setFirstAvailableSlot] = useState<string | null>(null);
  const [existingAppointments, setExistingAppointments] = useState<BookedAppointment[]>([]);

  // Fetch existing appointments for given date
  const fetchExistingAppointments = useCallback(async (dateStr: string) => {
    if (!facilityId) return [];
    
    try {
      // Format query parameters
      const params = new URLSearchParams();
      params.append('date', dateStr);
      params.append('facilityId', facilityId.toString());
      if (appointmentTypeId) params.append('typeId', appointmentTypeId.toString());
      
      const endpoint = `/api/schedules?${params.toString()}`;
      console.log('Fetching existing appointments for:', endpoint);
      
      const res = await apiRequest('GET', endpoint);
      if (!res.ok) {
        throw new Error('Failed to fetch existing appointments');
      }
      
      const appointments: Schedule[] = await res.json();
      
      // Map to simpler format
      const bookedAppointments: BookedAppointment[] = appointments.map(apt => ({
        startTime: apt.startTime,
        endTime: apt.endTime,
        appointmentTypeId: apt.appointmentTypeId || 0
      }));
      
      console.log(`Found ${bookedAppointments.length} existing appointments for date:`, dateStr);
      setExistingAppointments(bookedAppointments);
      return bookedAppointments;
    } catch (err: any) {
      console.error('Error fetching existing appointments:', err);
      return [];
    }
  }, [facilityId, appointmentTypeId]);
  
  // Fetch availability rules
  const fetchAvailabilityRules = useCallback(async () => {
    if (!facilityId && !appointmentTypeId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Construct query parameters
      const params = new URLSearchParams();
      if (facilityId) params.append('facilityId', facilityId.toString());
      if (appointmentTypeId) params.append('appointmentTypeId', appointmentTypeId.toString());

      const endpoint = `/api/appointment-master/availability-rules?${params.toString()}`;
      const res = await apiRequest('GET', endpoint);
      
      if (!res.ok) {
        throw new Error('Failed to fetch availability rules');
      }

      const rules = await res.json();
      console.log('Fetched availability rules:', rules);
      setAvailabilityRules(rules);
    } catch (err: any) {
      console.error('Error fetching availability rules:', err);
      setError(err.message || 'Failed to fetch availability rules');
      setAvailabilityRules([]);
    } finally {
      setIsLoading(false);
    }
  }, [facilityId, appointmentTypeId]);

  // Generate available time slots based on rules and date
  const generateTimeSlots = useCallback(async () => {
    if (!date) {
      console.log('No date provided for time slot generation');
      setAvailableTimeSlots([]);
      setFirstAvailableSlot(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Convert Date object to string format if it's a Date
      const dateString = date instanceof Date ? format(date, 'yyyy-MM-dd') : date;
      
      // Validate date format - should be YYYY-MM-DD
      if (!dateString || typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        console.error('Invalid date format for availability generation:', dateString);
        throw new Error('Invalid date format. Expected YYYY-MM-DD');
      }
      
      const selectedDate = new Date(dateString);
      
      // First, fetch existing appointments for the selected date
      const bookedAppointments = await fetchExistingAppointments(dateString);
      
      // Import the helper function dynamically
      const { generateAvailableTimeSlots } = await import('@/lib/appointment-availability');
      
      console.log('Generating time slots with parameters:', {
        date: selectedDate,
        rules: availabilityRules,
        duration,
        timezone: facilityTimezone
      });
      
      let slots: AvailabilitySlot[] = [];
      
      // Generate slots based on whether we have rules or not
      if (!availabilityRules.length) {
        console.log('No availability rules found, generating all slots as available');
        
        // If no rules are present, show all time slots in 15-minute intervals
        slots = Array.from({ length: 24 }).flatMap((_, hour) => 
          Array.from({ length: 4 }).map((_, quarterHour) => {
            const h = hour;
            const m = quarterHour * 15;
            return {
              time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
              available: true,
              reason: 'No rules configured',
              remaining: 1
            };
          })
        );
      } else {
        // Use our availability logic to generate slots based on rules
        slots = generateAvailableTimeSlots(
          dateString, // Use the dateString instead of Date object
          availabilityRules,
          duration,
          facilityTimezone,
          15 // 15-minute intervals
        );
      }
      
      // If we have rules and appointments, filter based on capacity and buffer times
      if (availabilityRules.length > 0 && availabilityRules[0]?.maxConcurrent) {
        // Process each slot against booking constraints
        slots = await processSlotAvailability(
          slots, 
          bookedAppointments, 
          availabilityRules,
          dateString,
          duration
        );
      }
      
      // Find the first available slot
      const availableSlot = slots.find(slot => slot.available);
      const firstSlot = availableSlot ? availableSlot.time : null;
      
      // Set first available slot
      setFirstAvailableSlot(firstSlot);
      
      // Notify caller about generated slots and first available time
      if (onTimeSlotGenerated) {
        onTimeSlotGenerated(slots, firstSlot);
      }
      
      console.log(`Generated ${slots.length} time slots, ${slots.filter(s => s.available).length} available`);
      console.log('First available slot:', firstSlot);
      
      // Store all slots
      setAvailableTimeSlots(slots);
    } catch (err: any) {
      console.error('Error generating time slots:', err);
      setError(err.message || 'Failed to generate time slots');
      
      // Provide fallback slots in case of error
      const fallbackSlots = Array.from({ length: 24 }).flatMap((_, hour) => 
        Array.from({ length: 4 }).map((_, quarterHour) => {
          const h = hour;
          const m = quarterHour * 15;
          return {
            time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
            available: false,
            reason: 'Error occurred',
            remaining: 0
          };
        })
      );
      
      setAvailableTimeSlots(fallbackSlots);
      setFirstAvailableSlot(null);
      
      // Notify caller about generated slots and no available time
      if (onTimeSlotGenerated) {
        onTimeSlotGenerated(fallbackSlots, null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [date, availabilityRules, duration, facilityTimezone, fetchExistingAppointments, onTimeSlotGenerated]);
  
  // Process slot availability based on existing bookings
  const processSlotAvailability = async (
    slots: AvailabilitySlot[], 
    bookedAppointments: BookedAppointment[], 
    rules: AvailabilityRule[],
    dateStr: string,
    durationMinutes: number
  ): Promise<AvailabilitySlot[]> => {
    // Get the appropriate rule to check
    const rule = rules[0]; // Usually just one rule per appointment type
    if (!rule) return slots;
    
    // Count total bookings for the day
    const totalBookingsForDay = bookedAppointments.length;
    
    // Check if we hit the daily limit
    const maxPerDay = rule.maxAppointmentsPerDay || Number.MAX_SAFE_INTEGER;
    const dailyLimitReached = totalBookingsForDay >= maxPerDay;
    
    if (dailyLimitReached) {
      console.log('Daily booking limit reached:', totalBookingsForDay, 'of', maxPerDay);
      // Mark all slots as unavailable due to daily limit
      return slots.map(slot => ({
        ...slot,
        available: false,
        reason: 'Daily appointment limit reached',
        remaining: 0
      }));
    }
    
    // Process each time slot
    return slots.map(slot => {
      // Skip already unavailable slots
      if (!slot.available) return slot;
      
      // Parse the slot time
      const [hour, minute] = slot.time.split(':').map(Number);
      
      // Create date objects for slot start and end
      const slotStartTime = new Date(dateStr);
      slotStartTime.setHours(hour, minute, 0, 0);
      
      const slotEndTime = new Date(slotStartTime);
      slotEndTime.setMinutes(slotEndTime.getMinutes() + durationMinutes);
      
      // Count concurrent bookings for this slot time
      const concurrentBookings = bookedAppointments.filter(apt => {
        try {
          const aptStart = new Date(apt.startTime);
          const aptEnd = new Date(apt.endTime);
          
          // Validate that dates are valid before comparing
          if (isNaN(aptStart.getTime()) || isNaN(aptEnd.getTime())) {
            console.warn('Invalid appointment date:', apt);
            return false;
          }
          
          // Check for overlap - the appointment overlaps with the slot if:
          // 1. The appointment starts before the slot ends AND
          // 2. The appointment ends after the slot starts
          return aptStart < slotEndTime && aptEnd > slotStartTime;
        } catch (err) {
          console.error('Error checking appointment overlap:', err);
          return false;
        }
      }).length;
      
      // Check if we still have capacity
      const maxConcurrent = rule.maxConcurrent || 1;
      const hasCapacity = concurrentBookings < maxConcurrent;
      const remaining = Math.max(0, maxConcurrent - concurrentBookings);
      
      // Check buffer time constraints
      let withinBuffer = false;
      const bufferMinutes = rule.bufferTime || 0;
      
      if (bufferMinutes > 0) {
        // For each existing appointment, check if this slot is within buffer time
        withinBuffer = bookedAppointments.some(apt => {
          try {
            const aptStart = new Date(apt.startTime);
            const aptEnd = new Date(apt.endTime);
            
            // Validate that dates are valid before comparing
            if (isNaN(aptStart.getTime()) || isNaN(aptEnd.getTime())) {
              console.warn('Invalid appointment date for buffer check:', apt);
              return false;
            }
            
            // Create buffer windows before and after appointment
            const bufferBefore = new Date(aptStart);
            bufferBefore.setMinutes(bufferBefore.getMinutes() - bufferMinutes);
            
            const bufferAfter = new Date(aptEnd);
            bufferAfter.setMinutes(bufferAfter.getMinutes() + bufferMinutes);
            
            // Check if slot starts within buffer window
            return (slotStartTime >= bufferBefore && slotStartTime <= aptStart) ||
                   (slotStartTime >= aptEnd && slotStartTime <= bufferAfter);
          } catch (err) {
            console.error('Error checking buffer overlap:', err);
            return false;
          }
        });
      }
      
      // Determine availability and reason
      let isAvailable = hasCapacity && !withinBuffer;
      let reason = '';
      
      if (!hasCapacity) {
        reason = 'Maximum concurrent appointments reached';
      } else if (withinBuffer) {
        reason = `Within ${bufferMinutes} minute buffer of existing appointment`;
      }
      
      return {
        ...slot,
        available: isAvailable,
        reason: isAvailable ? slot.reason : reason,
        remaining
      };
    });
  };

  // When facilityId or appointmentTypeId changes, fetch rules
  useEffect(() => {
    fetchAvailabilityRules();
  }, [fetchAvailabilityRules]);

  // When date or rules change, generate slots
  useEffect(() => {
    if (date) {
      generateTimeSlots();
    } else {
      // Reset slots when date is cleared
      setAvailableTimeSlots([]);
      setFirstAvailableSlot(null);
      
      if (onTimeSlotGenerated) {
        onTimeSlotGenerated([], null);
      }
    }
  }, [date, availabilityRules, generateTimeSlots, onTimeSlotGenerated]);

  return {
    availabilityRules,
    availableTimeSlots,
    firstAvailableSlot,
    existingAppointments,
    isLoading,
    error,
    refreshRules: fetchAvailabilityRules,
    refreshSlots: generateTimeSlots,
    fetchAppointments: fetchExistingAppointments
  };
}