import React, { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isSameMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Schedule } from '@shared/schema';
import { Dock } from '@shared/schema';

interface ScheduleMonthCalendarProps {
  schedules: Schedule[];
  docks: Dock[];
  date: Date;
  onScheduleClick: (scheduleId: number) => void;
  onCellClick?: (date: Date, dockId?: number) => void;
  onDateChange: (date: Date) => void;
  timezone?: string;
  timeFormat?: "12h" | "24h";
}

export default function ScheduleMonthCalendar({
  schedules,
  docks,
  date,
  onScheduleClick,
  onCellClick,
  onDateChange,
  timezone,
  timeFormat
}: ScheduleMonthCalendarProps) {
  // Navigation handlers
  const goToPreviousMonth = () => {
    onDateChange(subMonths(date, 1));
  };

  const goToNextMonth = () => {
    onDateChange(addMonths(date, 1));
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  // Format date for display
  const monthDisplay = format(date, 'MMMM yyyy');

  // Get all days in the current month
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Get the day of the week for the first day of the month (0 = Sunday, 6 = Saturday)
  const startDay = getDay(monthStart);

  // Generate day headers
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4 max-w-full overflow-hidden">
      {/* Calendar Header with view mode toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToPreviousMonth}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
            className="h-8 px-3 text-xs"
          >
            Today
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToNextMonth}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
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
            >
              Day
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-3 text-xs"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  // Use custom event instead of hard page reload
                  const dateParam = `&date=${date.toISOString().split('T')[0]}`;
                  const newUrl = `/schedules?view=week${dateParam}`;
                  window.history.pushState({}, '', newUrl);
                  
                  // Signal view change to parent component
                  window.dispatchEvent(new CustomEvent('viewchange', { 
                    detail: { view: 'week', date }
                  }));
                }
              }}
            >
              Week
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="h-7 px-3 text-xs"
              onClick={() => onDateChange(date)} // Just refresh current date
            >
              Month
            </Button>
          </div>
        </div>
        
        <h3 className="text-lg font-semibold w-full sm:w-auto text-center sm:text-left">{monthDisplay}</h3>
      </div>

      {/* Responsive Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 text-sm">
        {/* Day headers */}
        {dayHeaders.map((day, index) => (
          <div key={index} className="text-center py-2 text-xs sm:text-sm font-medium text-gray-500">
            {/* Show just the first letter on mobile, full day name on larger screens */}
            <span className="block sm:hidden">{day.charAt(0)}</span>
            <span className="hidden sm:block">{day}</span>
          </div>
        ))}
        
        {/* Empty cells before the first day of the month */}
        {Array.from({ length: startDay }).map((_, index) => (
          <div key={`empty-start-${index}`} className="p-1 sm:p-2 h-16 sm:h-20 lg:h-24 bg-gray-50 border border-gray-100 rounded-md"></div>
        ))}
        
        {/* Days of the month */}
        {daysInMonth.map((day, index) => {
          // Count schedules for this day
          const dailySchedules = schedules.filter(schedule => {
            const scheduleDate = new Date(schedule.startTime);
            return format(scheduleDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
          });
          
          return (
            <div 
              key={index}
              className={`p-1 sm:p-2 h-16 sm:h-20 lg:h-24 border ${isToday(day) ? 'border-primary bg-primary/5' : 'border-gray-100'} 
                          rounded-md overflow-hidden relative hover:bg-gray-50 cursor-pointer transition-colors`}
              onClick={() => onCellClick && onCellClick(day)}
            >
              <div className={`text-right mb-1 ${!isSameMonth(day, date) ? 'text-gray-400' : ''}`}>
                <span className={`inline-block rounded-full w-5 h-5 sm:w-6 sm:h-6 text-center leading-5 sm:leading-6 text-xs sm:text-sm
                               ${isToday(day) ? 'bg-primary text-white' : ''}`}>
                  {format(day, 'd')}
                </span>
              </div>
              
              {dailySchedules.length > 0 && (
                <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 right-1 sm:right-2">
                  <div className="text-xs font-medium text-primary bg-primary/5 px-1 py-0.5 rounded text-center">
                    {dailySchedules.length} <span className="hidden xs:inline">appointment{dailySchedules.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}