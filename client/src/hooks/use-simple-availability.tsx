import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface SimpleTimeSlot {
  time: string;
  available: boolean;
  capacity?: number;
  remaining?: number;
}

export interface UseSimpleAvailabilityProps {
  facilityId?: number | null;
  appointmentTypeId?: number | null;
  date?: string | Date | null;
  bookingPageSlug?: string;
}

/**
 * Simplified availability hook that focuses on core functionality
 */
export function useSimpleAvailability({
  facilityId,
  appointmentTypeId,
  date,
  bookingPageSlug
}: UseSimpleAvailabilityProps) {
  const [timeSlots, setTimeSlots] = useState<SimpleTimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = async () => {
    if (!facilityId || !appointmentTypeId || !date) {
      setTimeSlots([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
      
      // Build query parameters
      const params = new URLSearchParams({
        facilityId: facilityId.toString(),
        appointmentTypeId: appointmentTypeId.toString(),
        date: dateStr,
      });

      if (bookingPageSlug) {
        params.append('bookingPageSlug', bookingPageSlug);
      }

      const response = await apiRequest('GET', `/api/availability/simple?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch availability');
      }

      const data = await response.json();
      setTimeSlots(data.timeSlots || []);
    } catch (err) {
      console.error('Error fetching availability:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch availability');
      setTimeSlots([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability();
  }, [facilityId, appointmentTypeId, date, bookingPageSlug]);

  return {
    timeSlots,
    isLoading,
    error,
    refetch: fetchAvailability
  };
}