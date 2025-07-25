import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  disablePastDates?: boolean;
  disabledDays?: (date: Date) => boolean;
}

export function DatePicker({
  date,
  onDateChange,
  disablePastDates = false,
  disabledDays,
}: DatePickerProps) {
  // Create a helper function to normalize the date with timezone offset adjustment
  const normalizeDate = (date: Date): Date => {
    // Get timezone offset in minutes - browsers often report this in opposite sign,
    // so we need to negate it to get the actual offset
    const timezoneOffsetMinutes = date.getTimezoneOffset();
    
    // Calculate timezone offset in milliseconds (make it positive to add to date)
    const offsetMs = -timezoneOffsetMinutes * 60 * 1000;
    
    // Get the UTC timestamp and add the offset
    const timestamp = date.getTime() - offsetMs;
    
    // Create a new UTC date at noon (12:00) on the selected day
    // This ensures consistent behavior across timezones
    const correctedDate = new Date(timestamp);
    
    // Set the date to noon in local time to avoid any timezone edge cases
    return new Date(
      correctedDate.getFullYear(), 
      correctedDate.getMonth(), 
      correctedDate.getDate(), 
      12, 0, 0
    );
  };
  
  // Normalize the date before passing it to components
  const normalizedDate = date ? normalizeDate(date) : undefined;
  
  // Wrap the onDateChange to normalize the selected date
  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      // Normalize the date to ensure it's set to noon with timezone correction
      const normalizedNewDate = normalizeDate(newDate);
      
      // Log detailed information for debugging
      console.log("Date selected in calendar:", newDate);
      console.log("Date components:", {
        year: newDate.getFullYear(),
        month: newDate.getMonth() + 1, // add 1 because months are 0-indexed
        day: newDate.getDate(),
        hours: newDate.getHours(),
        minutes: newDate.getMinutes(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        offset: newDate.getTimezoneOffset()
      });
      console.log("Normalized date (with timezone correction):", normalizedNewDate);
      
      // Pass the normalized date to the parent component
      onDateChange(normalizedNewDate);
    } else {
      onDateChange(undefined);
    }
  };
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !normalizedDate && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {normalizedDate ? format(normalizedDate, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={normalizedDate}
          onSelect={handleDateChange}
          disabled={
            disabledDays 
              ? (date: any) => (disablePastDates && date < new Date()) || disabledDays(date)
              : disablePastDates 
                ? { before: new Date() } 
                : undefined
          }
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}