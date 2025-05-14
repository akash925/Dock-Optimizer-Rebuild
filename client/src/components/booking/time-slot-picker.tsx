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
  console.log(`TimeSlotPicker - Received ${slots.length} slots from API`);
  
  // Debug: Log the actual slots received from the backend
  console.log(`TimeSlotPicker - Slot data from API:`, JSON.stringify(slots, null, 2));
  
  // Sort slots chronologically by time - using only what the API provides
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
    
    // Create a proper dateTime string for the current slot time with today's date
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const slotDateTime = `${dateStr}T${timeStr}:00`;
    
    // Parse the time using the facility timezone to ensure proper conversion
    const slotTimeInFacilityTz = new Date(
      formatInTimeZone(new Date(slotDateTime), timezone, "yyyy-MM-dd'T'HH:mm:ss")
    );
    
    // For logging/debugging
    console.log(`TimeSlotPicker - Processing time slot: ${slot.time}`, {
      slotTimeInFacilityTz: slotTimeInFacilityTz.toISOString(),
      facilityTz: timezone,
      userTz: userTimezone,
      available: slot.available,
      remaining: slot.remaining
    });
    
    // Format facility time (in facility timezone)
    const facilityTime = formatInTimeZone(slotTimeInFacilityTz, timezone, "h:mm a");
    const facilityTzAbbr = getTzAbbreviation(timezone);
    
    // Format user time (in user timezone) - properly convert from facility time
    const userTime = formatInTimeZone(slotTimeInFacilityTz, userTimezone, "h:mm a");
    const userTzAbbr = getTzAbbreviation(userTimezone);
    
    // Show both timezones if they differ
    if (userTimezone !== timezone) {
      // Check if the displayed times would actually be different
      if (facilityTime !== userTime || facilityTzAbbr !== userTzAbbr) {
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span>{facilityTime}</span>
              <span className="text-xs text-muted-foreground">({facilityTzAbbr})</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{userTime}</span>
              <span>({userTzAbbr})</span>
            </div>
            {showRemainingSlots && slot.available && slot.remaining !== undefined && (
              <span className="text-xs text-green-600 mt-1 font-medium">
                {slot.remaining} {slot.remaining === 1 ? 'spot' : 'spots'} left
              </span>
            )}
          </div>
        );
      }
    }
    
    // Just facility time with timezone abbreviation
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span>{facilityTime}</span>
          <span className="text-xs text-muted-foreground">({facilityTzAbbr})</span>
        </div>
        {showRemainingSlots && slot.available && slot.remaining !== undefined && (
          <span className="text-xs text-green-600 mt-1 font-medium">
            {slot.remaining} {slot.remaining === 1 ? 'spot' : 'spots'} left
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
          {slotGroup.map((slot) => {
            // Detect specific slot states
            const isBufferTime = slot.reason?.toLowerCase().includes('buffer') || 
                slot.reason?.toLowerCase().includes('too soon');
            const isBreakTime = slot.reason?.toLowerCase().includes('break');
            const isCapacityFull = slot.reason?.toLowerCase().includes('capacity');
            
            return (
              <TooltipProvider key={slot.time}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => slot.available && onSelectTime(slot.time)}
                      className={cn(
                        "px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                        "border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                        selectedTime === slot.time
                          ? "border-primary bg-primary/10 text-primary-foreground"
                          : slot.available
                            ? "border-border bg-background hover:bg-secondary hover:text-secondary-foreground"
                            : isBufferTime 
                              ? "bg-amber-50/80 border-amber-200 text-amber-800 opacity-80 cursor-not-allowed"
                              : isBreakTime
                                ? "bg-gray-100 border-gray-200 text-gray-800 opacity-80 cursor-not-allowed"
                                : isCapacityFull
                                  ? "bg-red-50/60 border-red-200 text-red-800 opacity-80 cursor-not-allowed"
                                  : "bg-muted border-border text-muted-foreground cursor-not-allowed opacity-70"
                      )}
                      disabled={!slot.available}
                    >
                      <div className="flex flex-col items-center">
                        {formatTimeSlot(slot)}
                        
                        {/* Show capacity badges for available slots */}
                        {slot.available && slot.remaining !== undefined && slot.remaining > 0 && (
                          <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full mt-1 font-medium">
                            {slot.remaining} {slot.remaining === 1 ? 'spot' : 'spots'}
                          </span>
                        )}
                        
                        {/* Buffer time label */}
                        {!slot.available && isBufferTime && (
                          <span className="text-xs text-amber-600 font-medium mt-1">
                            Buffer Time
                          </span>
                        )}
                        
                        {/* Break time label */}
                        {!slot.available && isBreakTime && (
                          <span className="text-xs text-gray-600 font-medium mt-1">
                            Facility Break
                          </span>
                        )}
                        
                        {/* Capacity label */}
                        {!slot.available && isCapacityFull && (
                          <span className="text-xs text-red-600 font-medium mt-1">
                            No Capacity
                          </span>
                        )}
                      </div>
                    </button>
                  </TooltipTrigger>
                  {!slot.available && slot.reason && (
                    <TooltipContent>
                      <p>{slot.reason}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
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