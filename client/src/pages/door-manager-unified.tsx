import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dock, Schedule, Carrier, Facility } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, RefreshCw, Calendar, Settings } from "lucide-react";
import ReleaseDoorForm from "@/components/door-manager/release-door-form";
import UnifiedAppointmentFlow from "@/components/appointment/unified-appointment-flow";

export default function DoorManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<"all" | "available" | "not_available">("all");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showReleaseDoorForm, setShowReleaseDoorForm] = useState(false);
  const [selectedDockId, setSelectedDockId] = useState<number | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  
  // Add state for tracking recently assigned door
  const [recentlyAssignedDock, setRecentlyAssignedDock] = useState<number | null>(null);
  
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
    
    // First check if door has an in-progress appointment
    const inProgressSchedule = schedules.find(s => 
      s.dockId === dock.id && 
      s.status === "in-progress"
    );
    
    if (inProgressSchedule) {
      return { status: "occupied", currentSchedule: inProgressSchedule };
    }
    
    // Next check if door is occupied (has active appointment within time window)
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
    
    // Check if any scheduled appointment is assigned to this door
    const assignedSchedule = schedules.find(s => 
      s.dockId === dock.id && 
      s.status === "scheduled"
    );
    
    if (assignedSchedule) {
      // If it's about to start within the next hour, show as reserved
      if (new Date(assignedSchedule.startTime) > now && 
          new Date(assignedSchedule.startTime).getTime() - now.getTime() < 3600000) {
        return { status: "reserved", currentSchedule: assignedSchedule };
      }
      // Otherwise, still mark as occupied if it has an assigned door
      return { status: "occupied", currentSchedule: assignedSchedule };
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
  
  // Open the unified appointment form for creating new appointments
  const handleUseDoor = (dockId: number) => {
    setSelectedDockId(dockId);
    
    // Find the door's facility ID
    const selectedDock = docks.find(dock => dock.id === dockId);
    if (selectedDock) {
      // Set the facility filter to the door's facility
      setSelectedFacilityId(selectedDock.facilityId);
    }
    
    setShowAppointmentForm(true);
  };
  
  // Release a door (end appointment)
  const handleReleaseDoor = (scheduleId: number) => {
    setSelectedScheduleId(scheduleId);
    setShowReleaseDoorForm(true);
  };
  
  // Close appointment form
  const handleCloseAppointmentForm = () => {
    setShowAppointmentForm(false);
    setSelectedDockId(null);
  };
  
  // Close release door form
  const handleCloseReleaseDoorForm = () => {
    setShowReleaseDoorForm(false);
    setSelectedScheduleId(null);
  };
  
  // Handle successful appointment creation
  const handleAppointmentSuccess = (appointment: any) => {
    console.log('[DoorManager] Appointment created successfully:', appointment);
    
    // Refresh data
    queryClient.invalidateQueries({ queryKey: ["/api/docks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
    refetchDocks();
    refetchSchedules();
    
    // Show success message
    toast({
      title: "Appointment Created",
      description: `Appointment successfully created${appointment.confirmationCode ? ` (${appointment.confirmationCode})` : ''}`,
    });
    
    // Close form
    setShowAppointmentForm(false);
    setSelectedDockId(null);
  };
  
  // Handle successful door release
  const handleDoorReleaseSuccess = () => {
    console.log("[DoorManager] Door release success callback executed");
    
    // Close the form
    handleCloseReleaseDoorForm();
    
    // Immediately force a complete refresh of all data
    queryClient.invalidateQueries({ queryKey: ["/api/docks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
    
    // Refetch data with the refetch functions provided by React Query
    refetchDocks();
    refetchSchedules();
    
    // Force the component to re-render by updating the timestamp
    setLastUpdated(new Date());
    
    // Show success toast
    toast({
      title: "Door Released",
      description: "The door has been successfully released and is now available",
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Door Management</h1>
        <Button 
          variant="outline" 
          onClick={() => {
            refetchDocks();
            refetchSchedules();
            setLastUpdated(new Date());
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter:</span>
          <Button 
            variant={filterType === "all" ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilterType("all")}
          >
            All
          </Button>
          <Button 
            variant={filterType === "available" ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilterType("available")}
          >
            Available
          </Button>
          <Button 
            variant={filterType === "not_available" ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilterType("not_available")}
          >
            Not Available
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Facility:</span>
          <Select 
            value={selectedFacilityId?.toString() || ""} 
            onValueChange={(value) => setSelectedFacilityId(value ? parseInt(value) : null)}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="All Facilities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Facilities</SelectItem>
              {facilities.map((facility) => (
                <SelectItem key={facility.id} value={facility.id.toString()}>
                  {facility.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-red-500"></div>
            <span className="text-sm">Not Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-green-500"></div>
            <span className="text-sm">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-amber-500"></div>
            <span className="text-sm">Reserved</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredDocks.map((dock) => {
          const { status, currentSchedule } = getDoorStatus(dock);
          const carrierName = currentSchedule && carriers.find(c => c.id === currentSchedule.carrierId)?.name;
          
          return (
            <Card 
              key={dock.id} 
              className={`transition-all duration-300 ${
                recentlyAssignedDock === dock.id 
                  ? 'ring-2 ring-blue-500 scale-[1.03] bg-blue-50' 
                  : status === "occupied" 
                    ? 'border-red-500 bg-red-50' 
                    : status === "reserved" 
                      ? 'border-amber-400'
                      : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">{dock.name}</CardTitle>
                  <div className={`h-4 w-4 rounded-full ${
                    status === "available" ? "bg-green-500" : 
                    status === "occupied" ? "bg-red-500" : 
                    status === "reserved" ? "bg-amber-500" : "bg-gray-500"
                  }`}></div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <Badge 
                    variant={status === "available" ? "default" : "secondary"}
                    className={
                      status === "available" ? "bg-green-100 text-green-800" :
                      status === "occupied" ? "bg-red-100 text-red-800" :
                      status === "reserved" ? "bg-amber-100 text-amber-800" :
                      "bg-gray-100 text-gray-800"
                    }
                  >
                    {status === "available" ? "Available" :
                     status === "occupied" ? "Occupied" :
                     status === "reserved" ? "Reserved" : "Maintenance"}
                  </Badge>
                </div>

                {currentSchedule && (
                  <div className="text-sm space-y-1">
                    <div><strong>Company:</strong> {currentSchedule.companyName || 'N/A'}</div>
                    <div><strong>Carrier:</strong> {carrierName || 'N/A'}</div>
                    <div><strong>Time:</strong> {new Date(currentSchedule.startTime).toLocaleTimeString()} - {new Date(currentSchedule.endTime).toLocaleTimeString()}</div>
                  </div>
                )}

                <div className="pt-2">
                  {status === "occupied" && currentSchedule ? (
                    <Button 
                      onClick={() => handleReleaseDoor(currentSchedule.id)}
                      className="w-full bg-red-600 hover:bg-red-700"
                      size="sm"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Release Door
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleUseDoor(dock.id)}
                      className="w-full bg-green-600 hover:bg-green-700"
                      disabled={status === "not_available"}
                      size="sm"
                    >
                      {status === "reserved" ? "Check In" : "Use Door"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {filteredDocks.length === 0 && (
          <div className="col-span-full text-center p-10 bg-gray-50 rounded-md">
            <p className="text-gray-500">No doors available for the selected filters.</p>
          </div>
        )}
      </div>
      
      {/* Unified Appointment Form */}
      {showAppointmentForm && selectedDockId && (
        <UnifiedAppointmentFlow 
          mode="internal"
          isOpen={showAppointmentForm}
          onClose={handleCloseAppointmentForm}
          onSuccess={handleAppointmentSuccess}
          facilityId={selectedFacilityId || undefined}
          selectedDockId={selectedDockId}
          editMode="create"
        />
      )}
      
      {/* Release Door Form Dialog */}
      {showReleaseDoorForm && selectedScheduleId && (
        <ReleaseDoorForm
          isOpen={showReleaseDoorForm}
          onClose={handleCloseReleaseDoorForm}
          scheduleId={selectedScheduleId}
          onSuccess={handleDoorReleaseSuccess}
        />
      )}
    </div>
  );
} 