import React from "react";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { useTimeZoneUtils } from "@/hooks/use-timezone-utils";
import { formatInTimeZone } from "date-fns-tz";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AvailabilitySlot } from "@/hooks/use-appointment-availability-fixed";

interface TimeSlotPickerProps {
  slots: AvailabilitySlot[]; // Enhanced slot data from v2 API
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  timezone?: string;
  className?: string;
  showRemainingSlots?: boolean; // Whether to display remaining slots count
}

export function TimeSlotPicker({ 
  slots, 
  selectedTime, 
  onSelectTime, 
  timezone = "America/New_York",
  className,
  showRemainingSlots = true
}: TimeSlotPickerProps) {
  const { getTzAbbreviation, formatTimeInUserTimezone, getUserTimeZone } = useTimeZoneUtils();
  const userTimezone = getUserTimeZone();
  
  // Debug timezone info
  console.log(`TimeSlotPicker - Facility timezone: ${timezone}, User timezone: ${userTimezone}`);
  
  // Sort slots chronologically by time
  const sortedSlots = [...slots].sort((a, b) => {
    const timeA = parse(a.time, "HH:mm", new Date());
    const timeB = parse(b.time, "HH:mm", new Date());
    return timeA.getTime() - timeB.getTime();
  });
  
  // Format time to show both time zones if necessary
  const formatTimeSlot = (slot: AvailabilitySlot) => {
    // Create a date object for today with this time
    const today = new Date();
    const [hours, minutes] = slot.time.split(":").map(Number);
    
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
    
    console.log(`TimeSlotPicker - Processing time slot: ${slot.time}`, {
      slotTime: slotTime.toISOString(),
      endTime: endTime.toISOString(),
      facilityTz: timezone,
      available: slot.available,
      remaining: slot.remaining
    });
    
    // Format facility time (in facility timezone)
    const facilityTime = formatInTimeZone(slotTime, timezone, "h:mm a");
    const facilityTzAbbr = getTzAbbreviation(timezone);
    
    // Format user time (in user timezone)
    const userTime = format(slotTime, "h:mm a", { timeZone: userTimezone });
    const userTzAbbr = getTzAbbreviation(userTimezone);
    
    // Show both timezones if they differ
    if (userTimezone !== timezone) {
      const userOffset = new Date().getTimezoneOffset();
      const facilityOffset = new Date(formatInTimeZone(new Date(), timezone, "yyyy-MM-dd'T'HH:mm:ss")).getTimezoneOffset();
      
      // Only show both if there's an actual time difference
      if (userOffset !== facilityOffset) {
        return (
          <div className="flex flex-col">
            <span>{facilityTime}</span>
            <span className="text-xs opacity-70">
              {userTime} {userTzAbbr}
            </span>
            {showRemainingSlots && slot.available && slot.remaining !== undefined && (
              <span className="text-xs text-green-600 mt-1 font-medium">
                {slot.remaining} {slot.remaining === 1 ? 'slot' : 'slots'} left
              </span>
            )}
          </div>
        );
      }
    }
    
    // Just facility time with optional remaining count
    return (
      <div className="flex flex-col">
        <span>{facilityTime}</span>
        {showRemainingSlots && slot.available && slot.remaining !== undefined && (
          <span className="text-xs text-green-600 mt-1 font-medium">
            {slot.remaining} {slot.remaining === 1 ? 'slot' : 'slots'} left
          </span>
        )}
      </div>
    );
  };
  
  // Group slots into morning, afternoon, evening
  const groupedSlots = sortedSlots.reduce<Record<string, AvailabilitySlot[]>>(
    (groups, slot) => {
      const hour = parseInt(slot.time.split(":")[0], 10);
      
      if (hour < 12) {
        groups.morning = [...(groups.morning || []), slot];
      } else if (hour < 17) {
        groups.afternoon = [...(groups.afternoon || []), slot];
      } else {
        groups.evening = [...(groups.evening || []), slot];
      }
      
      return groups;
    },
    {}
  );
  
  const renderTimeGroup = (title: string, slotGroup: AvailabilitySlot[] | undefined) => {
    if (!slotGroup || slotGroup.length === 0) return null;
    
    return (
      <div className="mb-4">
        <h3 className="text-sm font-medium mb-2">{title}</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {slotGroup.map((slot) => (
            <TooltipProvider key={slot.time}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => slot.available && onSelectTime(slot.time)}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      "border border-border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                      selectedTime === slot.time
                        ? "border-primary bg-primary/10 text-primary-foreground"
                        : slot.available
                          ? "bg-background hover:bg-secondary hover:text-secondary-foreground"
                          : "bg-muted text-muted-foreground cursor-not-allowed opacity-70"
                    )}
                    disabled={!slot.available}
                  >
                    {formatTimeSlot(slot)}
                  </button>
                </TooltipTrigger>
                {!slot.available && slot.reason && (
                  <TooltipContent>
                    <p>{slot.reason}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div className={cn("space-y-2", className)}>
      {sortedSlots.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">
          No available time slots for this date
        </p>
      ) : (
        <>
          {renderTimeGroup("Morning", groupedSlots.morning)}
          {renderTimeGroup("Afternoon", groupedSlots.afternoon)}
          {renderTimeGroup("Evening", groupedSlots.evening)}
        </>
      )}
    </div>
  );
}