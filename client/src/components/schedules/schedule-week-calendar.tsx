import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { format, addDays, startOfWeek, endOfWeek, isWithinInterval, areIntervalsOverlapping } from "date-fns";
import { Schedule, Carrier } from "@shared/schema";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScheduleWeekCalendarProps {
  schedules: Schedule[];
  docks: { id: number; name: string }[];
  carriers: Carrier[];
  date: Date;
  onScheduleClick: (scheduleId: number) => void;
  onDateChange: (date: Date) => void;
  onViewChange: (view: "month" | "week" | "day" | "list") => void;
  onCellClick?: (date: Date, dockId?: number) => void;
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
}: ScheduleWeekCalendarProps) {
  // State for filters
  const [customerSearch, setCustomerSearch] = useState("");
  const [carrierSearch, setCarrierSearch] = useState("");
  const [selectedTimezone, setSelectedTimezone] = useState("");
  
  // Current week dates
  const weekStart = startOfWeek(date, { weekStartsOn: 0 }); // Sunday as start of week
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
  
  // Generate days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  // Generate hours from 12AM to 11PM
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = i; // Starting from 12 AM
    return {
      display: hour < 12 
        ? `${hour === 0 ? 12 : hour}am` 
        : `${hour === 12 ? 12 : hour - 12}${hour < 12 ? 'am' : 'pm'}`,
      value: hour
    };
  });
  
  // Filter schedules based on search inputs
  const filteredSchedules = schedules.filter(schedule => {
    // Filter by customer name
    const customerMatch = customerSearch 
      ? (schedule.customerName?.toLowerCase().includes(customerSearch.toLowerCase()) || false)
      : true;
    
    // Filter by carrier name
    let carrierMatch = true;
    if (carrierSearch) {
      const carrier = carriers.find(c => c.id === schedule.carrierId);
      carrierMatch = carrier 
        ? carrier.name.toLowerCase().includes(carrierSearch.toLowerCase())
        : schedule.carrierName 
          ? schedule.carrierName.toLowerCase().includes(carrierSearch.toLowerCase())
          : false;
    }
    
    return customerMatch && carrierMatch;
  });
  
  // Get week schedules
  const weekSchedules = filteredSchedules.filter(schedule => {
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
  
  // Format the date range for display (e.g., "Apr 13 - 19, 2025")
  const dateRangeDisplay = `${format(weekStart, 'MMM M/d')} - ${format(weekEnd, 'M/d, yyyy')}`;
  
  // Move to previous/next week
  const goToPreviousWeek = () => {
    onDateChange(addDays(date, -7));
  };
  
  const goToNextWeek = () => {
    onDateChange(addDays(date, 7));
  };
  
  const goToToday = () => {
    onDateChange(new Date());
  };
  
  // Clear all filters
  const clearFilters = () => {
    setCustomerSearch("");
    setCarrierSearch("");
    setSelectedTimezone("");
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

  return (
    <div className="bg-white rounded-lg shadow p-3 pb-0 mb-4 relative w-full overflow-hidden">
      {/* Ultra Compact Filters - Combined row with calendar navigation */}
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center space-x-1">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToPreviousWeek}
            className="h-7 w-7"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToNextWeek}
            className="h-7 w-7"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
            className="h-7 px-2 text-xs"
          >
            today
          </Button>
        </div>
        
        <div className="text-lg font-semibold">
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
          <select 
            className="h-7 px-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary text-xs w-[130px]"
            value={selectedTimezone}
            onChange={(e) => setSelectedTimezone(e.target.value)}
          >
            <option value="">TimeZone</option>
            <option value="EST">Eastern (ET)</option>
            <option value="CST">Central (CT)</option>
            <option value="MST">Mountain (MT)</option>
            <option value="PST">Pacific (PT)</option>
          </select>
          <Button 
            variant="secondary" 
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={clearFilters}
            disabled={!customerSearch && !carrierSearch && !selectedTimezone}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* View Mode Buttons */}
      <div className="flex justify-end items-center mb-1">
        <div className="flex items-center space-x-1">
          <Button 
            variant={`outline`} 
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onViewChange("month")}
          >
            month
          </Button>
          <Button 
            variant={`default`} 
            size="sm"
            className="h-7 px-2 text-xs bg-primary"
            onClick={() => onViewChange("week")}
          >
            week
          </Button>
          <Button 
            variant={`outline`} 
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onViewChange("day")}
          >
            day
          </Button>
          <Button 
            variant={`outline`} 
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onViewChange("list")}
          >
            list
          </Button>
        </div>
      </div>
      
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
            style={{ height: 'calc(100vh - 210px)' }}
          >
            <div 
              ref={calendarContentRef}
              className="grid grid-cols-7 min-w-max relative"
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
                        onClick={() => onCellClick && onCellClick(cellDate)}
                      ></div>
                    );
                  })}
                </div>
              ))}
              
              {/* Schedule events - positioned absolutely over the grid */}
              {weekSchedules.map(schedule => {
                const dayIndex = getScheduleDayIndex(schedule);
                if (dayIndex === -1) return null;
                
                const isInbound = schedule.type === "inbound";
                const carrier = carriers.find(c => c.id === schedule.carrierId);
                const startTimeStr = formatTime(schedule.startTime);
                const endTimeStr = formatTime(schedule.endTime);

                // Parse dates properly to handle timezone consistently
                const startDate = new Date(schedule.startTime);
                const endDate = new Date(schedule.endTime);
                
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
                  <div 
                    key={schedule.id}
                    className={cn(
                      "absolute rounded-sm px-1 py-0.5 text-[10px] cursor-pointer border",
                      statusColor
                    )}
                    style={{
                      top: `${topPosition}px`,
                      height: `${height}px`,
                      left: leftPosition,
                      width: width,
                      minWidth: 'calc(6rem - 4px)',
                      zIndex: 10
                    }}
                    onClick={() => onScheduleClick(schedule.id)}
                  >
                    <div className="font-medium truncate">
                      {startTimeStr}-{endTimeStr} {schedule.customerName || "(No customer)"} 
                    </div>
                    <div className="truncate">
                      {carrier?.name || schedule.carrierName || ""} #{schedule.truckNumber} • {isInbound ? "IN" : "OUT"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}