import React from 'react';
import { format, addDays, subDays, startOfDay, addHours } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Schedule } from '@shared/schema';
import { Dock } from '@shared/schema';
import { cn } from '@/lib/utils';

interface ScheduleDayCalendarProps {
  schedules: Schedule[];
  docks: Dock[];
  date: Date;
  onScheduleClick: (scheduleId: number) => void;
  onCellClick?: (date: Date, dockId?: number) => void;
  onDateChange: (date: Date) => void;
  timezone?: string;
  timeFormat?: "12h" | "24h";
}

// Extended schedule with formatted time
interface ScheduleWithTime extends Schedule {
  formattedTime: string;
}

export default function ScheduleDayCalendar({
  schedules,
  docks,
  date,
  onScheduleClick,
  onCellClick,
  onDateChange,
  timezone,
  timeFormat = "12h"
}: ScheduleDayCalendarProps) {
  // Navigation handlers
  const goToPreviousDay = () => {
    onDateChange(subDays(date, 1));
  };

  const goToNextDay = () => {
    onDateChange(addDays(date, 1));
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  // Format date for display
  const dateDisplay = format(date, 'MMMM d, yyyy');
  const dayOfWeek = format(date, 'EEEE');

  // Generate hours for the day view (3am to 11pm)
  const hourStart = 3; // Start at 3am
  const hourEnd = 23; // End at 11pm
  
  const hours = Array.from({ length: hourEnd - hourStart + 1 }, (_, i) => {
    const hour = hourStart + i;
    return {
      label: timeFormat === "12h" 
        ? `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? 'am' : 'pm'}`
        : `${hour.toString().padStart(2, '0')}:00`,
      value: hour,
      date: addHours(startOfDay(date), hour)
    };
  });

  // Get schedules for this day
  const daySchedules = schedules.filter((schedule) => {
    const scheduleDate = new Date(schedule.startTime);
    return scheduleDate.getDate() === date.getDate() &&
      scheduleDate.getMonth() === date.getMonth() &&
      scheduleDate.getFullYear() === date.getFullYear();
  });

  // Group schedules by hour and dock
  const schedulesByTime = new Map<number, Map<number, ScheduleWithTime[]>>();
  
  daySchedules.forEach(schedule => {
    const startTime = new Date(schedule.startTime);
    const hour = startTime.getHours();
    const formattedTime = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')} - ${new Date(schedule.endTime).getHours().toString().padStart(2, '0')}:${new Date(schedule.endTime).getMinutes().toString().padStart(2, '0')}`;
    
    // Skip if the hour is outside our display range
    if (hour < hourStart || hour > hourEnd) return;
    
    if (!schedulesByTime.has(hour)) {
      schedulesByTime.set(hour, new Map<number, ScheduleWithTime[]>());
    }
    
    if (!schedulesByTime.get(hour)?.has(schedule.dockId)) {
      schedulesByTime.get(hour)?.set(schedule.dockId, []);
    }
    
    schedulesByTime.get(hour)?.get(schedule.dockId)?.push({
      ...schedule,
      formattedTime
    });
  });

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4 max-w-full overflow-hidden">
      {/* Calendar Header with view mode toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToPreviousDay}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
            className="h-8 px-3 text-xs bg-green-100 hover:bg-green-200 border-green-200"
          >
            today
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToNextDay}
            className="h-8 w-8"
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
                  window.location.href = '/schedules?view=month';
                }
              }}
            >
              month
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-3 text-xs rounded-none border-r"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/schedules?view=week';
                }
              }}
            >
              week
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="h-7 px-3 text-xs rounded-none border-r"
              onClick={() => onDateChange(date)} // Just refresh current date
            >
              day
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-3 text-xs rounded-none"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/schedules?view=list';
                }
              }}
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
                {schedulesByTime.has(hour.value) && [...schedulesByTime.get(hour.value)?.entries() || []].map(entry => {
                  const dockId = entry[0];
                  const dockSchedules = entry[1];
                  
                  return dockSchedules.map(schedule => {
                    const dock = docks.find(d => d.id === schedule.dockId);
                    const dockName = dock ? dock.name : "Unknown Dock";
                    const isInbound = schedule.type === "inbound";
                    
                    return (
                      <div
                        key={schedule.id}
                        className={cn(
                          "p-1 rounded-sm text-xs cursor-pointer border transition-colors overflow-hidden",
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
                        <div className="font-medium truncate">
                          {schedule.formattedTime}
                        </div>
                        <div className="truncate">
                          {dockName} - {schedule.customerName || "Unnamed"}
                        </div>
                        <div className="truncate">
                          {schedule.carrierName || "No carrier"} • {schedule.truckNumber}
                        </div>
                      </div>
                    );
                  });
                })}
                
                {/* Add empty cell with click handler if no appointments */}
                {(!schedulesByTime.has(hour.value) || schedulesByTime.get(hour.value)?.size === 0) && (
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