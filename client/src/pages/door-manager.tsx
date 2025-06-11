import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dock, Schedule, Carrier, Facility } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, RefreshCw, Calendar, Settings, X, QrCode, FileText, Image, MessageSquare, Scan } from "lucide-react";
import ReleaseDoorForm from "@/components/door-manager/release-door-form";
import UnifiedAppointmentFlow from "@/components/appointment/unified-appointment-flow";
import DoorBoard from "../components/door-manager/door-board";
import AppointmentSelector from "@/components/door-manager/appointment-selector-dialog";
import DoorAppointmentForm from "@/components/door-manager/door-appointment-form";
import { useAssignAppointmentToDoor } from "@/components/door-manager/assign-appointment-service";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppointmentScanner } from "@/components/shared/appointment-scanner";

export default function DoorManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Import the assignment mutation hook
  const assignAppointmentMutation = useAssignAppointmentToDoor();
  
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<"all" | "available" | "not_available">("all");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [showReleaseDoorForm, setShowReleaseDoorForm] = useState(false);
  const [selectedDockId, setSelectedDockId] = useState<number | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  
  // Add missing state variables
  const [recentlyAssignedDock, setRecentlyAssignedDock] = useState<number | null>(null);
  const [showAppointmentSelector, setShowAppointmentSelector] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ start: Date; end: Date } | null>(null);
  
  // Add QR code dialog state
  const [showQRCode, setShowQRCode] = useState(false);
  const [selectedAppointmentForQR, setSelectedAppointmentForQR] = useState<Schedule | null>(null);
  
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
  
  // Open the unified appointment form
    const handleUseDoor = (dockId: number) => {
    console.log("[DoorManager] Use door clicked for dock ID:", dockId);
    setSelectedDockId(dockId);
    
    // Use only AppointmentSelector to avoid modal stacking
    setShowAppointmentSelector(true);
    console.log("[DoorManager] AppointmentSelector should now be visible");
  };
  
  // Create a new appointment with the facility pre-selected
  const handleCreateAppointment = () => {
    console.log("[DoorManager] Create new appointment clicked");
    if (!selectedDockId) {
      console.error("[DoorManager] Cannot create appointment: No dock selected");
      return;
    }
    
    // Attempt to find the facility in this order:
    // 1. User-selected facility ID from the selector
    // 2. The facility ID of the selected dock
    // 3. Default to null if nothing found
    const selectedDock = docks.find(d => d.id === selectedDockId);
    const dockFacilityId = selectedDock?.facilityId;
    
    const facilityId = selectedFacilityId || dockFacilityId || null;
    
    console.log(`[DoorManager] Creating appointment for Dock ID: ${selectedDockId}`);
    console.log(`[DoorManager] Using Facility ID: ${facilityId || 'None'} (Selected: ${selectedFacilityId}, Dock's: ${dockFacilityId})`);
    
    // Set facility ID for pre-selection in the appointment form
    if (facilityId) {
      // Update the facility ID state to ensure it's passed to the form
      setSelectedFacilityId(facilityId);
    } else {
      console.warn("[DoorManager] Warning: No facility ID available for new appointment");
    }
    
    // Default appointment to start now and end in 1 hour
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    end.setHours(end.getHours() + 1);
    
    // Round to nearest 15 minutes
    const roundMinutes = (date: Date) => {
      const minutes = date.getMinutes();
      const roundedMinutes = Math.ceil(minutes / 15) * 15;
      date.setMinutes(roundedMinutes, 0, 0);
      return date;
    };
    
    const roundedStart = roundMinutes(start);
    const roundedEnd = new Date(roundedStart);
    roundedEnd.setHours(roundedEnd.getHours() + 1);
    
    console.log(`[DoorManager] Setting time slot: ${roundedStart.toLocaleTimeString()} - ${roundedEnd.toLocaleTimeString()}`);
    setSelectedTimeSlot({ start: roundedStart, end: roundedEnd });
    
    // Close selector and open appointment form
    console.log("[DoorManager] Closing AppointmentSelector and opening DoorAppointmentForm");
    setShowAppointmentSelector(false);
    setShowAppointmentForm(true);
  };
  
  // Assign an existing appointment to a door
  const handleSelectAppointment = (scheduleId: number) => {
    console.log("[DoorManager] Assigning existing appointment:", scheduleId, "to dock:", selectedDockId);
    if (!selectedDockId) return;
    
    assignAppointmentMutation.mutate({ 
      scheduleId, 
      dockId: selectedDockId 
    }, {
      onSuccess: () => {
        console.log("[DoorManager] Assignment successful");
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
      },
      onError: (error) => {
        console.error("[DoorManager] Assignment failed:", error);
      }
    });
  };
  
  // Handle releasing a door
  const handleReleaseDoor = (scheduleId: number) => {
    setSelectedScheduleId(scheduleId);
    setShowReleaseDoorForm(true);
  };
  
  // Handle QR code viewing
  const handleViewQRCode = (schedule: Schedule) => {
    setSelectedAppointmentForQR(schedule);
    setShowQRCode(true);
  };
  
  // Generate QR code window
  const openQRCodeWindow = (schedule: Schedule) => {
    const confirmationCode = (schedule as any).confirmationCode || `HZL-${schedule.id.toString().padStart(6, '0')}`;
    const baseUrl = window.location.origin;
    
    // QR code should link to appointment details for staff use
    const appointmentDetailsUrl = `${baseUrl}/schedules/${schedule.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(appointmentDetailsUrl)}`;
    
    // Find carrier info
    const carrier = carriers.find(c => c.id === schedule.carrierId);
    
    // Open QR code in a new window for easy access
    const qrWindow = window.open('', '_blank', 'width=450,height=700,scrollbars=yes');
    if (qrWindow) {
      qrWindow.document.write(`
        <html>
          <head><title>Appointment Details - ${confirmationCode}</title></head>
          <body style="text-align: center; font-family: Arial, sans-serif; padding: 20px;">
            <h2>Door Manager - Appointment Details</h2>
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <div style="font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px;">
                ${confirmationCode}
              </div>
              <img src="${qrUrl}" alt="QR Code for ${confirmationCode}" style="border: 1px solid #ccc; border-radius: 8px;" />
              <p style="margin-top: 15px; color: #666; font-size: 14px;">
                Scan to view full appointment details
              </p>
            </div>
            
            <div style="text-align: left; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="margin-top: 0; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Appointment Summary</h3>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                  <p style="margin: 5px 0;"><strong>Customer:</strong> ${schedule.customerName || 'N/A'}</p>
                  <p style="margin: 5px 0;"><strong>Carrier:</strong> ${carrier?.name || 'Unknown'}</p>
                  <p style="margin: 5px 0;"><strong>Truck:</strong> ${schedule.truckNumber || 'N/A'}</p>
                </div>
                <div>
                  <p style="margin: 5px 0;"><strong>Type:</strong> ${schedule.type || 'N/A'}</p>
                  <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #059669;">${schedule.status}</span></p>
                  <p style="margin: 5px 0;"><strong>Started:</strong> ${schedule.actualStartTime ? new Date(schedule.actualStartTime).toLocaleString() : 'Not started'}</p>
                </div>
              </div>
              
              <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>Scheduled:</strong> ${new Date(schedule.startTime).toLocaleString()} - ${new Date(schedule.endTime).toLocaleTimeString()}</p>
                ${schedule.notes ? `<p style="margin: 10px 0 0 0;"><strong>Notes:</strong> ${schedule.notes}</p>` : ''}
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 15px;">
                <p style="font-size: 12px; color: #6b7280; margin: 0;">
                  <strong>QR Code URL:</strong> ${appointmentDetailsUrl}
                </p>
              </div>
            </div>
            
            <div style="margin-top: 20px;">
              <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin-right: 10px; font-weight: 500;">
                Print Details
              </button>
              <button onclick="window.close()" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                Close
              </button>
            </div>
            
            <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
              Use this QR code to quickly access appointment details from any device
            </p>
          </body>
        </html>
      `);
      qrWindow.document.close();
    }
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
    
    console.log("[DoorManager] Initial data refresh completed");
    
    // Schedule several refresh attempts to ensure the UI is fully updated
    let refreshCount = 0;
    const maxRefreshes = 5;
    
    // Force multiple refreshes to ensure UI is updated correctly
    const refreshInterval = setInterval(() => {
      refreshCount++;
      console.log(`[DoorManager] Scheduled refresh #${refreshCount} executing...`);
      
      // Refetch the data
      refetchDocks();
      refetchSchedules();
      
      // Update the timestamp to force a re-render
      setLastUpdated(new Date());
      
      // Clear the interval if we've done enough refreshes
      if (refreshCount >= maxRefreshes) {
        console.log(`[DoorManager] Completed ${refreshCount} scheduled refreshes, clearing interval`);
        clearInterval(refreshInterval);
        
        // Show a success toast after the refreshes are done
        toast({
          title: "Door Released",
          description: "The door has been successfully released and is now available",
        });
      }
    }, 600);
    
    // Only show success toast if the refresh interval is still running after 1 second
    setTimeout(() => {
      if (refreshCount < maxRefreshes) {
        console.log("[DoorManager] Still refreshing data...");
      }
    }, 1000);
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
                onValueChange={(value) => {
                  console.log(`[DoorManager] Changing facility to ID: ${value}`);
                  const facilityId = Number(value);
                  setSelectedFacilityId(facilityId);
                  
                  // Refresh data after facility change
                  setLastUpdated(new Date());
                  
                  // Schedule a refresh to make sure doors are correctly shown
                  setTimeout(() => {
                    console.log("[DoorManager] Performing post-facility-change refresh...");
                    refetchDocks();
                    refetchSchedules();
                    setLastUpdated(new Date());
                  }, 500);
                }}
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
        
        {/* Refresh Button */}
        <div className="flex justify-end mb-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              refetchDocks();
              refetchSchedules();
              setLastUpdated(new Date());
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Refresh Data
          </Button>
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
                    
                    {/* Enhanced appointment details */}
                    <div className="mt-2 space-y-1">
                      {currentSchedule.truckNumber && (
                        <div className="flex items-center text-xs text-gray-600">
                          <span className="font-medium">Truck:</span>
                          <span className="ml-1">{currentSchedule.truckNumber}</span>
                        </div>
                      )}
                      
                      {currentSchedule.notes && (
                        <div className="flex items-start text-xs text-gray-600">
                          <MessageSquare className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{currentSchedule.notes}</span>
                        </div>
                      )}
                      
                      {(currentSchedule as any).bolFileUploaded && (
                        <div className="flex items-center text-xs text-green-600">
                          <FileText className="h-3 w-3 mr-1" />
                          <span>BOL Document</span>
                        </div>
                      )}
                      
                      {/* QR Code Access Button */}
                      <div className="flex items-center space-x-1 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-6 px-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            openQRCodeWindow(currentSchedule);
                          }}
                        >
                          <QrCode className="h-3 w-3 mr-1" />
                          QR Code
                        </Button>
                        
                        {(currentSchedule as any).confirmationCode && (
                          <span className="text-xs text-gray-500 font-mono">
                            {(currentSchedule as any).confirmationCode}
                          </span>
                        )}
                      </div>
                    </div>
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
      
      {/* Release Door Form Dialog */}
      {showReleaseDoorForm && selectedScheduleId && (
        <ReleaseDoorForm
          isOpen={showReleaseDoorForm}
          onClose={handleCloseReleaseDoorForm}
          scheduleId={selectedScheduleId}
          onSuccess={handleDoorReleaseSuccess}
        />
      )}
      
      {/* Door Appointment Form Dialog */}
      {showAppointmentForm && selectedDockId && (
        <DoorAppointmentForm
          isOpen={showAppointmentForm}
          onClose={handleCloseAppointmentForm}
          dockId={selectedDockId}
          initialStartTime={selectedTimeSlot?.start || new Date()}
          initialEndTime={selectedTimeSlot?.end || new Date(Date.now() + 3600000)}
          carriers={carriers}
          schedules={schedules}
          onSuccess={() => {
            // Refresh data and close form
            refetchSchedules();
            refetchDocks();
            setLastUpdated(new Date());
            handleCloseAppointmentForm();
            
            // Show success message
            toast({
              title: "Appointment Created",
              description: "The appointment has been created and assigned to the door",
            });
          }}
        />
      )}
      
      {/* Appointment Selector Dialog */}
      {showAppointmentSelector && selectedDockId && (
        <AppointmentSelector
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
      
      {/* QR Code Dialog */}
      {showQRCode && selectedAppointmentForQR && (
        <Dialog open={showQRCode} onOpenChange={(open) => !open && setShowQRCode(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Appointment QR Code</DialogTitle>
            </DialogHeader>
            <div className="text-center space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Confirmation Code</p>
                <p className="text-lg font-mono">
                  {(selectedAppointmentForQR as any).confirmationCode || 
                   `HZL-${selectedAppointmentForQR.id.toString().padStart(6, '0')}`}
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => openQRCodeWindow(selectedAppointmentForQR)}
                  className="w-full"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  View & Print QR Code
                </Button>
                <p className="text-xs text-gray-500">
                  Opens QR code in new window for printing and sharing
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}