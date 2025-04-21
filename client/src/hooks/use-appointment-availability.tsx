import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { AvailabilityRule, AvailabilitySlot } from '@/lib/appointment-availability';

export interface UseAppointmentAvailabilityProps {
  facilityId?: number | null;
  appointmentTypeId?: number | null;
  facilityTimezone?: string;
  date?: string | Date | null;
  duration?: number;
  onTimeSlotGenerated?: (slots: AvailabilitySlot[], firstAvailableSlot: string | null) => void;
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
              reason: 'No rules configured'
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
            reason: 'Error occurred'
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
  }, [date, availabilityRules, duration, facilityTimezone, onTimeSlotGenerated]);

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
    isLoading,
    error,
    refreshRules: fetchAvailabilityRules,
    refreshSlots: generateTimeSlots
  };
}