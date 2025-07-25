import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isPast, isFuture, addHours } from "date-fns";
import { PlusCircle, Calendar, Clock, Truck, User, Filter, Scan } from "lucide-react";
import { Schedule, Facility } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AppointmentScanner } from "@/components/shared/appointment-scanner";

interface AppointmentSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dockId: number;
  facilityId: number | null;
  onSelect: (scheduleId: number) => void;
  onCreateNew: () => void;
  onFacilityChange?: (facilityId: number) => void;
}

export default function AppointmentSelectorDialog({
  isOpen,
  onClose,
  dockId,
  facilityId,
  onSelect,
  onCreateNew,
  onFacilityChange,
}: AppointmentSelectorDialogProps) {
  const [tab, setTab] = useState<"upcoming" | "all">("upcoming");
  const [filtered, setFiltered] = useState<Schedule[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(facilityId);
  
  // Fetch schedules
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
  });
  
  // Fetch facilities
  const { data: facilities = [], isLoading: facilitiesLoading } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });
  
  // Set the facility filter to the door's facility when component mounts or when facilityId changes
  useEffect(() => {
    if (facilityId) {
      setSelectedFacilityId(facilityId);
    }
  }, [facilityId]);
  
  const isLoading = schedulesLoading || facilitiesLoading;
  
  // Get the facility name
  const getFacilityName = (facilityId: number | null) => {
    if (!facilityId) return "All Facilities";
    const facility = facilities.find((f: any) => f.id === facilityId);
    return facility ? facility.name : "Unknown Facility";
  };
  
  useEffect(() => {
    if (schedules.length > 0) {
      let filtered = schedules.filter((schedule: any) => {
        // Only include scheduled or pending appointments
        const statusOk = (schedule.status === "scheduled" || schedule.status === "pending");
        
        // Don't include appointments already assigned to docks
        const notAssigned = !schedule.dockId;
        
        // Filter by facility if selected
        const facilityMatches = !selectedFacilityId || schedule.facilityId === selectedFacilityId;
        
        return statusOk && notAssigned && facilityMatches;
      });
      
      // For "upcoming" tab, only show future appointments
      if (tab === "upcoming") {
        filtered = filtered.filter((schedule: any) => isFuture(new Date(schedule.startTime))
        );
      }
      
      // Sort by startTime (soonest first)
      filtered.sort((a: any, b: any) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      
      setFiltered(filtered);
    }
  }, [schedules, tab, selectedFacilityId]);
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Scheduled</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  // Handle QR code scan results
  const handleQRScan = (scheduleId: number) => {
    console.log(`[AppointmentSelector] QR scan detected appointment ${scheduleId}`);
    
    // Find the appointment in our filtered list
    const scannedAppointment = schedules.find((s: any) => s.id === scheduleId);
    
    if (scannedAppointment) {
      // Check if this appointment is available for assignment
      const isAvailable = !scannedAppointment.dockId && 
                         (scannedAppointment.status === "scheduled" || scannedAppointment.status === "pending");
      
      if (isAvailable) {
        console.log(`[AppointmentSelector] Auto-assigning scanned appointment ${scheduleId} to dock ${dockId}`);
        onSelect(scheduleId);
      } else {
        console.warn(`[AppointmentSelector] Scanned appointment ${scheduleId} is not available for assignment`);
        // Could show a toast here if needed
      }
    } else {
      console.warn(`[AppointmentSelector] Scanned appointment ${scheduleId} not found in available appointments`);
      // Could show a toast here if needed
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open: any) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] w-[95vw] max-w-[95vw] sm:w-auto max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select or Create Appointment</DialogTitle>
          <DialogDescription>
            Assign an existing appointment to this door or create a new one
          </DialogDescription>
        </DialogHeader>
        
        {/* Header Actions - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b pb-4 space-y-3 sm:space-y-0">
          {/* Facility Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="facility-filter" className="text-sm font-medium">Filter by Facility</Label>
            </div>
            <Select 
              value={selectedFacilityId?.toString() || "0"} 
              onValueChange={(value: any) => {
                // If value is "0", it means "All Facilities" (null)
                const newFacilityId = value === "0" ? null : parseInt(value);
                setSelectedFacilityId(newFacilityId);
                // Pass the facility change up to the parent component if provided
                if (onFacilityChange && newFacilityId) {
                  onFacilityChange(newFacilityId);
                }
              }}
            >
              <SelectTrigger id="facility-filter" className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select a facility">
                  {getFacilityName(selectedFacilityId)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All Facilities</SelectItem>
                {facilities.map((facility: any) => <SelectItem key={facility.id} value={facility.id.toString()}>
                  {facility.name}
                </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          {/* QR Scanner - Mobile optimized */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <AppointmentScanner
              onScanComplete={handleQRScan}
              variant="outline"
              size="sm"
              buttonText="Scan QR Code"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="upcoming" className="w-full h-full flex flex-col" onValueChange={(value: any) => setTab(value as "upcoming" | "all")}>
            <TabsList className="grid w-full grid-cols-2 mb-2 flex-shrink-0">
              <TabsTrigger value="upcoming">Upcoming Appointments</TabsTrigger>
              <TabsTrigger value="all">All Unassigned</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upcoming" className="mt-4 flex-1 overflow-hidden">
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
                </div>
              ) : (
                <ScrollArea className="h-[50vh] sm:h-[400px] pr-4">
                  {filtered.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No upcoming appointments found</p>
                      <p className="text-sm mt-2">Try adjusting your facility filter or create a new appointment</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filtered.map((schedule) => (
                        <div 
                          key={schedule.id} 
                          className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => onSelect(schedule.id)}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium truncate">{schedule.customerName || 'Unknown Customer'}</span>
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {schedule.status}
                                </Badge>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span className="truncate">{format(new Date(schedule.startTime), 'MMM dd, HH:mm')}</span>
                                </div>
                                {schedule.carrierName && (
                                  <div className="flex items-center gap-1">
                                    <Truck className="h-3 w-3" />
                                    <span className="truncate">{schedule.carrierName}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <Button
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelect(schedule.id);
                              }}
                              className="w-full sm:w-auto mt-2 sm:mt-0"
                            >
                              Assign to Door
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}
            </TabsContent>
            
            <TabsContent value="all" className="mt-4 flex-1 overflow-hidden">
              <ScrollArea className="h-[50vh] sm:h-[400px] pr-4">
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>All unassigned appointments</p>
                  <p className="text-sm mt-2">This view will show all unassigned appointments across all time periods</p>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={onCreateNew} className="w-full sm:w-auto">
              <PlusCircle className="h-4 w-4 mr-2" />
              Create New Appointment
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}