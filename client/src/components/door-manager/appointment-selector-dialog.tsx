import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isPast, isFuture, addHours } from "date-fns";
import { PlusCircle, Calendar, Clock, Truck, User, Filter } from "lucide-react";
import { Schedule, Facility } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
    const facility = facilities.find(f => f.id === facilityId);
    return facility ? facility.name : "Unknown Facility";
  };
  
  useEffect(() => {
    if (schedules.length > 0) {
      let filtered = schedules.filter(schedule => {
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
        filtered = filtered.filter(schedule => 
          isFuture(new Date(schedule.startTime))
        );
      }
      
      // Sort by startTime (soonest first)
      filtered.sort((a, b) => 
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
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Select or Create Appointment</DialogTitle>
          <DialogDescription>
            Assign an existing appointment to this door or create a new one
          </DialogDescription>
        </DialogHeader>
        
        {/* Facility Filter */}
        <div className="mb-4 border-b pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="facility-filter" className="text-sm font-medium">Filter by Facility</Label>
          </div>
          <Select 
            value={selectedFacilityId?.toString() || ""} 
            onValueChange={(value) => {
              const newFacilityId = value ? parseInt(value) : null;
              setSelectedFacilityId(newFacilityId);
              // Pass the facility change up to the parent component if provided
              if (onFacilityChange && newFacilityId) {
                onFacilityChange(newFacilityId);
              }
            }}
          >
            <SelectTrigger id="facility-filter" className="w-full">
              <SelectValue placeholder="Select a facility">
                {getFacilityName(selectedFacilityId)}
              </SelectValue>
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
        
        <Tabs defaultValue="upcoming" className="w-full" onValueChange={(value) => setTab(value as "upcoming" | "all")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming">Upcoming Appointments</TabsTrigger>
            <TabsTrigger value="all">All Unassigned</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upcoming" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
              </div>
            ) : filtered.length > 0 ? (
              <ScrollArea className="h-[350px]">
                <div className="space-y-3">
                  {filtered.map((schedule) => (
                    <div 
                      key={schedule.id} 
                      className="p-3 border rounded-lg hover:border-primary cursor-pointer transition-colors"
                      onClick={() => onSelect(schedule.id)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium truncate">{schedule.customerName || "Unknown Customer"}</div>
                        {getStatusBadge(schedule.status)}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center">
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        {format(new Date(schedule.startTime), "MMM d, yyyy")}
                        <span className="mx-1">•</span>
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        {format(new Date(schedule.startTime), "h:mm a")} - {format(new Date(schedule.endTime), "h:mm a")}
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground flex items-center">
                        <Truck className="h-3.5 w-3.5 mr-1.5" />
                        {schedule.truckNumber || "No truck"}{schedule.trailerNumber ? ` / ${schedule.trailerNumber}` : ""}
                      </div>
                      {schedule.type && (
                        <div className="mt-1 text-xs">
                          <Badge variant="outline" className="font-normal">
                            {schedule.type.charAt(0).toUpperCase() + schedule.type.slice(1)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center p-8 border rounded-md bg-muted/20">
                <p className="text-muted-foreground">No upcoming unassigned appointments</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="all" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
              </div>
            ) : filtered.length > 0 ? (
              <ScrollArea className="h-[350px]">
                <div className="space-y-3">
                  {filtered.map((schedule) => (
                    <div 
                      key={schedule.id} 
                      className="p-3 border rounded-lg hover:border-primary cursor-pointer transition-colors"
                      onClick={() => onSelect(schedule.id)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium truncate">{schedule.customerName || "Unknown Customer"}</div>
                        {getStatusBadge(schedule.status)}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center">
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        {format(new Date(schedule.startTime), "MMM d, yyyy")}
                        <span className="mx-1">•</span>
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        {format(new Date(schedule.startTime), "h:mm a")} - {format(new Date(schedule.endTime), "h:mm a")}
                      </div>
                      <div className="mt-1.5 text-sm text-muted-foreground flex items-center">
                        <Truck className="h-3.5 w-3.5 mr-1.5" />
                        {schedule.truckNumber || "No truck"}{schedule.trailerNumber ? ` / ${schedule.trailerNumber}` : ""}
                      </div>
                      {schedule.type && (
                        <div className="mt-1 text-xs">
                          <Badge variant="outline" className="font-normal">
                            {schedule.type.charAt(0).toUpperCase() + schedule.type.slice(1)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center p-8 border rounded-md bg-muted/20">
                <p className="text-muted-foreground">No unassigned appointments available</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        <div className="mt-4 pt-4 border-t">
          <Button
            variant="default"
            className="w-full flex items-center justify-center gap-2"
            onClick={() => {
              // Pass the selectedFacilityId back to the parent component before creating new
              if (selectedFacilityId !== facilityId && selectedFacilityId) {
                // Update the facility ID in the parent component if it changed
                if (onFacilityChange) {
                  onFacilityChange(selectedFacilityId);
                }
                onCreateNew();
              } else {
                // If facility ID is unchanged, just create a new appointment
                onCreateNew();
              }
            }}
          >
            <PlusCircle className="h-4 w-4" />
            Create New Appointment {selectedFacilityId ? 
              `at ${getFacilityName(selectedFacilityId)}` : ''}
          </Button>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}