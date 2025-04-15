import { useState, useEffect } from "react";
import { Dock, Schedule, Carrier } from "@shared/schema";
import { formatDuration, getStatusColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Plus } from "lucide-react";

interface DoorStatusItem {
  id: number;
  name: string;
  status: "available" | "occupied" | "reserved" | "maintenance";
  currentSchedule?: Schedule;
  carrier?: string;
  elapsedTime?: number;
  remainingTime?: number;
}

interface DoorBoardProps {
  docks: Dock[];
  schedules: Schedule[];
  carriers: Carrier[];
  onCreateAppointment: (dockId: number, timeSlot?: {start: Date, end: Date}) => void;
}

export default function DoorBoard({ 
  docks, 
  schedules, 
  carriers,
  onCreateAppointment
}: DoorBoardProps) {
  const [doorStatuses, setDoorStatuses] = useState<DoorStatusItem[]>([]);
  const [timeUpdate, setTimeUpdate] = useState(new Date());
  
  // Process door status data
  useEffect(() => {
    if (docks.length > 0) {
      const now = new Date();
      
      const statuses = docks.map(dock => {
        // Determine door status based on schedules
        let status: "available" | "occupied" | "reserved" | "maintenance" = "available";
        
        // Find current schedule for occupied doors
        const currentSchedule = schedules.find(s => 
          s.dockId === dock.id && 
          new Date(s.startTime) <= now && 
          new Date(s.endTime) >= now
        );
        
        // Find next scheduled appointment for reserved doors
        const nextSchedule = schedules.find(s => 
          s.dockId === dock.id && 
          new Date(s.startTime) > now &&
          new Date(s.startTime).getTime() - now.getTime() < 3600000 // Within the next hour
        );
        
        if (currentSchedule) {
          status = "occupied";
        } else if (nextSchedule) {
          status = "reserved";
        } else if (!dock.isActive) {
          status = "maintenance";
        }
        
        // Calculate elapsed and remaining time for occupied doors
        let elapsedTime: number | undefined;
        let remainingTime: number | undefined;
        
        if (currentSchedule) {
          const startTime = new Date(currentSchedule.startTime);
          const endTime = new Date(currentSchedule.endTime);
          elapsedTime = now.getTime() - startTime.getTime();
          remainingTime = endTime.getTime() - now.getTime();
        }
        
        // Get carrier name
        const carrierName = currentSchedule 
          ? carriers.find(c => c.id === currentSchedule.carrierId)?.name 
          : (nextSchedule ? carriers.find(c => c.id === nextSchedule.carrierId)?.name : undefined);
        
        return {
          id: dock.id,
          name: dock.name,
          status,
          currentSchedule: currentSchedule || nextSchedule,
          carrier: carrierName,
          elapsedTime,
          remainingTime
        };
      });
      
      setDoorStatuses(statuses);
    }
  }, [docks, schedules, carriers, timeUpdate]);
  
  // Update time every 30 seconds to refresh timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUpdate(new Date());
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Get badge variant based on status
  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case "available":
        return "secondary";
      case "occupied":
        return "destructive";
      case "reserved":
        return "default";
      case "maintenance":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {doorStatuses.map((door) => (
        <div 
          key={door.id} 
          className="border rounded-md h-full bg-white shadow-sm flex flex-col"
        >
          <div className="p-4 border-b">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-lg">{door.name}</h3>
              <Badge variant={getStatusBadgeVariant(door.status)}>
                <span className={`h-2 w-2 rounded-full ${getStatusColor(door.status)} mr-1.5`}></span>
                <span className="capitalize">{door.status}</span>
              </Badge>
            </div>
            
            {door.status === "occupied" && door.carrier && (
              <div className="mb-2">
                <p className="text-sm font-medium">{door.carrier}</p>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>
                    Elapsed: {door.elapsedTime ? formatDuration(door.elapsedTime) : "--:--:--"}
                  </span>
                </div>
                {door.remainingTime && (
                  <div className="text-xs text-gray-500 mt-1 ml-4">
                    Remaining: {formatDuration(door.remainingTime)}
                  </div>
                )}
              </div>
            )}
            
            {door.status === "reserved" && door.carrier && door.currentSchedule && (
              <div className="mb-2">
                <p className="text-sm font-medium">Reserved: {door.carrier}</p>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  <span>
                    {new Date(door.currentSchedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {" - "}
                    {new Date(door.currentSchedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )}
            
            {door.status === "available" && (
              <div className="mb-2">
                <p className="text-sm text-gray-500">Available for booking</p>
              </div>
            )}
            
            {door.status === "maintenance" && (
              <div className="mb-2">
                <p className="text-sm text-gray-500">Under maintenance</p>
              </div>
            )}
          </div>
          
          <div className="p-3 mt-auto bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Updated: {timeUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            
            {door.status !== "maintenance" && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-xs"
                onClick={() => {
                  if (door.status === "available") {
                    // Create appointment starting now
                    const start = new Date();
                    const end = new Date();
                    end.setHours(end.getHours() + 1);
                    onCreateAppointment(door.id, { start, end });
                  } else if (door.status === "occupied" && door.currentSchedule) {
                    // Extend current appointment by 30 minutes
                    const start = new Date(door.currentSchedule.endTime);
                    const end = new Date(door.currentSchedule.endTime);
                    end.setMinutes(end.getMinutes() + 30);
                    onCreateAppointment(door.id, { start, end });
                  } else {
                    // Default appointment
                    onCreateAppointment(door.id);
                  }
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                {door.status === "available" ? "Book" : "Update"}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}