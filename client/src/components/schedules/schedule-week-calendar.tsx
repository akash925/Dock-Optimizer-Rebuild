import * as React from "react";
import { useState, useEffect } from "react";
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
  
  // Generate hours from 3AM to 11PM
  const hours = Array.from({ length: 21 }, (_, i) => {
    const hour = i + 3; // Starting from 3 AM
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
    
    // Check if schedule overlaps with the week
    return isWithinInterval(scheduleStart, { start: weekStart, end: weekEnd }) ||
           isWithinInterval(scheduleEnd, { start: weekStart, end: weekEnd }) ||
           areIntervalsOverlapping(
             { start: scheduleStart, end: scheduleEnd },
             { start: weekStart, end: weekEnd }
           );
  });
  
  // Function to position a schedule in the grid
  const getSchedulePosition = (schedule: Schedule) => {
    const scheduleStart = new Date(schedule.startTime);
    const scheduleEnd = new Date(schedule.endTime);
    
    // Get day index (0-6)
    const dayIndex = weekDays.findIndex(day => 
      day.getDate() === scheduleStart.getDate() && 
      day.getMonth() === scheduleStart.getMonth() &&
      day.getFullYear() === scheduleStart.getFullYear()
    );
    
    if (dayIndex === -1) return null;
    
    const startHour = scheduleStart.getHours();
    const startMinute = scheduleStart.getMinutes();
    const endHour = scheduleEnd.getHours();
    const endMinute = scheduleEnd.getMinutes();
    
    // Calculate top position (hours from 3am)
    const hourOffset = startHour - 3; // Hours since 3am
    const minuteOffset = startMinute / 60; // Percentage of hour
    const topPosition = (hourOffset + minuteOffset) * 60; // Each hour is 60px
    
    // Calculate height
    const durationHours = (endHour - startHour) + ((endMinute - startMinute) / 60);
    const height = durationHours * 60; // Each hour is 60px
    
    return {
      dayIndex,
      top: `${topPosition}px`,
      height: `${height}px`,
      left: '2px',
      right: '2px',
      position: 'absolute' as const
    };
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
      <div className="border rounded overflow-auto max-h-[calc(100vh-300px)]">
        <div className="grid grid-cols-8 min-w-max">
          {/* Empty top-left cell */}
          <div className="border-b border-r h-10 w-16 bg-gray-50"></div>
          
          {/* Day headers */}
          {weekDays.map((day, i) => (
            <div 
              key={i} 
              className={cn(
                "border-b border-r h-10 px-2 w-[calc((100%-4rem)/7)] min-w-[8rem] text-center flex flex-col justify-center",
                day.getDate() === new Date().getDate() && 
                day.getMonth() === new Date().getMonth() && 
                day.getFullYear() === new Date().getFullYear() 
                  ? "bg-blue-50" 
                  : "bg-gray-50"
              )}
            >
              <div className="font-medium">{format(day, 'EEE M/d')}</div>
            </div>
          ))}
          
          {/* Time rows */}
          {hours.map((hour, i) => (
            <div key={i} style={{ display: "contents" }}>
              {/* Hour label */}
              <div className="border-b border-r py-1 px-1 w-16 text-xs text-gray-500 h-[50px]">
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
                      "border-b border-r w-[calc((100%-4rem)/7)] min-w-[8rem] h-[50px] relative cursor-pointer hover:bg-gray-100 transition-colors",
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
            const position = getSchedulePosition(schedule);
            if (!position) return null;
            
            const { dayIndex, ...positionStyle } = position;
            const isInbound = schedule.type === "inbound";
            const carrier = carriers.find(c => c.id === schedule.carrierId);
            const startTimeStr = formatTime(schedule.startTime);
            const endTimeStr = formatTime(schedule.endTime);

            // Adjust for the new cell height
            const adjustedTop = parseFloat(positionStyle.top) * (50/60);
            const adjustedHeight = parseFloat(positionStyle.height) * (50/60);
            
            return (
              <div 
                key={schedule.id}
                className={cn(
                  "absolute rounded-sm px-1 py-0.5 text-[10px] cursor-pointer",
                  isInbound ? "bg-green-100 border border-green-300" : "bg-blue-100 border border-blue-300"
                )}
                style={{
                  ...positionStyle,
                  top: `${adjustedTop}px`,
                  height: `${adjustedHeight}px`,
                  left: `calc(16px + ${dayIndex} * (100% - 4rem) / 7 + 2px)`,
                  width: 'calc((100% - 4rem) / 7 - 4px)',
                  minWidth: 'calc(8rem - 4px)',
                  zIndex: 10
                }}
                onClick={() => onScheduleClick(schedule.id)}
              >
                <div className="font-medium truncate">
                  {startTimeStr}-{endTimeStr} {carrier?.name} #{schedule.truckNumber}
                </div>
                <div className="truncate">
                  {isInbound ? "INBOUND" : "OUTBOUND"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}