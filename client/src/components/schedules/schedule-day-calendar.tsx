import React, { useState, useMemo, useEffect } from 'react';
import { format, addDays, subDays, startOfDay, addHours, differenceInMinutes } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Schedule, Facility } from '@shared/schema';
import { Dock } from '@shared/schema';
import { cn } from '@/lib/utils';

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

interface ScheduleWithTime extends Schedule {
  formattedTime: string;
}

// Helper type for our schedules by hour and dock
type SchedulesByHourAndDock = Record<number, Record<number, ScheduleWithTime[]>>;

export default function ScheduleDayCalendar({
  schedules,
  docks,
  facilities,
  date,
  onScheduleClick,
  onCellClick,
  onDateChange,
  timezone,
  timeFormat = "12h"
}: ScheduleDayCalendarProps) {
  // State for loading indicator
  const [isLoading, setIsLoading] = useState(false);
  
  // Navigation handlers with loading indicators
  const goToPreviousDay = () => {
    setIsLoading(true);
    setTimeout(() => onDateChange(subDays(date, 1)), 10);
  };

  const goToNextDay = () => {
    setIsLoading(true);
    setTimeout(() => onDateChange(addDays(date, 1)), 10);
  };

  const goToToday = () => {
    setIsLoading(true);
    setTimeout(() => onDateChange(new Date()), 10);
  };

  // Format date for display - memoized to avoid recalculation
  const { dateDisplay, dayOfWeek } = useMemo(() => ({
    dateDisplay: format(date, 'MMMM d, yyyy'),
    dayOfWeek: format(date, 'EEEE')
  }), [date]);

  // Generate hours for the day view (3am to 11pm) - memoized
  const hourStart = 3; // Start at 3am
  const hourEnd = 23; // End at 11pm
  
  const hours = useMemo(() => {
    return Array.from({ length: hourEnd - hourStart + 1 }, (_, i) => {
      const hour = hourStart + i;
      return {
        label: timeFormat === "12h" 
          ? `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? 'am' : 'pm'}`
          : `${hour.toString().padStart(2, '0')}:00`,
        value: hour,
        date: addHours(startOfDay(date), hour)
      };
    });
  }, [date, timeFormat, hourStart, hourEnd]);

  // Reset loading state when schedules or date changes
  useEffect(() => {
    setIsLoading(false);
  }, [schedules, date]);

  // Get schedules for this day and organize them by hour and dock - memoized for performance
  const organizedSchedules = useMemo(() => {
    // Create the result object with proper typing
    const result: Record<number, Record<number, ScheduleWithTime[]>> = {};
    
    // Initialize empty slots for all hours
    for (let i = hourStart; i <= hourEnd; i++) {
      result[i] = {};
    }
    
    schedules.forEach(schedule => {
      // Skip any schedule with missing required fields
      if (!schedule.startTime || !schedule.endTime || !schedule.dockId) return;
      
      const startDate = new Date(schedule.startTime);
      const endDate = new Date(schedule.endTime);
      const dockId = schedule.dockId;
      
      // Check if the schedule is for the selected date
      if (
        startDate.getDate() === date.getDate() &&
        startDate.getMonth() === date.getMonth() &&
        startDate.getFullYear() === date.getFullYear()
      ) {
        // Format time for display based on timeFormat
        const formattedStartHour = timeFormat === "12h" 
          ? `${startDate.getHours() === 0 ? 12 : startDate.getHours() > 12 ? startDate.getHours() - 12 : startDate.getHours()}${startDate.getHours() < 12 ? 'am' : 'pm'}`
          : startDate.getHours().toString().padStart(2, '0');
          
        const formattedEndHour = timeFormat === "12h"
          ? `${endDate.getHours() === 0 ? 12 : endDate.getHours() > 12 ? endDate.getHours() - 12 : endDate.getHours()}${endDate.getHours() < 12 ? 'am' : 'pm'}`
          : endDate.getHours().toString().padStart(2, '0');
          
        const formattedStartMinutes = startDate.getMinutes().toString().padStart(2, '0');
        const formattedEndMinutes = endDate.getMinutes().toString().padStart(2, '0');
        
        const formattedTime = timeFormat === "12h"
          ? `${formattedStartHour}:${formattedStartMinutes} - ${formattedEndHour}:${formattedEndMinutes}`
          : `${formattedStartHour}:${formattedStartMinutes} - ${formattedEndHour}:${formattedEndMinutes}`;
        
        // Get start hour and potentially span across multiple hours
        const startHour = startDate.getHours();
        const endHour = endDate.getHours();
        
        // Calculate how many hours this spans
        const hoursSpanned: number[] = [];
        for (let h = startHour; h <= endHour; h++) {
          if (h >= hourStart && h <= hourEnd) {
            hoursSpanned.push(h);
          }
        }
        
        // Convert schedule to ScheduleWithTime
        const scheduleWithTime: ScheduleWithTime = {
          ...schedule,
          formattedTime
        };
        
        // Add the schedule to each hour it spans
        hoursSpanned.forEach(hour => {
          // Initialize dock array if it doesn't exist
          if (!result[hour][dockId]) {
            result[hour][dockId] = [];
          }
          
          // Only add the schedule once per dock/hour combination
          const existingSchedule = result[hour][dockId].find(s => s.id === schedule.id);
          if (!existingSchedule) {
            result[hour][dockId].push(scheduleWithTime);
          }
        });
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
                  setIsLoading(true);
                  const dateParam = `&date=${date.toISOString().split('T')[0]}`;
                  window.location.href = `/schedules?view=month${dateParam}`;
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
                  setIsLoading(true);
                  const dateParam = `&date=${date.toISOString().split('T')[0]}`;
                  window.location.href = `/schedules?view=week${dateParam}`;
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
                  setIsLoading(true);
                  const dateParam = `&date=${date.toISOString().split('T')[0]}`;
                  window.location.href = `/schedules?view=list${dateParam}`;
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
                      const dock = docks.find(d => d.id === schedule.dockId);
                      const facilityId = dock?.facilityId;
                      const facility = facilities?.find(f => f.id === facilityId);
                      const facilityName = facility?.name || "";
                      const isInbound = schedule.type === "inbound";
                      
                      // Calculate duration in hours (difference between start and end time)
                      const startTime = new Date(schedule.startTime);
                      const endTime = new Date(schedule.endTime);
                      const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                      
                      // Scale height based on duration - more precise scaling for better visibility
                      const heightClass = 
                        durationHours >= 5 ? "h-auto min-h-[10rem]" : 
                        durationHours >= 4 ? "h-auto min-h-[8rem]" :
                        durationHours >= 3 ? "h-auto min-h-[7rem]" :
                        durationHours >= 2 ? "h-auto min-h-[5.5rem]" :
                        durationHours >= 1 ? "h-auto min-h-[4rem]" : 
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
                                    : "bg-purple-50 border-purple-200"
                          )}
                          onClick={() => onScheduleClick(schedule.id)}
                        >
                          {/* CUSTOMER NAME FIRST - Most prominent */}
                          <div className="font-bold truncate text-base mb-1 pb-0.5 border-b border-gray-100">
                            {schedule.customerName || "Unnamed"}
                          </div>
                          
                          {/* Time and facility info */}
                          <div className="font-medium truncate text-xs">
                            {schedule.formattedTime}
                          </div>
                          <div className="truncate text-xs mt-0.5 font-medium text-blue-700">
                            {facilityName}
                          </div>
                          
                          {/* Type badge + Carrier info */}
                          <div className="flex gap-1 items-center mt-1.5">
                            <span className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded",
                              isInbound ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                            )}>
                              {isInbound ? "INBOUND" : "OUTBOUND"}
                            </span>
                            <span className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded",
                              schedule.status === "completed" ? "bg-green-100 text-green-800" :
                              schedule.status === "in-progress" ? "bg-yellow-100 text-yellow-800" :
                              schedule.status === "cancelled" ? "bg-gray-100 text-gray-800" :
                              "bg-gray-100 text-gray-800"
                            )}>
                              {schedule.status?.toUpperCase() || "SCHEDULED"}
                            </span>
                          </div>
                          
                          <div className="truncate text-gray-600 mt-1 text-xs">
                            {schedule.carrierName || "No carrier"} {schedule.truckNumber ? `• ${schedule.truckNumber}` : ""}
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