import { useState, useEffect, Fragment } from "react";
import { cn, formatTime } from "@/lib/utils";
import { Link } from "wouter";
import { Schedule, Dock, Carrier } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Calendar, Filter, CalendarClock } from "lucide-react";

interface ScheduleTimelineProps {
  schedules: Schedule[];
  docks: Dock[];
  carriers: Carrier[];
}

export default function ScheduleTimeline({ 
  schedules, 
  docks, 
  carriers 
}: ScheduleTimelineProps) {
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  
  // Filter schedules for today
  useEffect(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const filtered = schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.startTime);
      return scheduleDate >= today && scheduleDate < tomorrow;
    });
    
    setTodaySchedules(filtered);
  }, [schedules]);
  
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
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Today's Schedule</h3>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-1" />
            Filter
          </Button>
          <Button variant="link" size="sm" asChild>
            <Link href="/schedules" className="text-primary flex items-center text-sm">
              Calendar View
              <CalendarClock className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
      
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
          <Fragment key={dock.id}>
            <div className="calendar-door">{dock.name}</div>
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="calendar-hour"></div>
            ))}
          </Fragment>
        ))}
        
        {/* Schedule events */}
        {todaySchedules.map((schedule) => {
          const isInbound = schedule.type === "inbound";
          const carrier = carriers.find(c => c.id === schedule.carrierId);
          const startTimeStr = formatTime(schedule.startTime);
          const endTimeStr = formatTime(schedule.endTime);
          
          return (
            <Link key={schedule.id} href={`/schedules/${schedule.id}`}>
              <div 
                className={cn(
                  "calendar-event cursor-pointer",
                  isInbound ? "event-inbound" : "event-outbound"
                )}
                style={getScheduleStyle(schedule)}
              >
                <div className="font-medium">{carrier?.name} #{schedule.truckNumber}</div>
                <div className="text-xs">{startTimeStr} - {endTimeStr}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
