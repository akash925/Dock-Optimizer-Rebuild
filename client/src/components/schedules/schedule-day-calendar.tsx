import React, { useState } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Schedule } from '@shared/schema';
import { Dock } from '@shared/schema';

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

export default function ScheduleDayCalendar({
  schedules,
  docks,
  date,
  onScheduleClick,
  onCellClick,
  onDateChange,
  timezone,
  timeFormat
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
  const dateDisplay = format(date, 'EEEE, MMMM d, yyyy');

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-4">
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
            className="h-8 px-3 text-xs"
          >
            Today
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
        <h3 className="text-lg font-semibold">{dateDisplay}</h3>
      </div>

      {/* Responsive day view calendar */}
      <div className="p-4 border rounded-lg overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Left side - Docks list */}
          <div className="w-full md:w-1/4 lg:w-1/5 border-r mb-4 md:mb-0 pr-2">
            <h4 className="font-medium text-sm mb-2 sticky top-0 bg-white py-1">Docks</h4>
            <div className="space-y-1 overflow-auto max-h-[calc(100vh-350px)] md:max-h-[500px]">
              {docks.map((dock) => (
                <div 
                  key={dock.id}
                  className="p-2 hover:bg-gray-100 rounded cursor-pointer text-sm"
                  onClick={() => onCellClick && onCellClick(date, dock.id)}
                >
                  {dock.name}
                </div>
              ))}
            </div>
          </div>
          
          {/* Right side - Appointments */}
          <div className="w-full md:w-3/4 lg:w-4/5 pl-0 md:pl-4 overflow-auto">
            <div className="space-y-3">
              {docks.map((dock) => {
                // Filter schedules for this dock and date
                const dockSchedules = schedules.filter((schedule) => {
                  const scheduleDate = new Date(schedule.startTime);
                  return schedule.dockId === dock.id && 
                    scheduleDate.getDate() === date.getDate() &&
                    scheduleDate.getMonth() === date.getMonth() &&
                    scheduleDate.getFullYear() === date.getFullYear();
                });
                
                return (
                  <div key={dock.id} className="border-b pb-2">
                    <h5 className="font-medium text-sm mb-1">{dock.name}</h5>
                    {dockSchedules.length === 0 ? (
                      <div className="text-sm text-gray-500 italic">No appointments scheduled</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {dockSchedules.map((schedule) => (
                          <div 
                            key={schedule.id}
                            className={`p-2 rounded text-xs cursor-pointer border ${
                              schedule.type === "inbound" 
                                ? "bg-blue-50 border-blue-200" 
                                : "bg-purple-50 border-purple-200"
                            }`}
                            onClick={() => onScheduleClick(schedule.id)}
                          >
                            <div className="font-medium">
                              {new Date(schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                              {new Date(schedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div>{schedule.customerName || "Unnamed"}</div>
                            <div>{schedule.carrierName} • {schedule.truckNumber}</div>
                          </div>
                        ))}
                      </div>
                    )}
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