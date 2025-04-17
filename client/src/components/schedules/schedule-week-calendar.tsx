import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { format, addDays, startOfWeek, endOfWeek, isWithinInterval, areIntervalsOverlapping } from "date-fns";
import { Schedule, Carrier } from "@shared/schema";
import { formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon 
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
  // Current week dates
  const weekStart = startOfWeek(date, { weekStartsOn: 0 }); // Sunday as start of week
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
  
  // Generate days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  // Generate hours from 5AM to 11PM
  const hours = Array.from({ length: 19 }, (_, i) => {
    const hour = i + 5; // Starting from 5 AM
    return {
      display: hour < 12 
        ? `${hour === 0 ? 12 : hour}am` 
        : `${hour === 12 ? 12 : hour - 12}${hour < 12 ? 'am' : 'pm'}`,
      value: hour
    };
  });
  
  // Get week schedules
  const weekSchedules = schedules.filter(schedule => {
    const scheduleStart = new Date(schedule.startTime);
    const scheduleEnd = new Date(schedule.endTime);
    
    console.log("Checking schedule:", schedule);
    console.log("Schedule start date:", scheduleStart);
    console.log("Schedule end date:", scheduleEnd);
    console.log("Week start:", weekStart);
    console.log("Week end:", weekEnd);
    
    // Check if schedule overlaps with the week
    const result = isWithinInterval(scheduleStart, { start: weekStart, end: weekEnd }) ||
           isWithinInterval(scheduleEnd, { start: weekStart, end: weekEnd }) ||
           areIntervalsOverlapping(
             { start: scheduleStart, end: scheduleEnd },
             { start: weekStart, end: weekEnd }
           );
    
    console.log("Schedule within week range:", result);
    return result;
  });
  
  // Function to get the day index for a schedule
  const getScheduleDayIndex = (schedule: Schedule) => {
    const scheduleStart = new Date(schedule.startTime);
    
    console.log("Finding day index for schedule:", schedule.id);
    console.log("Schedule start date:", scheduleStart);
    console.log("Week days:", weekDays);
    
    // Get day index (0-6)
    const index = weekDays.findIndex(day => 
      day.getDate() === scheduleStart.getDate() && 
      day.getMonth() === scheduleStart.getMonth() &&
      day.getFullYear() === scheduleStart.getFullYear()
    );
    
    console.log("Found day index:", index);
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
  
  // Reference to the calendar grid container for auto-scrolling
  const calendarGridRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to 8-9 AM when the component mounts or updates
  useEffect(() => {
    if (calendarGridRef.current) {
      // Calculate position for 8 AM (3 hours from 5 AM start time)
      const scrollToPosition = 3 * 50; // 3 hours * 50px per hour
      calendarGridRef.current.scrollTop = scrollToPosition;
    }
  }, [date, schedules]); // Re-scroll when date or schedules change

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6 relative w-full overflow-hidden">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <input 
            type="text" 
            placeholder="Customer Name" 
            className="w-full h-10 px-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <input 
            type="text" 
            placeholder="Carrier Name" 
            className="w-full h-10 px-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <select 
            className="w-full h-10 px-3 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
            defaultValue="Select TimeZone"
          >
            <option disabled>Select TimeZone</option>
            <option>Eastern Time (ET)</option>
            <option>Central Time (CT)</option>
            <option>Mountain Time (MT)</option>
            <option>Pacific Time (PT)</option>
          </select>
        </div>
        <Button 
          variant="secondary" 
          size="sm"
          className="h-10 px-4"
        >
          Clear
        </Button>
      </div>

      {/* Calendar Header & Navigation */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToPreviousWeek}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToNextWeek}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
            className="h-8"
          >
            today
          </Button>
        </div>
        
        <div className="text-xl font-semibold">
          {dateRangeDisplay}
        </div>
        
        <div className="flex items-center space-x-2 flex-wrap">
          <Button 
            variant={`outline`} 
            size="sm"
            className="h-8"
            onClick={() => onViewChange("month")}
          >
            month
          </Button>
          <Button 
            variant={`default`} 
            size="sm"
            className="h-8 bg-primary"
            onClick={() => onViewChange("week")}
          >
            week
          </Button>
          <Button 
            variant={`outline`} 
            size="sm"
            className="h-8"
            onClick={() => onViewChange("day")}
          >
            day
          </Button>
          <Button 
            variant={`outline`} 
            size="sm"
            className="h-8"
            onClick={() => onViewChange("list")}
          >
            list
          </Button>
        </div>
      </div>
      
      {/* Week Calendar Grid */}
      <div ref={calendarGridRef} className="border rounded overflow-auto max-h-[calc(100vh-300px)]">
        <div className="grid grid-cols-8 min-w-max">
          {/* Empty top-left cell */}
          <div className="border-b border-r h-10 w-12 bg-gray-50"></div>
          
          {/* Day headers */}
          {weekDays.map((day, i) => (
            <div 
              key={i} 
              className={cn(
                "border-b border-r h-10 px-1 w-[calc((100%-3rem)/7)] min-w-[6rem] text-center flex flex-col justify-center",
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
          
          {/* Time rows */}
          {hours.map((hour, i) => (
            <div key={i} style={{ display: "contents" }}>
              {/* Hour label */}
              <div className="border-b border-r py-1 px-1 w-12 text-xs text-gray-500 h-[50px]">
                {hour.display}
              </div>
              
              {/* Day cells */}
              {weekDays.map((day, j) => {
                // Create date object for the current cell (day + time)
                const cellDate = new Date(day);
                cellDate.setHours(hour.value);
                cellDate.setMinutes(0);

                return (
                  <div 
                    key={j} 
                    className={cn(
                      "border-b border-r w-[calc((100%-3rem)/7)] min-w-[6rem] h-[50px] relative cursor-pointer hover:bg-gray-100 transition-colors",
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
          
          {/* Schedule events */}
          {weekSchedules.map(schedule => {
            console.log("Checking schedule:", schedule);
            
            const dayIndex = getScheduleDayIndex(schedule);
            console.log("Finding day index for schedule:", schedule.id);
            console.log("Found day index:", dayIndex);
            if (dayIndex === -1) return null;
            
            const isInbound = schedule.type === "inbound";
            const carrier = carriers.find(c => c.id === schedule.carrierId);
            const startTimeStr = formatTime(schedule.startTime);
            const endTimeStr = formatTime(schedule.endTime);

            // Parse dates properly to handle timezone consistently
            const startDate = new Date(schedule.startTime);
            const endDate = new Date(schedule.endTime);
            
            console.log("Schedule start date:", JSON.stringify(startDate));
            console.log("Schedule end date:", JSON.stringify(endDate));
            
            // Calculate precise position based on hours and cell size
            const startHour = startDate.getHours();
            const startMinute = startDate.getMinutes();
            const endHour = endDate.getHours();
            const endMinute = endDate.getMinutes();
            
            // Round startMinute to nearest 15-min slot (0, 15, 30, 45)
            const roundedStartMinute = Math.floor(startMinute / 15) * 15;
            
            // For end time, round up to nearest 15-min slot
            const roundedEndMinute = Math.ceil(endMinute / 15) * 15;
            
            // Calculate position relative to visible hours (starting from 5am)
            const hourOffset = startHour - 5; // Hours since 5am
            const minuteOffset = roundedStartMinute / 60; // Percentage of hour
            
            // Ensure calculations don't result in negative values
            const topPosition = Math.max(0, (hourOffset + minuteOffset) * 50); // Each hour is 50px
            
            // Calculate height using rounded minutes (clamp to minimum height for visibility)
            const durationHours = Math.max(0.5, (endHour - startHour) + ((roundedEndMinute - roundedStartMinute) / 60));
            const height = Math.max(25, durationHours * 50); // Each hour is 50px, min height 25px
            
            return (
              <div 
                key={schedule.id}
                className={cn(
                  "absolute rounded-sm px-1 py-0.5 text-[10px] cursor-pointer",
                  isInbound ? "bg-green-100 border border-green-300" : "bg-blue-100 border border-blue-300"
                )}
                style={{
                  top: `${topPosition}px`,
                  height: `${height}px`,
                  left: `calc(3rem + ${dayIndex} * (100% - 3rem) / 7)`,
                  width: 'calc((100% - 3rem) / 7 - 4px)',
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
  );
}