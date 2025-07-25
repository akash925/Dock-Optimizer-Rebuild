import { useState, useMemo, useEffect } from "react";
import { Schedule, Dock, Facility } from "@shared/schema";
import { format, addDays, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  ChevronLeft, 
  ChevronRight,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Extended Schedule interface with additional derived properties for UI
interface ScheduleWithTime extends Schedule {
  formattedTime: string;
  _displayStartHour?: number;
  _displayEndHour?: number;
  _spanMultipleHours?: boolean;
}

// Type for organizing schedules by hour and dock
type SchedulesByHourAndDock = Record<number, Record<number, ScheduleWithTime[]>>;

interface ScheduleDayCalendarProps {
  schedules: Schedule[];
  docks: Dock[];
  facilities: Facility[];
  date: Date;
  onScheduleClick: (scheduleId: number) => void;
  onCellClick?: (date: Date, dockId?: number) => void;
  onDateChange: (date: Date) => void;
  timezone?: string;
  timeFormat?: "12h" | "24h";
}

export default function ScheduleDayCalendar({
  schedules,
  docks,
  facilities,
  date,
  onScheduleClick,
  onCellClick,
  onDateChange,
  timezone = "America/Chicago",
  timeFormat = "12h"
}: ScheduleDayCalendarProps) {
  // State for loading indicator
  const [isLoading, setIsLoading] = useState(true);
  
  // Define hour range for the day view
  const hourStart = 6; // 6 AM
  const hourEnd = 22;  // 10 PM
  
  // Calculate display information for current date
  const dayOfWeek = format(date, "EEEE");
  const dateDisplay = format(date, "MMMM d, yyyy");
  
  // Generate hours array for rendering
  const hours = useMemo(() => {
    const result = [];
    for (let i = hourStart; i <= hourEnd; i++) {
      // Format based on 12h or 24h preference
      let label;
      if (timeFormat === "12h") {
        const hour12 = i % 12 || 12;
        const ampm = i < 12 || i === 24 ? "am" : "pm";
        label = `${hour12}${ampm}`;
      } else {
        label = `${i.toString().padStart(2, '0')}:00`;
      }
      
      // Create a Date object for this hour on the selected date
      const hourDate = new Date(date);
      hourDate.setHours(i, 0, 0, 0);
      
      result.push({
        value: i,
        label,
        date: hourDate
      });
    }
    return result;
  }, [hourStart, hourEnd, date, timeFormat]);
  
  // Navigation functions
  const goToPreviousDay = () => {
    setIsLoading(true);
    const newDate = subDays(date, 1);
    onDateChange(newDate);
  };
  
  const goToNextDay = () => {
    setIsLoading(true);
    const newDate = addDays(date, 1);
    onDateChange(newDate);
  };
  
  const goToToday = () => {
    setIsLoading(true);
    onDateChange(new Date());
  };
  
  // Improved loading state management for smoother transitions
  useEffect(() => {
    // Short delay to allow component to render before removing loading state
    // This prevents flickering during transitions
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 150);
    
    return () => clearTimeout(timer);
  }, [schedules, date]);
  
  // Handle incoming view changes more gracefully
  useEffect(() => {
    // Listen for incoming view change events from parent
    const handleExternalViewChange = (e: CustomEvent) => {
      if (e.detail && e.detail.view === 'day') {
        // Don't set loading to true if we're already in day view
        // This prevents unnecessary reloads when just changing dates
        setIsLoading(false);
      }
    };
    
    window.addEventListener('viewchange', handleExternalViewChange as EventListener);
    return () => {
      window.removeEventListener('viewchange', handleExternalViewChange as EventListener);
    };
  }, []);
  
  // Get schedules for this day and organize them - optimized for performance
  const organizedSchedules = useMemo(() => {
    // Create the result object with proper typing
    const result: SchedulesByHourAndDock = {};
    
    // Initialize empty slots for all hours
    for (let i = hourStart; i <= hourEnd; i++) {
      result[i] = {};
    }
    
    // Performance optimization: Use the selected date string once
    const selectedDay = date.toISOString().split('T')[0];
    
    // Filter only schedules for this day - using a safer approach
    // that avoids TypeScript errors
    const appointmentsToShow = schedules.filter(schedule => {
      // Skip invalid schedules quickly
      if (!schedule.startTime || !schedule.endTime) return false;
      
      try {
        // Create date objects for safer comparison
        const scheduleStartDate = new Date(schedule.startTime);
        const scheduleEndDate = new Date(schedule.endTime);
        
        // Convert to simple date strings (YYYY-MM-DD format)
        const startDateString = scheduleStartDate.toISOString().split('T')[0];
        const endDateString = scheduleEndDate.toISOString().split('T')[0];
        
        // Include any appointments that overlap with selected day
        return selectedDay >= startDateString && selectedDay <= endDateString;
      } catch (e) {
        // Handle any parsing errors safely
        return false;
      }
    });
    
    // Process only the filtered appointments - no unnecessary work
    appointmentsToShow.forEach(schedule => {
      // We don't strictly need a dock ID for visualization
      const dockId = schedule.dockId || 0; // Use 0 for no dock
      
      // Use faster string-based date handling
      const startDate = new Date(schedule.startTime);
      const endDate = new Date(schedule.endTime);

      // Create a readable time format string
      let startTimeFormatted, endTimeFormatted;
      
      if (timeFormat === "12h") {
        startTimeFormatted = `${startDate.getHours() % 12 || 12}:${startDate.getMinutes().toString().padStart(2, '0')}${startDate.getHours() < 12 ? 'am' : 'pm'}`;
        endTimeFormatted = `${endDate.getHours() % 12 || 12}:${endDate.getMinutes().toString().padStart(2, '0')}${endDate.getHours() < 12 ? 'am' : 'pm'}`;
      } else {
        startTimeFormatted = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
        endTimeFormatted = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
      }
      
      // Add a space between time and am/pm for better readability
      startTimeFormatted = startTimeFormatted.replace(/([ap]m)$/, ' $1');
      endTimeFormatted = endTimeFormatted.replace(/([ap]m)$/, ' $1');
      
      const formattedTime = `${startTimeFormatted} - ${endTimeFormatted}`;
      
      // Calculate relevant display hours for this day view
      let displayStartHour = startDate.getHours();
      let displayEndHour = endDate.getHours();
      
      // If appointment starts before this day, use midnight (hour 0) as start 
      if (startDate.getDate() !== date.getDate() || 
          startDate.getMonth() !== date.getMonth() || 
          startDate.getFullYear() !== date.getFullYear()) {
        displayStartHour = hourStart;
      }
      
      // If appointment ends after this day, use last hour as end
      if (endDate.getDate() !== date.getDate() || 
          endDate.getMonth() !== date.getMonth() || 
          endDate.getFullYear() !== date.getFullYear()) {
        displayEndHour = hourEnd;
      }
      
      // Enhanced schedule object with additional metadata
      const scheduleWithTime: ScheduleWithTime = {
        ...schedule,
        formattedTime,
        // Store original date info so we can calculate proper heights
        _displayStartHour: displayStartHour,
        _displayEndHour: displayEndHour,
        _spanMultipleHours: (displayEndHour - displayStartHour) > 0
      };
     
      // We'll only add this schedule to the FIRST hour slot to avoid duplicates
      // The rendering logic will handle showing it with proper height spanning multiple slots
      const firstHour = Math.max(hourStart, displayStartHour);
      
      // Initialize dock array if it doesn't exist
      if (!result[firstHour][dockId]) {
        result[firstHour][dockId] = [];
      }
      
      // Only add if not already present (deduplication)
      const alreadyAdded = result[firstHour][dockId].some(s => s.id === schedule.id);
      if (!alreadyAdded) {
        result[firstHour][dockId].push(scheduleWithTime);
      }
    });
    
    return result;
  }, [schedules, date, hourStart, hourEnd, timezone, timeFormat]);

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4 max-w-full overflow-hidden relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-50">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm mt-2">Loading calendar...</span>
          </div>
        </div>
      )}
      
      {/* Calendar Header with view mode toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline" 
            size="icon" 
            onClick={goToPreviousDay}
            className="h-8 w-8"
            disabled={isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline" 
            size="sm"
            onClick={goToToday}
            className="h-8 px-3 text-xs bg-green-100 hover:bg-green-200 border-green-200"
            disabled={isLoading}
          >
            today
          </Button>
          <Button
            variant="outline" 
            size="icon" 
            onClick={goToNextDay}
            className="h-8 w-8"
            disabled={isLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Date display in center */}
        <div className="flex items-center space-x-2 order-first sm:order-none w-full sm:w-auto justify-center">
          <h3 className="text-xl font-medium text-center">{dateDisplay}</h3>
        </div>
        
        {/* View Mode Switch */}
        <div className="flex items-center space-x-2 ml-auto">
          <div className="flex rounded overflow-hidden border">
            <Button
              variant="ghost" 
              size="sm" 
              className="h-7 px-3 text-xs rounded-none border-r"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  // Use URL manipulation without full page reload
                  setIsLoading(true);
                  const dateParam = `&date=${date.toISOString().split('T')[0]}`;
                  const newUrl = `/schedules?view=month${dateParam}`;
                  window.history.pushState({}, '', newUrl);
                  // Signal view change to parent component
                  window.dispatchEvent(new CustomEvent('viewchange', { 
                    detail: { view: 'month', date }
                  }));
                }
              }}
              disabled={isLoading}
            >
              month
            </Button>
            <Button
              variant="ghost" 
              size="sm" 
              className="h-7 px-3 text-xs rounded-none border-r"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  // Use URL manipulation without full page reload
                  setIsLoading(true);
                  const dateParam = `&date=${date.toISOString().split('T')[0]}`;
                  const newUrl = `/schedules?view=week${dateParam}`;
                  window.history.pushState({}, '', newUrl);
                  // Signal view change to parent component
                  window.dispatchEvent(new CustomEvent('viewchange', { 
                    detail: { view: 'week', date }
                  }));
                }
              }}
              disabled={isLoading}
            >
              week
            </Button>
            <Button
              variant="default" 
              size="sm" 
              className="h-7 px-3 text-xs rounded-none border-r"
              onClick={() => onDateChange(date)} // Just refresh current date
              disabled={isLoading}
            >
              day
            </Button>
            <Button
              variant="ghost" 
              size="sm" 
              className="h-7 px-3 text-xs rounded-none"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  // Use URL manipulation without full page reload
                  setIsLoading(true);
                  const dateParam = `&date=${date.toISOString().split('T')[0]}`;
                  const newUrl = `/schedules?view=list${dateParam}`;
                  window.history.pushState({}, '', newUrl);
                  // Signal view change to parent component
                  window.dispatchEvent(new CustomEvent('viewchange', { 
                    detail: { view: 'list', date }
                  }));
                }
              }}
              disabled={isLoading}
            >
              list
            </Button>
          </div>
        </div>
      </div>

      {/* New Day View Calendar - Timeline style like the reference */}
      <div className="border rounded-md overflow-x-auto max-w-full">
        {/* Header row with day name */}
        <div className="bg-gray-50 border-b py-2 text-center sticky top-0 z-10">
          <div className="font-medium">{dayOfWeek}</div>
        </div>
        
        {/* Time slots */}
        <div className="divide-y">
          {hours.map((hour) => (
            <div key={hour.value} className="relative hover:bg-gray-50/70">
              {/* Time label */}
              <div className="absolute left-0 top-0 w-16 sm:w-20 py-2 px-2 text-left border-r bg-gray-50 text-gray-700 text-sm font-medium">
                {hour.label}
              </div>
              
              {/* Appointments for this hour */}
              <div className="ml-16 sm:ml-20 min-h-[3rem] p-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
                {organizedSchedules[hour.value] && 
                  Object.entries(organizedSchedules[hour.value]).flatMap(([dockId, dockSchedules]) => {
                    return dockSchedules.map((schedule) => {
                      // Performance optimization: Get facility name more efficiently
                      let facilityName = "";
                      
                      // Option 1: Direct from schedule if available (fastest path)
                      if ((schedule as any).facilityName) {
                        facilityName = (schedule as any).facilityName;
                      } 
                      // Option 2: From schedule's facilityId if available
                      else if (schedule.facilityId) {
                        const facility = facilities?.find(f => f.id === schedule.facilityId);
                        facilityName = facility?.name || "";
                      }
                      // Option 3: From dock's facility as fallback
                      else if (schedule.dockId) {
                        const dock = docks.find(d => d.id === schedule.dockId);
                        if (dock?.facilityId) {
                          const facility = facilities?.find(f => f.id === dock.facilityId);
                          facilityName = facility?.name || "";
                        }
                      }
                      
                      const isInbound = schedule.type === "inbound";
                      
                      // Calculate appropriate height for multi-hour appointments
                      // Use the _displayStartHour and _displayEndHour metadata we added
                      const startHour = schedule._displayStartHour || hour.value;
                      const endHour = schedule._displayEndHour || hour.value + 1;
                      const hourSpan = endHour - startHour;
                      
                      // Scale height based on hour span - our new metadata-driven approach
                      const heightClass = 
                        hourSpan >= 5 ? "h-auto min-h-[10rem]" : 
                        hourSpan >= 4 ? "h-auto min-h-[8rem]" :
                        hourSpan >= 3 ? "h-auto min-h-[7rem]" :
                        hourSpan >= 2 ? "h-auto min-h-[5.5rem]" :
                        hourSpan >= 1 ? "h-auto min-h-[4rem]" : 
                        "h-auto min-h-[3rem]";
                      
                      return (
                        <div
                          key={schedule.id}
                          className={cn(
                            "p-2 rounded-sm cursor-pointer border transition-colors overflow-hidden flex flex-col",
                            heightClass,
                            schedule.status === "completed" 
                              ? "bg-green-50 border-green-200"
                              : schedule.status === "cancelled" 
                                ? "bg-gray-100 border-gray-300"
                                : schedule.status === "in-progress"
                                  ? "bg-yellow-50 border-yellow-300"
                                  : isInbound 
                                    ? "bg-blue-50 border-blue-200" 
                                    : "bg-purple-50 border-purple-200",
                            "hover:shadow-md"
                          )}
                          style={{
                            boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
                            minHeight: '40px'
                          }}
                          onClick={() => onScheduleClick(schedule.id)}
                        >
                          {/* ULTRA-PROMINENT CUSTOMER NAME - Guaranteed to be visible with background */}
                          <div 
                            className={`font-black text-base lg:text-lg mb-1 leading-tight text-gray-900 tracking-tight px-1.5 py-1 -mx-1 -mt-1 rounded-t-sm ${
                              isInbound ? 'bg-blue-50' : 'bg-purple-50'
                            }`}
                            style={{ 
                              textShadow: "0px 0px 0.5px rgba(0,0,0,0.2)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "100%",
                              borderBottom: isInbound ? '2px solid #60a5fa' : '2px solid #c084fc'
                            }}
                          >
                            {schedule.customerName || "Unnamed"}
                          </div>
                          
                          {/* Type badge + Status inline */}
                          <div className="flex items-center gap-1 truncate">
                            <span className={cn(
                              "text-[10px] px-1 py-0.5 rounded-sm font-bold uppercase",
                              isInbound ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                            )}>
                              {isInbound ? "IN" : "OUT"}
                            </span>
                            <span className={cn(
                              "text-[10px] px-1 py-0.5 rounded-sm font-bold uppercase",
                              schedule.status === "completed" ? "bg-green-100 text-green-800" :
                              schedule.status === "in-progress" ? "bg-yellow-100 text-yellow-800" :
                              schedule.status === "cancelled" ? "bg-red-100 text-red-800" :
                              "bg-blue-100 text-blue-800"
                            )}>
                              {schedule.status?.substring(0,3).toUpperCase() || "SCH"}
                            </span>
                            {schedule.truckNumber && 
                              <span className="text-[10px] px-1 py-0.5 bg-gray-100 rounded-sm font-bold">
                                #{schedule.truckNumber}
                              </span>
                            }
                          </div>

                          {/* Facility name and time */}
                          <div className="flex justify-between items-center text-[10px] mt-1">
                            <span className="font-medium truncate">{schedule.formattedTime}</span>
                            <span className="truncate text-blue-800 font-semibold ml-1">
                              {facilityName}
                            </span>
                          </div>
                          
                          {/* Carrier info if space permits */}
                          <div className="text-[9px] truncate text-gray-700 mt-0.5 font-medium">
                            {schedule.carrierName || "No carrier"}
                          </div>
                        </div>
                      );
                    });
                  })
                }
                
                {/* Add empty cell with click handler if no appointments */}
                {(!organizedSchedules[hour.value] || Object.keys(organizedSchedules[hour.value]).length === 0) && (
                  <div 
                    className="h-10 w-full cursor-pointer"
                    onClick={() => onCellClick && onCellClick(hour.date)}
                  ></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}