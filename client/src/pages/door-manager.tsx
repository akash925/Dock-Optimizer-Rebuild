import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dock, Schedule, Carrier, Facility } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import DoorAppointmentForm from "../components/door-manager/door-appointment-form-fixed";
import ReleaseDoorForm from "../components/door-manager/release-door-form";
import AppointmentSelectorDialog from "../components/door-manager/appointment-selector-dialog";
import { useAssignAppointmentToDoor } from "../components/door-manager/assign-appointment-service";
import DoorBoard from "../components/door-manager/door-board";
import { X, LogOut, RefreshCw } from "lucide-react";

export default function DoorManager() {
  const { toast } = useToast();
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<"all" | "available" | "not_available">("all");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showAppointmentSelector, setShowAppointmentSelector] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showReleaseDoorForm, setShowReleaseDoorForm] = useState(false);
  const [selectedDockId, setSelectedDockId] = useState<number | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{start: Date, end: Date} | null>(null);
  
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
  
  // Use the door assignment mutation
  const assignAppointmentMutation = useAssignAppointmentToDoor();
  
  // Open the appointment selector
  const handleUseDoor = (dockId: number) => {
    setSelectedDockId(dockId);
    
    // Find the door's facility ID
    const selectedDock = docks.find(dock => dock.id === dockId);
    if (selectedDock) {
      // Set the facility filter to the door's facility
      setSelectedFacilityId(selectedDock.facilityId);
    }
    
    setShowAppointmentSelector(true);
  };
  
  // Create a new appointment with the facility pre-selected
  const handleCreateAppointment = () => {
    if (!selectedDockId) return;
    
    // Find the door's facility ID if not already set
    const facilityId = selectedFacilityId || 
      docks.find(d => d.id === selectedDockId)?.facilityId || null;
    
    // Set facility ID for pre-selection in the appointment form
    if (facilityId) {
      setSelectedFacilityId(facilityId);
    }
    
    // Default to 1 hour from now 
    const start = new Date();
    const end = new Date();
    end.setHours(end.getHours() + 1);
    setSelectedTimeSlot({ start, end });
    setShowAppointmentSelector(false);
    setShowAppointmentForm(true);
  };
  
  // Assign an existing appointment to a door
  const handleSelectAppointment = (scheduleId: number) => {
    if (!selectedDockId) return;
    
    assignAppointmentMutation.mutate({ 
      scheduleId, 
      dockId: selectedDockId 
    }, {
      onSuccess: () => {
        // Set the recently assigned dock for visual feedback
        setRecentlyAssignedDock(selectedDockId);
        
        // Hide the appointment selector and refresh data
        setShowAppointmentSelector(false);
        refetchSchedules();
        refetchDocks();
        setLastUpdated(new Date());
        
        // Clear the highlight after 3 seconds
        setTimeout(() => {
          setRecentlyAssignedDock(null);
        }, 3000);
        
        // Show toast notification
        toast({
          title: "Appointment assigned",
          description: "The appointment has been successfully assigned to the door",
        });
      }
    });
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
  
  // Handle successful door release
  const handleDoorReleaseSuccess = () => {
    // Immediately update the data
    refetchSchedules();
    
    // Close the form
    handleCloseReleaseDoorForm();
    
    // Refetch the docks to update their status
    refetchDocks();
    
    // Force a complete refresh after a delay to ensure all data is in sync
    setTimeout(() => {
      refetchSchedules();
      refetchDocks();
      
      // Also update the timestamp to force a complete re-render
      setLastUpdated(new Date());
    }, 800);
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
              <div 
                key={dock.id} 
                className={`border rounded-md overflow-hidden shadow-sm transition-all duration-300 ${
                  recentlyAssignedDock === dock.id 
                    ? 'ring-2 ring-blue-500 scale-[1.03] bg-blue-50' 
                    : status === "occupied" 
                      ? 'border-red-500 bg-red-50' 
                      : status === "reserved" 
                        ? 'border-amber-400'
                        : ''
                }`}
              >
                <div className="p-4 border-b flex justify-between items-center">
                  <div className="font-semibold">{dock.name}</div>
                  <div className={`h-4 w-4 rounded-full ${
                    status === "available" ? "bg-green-500" : 
                    status === "occupied" ? "bg-red-500" : 
                    status === "reserved" ? "bg-amber-500" : "bg-gray-500"
                  }`}></div>
                </div>
                
                {(status === "occupied" || status === "reserved") && currentSchedule && (
                  <div className="px-4 pt-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {currentSchedule.customerName || "No Customer Name"}
                    </p>
                    <p className="text-xs font-medium text-gray-700">
                      {carrierName || "Unknown Carrier"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {/* Eastern Time (facility timezone) */}
                      {new Date(currentSchedule.startTime).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        timeZone: 'America/New_York' 
                      })} - 
                      {new Date(currentSchedule.endTime).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        timeZone: 'America/New_York'
                      })}
                      {/* Show local time if different */}
                      {Intl.DateTimeFormat().resolvedOptions().timeZone !== 'America/New_York' && (
                        <span className="text-xs italic"> 
                          ({new Date(currentSchedule.startTime).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })} local)
                        </span>
                      )}
                    </p>
                    {status === "reserved" && <p className="text-xs text-amber-600 font-medium">Reserved</p>}
                  </div>
                )}
                
                <div className="p-4 flex justify-center">
                  {status === "occupied" && currentSchedule ? (
                    <Button 
                      onClick={() => handleReleaseDoor(currentSchedule.id)}
                      className="w-full bg-red-600 hover:bg-red-700"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Release Door
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleUseDoor(dock.id)}
                      className="w-full bg-green-600 hover:bg-green-700"
                      disabled={status === "not_available"}
                    >
                      {status === "reserved" ? "Check In" : "Use Door"}
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
      {showAppointmentForm && selectedDockId && (
        <DoorAppointmentForm 
          isOpen={showAppointmentForm}
          onClose={handleCloseAppointmentForm}
          dockId={selectedDockId}
          facilityId={selectedFacilityId || undefined}
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
          onSuccess={handleDoorReleaseSuccess}
        />
      )}
      
      {/* Appointment Selector Dialog */}
      {showAppointmentSelector && selectedDockId && (
        <AppointmentSelectorDialog
          isOpen={showAppointmentSelector}
          onClose={() => setShowAppointmentSelector(false)}
          dockId={selectedDockId}
          facilityId={selectedFacilityId}
          onSelect={handleSelectAppointment}
          onCreateNew={handleCreateAppointment}
          onFacilityChange={(facilityId) => {
            // Update the facility ID when changed in the dialog
            setSelectedFacilityId(facilityId);
          }}
        />
      )}
    </div>
  );
}