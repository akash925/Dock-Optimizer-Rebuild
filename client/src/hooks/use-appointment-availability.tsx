import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

export interface AvailabilityRule {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  appointmentTypeId?: number;
  facilityId?: number;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  reason?: string;
}

export interface UseAppointmentAvailabilityProps {
  facilityId?: number | null;
  appointmentTypeId?: number | null;
  facilityTimezone?: string;
  date?: string | Date | null;
  duration?: number;
}

export function useAppointmentAvailability({
  facilityId,
  appointmentTypeId,
  facilityTimezone = 'America/New_York',
  date,
  duration = 60
}: UseAppointmentAvailabilityProps) {
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      return;
    }

    setIsLoading(true);
    setError(null);

    // Convert Date object to string format if it's a Date
    const dateString = date instanceof Date ? format(date, 'yyyy-MM-dd') : date;
    const selectedDate = new Date(dateString);
    
    try {
      // Import the helper function dynamically
      const { generateAvailableTimeSlots } = await import('@/lib/appointment-availability');
      
      console.log('Generating time slots with parameters:', {
        date: selectedDate,
        rules: availabilityRules,
        duration,
        timezone: facilityTimezone
      });
      
      let slots: TimeSlot[] = [];
      
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
          selectedDate,
          availabilityRules,
          duration,
          facilityTimezone,
          15 // 15-minute intervals
        );
      }
      
      console.log(`Generated ${slots.length} time slots, ${slots.filter(s => s.available).length} available`);
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
            available: true,
            reason: 'Fallback slot (error occurred)'
          };
        })
      );
      
      setAvailableTimeSlots(fallbackSlots);
    } finally {
      setIsLoading(false);
    }
  }, [date, availabilityRules, duration, facilityTimezone]);

  // When facilityId or appointmentTypeId changes, fetch rules
  useEffect(() => {
    fetchAvailabilityRules();
  }, [fetchAvailabilityRules]);

  // When date or rules change, generate slots
  useEffect(() => {
    if (date) {
      generateTimeSlots();
    }
  }, [date, availabilityRules, generateTimeSlots]);

  return {
    availabilityRules,
    availableTimeSlots,
    isLoading,
    error,
    refreshRules: fetchAvailabilityRules,
    refreshSlots: generateTimeSlots
  };
}