import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import { format, addDays, startOfWeek, endOfWeek, isWithinInterval, areIntervalsOverlapping, addMinutes } from "date-fns";
import { Schedule, Carrier } from "@shared/schema";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon,
  X,
  Info,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { utcToUserTime, formatInUserTimeZone, getUserTimeZone, getCurrentTimeInTimeZone } from "@/lib/timezone-utils";

interface ScheduleWeekCalendarProps {
  schedules: Schedule[];
  docks: { id: number; name: string }[];
  carriers: Carrier[];
  date: Date;
  onScheduleClick: (scheduleId: number) => void;
  onDateChange: (date: Date) => void;
  onViewChange: (view: "month" | "week" | "day" | "list") => void;
  onCellClick?: (date: Date, dockId?: number) => void;
  timezone?: string; // Add timezone prop
  timeFormat?: "12h" | "24h"; // Add time format prop
}

export default function ScheduleWeekCalendar({
  schedules,
  docks,
  carriers,
  date,
  onScheduleClick,
  onDateChange,
  onViewChange,
  onCellClick,
  timezone,
  timeFormat = "12h", // Default to 12h format if not specified
}: ScheduleWeekCalendarProps) {
  // State for filters
  const [customerSearch, setCustomerSearch] = useState("");
  const [carrierSearch, setCarrierSearch] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState(timezone || "");
  const [isLoading, setIsLoading] = useState(false);
  
  // State for current time indicator
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentTimePosition, setCurrentTimePosition] = useState<number>(0);
  
  // Current week dates - memoized to avoid recalculation
  const { weekStart, weekEnd, dateRangeDisplay, weekDays } = useMemo(() => {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 }); // Sunday as start of week
    const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
    const dateRangeDisplay = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    
    return { weekStart, weekEnd, dateRangeDisplay, weekDays };
  }, [date]);
  
  // Generate hours from 12AM to 11PM based on timeFormat - memoized
  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const hour = i; // Starting from 12 AM
      return {
        display: timeFormat === "24h"
          ? `${hour.toString().padStart(2, '0')}:00`  // 24h format (e.g., "08:00", "14:00")
          : hour < 12 
            ? `${hour === 0 ? 12 : hour}am` 
            : `${hour === 12 ? 12 : hour - 12}${hour < 12 ? 'am' : 'pm'}`,
        value: hour
      };
    });
  }, [timeFormat]);
  
  // Filter schedules based on search inputs - memoized for better performance
  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      // Filter by customer name
      const customerMatch = customerSearch 
        ? (schedule.customerName?.toLowerCase().includes(customerSearch.toLowerCase()) || false)
        : true;
      
      // Filter by carrier name
      let carrierMatch = true;
      if (carrierSearch) {
        const carrier = carriers.find(c => c.id === schedule.carrierId);
        const carrierName = (schedule as any).carrierName;
        carrierMatch = carrier 
          ? carrier.name.toLowerCase().includes(carrierSearch.toLowerCase())
          : carrierName 
            ? carrierName.toLowerCase().includes(carrierSearch.toLowerCase())
            : false;
      }
      
      return customerMatch && carrierMatch;
    });
  }, [schedules, customerSearch, carrierSearch, carriers]);
  
  // Get week schedules - memoized to prevent recalculation on every render
  const weekSchedules = useMemo(() => {
    return filteredSchedules.filter(schedule => {
      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);
      
      // Check if schedule overlaps with the week
      return isWithinInterval(scheduleStart, { start: weekStart, end: weekEnd }) ||
             isWithinInterval(scheduleEnd, { start: weekStart, end: weekEnd }) ||
             areIntervalsOverlapping(
               { start: scheduleStart, end: scheduleEnd },
               { start: weekStart, end: weekEnd }
             );
    });
  }, [filteredSchedules, weekStart, weekEnd]);
  
  // Function to get the day index for a schedule
  const getScheduleDayIndex = (schedule: Schedule) => {
    const scheduleStart = new Date(schedule.startTime);
    
    // Get day index (0-6)
    const index = weekDays.findIndex(day => 
      day.getDate() === scheduleStart.getDate() && 
      day.getMonth() === scheduleStart.getMonth() &&
      day.getFullYear() === scheduleStart.getFullYear()
    );
    
    return index;
  };
  
  // Helper function to format time based on timeFormat setting
  const formatTimeWithFormat = (date: Date): string => {
    if (timeFormat === "24h") {
      return format(date, 'HH:mm'); // 24-hour format (e.g., 14:30)
    } else {
      return format(date, 'h:mm a'); // 12-hour format with am/pm (e.g., 2:30 pm)
    }
  };
  

  
  // Move to previous/next week with loading indicators
  const goToPreviousWeek = () => {
    setIsLoading(true);
    setTimeout(() => onDateChange(addDays(date, -7)), 10);
  };
  
  const goToNextWeek = () => {
    setIsLoading(true);
    setTimeout(() => onDateChange(addDays(date, 7)), 10);
  };
  
  const goToToday = () => {
    setIsLoading(true);
    setTimeout(() => onDateChange(new Date()), 10);
  };
  
  // Reset loading state when schedules or date changes
  useEffect(() => {
    setIsLoading(false);
  }, [schedules, date]);
  
  // Clear all filters
  const clearFilters = () => {
    setCustomerSearch("");
    setCarrierSearch("");
    // Timezone selection is now handled by parent component
  };
  
  // Reference to the calendar grid container for auto-scrolling
  const calendarGridRef = useRef<HTMLDivElement>(null);
  const timeHeadersRef = useRef<HTMLDivElement>(null);
  const dayHeadersRef = useRef<HTMLDivElement>(null);
  const calendarContentRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to 8 AM when the component mounts or updates
  useEffect(() => {
    if (calendarGridRef.current) {
      // Calculate position for 8 AM (hour index 8) - 12AM is index 0
      const scrollToPosition = 8 * 50; // 8 hours * 50px per hour
      calendarGridRef.current.scrollTop = scrollToPosition;
    }
  }, [date, schedules]); // Re-scroll when date or schedules change
  
  // Sync scroll position of time headers with main grid
  useEffect(() => {
    const handleGridScroll = () => {
      if (calendarGridRef.current && timeHeadersRef.current) {
        timeHeadersRef.current.scrollTop = calendarGridRef.current.scrollTop;
      }
    };
    
    const grid = calendarGridRef.current;
    if (grid) {
      grid.addEventListener('scroll', handleGridScroll);
      return () => grid.removeEventListener('scroll', handleGridScroll);
    }
  }, []);
  
  // Function to calculate the current time position based on timezone
  const calculateTimePosition = () => {
    // Use selected timezone if available, otherwise use local time
    const tzToUse = timezone || getUserTimeZone();
    
    // Get current time in the selected timezone
    const now = getCurrentTimeInTimeZone(tzToUse);
    
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Calculate position (each hour is 50px)
    const position = (hours + minutes / 60) * 50;
    return position;
  };
  
  // Update current time every minute and when timezone changes
  useEffect(() => {
    // Get the timezone-adjusted current time
    const tzToUse = timezone || getUserTimeZone();
    const now = getCurrentTimeInTimeZone(tzToUse);
    
    // Initial calculation
    setCurrentTime(now);
    setCurrentTimePosition(calculateTimePosition());
    
    // Set up interval to update every minute
    const interval = setInterval(() => {
      const updatedNow = getCurrentTimeInTimeZone(tzToUse);
      setCurrentTime(updatedNow);
      setCurrentTimePosition(calculateTimePosition());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [timezone]); // Recalculate when timezone changes

  return (
    <div className="bg-white rounded-lg shadow p-3 pb-0 mb-4 relative w-full overflow-hidden">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center">
            <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-primary rounded-full"></div>
            <span className="text-sm mt-2">Loading calendar...</span>
          </div>
        </div>
      )}
      
      {/* Ultra Compact Filters - Combined row with calendar navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
        <div className="flex items-center space-x-1">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToPreviousWeek}
            className="h-7 w-7"
            disabled={isLoading}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToNextWeek}
            className="h-7 w-7"
            disabled={isLoading}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
            className="h-7 px-2 text-xs"
            disabled={isLoading}
          >
            today
          </Button>
        </div>
        
        {/* View Mode Switch */}
        <div className="flex items-center space-x-2 ml-auto">
          <div className="bg-muted rounded-md p-1 flex space-x-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-3 text-xs"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  setIsLoading(true);
                  window.location.href = '/schedules?view=day';
                }
              }}
              disabled={isLoading}
            >
              Day
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="h-7 px-3 text-xs"
              onClick={() => onDateChange(date)} // Just refresh current date
              disabled={isLoading}
            >
              Week
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-3 text-xs"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  setIsLoading(true);
                  window.location.href = '/schedules?view=month';
                }
              }}
              disabled={isLoading}
            >
              Month
            </Button>
          </div>
        </div>
        
        <div className="text-base font-medium bg-gray-50 py-1 px-3 rounded-md border border-gray-200">
          {dateRangeDisplay}
        </div>

        <div className="flex gap-1 items-center">
          <div className="relative w-[150px]">
            <input 
              type="text" 
              placeholder="Customer Name" 
              className="w-full h-7 px-2 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary pr-6 text-xs"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            {customerSearch && (
              <button 
                className="absolute right-1 top-1.5 text-gray-500 hover:text-gray-700"
                onClick={() => setCustomerSearch("")}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="relative w-[150px]">
            <input 
              type="text" 
              placeholder="Carrier Name" 
              className="w-full h-7 px-2 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary pr-6 text-xs"
              value={carrierSearch}
              onChange={(e) => setCarrierSearch(e.target.value)}
            />
            {carrierSearch && (
              <button 
                className="absolute right-1 top-1.5 text-gray-500 hover:text-gray-700"
                onClick={() => setCarrierSearch("")}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {/* Timezone selection moved to parent component */}
          <Button 
            variant="secondary" 
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={clearFilters}
            disabled={!customerSearch && !carrierSearch}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* View mode buttons removed - now using view switcher in the header */}
      
      {/* Week Calendar Grid - With sticky headers */}
      <div className="border rounded relative">
        {/* Sticky day headers */}
        <div 
          ref={dayHeadersRef}
          className="grid grid-cols-8 min-w-max sticky top-0 z-20 shadow-sm" 
          style={{ width: 'calc(100% - 0px)' }}
        >
          {/* Empty top-left cell */}
          <div className="border-b border-r h-10 w-16 bg-gray-50"></div>
          
          {/* Day headers */}
          {weekDays.map((day, i) => (
            <div 
              key={i} 
              className={cn(
                "border-b border-r h-10 px-1 w-[calc((100%-4rem)/7)] min-w-[6rem] text-center flex flex-col justify-center",
                day.getDate() === new Date().getDate() && 
                day.getMonth() === new Date().getMonth() && 
                day.getFullYear() === new Date().getFullYear() 
                  ? "bg-blue-50" 
                  : "bg-gray-50"
              )}
            >
              <div className="font-medium text-sm">{format(day, 'EEE M/d')}</div>
            </div>
          ))}
        </div>
        
        <div className="flex">
          {/* Sticky time labels */}
          <div 
            ref={timeHeadersRef}
            className="w-16 flex-shrink-0 overflow-hidden z-10"
            style={{ height: 'calc(100vh - 210px)' }}
          >
            {hours.map((hour, i) => (
              <div 
                key={i} 
                className="border-b border-r py-1 px-1 w-16 text-xs text-gray-500 h-[50px] bg-gray-50 flex items-center justify-center"
              >
                {hour.display}
              </div>
            ))}
          </div>
          
          {/* Main calendar grid */}
          <div 
            ref={calendarGridRef}
            className="overflow-auto relative flex-grow"
            style={{ height: 'clamp(300px, calc(100vh - 210px), 700px)' }}
          >
            <div 
              ref={calendarContentRef}
              className="grid grid-cols-7 min-w-max w-full relative"
            >
              {/* Day columns with cells */}
              {weekDays.map((day, dayIndex) => (
                <div key={dayIndex} className="contents">
                  {hours.map((hour, hourIndex) => {
                    // Create date object for the current cell (day + time)
                    // Create a fresh copy of the date to prevent any reference issues
                    const cellDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
                    cellDate.setHours(hour.value);
                    cellDate.setMinutes(0);
                    
                    // Verify that this is a valid date object
                    if (isNaN(cellDate.getTime())) {
                      console.error("Invalid cellDate created:", { day, hour });
                    }

                    return (
                      <div 
                        key={`${dayIndex}-${hourIndex}`} 
                        className={cn(
                          "border-b border-r w-full min-w-[6rem] h-[50px] relative cursor-pointer hover:bg-gray-100 transition-colors",
                          day.getDate() === new Date().getDate() && 
                          day.getMonth() === new Date().getMonth() && 
                          day.getFullYear() === new Date().getFullYear() 
                            ? "bg-blue-50/30" 
                            : hour.value % 2 === 0 ? "bg-gray-50/30" : ""
                        )}
                        onClick={() => onCellClick && onCellClick(cellDate, undefined)}
                      ></div>
                    );
                  })}
                </div>
              ))}
              
              {/* Current time indicator - only show for today's date */}
              {weekDays.some(day => 
                day.getDate() === new Date().getDate() && 
                day.getMonth() === new Date().getMonth() && 
                day.getFullYear() === new Date().getFullYear()
              ) && (
                <div className="absolute left-0 right-0 flex items-center z-50 pointer-events-none" 
                     style={{ top: `${currentTimePosition}px` }}>
                  <div className="w-16 flex items-center justify-end pr-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 text-red-500 mr-1" />
                            <span className="text-xs font-medium text-red-500">
                              {formatTimeWithFormat(currentTime)}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="start" className="text-xs">
                          <p>Current time</p>
                          <p className="text-muted-foreground">Timezone: {timezone || getUserTimeZone()}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex-1 border-t border-red-500 relative">
                    <div className="absolute -right-1 -top-1.5 w-0 h-0 border-t-4 border-r-4 border-b-4 border-transparent border-r-red-500 border-b-transparent" />
                  </div>
                </div>
              )}
              
              {/* Schedule events - positioned absolutely over the grid */}
              {weekSchedules.map(schedule => {
                const dayIndex = getScheduleDayIndex(schedule);
                if (dayIndex === -1) return null;
                
                const isInbound = schedule.type === "inbound";
                const carrier = carriers.find(c => c.id === schedule.carrierId);
                
                // Get the facility timezone from the appointment type, facility, or default to America/New_York
                const facilityTimeZone = "America/New_York";
                
                // Convert UTC times to user's timezone for display
                const startDate = utcToUserTime(schedule.startTime);
                const endDate = utcToUserTime(schedule.endTime);
                
                // Format times for display based on selected time format
                const startTimeStr = formatTimeWithFormat(startDate);
                const endTimeStr = formatTimeWithFormat(endDate);
                
                // Calculate precise position based on hours and cell size
                const startHour = startDate.getHours();
                const startMinute = startDate.getMinutes();
                const endHour = endDate.getHours();
                const endMinute = endDate.getMinutes();
                
                // Round startMinute to nearest 15-min slot (0, 15, 30, 45)
                const roundedStartMinute = Math.floor(startMinute / 15) * 15;
                
                // For end time, round up to nearest 15-min slot
                const roundedEndMinute = Math.ceil(endMinute / 15) * 15;
                
                // Calculate position relative to hours (starting from 12am)
                const hourOffset = startHour; // Hours since 12am
                const minuteOffset = roundedStartMinute / 60; // Percentage of hour
                
                // Calculate position
                const topPosition = (hourOffset + minuteOffset) * 50; // Each hour is 50px
                
                // Calculate height using rounded minutes (clamp to minimum height for visibility)
                const durationHours = Math.max(0.5, (endHour - startHour) + ((roundedEndMinute - roundedStartMinute) / 60));
                const height = Math.max(25, durationHours * 50); // Each hour is 50px, min height 25px
                
                // Calculate width and left position for each event
                const leftPosition = `${dayIndex * (100 / 7)}%`;  
                const width = `calc(${100/7}% - 4px)`;
                
                // Check for overlapping appointments at the same time slot
                const overlappingSchedules = weekSchedules.filter(s => 
                  s.id !== schedule.id && 
                  getScheduleDayIndex(s) === dayIndex &&
                  areIntervalsOverlapping(
                    { start: new Date(s.startTime), end: new Date(s.endTime) },
                    { start: startDate, end: endDate }
                  )
                );
                
                // Calculate offset for stacked appointments
                const isOverlapping = overlappingSchedules.length > 0;
                const overlapCount = overlappingSchedules.length + 1; // +1 for current schedule
                const overlapIndex = overlappingSchedules.filter(s => s.id < schedule.id).length;
                
                // Status-based styling
                const statusColor = schedule.status === "completed" 
                  ? "bg-green-100 border-green-300"
                  : schedule.status === "cancelled" 
                    ? "bg-gray-100 border-gray-300"
                    : schedule.status === "in-progress"
                      ? "bg-yellow-100 border-yellow-300"
                      : isInbound 
                        ? "bg-blue-100 border-blue-300" 
                        : "bg-purple-100 border-purple-300";
                
                return (
                  <TooltipProvider key={schedule.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className={cn(
                            "absolute rounded-sm p-1 text-xs cursor-pointer border overflow-hidden flex flex-col",
                            statusColor
                          )}
                          style={{
                            top: `${topPosition}px`,
                            height: `${height}px`,
                            left: isOverlapping 
                              ? `calc(${leftPosition} + ${(overlapIndex * 5)}px)` // Offset stacked appointments
                              : leftPosition,
                            width: isOverlapping 
                              ? `calc(${width} - ${(overlapCount - 1) * 5}px)` // Make room for other appointments
                              : width,
                            minWidth: isOverlapping 
                              ? 'calc(8rem - 4px)' 
                              : 'calc(9rem - 4px)',
                            zIndex: isOverlapping ? 10 + overlapIndex : 10, // Stack newer appointments on top
                            minHeight: '40px', // Minimum height to ensure content visibility
                            maxHeight: `${Math.max(height, 80)}px`, // More maximum height for content
                            opacity: isOverlapping ? 0.95 : 1, // Slight transparency for overlapping appointments
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'
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
                            {schedule.customerName || "(No customer)"}
                          </div>
                          
                          {/* Type badge + Status inline */}
                          <div className="flex items-center gap-1 truncate">
                            <span className={`text-[10px] px-1 py-0.5 rounded-sm font-bold uppercase ${
                              isInbound ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {isInbound ? "IN" : "OUT"}
                            </span>
                            <span className={`text-[10px] px-1 py-0.5 rounded-sm font-bold uppercase ${
                              schedule.status === "completed" ? 'bg-green-100 text-green-800' :
                              schedule.status === "in-progress" ? 'bg-yellow-100 text-yellow-800' :
                              schedule.status === "cancelled" ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
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
                            <span className="font-medium truncate">{startTimeStr}-{endTimeStr}</span>
                            {(schedule as any).facilityName && (
                              <span className="truncate text-blue-800 font-semibold ml-1">
                                {(schedule as any).facilityName}
                              </span>
                            )}
                          </div>
                          
                          {/* Carrier info if space permits */}
                          {carrier?.name && (
                            <div className="text-[9px] truncate text-gray-700 mt-0.5 font-medium">
                              {carrier.name}
                            </div>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-1 text-xs">
                          <div className="font-extrabold text-base text-gray-800 border-b border-gray-200 pb-1 mb-1">{schedule.customerName || "Unnamed Appointment"}</div>
                          <div>
                            <span className="font-medium">Time:</span> {startTimeStr}-{endTimeStr}
                          </div>
                          <div>
                            <span className="font-medium">Facility:</span> {(schedule as any).facilityName || "Not specified"}
                          </div>
                          <div>
                            <span className="font-medium">Type:</span> 
                            <span className={`ml-1 px-1.5 py-0.5 rounded-sm ${
                              isInbound ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                            }`}>
                              {isInbound ? "Inbound" : "Outbound"}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Carrier:</span> {carrier?.name || (schedule as any).carrierName || "Unknown"}
                          </div>
                          {schedule.truckNumber && (
                            <div>
                              <span className="font-medium">Truck #:</span> {schedule.truckNumber}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Status:</span> {schedule.status?.charAt(0).toUpperCase() + schedule.status?.slice(1) || "Unknown"}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}