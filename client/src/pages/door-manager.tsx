import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dock, Schedule, Carrier, Facility } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import DoorAppointmentForm from "../components/door-manager/door-appointment-form";
import ReleaseDoorForm from "../components/door-manager/release-door-form";
import { X, LogOut } from "lucide-react";

export default function DoorManager() {
  const { toast } = useToast();
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<"all" | "available" | "not_available">("all");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showReleaseDoorForm, setShowReleaseDoorForm] = useState(false);
  const [selectedDockId, setSelectedDockId] = useState<number | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{start: Date, end: Date} | null>(null);
  
  // Fetch facilities
  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });
  
  // Fetch docks
  const { data: docks = [], refetch: refetchDocks } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });
  
  // Fetch schedules
  const { data: schedules = [], refetch: refetchSchedules } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
  });
  
  // Fetch carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });

  // When facilities load, select the first one by default if none is selected
  useEffect(() => {
    if (facilities.length > 0 && !selectedFacilityId) {
      setSelectedFacilityId(facilities[0].id);
    }
  }, [facilities, selectedFacilityId]);
  
  // Set up auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      refetchDocks();
      refetchSchedules();
      setLastUpdated(new Date());
    }, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, [refetchDocks, refetchSchedules]);

  // Determine door status and current schedule
  const getDoorStatus = (dock: Dock): { 
    status: "available" | "occupied" | "reserved" | "not_available";
    currentSchedule?: Schedule;
  } => {
    const now = new Date();
    
    // First check if door is occupied (has active appointment)
    // An appointment is active if it's within its time window AND not cancelled or completed
    const currentSchedule = schedules.find(s => 
      s.dockId === dock.id && 
      new Date(s.startTime) <= now && 
      new Date(s.endTime) >= now &&
      s.status !== "cancelled" && 
      s.status !== "completed"
    );
    
    if (currentSchedule) {
      return { status: "occupied", currentSchedule };
    }
    
    // Check if door is reserved soon
    const upcomingSchedule = schedules.find(s => 
      s.dockId === dock.id && 
      new Date(s.startTime) > now &&
      new Date(s.startTime).getTime() - now.getTime() < 3600000 && // Within the next hour
      s.status !== "cancelled" &&
      s.status !== "completed"
    );
    
    if (upcomingSchedule) {
      return { status: "reserved", currentSchedule: upcomingSchedule };
    }
    
    // Door is in maintenance
    if (!dock.isActive) {
      return { status: "not_available" };
    }
    
    // Door is available
    return { status: "available" };
  };

  // Filter docks by facility and availability
  const filteredDocks = docks.filter(dock => {
    // Filter by facility
    const facilityMatch = selectedFacilityId ? 
      (dock.facilityId === selectedFacilityId) : true;
    
    // Filter by availability
    const { status } = getDoorStatus(dock);
    const availabilityMatch = filterType === "all" ? 
      true : (filterType === "available" ? status === "available" : status !== "available");
    
    return facilityMatch && availabilityMatch;
  });
  
  // Create an ad-hoc appointment
  const handleCreateAppointment = (dockId: number) => {
    setSelectedDockId(dockId);
    // Default to 1 hour from now 
    const start = new Date();
    const end = new Date();
    end.setHours(end.getHours() + 1);
    setSelectedTimeSlot({ start, end });
    setShowAppointmentForm(true);
  };
  
  // Handle releasing a door
  const handleReleaseDoor = (scheduleId: number) => {
    setSelectedScheduleId(scheduleId);
    setShowReleaseDoorForm(true);
  };
  
  // Close the appointment form
  const handleCloseAppointmentForm = () => {
    setShowAppointmentForm(false);
    setSelectedDockId(null);
    setSelectedTimeSlot(null);
  };
  
  // Close the release door form
  const handleCloseReleaseDoorForm = () => {
    setShowReleaseDoorForm(false);
    setSelectedScheduleId(null);
  };

  return (
    <div className="relative">
      <div className="absolute top-3 right-3">
        <Button size="icon" variant="ghost">
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="p-4">
        <h1 className="text-2xl font-semibold text-center mb-4">Door Management</h1>
        
        <div className="bg-gray-100 p-4 rounded-md mb-6">
          <div className="flex flex-wrap gap-4 justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="font-medium">Filter :</div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setFilterType("all")}
                  className={`rounded-full px-4 py-1 ${
                    filterType === "all" 
                      ? "bg-blue-500 text-white" 
                      : "bg-white"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType("available")}
                  className={`rounded-full px-4 py-1 ${
                    filterType === "available" 
                      ? "bg-green-500 text-white" 
                      : "bg-white"
                  }`}
                >
                  AVAILABLE
                </button>
                <button
                  onClick={() => setFilterType("not_available")}
                  className={`rounded-full px-4 py-1 ${
                    filterType === "not_available" 
                      ? "bg-red-500 text-white" 
                      : "bg-white"
                  }`}
                >
                  NOT AVAILABLE
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="font-medium">Facility :</span>
              <Select 
                value={selectedFacilityId?.toString() || ""} 
                onValueChange={(value) => setSelectedFacilityId(Number(value))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((facility) => (
                    <SelectItem key={facility.id} value={facility.id.toString()}>
                      {facility.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="h-4 w-4 rounded-full bg-red-500 mr-2"></div>
                <span>Not Available</span>
              </div>
              <div className="flex items-center">
                <div className="h-4 w-4 rounded-full bg-green-500 mr-2"></div>
                <span>Available</span>
              </div>
              <div className="flex items-center">
                <div className="h-4 w-4 rounded-full bg-amber-500 mr-2"></div>
                <span>Reserved</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredDocks.map((dock) => {
            const { status, currentSchedule } = getDoorStatus(dock);
            const carrierName = currentSchedule && carriers.find(c => c.id === currentSchedule.carrierId)?.name;
            
            return (
              <div key={dock.id} className="border rounded-md overflow-hidden shadow-sm">
                <div className="p-4 border-b flex justify-between items-center">
                  <div className="font-semibold">{dock.name}</div>
                  <div className={`h-4 w-4 rounded-full ${
                    status === "available" ? "bg-green-500" : 
                    status === "occupied" ? "bg-red-500" : 
                    status === "reserved" ? "bg-amber-500" : "bg-gray-500"
                  }`}></div>
                </div>
                
                {status === "occupied" && currentSchedule && (
                  <div className="px-4 pt-2">
                    <p className="text-sm font-medium">{carrierName || "Unknown Carrier"}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(currentSchedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                      {new Date(currentSchedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
                
                <div className="p-4 flex justify-center">
                  {status === "occupied" && currentSchedule ? (
                    <Button 
                      onClick={() => handleReleaseDoor(currentSchedule.id)}
                      className="w-full bg-amber-600 hover:bg-amber-700"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Release Door
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleCreateAppointment(dock.id)}
                      className="w-full"
                      disabled={status === "not_available"}
                    >
                      Use Door
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          
          {filteredDocks.length === 0 && (
            <div className="col-span-full text-center p-10 bg-gray-50 rounded-md">
              <p className="text-gray-500">No doors available for the selected filters.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Door Appointment Form Dialog */}
      {showAppointmentForm && selectedDockId && selectedTimeSlot && (
        <DoorAppointmentForm 
          isOpen={showAppointmentForm}
          onClose={handleCloseAppointmentForm}
          dockId={selectedDockId}
          initialStartTime={selectedTimeSlot.start}
          initialEndTime={selectedTimeSlot.end}
          carriers={carriers}
          schedules={schedules}
          onSuccess={() => {
            refetchSchedules();
            handleCloseAppointmentForm();
          }}
        />
      )}
      
      {/* Release Door Form Dialog */}
      {showReleaseDoorForm && selectedScheduleId && (
        <ReleaseDoorForm
          isOpen={showReleaseDoorForm}
          onClose={handleCloseReleaseDoorForm}
          scheduleId={selectedScheduleId}
          onSuccess={() => {
            refetchSchedules();
            handleCloseReleaseDoorForm();
          }}
        />
      )}
    </div>
  );
}