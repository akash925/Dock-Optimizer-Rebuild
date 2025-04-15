import { useState } from "react";
import { format, startOfWeek, addDays, isToday, isWithinInterval, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Schedule {
  id: number;
  dockId: number;
  carrierId: number;
  truckNumber: string;
  startTime: Date;
  endTime: Date;
  type: "inbound" | "outbound";
  status: string;
}

interface Dock {
  id: number;
  name: string;
  isActive: boolean;
  type: string;
}

interface Carrier {
  id: number;
  name: string;
}

interface CalendarViewProps {
  schedules: Schedule[];
  docks: Dock[];
  carriers: Carrier[];
  onCreateAppointment: (dockId: number, timeSlot?: {start: Date, end: Date}) => void;
}

export default function CalendarView({ 
  schedules, 
  docks, 
  carriers,
  onCreateAppointment 
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekStartDate, setWeekStartDate] = useState(startOfWeek(currentDate));
  
  // Generate week days
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(addDays(weekStartDate, i));
  }
  
  // Go to previous week
  const prevWeek = () => {
    const newWeekStart = addDays(weekStartDate, -7);
    setWeekStartDate(newWeekStart);
  };
  
  // Go to next week
  const nextWeek = () => {
    const newWeekStart = addDays(weekStartDate, 7);
    setWeekStartDate(newWeekStart);
  };
  
  // Go to current week
  const goToToday = () => {
    setWeekStartDate(startOfWeek(new Date()));
  };
  
  // Get carrier name by ID
  const getCarrierName = (carrierId: number) => {
    const carrier = carriers.find(c => c.id === carrierId);
    return carrier ? carrier.name : "Unknown";
  };
  
  // Get schedule for a specific day and dock
  const getSchedulesForDayAndDock = (day: Date, dockId: number) => {
    return schedules.filter(schedule => {
      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);
      
      return (
        schedule.dockId === dockId &&
        isWithinInterval(day, {
          start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0),
          end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)
        }) &&
        (isWithinInterval(scheduleStart, {
          start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0),
          end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)
        }) ||
        isWithinInterval(scheduleEnd, {
          start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0),
          end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)
        }))
      );
    });
  };
  
  // Format time for display
  const formatTimeRange = (start: Date, end: Date) => {
    return `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`;
  };

  // Generate time slots (hour labels)
  const timeSlots: string[] = [];
  for (let hour = 5; hour <= 19; hour++) {
    timeSlots.push(`${hour}:00`);
  }
  
  // Handle click on empty cell to create appointment
  const handleCellClick = (dockId: number, day: Date, hour: number) => {
    const startTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
    const endTime = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour + 1, 0, 0);
    onCreateAppointment(dockId, { start: startTime, end: endTime });
  };
  
  return (
    <div className="flex flex-col">
      {/* Calendar header and controls */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">
          {format(weekStartDate, "MMM d")} - {format(addDays(weekStartDate, 6), "MMM d, yyyy")}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Calendar grid */}
      <div className="border rounded-md overflow-auto">
        <div className="min-w-[800px]">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b">
            <div className="p-2 border-r bg-muted"></div>
            {weekDays.map((day, i) => (
              <div 
                key={i} 
                className={`p-2 text-center border-r font-medium ${isToday(day) ? 'bg-primary/10' : ''}`}
              >
                <div>{format(day, "EEE")}</div>
                <div className={`text-sm ${isToday(day) ? 'text-primary font-bold' : 'text-gray-500'}`}>
                  {format(day, "MMM d")}
                </div>
              </div>
            ))}
          </div>
          
          {/* Dock rows */}
          {docks.map(dock => (
            <div key={dock.id} className="grid grid-cols-8 border-b">
              <div className="p-2 border-r bg-muted font-medium flex items-center">
                {dock.name}
                <Badge variant={dock.isActive ? "secondary" : "outline"} className="ml-2">
                  {dock.type}
                </Badge>
              </div>
              
              {/* Day cells for each dock */}
              {weekDays.map((day, dayIndex) => {
                const daySchedules = getSchedulesForDayAndDock(day, dock.id);
                
                return (
                  <div 
                    key={dayIndex} 
                    className={`relative p-1 border-r ${isToday(day) ? 'bg-primary/5' : ''} min-h-[100px]`}
                  >
                    {/* Render schedules for this day and dock */}
                    {daySchedules.map(schedule => (
                      <div 
                        key={schedule.id}
                        className={`mb-1 p-1 text-xs rounded ${
                          schedule.type === "inbound" ? "bg-blue-100 border-blue-300" : "bg-green-100 border-green-300"
                        } border overflow-hidden`}
                        title={`${getCarrierName(schedule.carrierId)} (${schedule.truckNumber})`}
                      >
                        <div className="font-medium truncate">{getCarrierName(schedule.carrierId)}</div>
                        <div className="text-gray-500">
                          {formatTimeRange(
                            new Date(schedule.startTime),
                            new Date(schedule.endTime)
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Add button */}
                    {daySchedules.length === 0 && (
                      <button
                        onClick={() => handleCellClick(dock.id, day, 9)} // Default to 9 AM
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 bg-primary/10 rounded-full p-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}