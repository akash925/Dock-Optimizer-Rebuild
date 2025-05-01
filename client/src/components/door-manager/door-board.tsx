import { useState, useEffect } from "react";
import { Dock, Schedule, Carrier } from "@shared/schema";
import { formatDuration, getStatusColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Plus, LogOut, CheckCircle2, Loader2 } from "lucide-react";
import ReleaseDoorForm from "./release-door-form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DoorStatusItem {
  id: number;
  name: string;
  status: "available" | "occupied" | "reserved" | "maintenance";
  currentSchedule?: Schedule;
  carrier?: string;
  elapsedTime?: number;
  remainingTime?: number;
  isCheckedIn?: boolean;
}

interface DoorBoardProps {
  docks: Dock[];
  schedules: Schedule[];
  carriers: Carrier[];
  onCreateAppointment: (dockId: number, timeSlot?: {start: Date, end: Date}) => void;
  onRefreshData: () => void;
}

export default function DoorBoard({ 
  docks, 
  schedules, 
  carriers,
  onCreateAppointment,
  onRefreshData
}: DoorBoardProps) {
  const [doorStatuses, setDoorStatuses] = useState<DoorStatusItem[]>([]);
  const [timeUpdate, setTimeUpdate] = useState(new Date());
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const { toast } = useToast();
  
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
          s.dockId !== null &&  // Ensure it has a dock assigned
          new Date(s.startTime) > now &&
          new Date(s.startTime).getTime() - now.getTime() < 3600000 // Within the next hour
        );
        
        // Determine if the door is occupied and the appointment is checked in
        const isOccupiedAndCheckedIn = currentSchedule && currentSchedule.status === "in-progress";
        
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
          // Use actualStartTime if available (meaning the appointment is checked in)
          const startTime = currentSchedule.actualStartTime 
            ? new Date(currentSchedule.actualStartTime) 
            : new Date(currentSchedule.startTime);
          
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
          remainingTime,
          isCheckedIn: isOccupiedAndCheckedIn
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

  // Check-in mutation for checking in an appointment
  const checkInMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      const response = await apiRequest("PATCH", `/api/schedules/${scheduleId}/check-in`, {
        actualStartTime: new Date().toISOString()
      });
      
      if (!response.ok) {
        let errorMessage = "Failed to check in";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        throw new Error(errorMessage);
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Appointment checked in",
        description: "The appointment has been successfully checked in."
      });
      
      // Refresh data to show updated status
      onRefreshData();
      // Also update local timer
      setTimeUpdate(new Date());
    },
    onError: (error: Error) => {
      toast({
        title: "Check-in failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle checking in an appointment
  const handleCheckIn = (scheduleId: number) => {
    checkInMutation.mutate(scheduleId);
  };

  // Handle releasing a door
  const handleReleaseDoor = (scheduleId: number) => {
    setSelectedScheduleId(scheduleId);
    setReleaseModalOpen(true);
  };
  
  // Handle successful door release
  const handleReleaseSuccess = () => {
    setReleaseModalOpen(false);
    setSelectedScheduleId(null);
    
    // Refresh data to ensure server changes are reflected
    onRefreshData();
    
    // Also update local timer
    setTimeUpdate(new Date());
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {doorStatuses.map((door) => (
          <div 
            key={door.id} 
            className={`border rounded-md h-full bg-white shadow-sm flex flex-col ${door.status === "occupied" ? "border-red-300" : ""}`}
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
                  <p className="text-sm font-medium">
                    {door.carrier}
                    {door.isCheckedIn && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        Checked In
                      </span>
                    )}
                  </p>
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
                <div className="flex space-x-1">
                  {/* Reserved door - Check-in button */}
                  {door.status === "reserved" && door.currentSchedule && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => handleCheckIn(door.currentSchedule!.id)}
                      disabled={checkInMutation.isPending}
                    >
                      {checkInMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      )}
                      Check In
                    </Button>
                  )}
                  
                  {/* Occupied door - Release button */}
                  {door.status === "occupied" && door.currentSchedule && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => handleReleaseDoor(door.currentSchedule!.id)}
                    >
                      <LogOut className="h-3 w-3 mr-1" />
                      Release
                    </Button>
                  )}
                  
                  {/* Book/Update button for all non-maintenance doors */}
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
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Release Door Modal */}
      <ReleaseDoorForm
        isOpen={releaseModalOpen}
        onClose={() => setReleaseModalOpen(false)}
        scheduleId={selectedScheduleId || 0}
        onSuccess={handleReleaseSuccess}
      />
    </>
  );
}