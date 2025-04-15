import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Schedule } from "@shared/schema";
import { formatTime } from "@/lib/utils";

interface ScheduleCalendarProps {
  schedules: Schedule[];
  docks: { id: number; name: string }[];
  date: Date;
  onScheduleClick: (scheduleId: number) => void;
}

export default function ScheduleCalendar({
  schedules,
  docks,
  date,
  onScheduleClick,
}: ScheduleCalendarProps) {
  const [dailySchedules, setDailySchedules] = useState<Schedule[]>([]);
  
  // Filter schedules for the selected date
  useEffect(() => {
    const selectedDateStr = date.toISOString().split('T')[0];
    
    const filteredSchedules = schedules.filter(schedule => {
      const scheduleStartDate = new Date(schedule.startTime).toISOString().split('T')[0];
      const scheduleEndDate = new Date(schedule.endTime).toISOString().split('T')[0];
      
      return scheduleStartDate === selectedDateStr || scheduleEndDate === selectedDateStr;
    });
    
    setDailySchedules(filteredSchedules);
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
          <React.Fragment key={dock.id}>
            <div className="calendar-door">{dock.name}</div>
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="calendar-hour"></div>
            ))}
          </React.Fragment>
        ))}
        
        {/* Schedule events */}
        {dailySchedules.map((schedule) => {
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
