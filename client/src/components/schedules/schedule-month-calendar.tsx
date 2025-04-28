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
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-4">
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
        <h3 className="text-lg font-semibold">{monthDisplay}</h3>
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
          <div key={`empty-start-${index}`} className="p-2 h-20 bg-gray-50 border border-gray-100 rounded-md"></div>
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
              className={`p-2 h-20 border ${isToday(day) ? 'border-primary bg-primary/5' : 'border-gray-100'} 
                          rounded-md overflow-hidden relative hover:bg-gray-50 cursor-pointer transition-colors`}
              onClick={() => onCellClick && onCellClick(day)}
            >
              <div className={`text-right mb-1 ${!isSameMonth(day, date) ? 'text-gray-400' : ''}`}>
                <span className={`inline-block rounded-full w-6 h-6 text-center leading-6 text-sm 
                               ${isToday(day) ? 'bg-primary text-white' : ''}`}>
                  {format(day, 'd')}
                </span>
              </div>
              
              {dailySchedules.length > 0 && (
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="text-xs font-medium text-primary">
                    {dailySchedules.length} appointment{dailySchedules.length !== 1 ? 's' : ''}
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