import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Schedule } from "@shared/schema";
import { formatTime } from "@/lib/utils";
import { format, parse, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

interface ScheduleCalendarProps {
  schedules: Schedule[];
  docks: { id: number; name: string }[];
  date: Date;
  timezone: string;
  timeFormat: "12h" | "24h";
  onScheduleClick: (scheduleId: number) => void;
  onCellClick?: (date: Date, dockId?: number) => void;
}

export default function ScheduleCalendar({
  schedules,
  docks,
  date,
  timezone,
  timeFormat,
  onScheduleClick,
  onCellClick,
}: ScheduleCalendarProps) {
  const [displaySchedules, setDisplaySchedules] = useState<Schedule[]>([]);
  
  // Filter schedules for the selected view (week)
  useEffect(() => {
    // For the calendar view, we want to show the entire week containing the selected date
    const weekStart = startOfWeek(date);
    const weekEnd = endOfWeek(date);
    
    // Filter schedules that fall within the week's range
    const schedulesForWeek = schedules.filter(schedule => {
      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);
      
      // Check if schedule overlaps with the week
      return isWithinInterval(scheduleStart, { start: weekStart, end: weekEnd }) ||
             isWithinInterval(scheduleEnd, { start: weekStart, end: weekEnd }) ||
             (scheduleStart < weekStart && scheduleEnd > weekEnd);
    });
    
    setDisplaySchedules(schedulesForWeek);
  }, [schedules, date]);

  // Generate the hours for the calendar
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = i < 12 ? `${i === 0 ? 12 : i}:00 AM` : `${i === 12 ? 12 : i - 12}:00 PM`;
    return hour;
  });

  // Calculate position and width for each schedule
  const getScheduleStyle = (schedule: Schedule) => {
    const startTime = new Date(schedule.startTime);
    const endTime = new Date(schedule.endTime);
    
    // Get hours and minutes
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinute = endTime.getMinutes();
    
    // Calculate start position (column)
    const startColumn = startHour + 2; // +2 because column 1 is for dock names
    
    // Calculate width based on duration
    const durationHours = 
      (endHour - startHour) + 
      ((endMinute - startMinute) / 60);
    
    // Calculate offset within the hour
    const minuteOffsetPercent = (startMinute / 60) * 100;
    
    // Find the row for this dock
    const dockIndex = docks.findIndex(d => d.id === schedule.dockId);
    const rowIndex = dockIndex + 2; // +2 for the header row
    
    return {
      gridRow: rowIndex,
      gridColumn: `${startColumn} / span ${Math.ceil(durationHours)}`,
      left: `${minuteOffsetPercent}%`,
      width: `calc(100% * ${durationHours})`,
    };
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6 overflow-x-auto">
      <div className="calendar-grid min-w-max">
        {/* Hours Header */}
        <div className="calendar-door font-medium">Dock / Time</div>
        {hours.map((hour, i) => (
          <div key={i} className="calendar-hour text-center text-xs text-neutral-400 py-2">
            {hour}
          </div>
        ))}
        
        {/* Door rows */}
        {docks.map((dock) => (
          <div key={dock.id} className="door-group" style={{ display: "contents" }}>
            <div className="calendar-door">{dock.name}</div>
            {Array.from({ length: 24 }, (_, i) => {
              // Create a date object for this hour cell
              const cellDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), i, 0, 0);
              
              return (
                <div 
                  key={i} 
                  className="calendar-hour cursor-pointer hover:bg-gray-100"
                  onClick={() => onCellClick && onCellClick(cellDate, dock.id)}
                ></div>
              );
            })}
          </div>
        ))}
        
        {/* Schedule events */}
        {displaySchedules.map((schedule) => {
          const dockName = docks.find(d => d.id === schedule.dockId)?.name || '';
          const isInbound = schedule.type === "inbound";
          const startTimeStr = formatTime(schedule.startTime);
          const endTimeStr = formatTime(schedule.endTime);
          
          return (
            <div 
              key={schedule.id}
              className={cn(
                "calendar-event",
                isInbound ? "event-inbound" : "event-outbound"
              )}
              style={getScheduleStyle(schedule)}
              onClick={() => onScheduleClick(schedule.id)}
            >
              <div className="font-medium">
                #{schedule.truckNumber}
              </div>
              <div className="text-xs">
                {startTimeStr} - {endTimeStr}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
