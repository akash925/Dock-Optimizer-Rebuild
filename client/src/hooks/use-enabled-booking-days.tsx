import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export type DayHours = {
  open: boolean;
  start: string;  // "08:00"
  end: string;    // "17:00"
  breakStart?: string;
  breakEnd?: string;
};

export type OrganizationHours = {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
};

export const dayToIndex: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Custom hook to determine which days should be enabled in booking calendars
 * based on organization default hours
 */
export function useEnabledBookingDays(organizationId: number) {
  // Fetch organization hours
  const { data: hours, isLoading, error } = useQuery({
    queryKey: ['orgHours', organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/org/hours?organizationId=${organizationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch organization hours');
      }
      return response.json() as Promise<OrganizationHours>;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  // Determine which days are enabled based on the "open" flag
  const enabledDays = useMemo(() => {
    if (!hours) return [];
    
    return Object.entries(hours)
      .filter(([_, values]) => values.open)
      .map(([day]) => day); // returns ['monday', 'tuesday', ..., 'saturday']
  }, [hours]);

  // Convert enabled days to day indices for react-day-picker (0 = Sunday)
  const enabledDayIndices = useMemo(() => {
    return enabledDays.map(day => dayToIndex[day]);
  }, [enabledDays]);

  // Create a disabledDays configuration for react-day-picker
  const disabledDays = useMemo(() => {
    const disabled = Object.keys(dayToIndex).filter(
      (day) => !enabledDays.includes(day)
    );
    return disabled.map(day => ({ dayOfWeek: dayToIndex[day] }));
  }, [enabledDays]);

  // Function to check if a specific day is enabled
  const isDayEnabled = (date: Date) => {
    if (!hours) return false;
    
    const day = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return hours[day as keyof OrganizationHours]?.open || false;
  };

  // Function to get hours for a specific day
  const getHoursForDay = (date: Date): DayHours | null => {
    if (!hours) return null;
    
    const day = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return hours[day as keyof OrganizationHours] || null;
  };

  return { 
    hours,
    enabledDays, 
    enabledDayIndices,
    disabledDays,
    isDayEnabled,
    getHoursForDay,
    isLoading,
    error
  };
}

/**
 * Generates time slots for a specific date based on organization hours
 */
export function generateTimeSlots(
  date: Date, 
  orgHours: OrganizationHours | undefined, 
  intervalMinutes: number = 30
): string[] {
  if (!orgHours) return [];
  
  const day = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof OrganizationHours;
  const config = orgHours[day];
  
  if (!config?.open) return [];

  const start = parseTime(config.start); // "08:00"
  const end = parseTime(config.end);     // "17:00"
  const breakStart = config.breakStart ? parseTime(config.breakStart) : null;
  const breakEnd = config.breakEnd ? parseTime(config.breakEnd) : null;

  // Generate intervals based on the specified time range
  const slots = generateIntervals(start, end, intervalMinutes);
  
  // Filter out slots during break time if applicable
  if (breakStart && breakEnd) {
    return slots.filter(time => {
      const timeObj = parseTime(time);
      return !isBetween(timeObj, breakStart, breakEnd);
    });
  }
  
  return slots;
}

// Helper function to parse time string into hours and minutes
function parseTime(timeString: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeString.split(':').map(Number);
  return { hours, minutes };
}

// Helper function to check if a time is between two other times
function isBetween(
  time: { hours: number; minutes: number },
  start: { hours: number; minutes: number } | null,
  end: { hours: number; minutes: number } | null
): boolean {
  if (!start || !end) return false;
  
  const timeMinutes = time.hours * 60 + time.minutes;
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  
  return timeMinutes >= startMinutes && timeMinutes < endMinutes;
}

// Helper function to generate time intervals
function generateIntervals(
  start: { hours: number; minutes: number },
  end: { hours: number; minutes: number },
  intervalMinutes: number = 30
): string[] {
  const slots: string[] = [];
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  
  for (let mins = startMinutes; mins < endMinutes; mins += intervalMinutes) {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
  }
  
  return slots;
}