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
    const result: SchedulesByHourAndDock = {};
    
    schedules.forEach(schedule => {
      if (!schedule.startTime || !schedule.endTime || !schedule.dockId) return;
      
      const scheduleDate = new Date(schedule.startTime);
      
      // Check if the schedule is for the selected date
      if (
        scheduleDate.getDate() === date.getDate() &&
        scheduleDate.getMonth() === date.getMonth() &&
        scheduleDate.getFullYear() === date.getFullYear()
      ) {
        const hour = scheduleDate.getHours();
        
        // Skip if the hour is outside our display range
        if (hour < hourStart || hour > hourEnd) return;
        
        // Format time for display
        let formattedTime;
        // Fallback to direct formatting
        formattedTime = `${scheduleDate.getHours().toString().padStart(2, '0')}:${scheduleDate.getMinutes().toString().padStart(2, '0')} - ${new Date(schedule.endTime).getHours().toString().padStart(2, '0')}:${new Date(schedule.endTime).getMinutes().toString().padStart(2, '0')}`;
        
        // Initialize hour object if it doesn't exist
        if (!result[hour]) {
          result[hour] = {};
        }
        
        // Initialize dock array if it doesn't exist
        if (!result[hour][schedule.dockId]) {
          result[hour][schedule.dockId] = [];
        }
        
        // Add schedule to the proper hour and dock
        result[hour][schedule.dockId].push({
          ...schedule,
          formattedTime
        });
      }
    });
    
    return result;
  }, [schedules, date, hourStart, hourEnd, timezone]);

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
                      
                      // Make 4-hour appointments taller
                      const heightClass = durationHours >= 4 ? "h-auto min-h-[6rem]" : "h-auto min-h-[4rem]";
                      
                      return (
                        <div
                          key={schedule.id}
                          className={cn(
                            "p-2 rounded-sm text-xs cursor-pointer border transition-colors overflow-hidden flex flex-col",
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
                          <div className="font-bold truncate text-sm mb-1">
                            {schedule.formattedTime}
                          </div>
                          <div className="truncate text-xs mt-0.5 font-medium">
                            {facilityName}
                          </div>
                          <div className="truncate font-medium mt-1">
                            {schedule.customerName || "Unnamed"}
                          </div>
                          <div className="truncate text-gray-600 mt-0.5">
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