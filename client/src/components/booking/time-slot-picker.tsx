import React from "react";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { useTimeZoneUtils } from "@/hooks/use-timezone-utils";
import { formatTimeRangeForDualZones, toZonedTime } from "@/lib/timezone-utils";

interface TimeSlotPickerProps {
  availableTimes: string[]; // array of times in "HH:MM" format
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  timezone?: string;
  className?: string;
}

export function TimeSlotPicker({ 
  availableTimes, 
  selectedTime, 
  onSelectTime, 
  timezone = "America/New_York",
  className 
}: TimeSlotPickerProps) {
  const { getTzAbbreviation, formatTimeInUserTimezone, getUserTimeZone } = useTimeZoneUtils();
  const userTimezone = getUserTimeZone();
  
  // Debug timezone info
  console.log(`TimeSlotPicker - Facility timezone: ${timezone}, User timezone: ${userTimezone}`);
  
  // Sort times chronologically
  const sortedTimes = [...availableTimes].sort((a, b) => {
    const timeA = parse(a, "HH:mm", new Date());
    const timeB = parse(b, "HH:mm", new Date());
    return timeA.getTime() - timeB.getTime();
  });
  
  // Format time to show both time zones if necessary
  const formatTimeSlot = (timeStr: string) => {
    // Create a date object for today with this time
    const today = new Date();
    const [hours, minutes] = timeStr.split(":").map(Number);
    
    // Create a Date with current date but with the time slot time
    const slotTime = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      hours,
      minutes
    );
    
    // Calculate end time (1 hour later by default)
    const endTime = new Date(slotTime.getTime() + 60 * 60 * 1000);
    
    console.log(`TimeSlotPicker - Processing time slot: ${timeStr}`, {
      slotTime: slotTime.toISOString(),
      endTime: endTime.toISOString(),
      facilityTz: timezone
    });
    
    // Use our enhanced timezone utilities
    const { facilityTimeRange, userTimeRange, facilityZoneAbbr, userZoneAbbr, showBothTimezones } = 
      formatTimeRangeForDualZones(slotTime, endTime, timezone);
    
    // Extract just the start time from the range for display in the button
    const facilityStartTime = facilityTimeRange.split(' - ')[0];
    const userStartTime = userTimeRange.split(' - ')[0];
    
    // Show both timezones if they differ
    if (showBothTimezones) {
      return (
        <div className="flex flex-col">
          <span>{facilityStartTime}</span>
          <span className="text-xs opacity-70">
            {userStartTime} {userZoneAbbr}
          </span>
        </div>
      );
    }
    
    // Otherwise just show facility time
    return facilityStartTime;
  };
  
  // Group times into morning, afternoon, evening
  const groupedTimes = sortedTimes.reduce<Record<string, string[]>>(
    (groups, time) => {
      const hour = parseInt(time.split(":")[0], 10);
      
      if (hour < 12) {
        groups.morning = [...(groups.morning || []), time];
      } else if (hour < 17) {
        groups.afternoon = [...(groups.afternoon || []), time];
      } else {
        groups.evening = [...(groups.evening || []), time];
      }
      
      return groups;
    },
    {}
  );
  
  const renderTimeGroup = (title: string, times: string[] | undefined) => {
    if (!times || times.length === 0) return null;
    
    return (
      <div className="mb-4">
        <h3 className="text-sm font-medium mb-2">{title}</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {times.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => onSelectTime(time)}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                "border border-border hover:bg-secondary hover:text-secondary-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                selectedTime === time
                  ? "border-primary bg-primary/10 text-primary-foreground"
                  : "bg-background"
              )}
            >
              {formatTimeSlot(time)}
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div className={cn("space-y-2", className)}>
      {sortedTimes.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">
          No available time slots for this date
        </p>
      ) : (
        <>
          {renderTimeGroup("Morning", groupedTimes.morning)}
          {renderTimeGroup("Afternoon", groupedTimes.afternoon)}
          {renderTimeGroup("Evening", groupedTimes.evening)}
        </>
      )}
    </div>
  );
}