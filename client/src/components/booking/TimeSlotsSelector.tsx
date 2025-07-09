import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, Loader2 } from 'lucide-react';

interface TimeSlot {
  time: string;
  available: boolean;
  remainingCapacity: number;
  remaining: number;
  reason: string;
}

interface TimeSlotsResponse {
  slots: TimeSlot[];
  facilityTimezone: string;
  date: string;
}

interface TimeSlotsProps {
  date: string;
  facilityId?: number;
  appointmentTypeId?: number;
  onSelectTime: (time: string) => void;
  selectedTime?: string;
  showRemainingSlots?: boolean;
}

export function TimeSlotsSelector({
  date,
  facilityId,
  appointmentTypeId,
  onSelectTime,
  selectedTime,
  showRemainingSlots = false
}: TimeSlotsProps) {
  const [slotsData, setSlotsData] = useState<TimeSlotsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAvailability() {
      if (!date || !facilityId || !appointmentTypeId) {
        setSlotsData(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log(`[TimeSlotsSelector] Fetching availability for ${date}, facility ${facilityId}, type ${appointmentTypeId}`);
        
        const response = await fetch(
          `/api/availability?date=${date}&facilityId=${facilityId}&appointmentTypeId=${appointmentTypeId}`
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch availability: ${response.statusText}`);
        }
        
        const data: TimeSlotsResponse = await response.json();
        console.log(`[TimeSlotsSelector] Received ${data.slots?.length || 0} time slots`);
        
        setSlotsData(data);
      } catch (err) {
        console.error('[TimeSlotsSelector] Error fetching availability:', err);
        setError(err instanceof Error ? err.message : 'Failed to load available time slots');
        setSlotsData(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAvailability();
  }, [date, facilityId, appointmentTypeId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading available time slots...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (!slotsData || !slotsData.slots.length) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No available time slots for this date.</p>
      </div>
    );
  }

  const availableSlots = slotsData.slots.filter(slot => slot.available);
  const unavailableSlots = slotsData.slots.filter(slot => !slot.available);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Available Time Slots</h3>
        <p className="text-sm text-muted-foreground">
          Select a time slot for your appointment on {new Date(date).toLocaleDateString()}
        </p>
        {slotsData.facilityTimezone && (
          <p className="text-xs text-muted-foreground mt-1">
            All times shown in facility timezone ({slotsData.facilityTimezone})
          </p>
        )}
      </div>

      {availableSlots.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {availableSlots.map((slot) => (
            <Button
              key={slot.time}
              variant={selectedTime === slot.time ? "default" : "outline"}
              onClick={() => onSelectTime(slot.time)}
              className="h-auto p-3 flex flex-col items-center justify-center space-y-1"
            >
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{slot.time}</span>
              </div>
              {showRemainingSlots && slot.remainingCapacity > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{slot.remainingCapacity} left</span>
                </div>
              )}
            </Button>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-muted-foreground">
            No available time slots for this date. Please select a different date.
          </p>
        </div>
      )}

      {unavailableSlots.length > 0 && (
        <div className="mt-8">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            Unavailable Time Slots
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {unavailableSlots.map((slot) => (
              <div
                key={slot.time}
                className="p-3 bg-gray-100 rounded-lg text-center opacity-60"
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">{slot.time}</span>
                </div>
                {slot.reason && (
                  <Badge variant="secondary" className="text-xs">
                    {slot.reason}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 