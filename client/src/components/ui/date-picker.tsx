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
  // Create a helper function to normalize the date at 12 PM to avoid timezone issues
  const normalizeDate = (date: Date): Date => {
    // Create a new date at noon to avoid timezone edge cases
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  };
  
  // Normalize the date before passing it to components
  const normalizedDate = date ? normalizeDate(date) : undefined;
  
  // Wrap the onDateChange to normalize the selected date
  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      // Normalize the date to ensure it's set to noon
      const normalizedNewDate = normalizeDate(newDate);
      // Log information for debugging
      console.log("Date selected in calendar:", newDate);
      console.log("Normalized date (set to noon):", normalizedNewDate);
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
              ? (date) => (disablePastDates && date < new Date()) || disabledDays(date)
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