import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface TimeSlot {
  time: string;
  available: boolean;
  reason?: string;
  remaining?: number;
  remainingCapacity?: number;
}

interface EnhancedTimeSlotsProps {
  date: string;
  facilityId: number;
  appointmentTypeId: number;
  bookingPageSlug?: string;
  selectedTime?: string;
  onSelectTime: (time: string) => void;
  showRemainingSlots?: boolean;
}

export function EnhancedTimeSlots({
  date,
  facilityId,
  appointmentTypeId,
  bookingPageSlug,
  selectedTime,
  onSelectTime,
  showRemainingSlots = false
}: EnhancedTimeSlotsProps) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (date && facilityId && appointmentTypeId) {
      fetchTimeSlots();
    }
  }, [date, facilityId, appointmentTypeId]);

  const fetchTimeSlots = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`[EnhancedTimeSlots] Fetching slots for date=${date}, facility=${facilityId}, type=${appointmentTypeId}`);
      
      const params = new URLSearchParams({
        date,
        facilityId: String(facilityId),
        appointmentTypeId: String(appointmentTypeId),
      });
      
      if (bookingPageSlug) {
        params.append('bookingPageSlug', bookingPageSlug);
      }
      
      const response = await fetch(`/api/availability?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch time slots (${response.status})`);
      }
      
      const data = await response.json();
      console.log(`[EnhancedTimeSlots] Received data:`, data);
      
      // Handle both response formats
      if (data.slots && Array.isArray(data.slots)) {
        setSlots(data.slots);
      } else if (data.availableTimes && Array.isArray(data.availableTimes)) {
        // Convert availableTimes to slots format
        const convertedSlots = data.availableTimes.map((time: string) => ({
          time,
          available: true,
          remaining: 1
        }));
        setSlots(convertedSlots);
      } else {
        setSlots([]);
      }
      
    } catch (err) {
      console.error('[EnhancedTimeSlots] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load time slots');
      toast({
        title: 'Error',
        description: 'Failed to load available time slots. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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
        <Button onClick={fetchTimeSlots} variant="outline" size="sm">
          Try Again
        </Button>
      </div>
    );
  }

  const availableSlots = slots.filter(slot => slot.available);
  const unavailableSlots = slots.filter(slot => !slot.available);

  if (availableSlots.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">No Available Time Slots</p>
        <p className="text-muted-foreground">
          There are no available time slots for {new Date(date).toLocaleDateString()}. 
          Please select a different date.
        </p>
        {unavailableSlots.length > 0 && (
          <details className="mt-4 text-sm text-muted-foreground">
            <summary className="cursor-pointer">View unavailable times</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {unavailableSlots.map((slot, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span>{slot.time}</span>
                  <span className="text-xs">{slot.reason || 'Unavailable'}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold mb-2">Available Time Slots</h3>
        <p className="text-sm text-muted-foreground">
          Select a time slot for your appointment on {new Date(date).toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {availableSlots.map((slot, index) => {
          const isSelected = selectedTime === slot.time;
          const remainingCount = slot.remaining || slot.remainingCapacity || 0;
          
          return (
            <Button
              key={index}
              variant={isSelected ? "default" : "outline"}
              size="lg"
              className={`
                relative h-auto p-3 flex flex-col items-center justify-center
                ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
                hover:scale-105 transition-transform
              `}
              onClick={() => onSelectTime(slot.time)}
            >
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{slot.time}</span>
              </div>
              
              {showRemainingSlots && remainingCount > 0 && (
                <Badge variant="secondary" className="mt-1 text-xs">
                  {remainingCount} spot{remainingCount !== 1 ? 's' : ''} left
                </Badge>
              )}
              
              {isSelected && (
                <CheckCircle className="absolute -top-2 -right-2 h-6 w-6 text-primary bg-white rounded-full" />
              )}
            </Button>
          );
        })}
      </div>

      {selectedTime && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">Selected: {selectedTime}</span>
          </div>
        </div>
      )}
    </div>
  );
}