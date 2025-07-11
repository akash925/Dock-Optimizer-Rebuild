import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock } from 'lucide-react';
import { useSimpleAvailability, SimpleTimeSlot } from '@/hooks/use-simple-availability';

interface SimpleTimeSlotsProps {
  facilityId?: number | null;
  appointmentTypeId?: number | null;
  date?: string | Date | null;
  selectedTime?: string;
  onTimeSelect?: (time: string) => void;
  bookingPageSlug?: string;
}

export function SimpleTimeSlots({
  facilityId,
  appointmentTypeId,
  date,
  selectedTime,
  onTimeSelect,
  bookingPageSlug
}: SimpleTimeSlotsProps) {
  const { timeSlots, isLoading, error } = useSimpleAvailability({
    facilityId,
    appointmentTypeId,
    date,
    bookingPageSlug
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading available times...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading time slots: {error}</p>
      </div>
    );
  }

  if (!timeSlots.length) {
    return (
      <div className="text-center py-8">
        <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No available times for this date</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {timeSlots.map((slot) => (
          <TimeSlotButton
            key={slot.time}
            slot={slot}
            isSelected={selectedTime === slot.time}
            onSelect={() => onTimeSelect?.(slot.time)}
          />
        ))}
      </div>
    </div>
  );
}

interface TimeSlotButtonProps {
  slot: SimpleTimeSlot;
  isSelected: boolean;
  onSelect: () => void;
}

function TimeSlotButton({ slot, isSelected, onSelect }: TimeSlotButtonProps) {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="relative">
      <Button
        variant={isSelected ? "default" : "outline"}
        className={`w-full h-auto p-3 ${
          !slot.available 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-primary/10'
        }`}
        onClick={onSelect}
        disabled={!slot.available}
      >
        <div className="flex flex-col items-center space-y-1">
          <span className="font-medium">{formatTime(slot.time)}</span>
          {slot.remaining !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {slot.remaining} left
            </Badge>
          )}
        </div>
      </Button>
    </div>
  );
}