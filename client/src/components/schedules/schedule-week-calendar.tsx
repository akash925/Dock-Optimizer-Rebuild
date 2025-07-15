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
// Remove timezone conversions to fix over-correction
import { getUserTimeZone } from "@shared/timezone-service";

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
  
  // Function to calculate the top position of a schedule in the grid
  const getScheduleTopPosition = (schedule: Schedule, hours: { value: number; display: string }[]) => {
    const startHour = new Date(schedule.startTime).getHours();
    const startMinute = new Date(schedule.startTime).getMinutes();
    const endHour = new Date(schedule.endTime).getHours();
    const endMinute = new Date(schedule.endTime).getMinutes();

    // Round startMinute to nearest 15-min slot (0, 15, 30, 45)
    const roundedStartMinute = Math.floor(startMinute / 15) * 15;

    // For end time, round up to nearest 15-min slot
    const roundedEndMinute = Math.ceil(endMinute / 15) * 15;

    // Calculate position relative to hours (starting from 12am)
    const hourOffset = startHour; // Hours since 12am
    const minuteOffset = roundedStartMinute / 60; // Percentage of hour

    // Calculate position
    const topPosition = (hourOffset + minuteOffset) * 50; // Each hour is 50px
    return topPosition;
  };

  // Function to calculate the height of a schedule in the grid
  const getScheduleHeight = (schedule: Schedule, hours: { value: number; display: string }[]) => {
    const startHour = new Date(schedule.startTime).getHours();
    const startMinute = new Date(schedule.startTime).getMinutes();
    const endHour = new Date(schedule.endTime).getHours();
    const endMinute = new Date(schedule.endTime).getMinutes();

    // Round startMinute to nearest 15-min slot (0, 15, 30, 45)
    const roundedStartMinute = Math.floor(startMinute / 15) * 15;

    // For end time, round up to nearest 15-min slot
    const roundedEndMinute = Math.ceil(endMinute / 15) * 15;

    // Calculate duration in hours
    const durationHours = Math.max(0.5, (endHour - startHour) + ((roundedEndMinute - roundedStartMinute) / 60));
    const baseHeight = Math.max(25, durationHours * 50); // Each hour is 50px, min height 25px

    // Calculate dynamic height based on customer name length to ensure text is visible
    const customerNameLength = (schedule.customerName || "").length;
    const nameBasedHeight = customerNameLength > 20 ? 75 : customerNameLength > 15 ? 65 : 55;

    // Final height is the maximum of duration-based height and name-based height
    const height = Math.max(baseHeight, nameBasedHeight);
    return height;
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
    // Use current local time directly - no conversion needed
    const now = new Date();
    
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Calculate position (each hour is 50px)
    const position = (hours + minutes / 60) * 50;
    return position;
  };
  
  // Update current time every minute
  useEffect(() => {
    // Use current local time directly
    const now = new Date();
    
    // Initial calculation
    setCurrentTime(now);
    setCurrentTimePosition(calculateTimePosition());
    
    // Set up interval to update every minute
    const interval = setInterval(() => {
      const updatedNow = new Date();
      setCurrentTime(updatedNow);
      setCurrentTimePosition(calculateTimePosition());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []); // Only set up once - no dependencies needed

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
                  // Use custom event instead of hard page reload
                  // This will be handled by the optimized transition code in schedules.tsx
                  const dateParam = `&date=${date.toISOString().split('T')[0]}`;
                  const newUrl = `/schedules?view=day${dateParam}`;
                  window.history.pushState({}, '', newUrl);
                  
                  // Signal view change to parent component
                  window.dispatchEvent(new CustomEvent('viewchange', { 
                    detail: { view: 'day', date }
                  }));
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
      
      {/* Week Calendar Grid - With sticky headers - Fixed responsive layout */}
      <div className="border rounded relative overflow-x-auto">
        {/* Sticky day headers */}
        <div 
          ref={dayHeadersRef}
          className="grid grid-cols-8 sticky top-0 z-20 shadow-sm bg-white min-w-full" 
          style={{ minWidth: '800px' }}
        >
          {/* Empty top-left cell */}
          <div className="border-b border-r h-10 w-20 bg-gray-50 flex-shrink-0"></div>
          
          {/* Day headers - Fixed width for consistency */}
          {weekDays.map((day, i) => {
            const isToday = day.getDate() === new Date().getDate() && 
                           day.getMonth() === new Date().getMonth() && 
                           day.getFullYear() === new Date().getFullYear();
            
            return (
              <div 
                key={i} 
                className={cn(
                  "border-b border-r h-10 text-center flex flex-col justify-center",
                  "min-w-24 flex-1", // Fixed minimum width
                  isToday && "bg-primary/5 text-primary font-medium"
                )}
              >
                <div className="text-xs font-medium">{format(day, 'EEE')}</div>
                <div className="text-xs text-muted-foreground">{format(day, 'M/d')}</div>
              </div>
            );
          })}
        </div>
        
        {/* Time slots and appointments - Fixed responsive grid */}
        <div className="relative" style={{ minWidth: '800px' }}>
          {/* Time Grid Background */}
          <div 
            className="grid grid-cols-8 absolute inset-0 z-0"
            style={{
              gridTemplateRows: `repeat(${hours.length}, 1fr)`,
              height: `${hours.length * 50}px`
            }}
          >
            {/* Generate grid cells */}
            {hours.map((hour, hourIndex) => (
              <React.Fragment key={hourIndex}>
                {/* Time label cell */}
                <div 
                  className="border-b border-r text-xs text-muted-foreground bg-gray-50 p-2 flex items-center justify-center"
                  style={{ height: '50px' }}
                >
                  {hour.display}
                </div>
                
                {/* Day cells */}
                {weekDays.map((day, dayIndex) => (
                  <div 
                    key={`${hourIndex}-${dayIndex}`}
                    className={cn(
                      "border-b border-r relative cursor-pointer hover:bg-gray-50 transition-colors",
                      "min-w-24" // Fixed minimum width
                    )}
                    style={{ height: '50px' }}
                    onClick={() => {
                      if (onCellClick) {
                        const cellDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
                        cellDate.setHours(hour.value);
                        cellDate.setMinutes(0);
                        onCellClick(cellDate, undefined);
                      }
                    }}
                  >
                    {/* Empty slot - can be clicked to create new appointment */}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
          
          {/* Appointment overlays */}
          <div 
            className="relative z-10"
            style={{ 
              height: `${hours.length * 50}px`,
              minWidth: '800px'
            }}
          >
            {weekSchedules.map(schedule => {
              const dayIndex = getScheduleDayIndex(schedule);
              if (dayIndex === -1) return null;
              
              const startTime = new Date(schedule.startTime);
              const endTime = new Date(schedule.endTime);
              
              // Calculate position based on time
              const topPosition = getScheduleTopPosition(schedule, hours);
              const height = getScheduleHeight(schedule, hours);
              
              return (
                <div 
                  key={schedule.id}
                  className="absolute cursor-pointer"
                  style={{
                    left: `${(dayIndex + 1) * 12.5}%`,
                    width: '12.5%',
                    top: `${topPosition}px`,
                    height: `${height}px`,
                    padding: '2px',
                    zIndex: 20
                  }}
                  onClick={() => onScheduleClick?.(schedule.id)}
                >
                  <div className="bg-primary/10 border border-primary/20 rounded p-1 h-full overflow-hidden">
                    <div className="text-xs font-medium text-primary truncate">
                      {schedule.customerName || 'Unnamed'}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Current time indicator - only show for today's date */}
            {weekDays.some(day => 
              day.getDate() === new Date().getDate() && 
              day.getMonth() === new Date().getMonth() && 
              day.getFullYear() === new Date().getFullYear()
            ) && (
              <div className="absolute left-0 right-0 flex items-center z-50 pointer-events-none" 
                   style={{ top: `${currentTimePosition}px` }}>
                <div className="w-20 flex items-center justify-end pr-1">
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
          </div>
        </div>
      </div>
    </div>
  );
}