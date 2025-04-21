import * as React from "react";
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
}

export function TimePicker({
  value,
  onChange,
  availableTimes,
  disabled = false,
}: TimePickerProps) {
  // Generate times in 15-minute intervals if no available times are provided
  const times = availableTimes || generateTimeIntervals(15);

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className={cn(
        "w-full",
        !value && "text-muted-foreground"
      )}>
        <ClockIcon className="mr-2 h-4 w-4" />
        <SelectValue placeholder="Select a time" />
      </SelectTrigger>
      <SelectContent>
        {times.map((time) => (
          <SelectItem key={time} value={time}>
            {time}
          </SelectItem>
        ))}
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