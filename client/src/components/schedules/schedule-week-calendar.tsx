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
}

export default function ScheduleWeekCalendar({
  schedules,
  docks,
  carriers,
  date,
  onScheduleClick,
  onDateChange,
  onViewChange,
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
  const dateRangeDisplay = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd, yyyy')}`;
  
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
    <div className="bg-white rounded-lg shadow p-4 mb-6 relative">
      {/* Calendar Header & Navigation */}
      <div className="flex justify-between items-center mb-4">
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
        
        <div className="flex items-center space-x-2">
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
      <div className="border rounded overflow-auto">
        <div className="grid grid-cols-8 min-w-max">
          {/* Empty top-left cell */}
          <div className="border-b border-r h-10 w-20 bg-gray-50"></div>
          
          {/* Day headers */}
          {weekDays.map((day, i) => (
            <div 
              key={i} 
              className={cn(
                "border-b border-r h-10 px-2 w-40 text-center flex flex-col justify-center",
                day.getDate() === new Date().getDate() && 
                day.getMonth() === new Date().getMonth() && 
                day.getFullYear() === new Date().getFullYear() 
                  ? "bg-blue-50" 
                  : "bg-gray-50"
              )}
            >
              <div className="font-medium">{format(day, 'EEE d/M')}</div>
            </div>
          ))}
          
          {/* Time rows */}
          {hours.map((hour, i) => (
            <div key={i} style={{ display: "contents" }}>
              {/* Hour label */}
              <div className="border-b border-r py-1 px-2 w-20 text-xs text-gray-500 h-[60px]">
                {hour.display}
              </div>
              
              {/* Day cells */}
              {weekDays.map((day, j) => (
                <div 
                  key={j} 
                  className={cn(
                    "border-b border-r w-40 h-[60px] relative",
                    day.getDate() === new Date().getDate() && 
                    day.getMonth() === new Date().getMonth() && 
                    day.getFullYear() === new Date().getFullYear() 
                      ? "bg-blue-50/30" 
                      : hour.value % 2 === 0 ? "bg-gray-50/30" : ""
                  )}
                ></div>
              ))}
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
            
            // Calculate column position (first column is time labels)
            const columnStart = dayIndex + 2; // +2 because grid is 1-indexed and first column is for time labels

            return (
              <div 
                key={schedule.id}
                className={cn(
                  "absolute rounded-sm px-1 py-0.5 text-[10px] cursor-pointer",
                  isInbound ? "bg-green-100 border border-green-300" : "bg-blue-100 border border-blue-300"
                )}
                style={{
                  ...positionStyle,
                  gridColumn: columnStart,
                  left: `calc(20px + ${dayIndex} * 10rem + 2px)`, // 20px for time column + day position
                  width: 'calc(10rem - 4px)',
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