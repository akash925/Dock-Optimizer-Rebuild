import { useCallback, useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { TimeSlot } from '@/components/booking/time-slot-picker';

// For backward compatibility during migration
type AvailabilitySlot = TimeSlot;

export interface UseAppointmentAvailabilityProps {
  facilityId?: number | null;
  typeId?: number | null;
  appointmentTypeId?: number | null;
  mode?: 'trailer' | 'container';
  timezone?: string;
  facilityTimezone?: string;
  date?: string | Date | null;
  duration?: number;
  onTimeSlotGenerated?: (slots: TimeSlot[], firstAvailableSlot: string | null) => void;
  bookingPageSlug?: string; // Optional booking page slug for tenant context
}

/**
 * Final version of useAppointmentAvailability hook that uses the v2 API endpoint
 * for availability calculations, with redundant client-side state removed
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
  onTimeSlotGenerated,
  bookingPageSlug
}: UseAppointmentAvailabilityProps) {
  // State
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    date ? (typeof date === 'string' ? date : date.toISOString().split('T')[0]) : null
  );

  // Function to check if a date is a holiday
  const checkIsHoliday = useCallback(async (dateStr: string): Promise<boolean> => {
    if (!facilityId) return false;
    
    try {
      // Build query parameters with bookingPageSlug if available
      let queryParams = '';
      if (bookingPageSlug) {
        queryParams = `?bookingPageSlug=${encodeURIComponent(bookingPageSlug)}`;
      }
      
      // First, get the organization ID for this facility with tenant context if available
      const orgResponse = await apiRequest('GET', `/api/facilities/${facilityId}/organization${queryParams}`);
      
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
      const holidaysResponse = await apiRequest('GET', `/api/organizations/${organizationId}/holidays${queryParams}`);
      
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
  }, [facilityId, bookingPageSlug]);
  
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
        const holidaySlot: TimeSlot = {
          time: '00:00',
          available: false,
          reason: 'Organization Holiday',
          remaining: 0,
          remainingCapacity: 0
        };
        
        setAvailableTimeSlots([holidaySlot]);
        
        // Call callback if provided
        if (onTimeSlotGenerated) {
          onTimeSlotGenerated([holidaySlot], null);
        }
        
        return;
      }

      // Fetch availability directly from the new v2 API endpoint
      const queryParams = new URLSearchParams();
      queryParams.append('date', dateStr);
      queryParams.append('facilityId', String(facilityId));
      
      const effectiveTypeId = appointmentTypeId || typeId;
      if (effectiveTypeId) {
        queryParams.append('appointmentTypeId', String(effectiveTypeId));
      }
      
      // Add bookingPageSlug for tenant context if available
      if (bookingPageSlug) {
        queryParams.append('bookingPageSlug', bookingPageSlug);
      }
      
      // Use the new v2 endpoint for enhanced availability data
      const url = `/api/availability/v2?${queryParams.toString()}`;
      console.log(`[AvailabilityHook] Fetching from v2 endpoint: ${url}`);
      
      const response = await apiRequest('GET', url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch availability: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[AvailabilityHook] Received ${data.slots?.length || 0} slots from v2 endpoint`);
      
      // Use slots directly from the API response but ensure they meet the interface requirements
      const slots = (data.slots || []).map((slot: any): TimeSlot => ({
        time: slot.time,
        available: Boolean(slot.available),
        reason: slot.reason || '',
        remaining: typeof slot.remaining === 'number' ? slot.remaining : 0,
        remainingCapacity: typeof slot.remainingCapacity === 'number' ? slot.remainingCapacity : 0,
        isBufferTime: Boolean(slot.isBufferTime)
      }));
      
      // Debug information about slots
      console.log(`[AvailabilityHook] Received slots:`, data.slots);
      console.log(`[AvailabilityHook] User TZ:`, Intl.DateTimeFormat().resolvedOptions().timeZone);
      console.log(`[AvailabilityHook] Facility TZ:`, facilityTimezone || timezone || 'not provided');
      
      // Add debug information about the time strings
      if (slots.length > 0) {
        const firstSlot = slots[0];
        const lastSlot = slots[slots.length - 1];
        console.log(`[AvailabilityHook] First slot time: ${firstSlot.time}, available: ${firstSlot.available}`);
        console.log(`[AvailabilityHook] Last slot time: ${lastSlot.time}, available: ${lastSlot.available}`);
        
        // Show example of parsing a time
        const [hours, minutes] = firstSlot.time.split(':').map(Number);
        console.log(`[AvailabilityHook] First slot parsed: Hours=${hours}, Minutes=${minutes}`);
        
        // Show sample conversion to 12-hour format
        const hour12 = hours % 12 || 12;
        const period = hours >= 12 ? 'PM' : 'AM';
        console.log(`[AvailabilityHook] First slot 12-hour format: ${hour12}:${minutes.toString().padStart(2, '0')} ${period}`);
      }
      
      console.log(`[AvailabilityHook] Processed ${slots.length} slots for UI rendering`);
      
      // Update state with the processed slots
      setAvailableTimeSlots(slots);
      
      // Call callback if provided
      if (onTimeSlotGenerated) {
        const firstAvailableSlot = slots.find((slot: TimeSlot) => slot.available)?.time || null;
        onTimeSlotGenerated(slots, firstAvailableSlot);
      }
    } catch (error) {
      console.error("Error fetching availability for date:", error);
      setError(error instanceof Error ? error : new Error('Failed to fetch availability'));
    } finally {
      setIsLoading(false);
    }
  }, [facilityId, appointmentTypeId, typeId, bookingPageSlug, onTimeSlotGenerated, checkIsHoliday]);

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
    fetchAvailabilityForDate
  };
}

// Export an alias with the "Fixed" suffix for clarity
export const useAppointmentAvailabilityFixed = useAppointmentAvailability;