import * as React from "react";
import { format, parse } from "date-fns";
import { ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  availableTimes?: string[];
  disabled?: boolean;
  loading?: boolean;
  noOptionsMessage?: string;
}

export function TimePicker({
  value,
  onChange,
  availableTimes,
  disabled = false,
  loading = false,
  noOptionsMessage = "No available times"
}: TimePickerProps) {
  // Generate times in 15-minute intervals if no available times are provided
  const times = availableTimes || generateTimeIntervals(15);

  // Format the display of the time
  const formatTimeDisplay = (timeString: string) => {
    try {
      const timeObj = parse(timeString, 'HH:mm', new Date());
      return format(timeObj, 'h:mm a'); // e.g., "9:30 AM"
    } catch (e) {
      return timeString; // Fallback to the original string
    }
  };

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || loading}
    >
      <SelectTrigger className={cn(
        "w-full",
        !value && "text-muted-foreground"
      )}>
        <ClockIcon className="mr-2 h-4 w-4" />
        <SelectValue placeholder={loading ? "Loading times..." : "Select a time"}>
          {value && formatTimeDisplay(value)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {loading ? (
          <div className="py-2 px-4 text-sm text-center">Loading available time slots...</div>
        ) : times.length > 0 ? (
          times.map((time) => (
            <SelectItem key={time} value={time}>
              {formatTimeDisplay(time)}
            </SelectItem>
          ))
        ) : (
          <div className="py-2 px-4 text-sm text-center">{noOptionsMessage}</div>
        )}
      </SelectContent>
    </Select>
  );
}

// Helper function to generate time intervals
function generateTimeIntervals(intervalMinutes: number): string[] {
  const times: string[] = [];
  const minutes = 24 * 60; // Total minutes in a day
  
  for (let i = 0; i < minutes; i += intervalMinutes) {
    const hour = Math.floor(i / 60);
    const minute = i % 60;
    
    // Format as HH:MM
    times.push(
      `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    );
  }
  
  return times;
}