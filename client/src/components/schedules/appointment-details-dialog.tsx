import * as React from "react";
import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Schedule } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, Calendar, Truck, FileText, ChevronsRight, Check, X, RefreshCw, 
  ClipboardList, Trash2, Pencil, QrCode, Printer, History, ArrowRight,
  AlertTriangle, Edit, Save, Info
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { 
  getUserTimeZone,
  getTimeZoneAbbreviation,
  formatInUserTimeZone,
  formatInFacilityTimeZone,
  formatDateRangeInTimeZone
} from "@/lib/timezone-utils";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import AppointmentQRCode from "./appointment-qr-code";

interface ExtendedSchedule extends Schedule {
  dockName?: string;
  appointmentTypeName?: string;
  facilityName?: string;
  facilityId?: number;
}

interface AppointmentDetailsDialogProps {
  appointment: ExtendedSchedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityName?: string;
  timezone?: string; // Add timezone prop
}

export function AppointmentDetailsDialog({
  appointment,
  open,
  onOpenChange,
  facilityName,
  timezone
}: AppointmentDetailsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [formData, setFormData] = useState<Partial<Schedule>>({});
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(
    appointment ? new Date(appointment.startTime) : undefined
  );
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [rescheduleDuration, setRescheduleDuration] = useState<number>(60); // Default 1 hour
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  
  // Initialize reschedule data when appointment changes
  useEffect(() => {
    if (appointment) {
      const startDate = new Date(appointment.startTime);
      setRescheduleDate(startDate);
      setRescheduleTime(format(startDate, "HH:mm"));
      
      // Calculate duration in minutes
      const startTime = new Date(appointment.startTime).getTime();
      const endTime = new Date(appointment.endTime).getTime();
      const durationMs = endTime - startTime;
      setRescheduleDuration(durationMs / (1000 * 60)); // Convert ms to minutes
    }
  }, [appointment]);

  // Initialize form data when appointment changes
  useEffect(() => {
    if (appointment) {
      setFormData(appointment);
    }
  }, [appointment]);

  // Create state for the event history
  const [eventHistory, setEventHistory] = useState<Array<{
    id: number;
    timestamp: Date;
    type: string;
    user: number | string;
    changes: string;
  }>>([]);
  
  // Create a side effect to update the event history when the appointment changes
  useEffect(() => {
    if (!appointment) return;
    
    const history = [
      {
        id: 1,
        timestamp: new Date(new Date().getTime() - 24 * 60 * 60 * 1000), // 1 day ago
        type: "creation",
        user: appointment.createdBy || "External User",
        changes: "Appointment created"
      }
    ];
    
    // If the appointment has been rescheduled (we can detect by comparing createdAt with lastModifiedAt)
    if (appointment.lastModifiedAt && appointment.createdAt !== appointment.lastModifiedAt) {
      history.push({
        id: 2,
        timestamp: new Date(appointment.lastModifiedAt),
        type: "reschedule",
        user: appointment.lastModifiedBy || "System",
        changes: "Appointment rescheduled"
      });
    }
    
    // If the appointment has been checked in
    if (appointment.actualStartTime) {
      history.push({
        id: 3,
        timestamp: new Date(appointment.actualStartTime),
        type: "check-in",
        user: appointment.lastModifiedBy || "System",
        changes: "Appointment checked in"
      });
    }
    
    // If the appointment has been checked out
    if (appointment.actualEndTime) {
      history.push({
        id: 4,
        timestamp: new Date(appointment.actualEndTime),
        type: "check-out",
        user: appointment.lastModifiedBy || "System",
        changes: "Appointment checked out"
      });
    }
    
    // Sort history by timestamp (newest first)
    const sortedHistory = [...history].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    setEventHistory(sortedHistory);
  }, [appointment]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Mutation for updating appointment
  const updateAppointmentMutation = useMutation({
    mutationFn: async (data: Partial<Schedule>) => {
      if (!appointment?.id) throw new Error("No appointment ID provided");
      
      // Remove any undefined values but allow empty strings and null values to be saved
      const cleanedData: Partial<Schedule> = Object.entries(data)
        .filter(([_, value]) => value !== undefined)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {} as Partial<Schedule>);
      
      console.log("Updating appointment with data:", cleanedData);
      console.log("Form data at time of submission:", formData);
      
      // Add explicit notes field if it's present in the form data
      if (formData && typeof formData === 'object' && formData !== null && 'notes' in formData) {
        cleanedData.notes = (formData as Partial<Schedule>).notes;
      }
      
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}`, cleanedData);
      const result = await res.json();
      console.log("Update response:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      setIsEditing(false);
      toast({
        title: "Appointment updated",
        description: "The appointment has been successfully updated",
      });
    },
    onError: (error) => {
      console.error("Error updating appointment:", error);
      toast({
        title: "Error updating appointment",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for checking in appointment
  const checkInAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!appointment?.id) throw new Error("No appointment ID provided");
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}/check-in`);
      return res.json();
    },
    onSuccess: (data) => {
      // Immediately update the local state to reflect check-in
      if (appointment) {
        // Update the appointment data with the server response
        Object.assign(appointment, data);
      }
      // Then invalidate the queries to fetch fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Appointment checked in",
        description: "The appointment has been checked in successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error checking in",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation for checking out appointment (completing)
  const checkOutAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!appointment?.id) throw new Error("No appointment ID provided");
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}/check-out`);
      return res.json();
    },
    onSuccess: (data) => {
      // Immediately update the local state to reflect check-out
      if (appointment) {
        // Update the appointment data with the server response
        Object.assign(appointment, data);
      }
      // Then invalidate the queries to fetch fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Appointment completed",
        description: "The appointment has been marked as completed",
      });
    },
    onError: (error) => {
      toast({
        title: "Error completing appointment",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for canceling appointment
  const cancelAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!appointment?.id) throw new Error("No appointment ID provided");
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      onOpenChange(false);
      toast({
        title: "Appointment cancelled",
        description: "The appointment has been cancelled successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error cancelling appointment",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for deleting appointment
  const deleteAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!appointment?.id) throw new Error("No appointment ID provided");
      const res = await apiRequest("DELETE", `/api/schedules/${appointment.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      onOpenChange(false);
      toast({
        title: "Appointment deleted",
        description: "The appointment has been permanently deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting appointment",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation for rescheduling appointment
  const rescheduleAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!appointment?.id) throw new Error("No appointment ID provided");
      if (!rescheduleDate) throw new Error("No date selected");
      
      // Create start and end Date objects
      const [hours, minutes] = rescheduleTime.split(':').map(Number);
      const startTime = new Date(rescheduleDate);
      startTime.setHours(hours, minutes, 0, 0);
      
      // Calculate end time based on duration in minutes
      const endTime = new Date(startTime.getTime());
      endTime.setMinutes(endTime.getMinutes() + rescheduleDuration);
      
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}/reschedule`, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      setIsRescheduling(false);
      toast({
        title: "Appointment rescheduled",
        description: "The appointment has been rescheduled successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error rescheduling appointment",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // If appointment is null (loading state), return an empty div (to prevent errors)
  if (!appointment) return <></>;
  
  const displayFacilityName = facilityName || appointment.facilityName;
  
  // Set the appropriate title for the dialog
  let appointmentTitle = "Appointment Details";
  
  if (appointment.customerName) {
    appointmentTitle = `${appointment.customerName}`;
  } else if (appointment.carrierName) {
    appointmentTitle = `${appointment.carrierName}`;
  }
  
  // Get appropriate badge color based on appointment type
  const getTypeColor = () => {
    if (appointment.type === "inbound") {
      return "bg-blue-50 text-blue-700 border-blue-200";
    } else {
      return "bg-purple-50 text-purple-700 border-purple-200";
    }
  };
  
  // Get the carrier details from the carrier ID
  const carrier = { name: appointment.carrierName || "Unknown Carrier" };
  
  // Get the time remaining until the appointment (in minutes)
  const getTimeRemaining = () => {
    const now = new Date();
    const appointmentTime = new Date(appointment.startTime);
    const timeRemaining = differenceInMinutes(appointmentTime, now);
    return timeRemaining;
  };
  
  // Compute remaining time for imminent appointments
  const timeRemaining = getTimeRemaining();
  const isImminent = timeRemaining >= 0 && timeRemaining <= 30;
  
  return (
    <>
      {/* Reschedule Dialog */}
      <Dialog open={isRescheduling} onOpenChange={(open) => setIsRescheduling(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              Select a new date and time for this appointment.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reschedule-date" className="text-right">
                Date
              </Label>
              <div className="col-span-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-left font-normal"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {rescheduleDate ? format(rescheduleDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={rescheduleDate}
                      onSelect={setRescheduleDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reschedule-time" className="text-right">
                Time
              </Label>
              <Input
                id="reschedule-time"
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reschedule-duration" className="text-right">
                Duration (min)
              </Label>
              <Input
                id="reschedule-duration"
                type="number"
                min={15}
                step={15}
                value={rescheduleDuration}
                onChange={(e) => setRescheduleDuration(Number(e.target.value))}
                className="col-span-3"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsRescheduling(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => rescheduleAppointmentMutation.mutate()}
              disabled={!rescheduleDate || !rescheduleTime || rescheduleAppointmentMutation.isPending}
            >
              {rescheduleAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    
      {/* Main Appointment Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {appointmentTitle}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {/* Display appointment type prominently */}
                {appointment.appointmentTypeId && (
                  <Badge className="bg-primary text-primary-foreground font-medium">
                    {appointment.appointmentTypeName || `Type #${appointment.appointmentTypeId}`}
                  </Badge>
                )}
                <Badge variant="outline" className={getTypeColor()}>
                  {appointment.type === "inbound" ? "Inbound" : "Outbound"}
                </Badge>
                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                  {appointment.status === "scheduled" ? "Scheduled" : 
                  appointment.status === "in-progress" ? "In Progress" : 
                  appointment.status === "completed" ? "Completed" : "Cancelled"}
                </Badge>
                <Badge variant="outline" className={
                  appointment.appointmentMode === "container" 
                    ? "bg-orange-50 text-orange-700 border-orange-200" 
                    : "bg-slate-50 text-slate-700 border-slate-200"
                }>
                  {appointment.appointmentMode === "container" ? "Container" : "Trailer"}
                </Badge>
              </div>
            </DialogTitle>
            <DialogDescription>
              <div className="flex flex-col space-y-1 mt-1">
                <span>{displayFacilityName ? `Facility: ${displayFacilityName}` : ""}</span>
                <span>{appointment.dockId ? `Dock: ${appointment.dockName || "Unknown"}` : "No dock assigned"}</span>
                <span>{appointment.type === "inbound" ? "Inbound" : "Outbound"} appointment</span>
              </div>
            </DialogDescription>
          </DialogHeader>

          {/* Schedule Times */}
          <div className="border-t border-b py-4">
            <h3 className="text-sm font-medium mb-3">
              Schedule Times
              {appointment.status === "completed" && 
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded ml-2">Completed</span>
              }
              {appointment.status === "in-progress" && 
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded ml-2">In Progress</span>
              }
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Scheduled Time:</Label>
                <div className="flex flex-col mt-1">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="font-medium">
                      {appointment && appointment.startTime && appointment.endTime
                        ? formatDateRangeInTimeZone(
                            new Date(appointment.startTime),
                            new Date(appointment.endTime),
                            getUserTimeZone(),
                            'MMM d, yyyy',
                            'h:mm a'
                          )
                        : ""}
                    </span>
                  </div>
                  
                  {/* Show detailed times in both timezones */}
                  <div className="mt-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 mr-1.5 text-muted-foreground" />
                      <span>Your time: </span>
                      <span className="ml-1 font-medium">
                        {appointment && appointment.startTime 
                          ? formatInUserTimeZone(new Date(appointment.startTime), 'MM/dd/yyyy, hh:mm a') 
                          : ""} - {appointment && appointment.endTime 
                          ? formatInUserTimeZone(new Date(appointment.endTime), 'hh:mm a') 
                          : ""}
                      </span>
                    </div>
                    
                    <div className="flex items-center mt-1">
                      <Clock className="h-3 w-3 mr-1.5 text-muted-foreground" />
                      <span>Facility time: </span>
                      <span className="ml-1 font-medium">
                        {appointment && appointment.startTime 
                          ? formatInFacilityTimeZone(
                              new Date(appointment.startTime), 
                              'MM/dd/yyyy, hh:mm a',
                              appointment.facilityId && appointment.facilityTimezone 
                                ? appointment.facilityTimezone 
                                : "America/New_York"
                            )
                          : ""} - {appointment && appointment.endTime 
                          ? formatInFacilityTimeZone(
                              new Date(appointment.endTime), 
                              'hh:mm a',
                              appointment.facilityId && appointment.facilityTimezone 
                                ? appointment.facilityTimezone 
                                : "America/New_York"
                            )
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Time & Timezone Information */}
            <div className="mt-3 pb-2 border-b">
              <Label className="text-xs text-muted-foreground">
                <Clock className="h-3 w-3 inline mr-1" /> Time & Timezone:
              </Label>
              
              {appointment && appointment.startTime && appointment.endTime && (
                <div className="bg-muted/30 rounded-md p-2 mt-1">
                  {/* Display time information with proper timezone handling */}
                  <div className="grid grid-cols-1 gap-1 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Your time:</span>
                      <span>
                        {formatInUserTimeZone(new Date(appointment.startTime), 'h:mm a')} - {formatInUserTimeZone(new Date(appointment.endTime), 'h:mm a')} {getTimeZoneAbbreviation(getUserTimeZone())}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Facility time:</span>
                      <span>
                        {formatInFacilityTimeZone(
                          new Date(appointment.startTime), 
                          'h:mm a',
                          appointment.facilityId && appointment.facilityTimezone 
                            ? appointment.facilityTimezone 
                            : "America/New_York"
                        )} - {formatInFacilityTimeZone(
                          new Date(appointment.endTime), 
                          'h:mm a',
                          appointment.facilityId && appointment.facilityTimezone 
                            ? appointment.facilityTimezone 
                            : "America/New_York"
                        )} {getTimeZoneAbbreviation(appointment.facilityTimezone || "America/New_York")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4">
              <div className="space-y-1 mt-3">
                <Label className="text-xs text-muted-foreground">Pickup or Dropoff:</Label>
                <div className="flex items-center">
                  <ChevronsRight className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{appointment.type === "inbound" ? "Dropoff" : "Pickup"}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Check-in/Check-out History */}
          <div className="border-b py-4">
            <h3 className="text-sm font-medium mb-3">Check-In/Check-Out History</h3>
            
            <div className="rounded-md border bg-slate-50 p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${appointment.actualStartTime ? "bg-emerald-500" : "bg-slate-300"}`}></div>
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold">Check-In Time</h4>
                    {appointment.actualStartTime ? (
                      <>
                        <div className="text-sm font-medium">
                          {format(new Date(appointment.actualStartTime), "MM/dd/yyyy, hh:mm a")}
                        </div>
                        <div className="flex flex-col mt-1">
                          <div className="text-xs">
                            <span className="font-medium">Your time:</span>{" "}
                            {formatInUserTimeZone(new Date(appointment.actualStartTime), 'MM/dd/yyyy hh:mm a')} {getTimeZoneAbbreviation(getUserTimeZone())}
                          </div>
                          <div className="text-xs">
                            <span className="font-medium">Facility time:</span>{" "}
                            {formatInFacilityTimeZone(
                              new Date(appointment.actualStartTime), 
                              'MM/dd/yyyy hh:mm a',
                              appointment.facilityId && appointment.facilityTimezone 
                                ? appointment.facilityTimezone 
                                : "America/New_York"
                            )} {getTimeZoneAbbreviation(appointment.facilityTimezone || "America/New_York")}
                          </div>
                        </div>
                        {appointment.lastModifiedBy && (
                          <p className="text-xs text-muted-foreground mt-1">
                            By: User ID {appointment.lastModifiedBy}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="text-sm">Not checked in yet</div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${appointment.actualEndTime ? "bg-emerald-500" : "bg-slate-300"}`}></div>
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold">Check-Out Time</h4>
                    {appointment.actualEndTime ? (
                      <>
                        <div className="text-sm font-medium">
                          {format(new Date(appointment.actualEndTime), "MM/dd/yyyy, hh:mm a")}
                        </div>
                        <div className="flex flex-col mt-1">
                          <div className="text-xs">
                            <span className="font-medium">Your time:</span>{" "}
                            {formatInUserTimeZone(new Date(appointment.actualEndTime), 'MM/dd/yyyy hh:mm a')} {getTimeZoneAbbreviation(getUserTimeZone())}
                          </div>
                          <div className="text-xs">
                            <span className="font-medium">Facility time:</span>{" "}
                            {formatInFacilityTimeZone(
                              new Date(appointment.actualEndTime), 
                              'MM/dd/yyyy hh:mm a',
                              appointment.facilityId && appointment.facilityTimezone 
                                ? appointment.facilityTimezone 
                                : "America/New_York"
                            )} {getTimeZoneAbbreviation(appointment.facilityTimezone || "America/New_York")}
                          </div>
                        </div>
                        {appointment.lastModifiedBy && (
                          <p className="text-xs text-muted-foreground mt-1">
                            By: User ID {appointment.lastModifiedBy}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="text-sm">Not checked out yet</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Carrier and Driver information */}
          <div className="border-t py-4">
            <h3 className="text-sm font-medium mb-3">Carrier & Driver Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Carrier Name:</Label>
                {isEditing ? (
                  <Input 
                    value={formData.carrierName || ''} 
                    onChange={(e) => handleInputChange('carrierName', e.target.value)}
                    className="h-8"
                  />
                ) : (
                  <div className="font-medium">{carrier?.name || appointment.carrierName || "Unknown Carrier"}</div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">MC Number:</Label>
                {isEditing ? (
                  <Input 
                    value={formData.mcNumber || ''} 
                    onChange={(e) => handleInputChange('mcNumber', e.target.value)}
                    className="h-8"
                  />
                ) : (
                  <div className="font-medium">{appointment.mcNumber || "N/A"}</div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Customer Name:</Label>
                {isEditing ? (
                  <Input 
                    value={formData.customerName || ''} 
                    onChange={(e) => handleInputChange('customerName', e.target.value)}
                    className="h-8"
                  />
                ) : (
                  <div className="font-medium">{appointment.customerName || "N/A"}</div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Driver Name:</Label>
                {isEditing ? (
                  <Input 
                    value={formData.driverName || ''} 
                    onChange={(e) => handleInputChange('driverName', e.target.value)}
                    className="h-8"
                  />
                ) : (
                  <div className="font-medium">{appointment.driverName || "N/A"}</div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Driver Phone:</Label>
                {isEditing ? (
                  <Input 
                    value={formData.driverPhone || ''} 
                    onChange={(e) => handleInputChange('driverPhone', e.target.value)}
                    className="h-8"
                  />
                ) : (
                  <div className="font-medium">{appointment.driverPhone || "N/A"}</div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Truck Number:</Label>
                {isEditing ? (
                  <Input 
                    value={formData.truckNumber || ''} 
                    onChange={(e) => handleInputChange('truckNumber', e.target.value)}
                    className="h-8"
                  />
                ) : (
                  <div className="font-medium">{appointment.truckNumber || "N/A"}</div>
                )}
              </div>
            </div>
          </div>
          
          {/* QR Code for check-in */}
          <div className="border-t border-b py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium flex items-center">
                <QrCode className="h-4 w-4 mr-2 text-primary" />
                Appointment Confirmation Code
              </h3>
              <span className="bg-slate-100 px-3 py-1 rounded-md font-mono font-medium">
                HC{appointment.id.toString().padStart(6, '0')}
              </span>
            </div>
            
            {/* Only show QR code for external appointments (identified by having null createdBy or no carrier name) */}
            {appointment.status === "scheduled" && (!appointment.createdBy || appointment.createdBy === 0) && (
              <div className="flex flex-col items-center">
                <p className="text-sm text-muted-foreground mb-3">
                  External appointment - ensure driver receives this QR code for check-in
                </p>
                <div className="border border-primary border-2 p-3 rounded-md inline-block bg-white shadow-sm">
                  <AppointmentQRCode 
                    schedule={appointment} 
                    confirmationCode={`HC${appointment.id.toString().padStart(6, '0')}`}
                    isExternal={true}
                  />
                </div>
                <div className="mt-4 flex justify-center gap-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-xs flex items-center gap-1"
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        const startTime = new Date(appointment.startTime);
                        // Format the start time in both user timezone and facility timezone
                        const userTimeFormatted = formatInUserTimeZone(startTime, 'MMM dd, yyyy h:mm a');
                        const facilityTimeFormatted = formatInFacilityTimeZone(
                          startTime,
                          'MMM dd, yyyy h:mm a',
                          appointment.facilityId && appointment.facilityTimezone 
                            ? appointment.facilityTimezone 
                            : "America/New_York"
                        );
                        const userTimeZoneAbbr = getTimeZoneAbbreviation(getUserTimeZone());
                        const facilityTimeZoneAbbr = getTimeZoneAbbreviation(
                          appointment.facilityTimezone || "America/New_York"
                        );
                        
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Appointment QR Code - ${appointment.id}</title>
                              <style>
                                body { 
                                  font-family: sans-serif; 
                                  padding: 20px;
                                  text-align: center;
                                }
                                .qr-wrapper {
                                  margin: 20px auto;
                                  width: 200px;
                                }
                                h1 { font-size: 20px; margin-bottom: 5px; }
                                p { margin: 5px 0; }
                                .info { font-size: 14px; color: #666; }
                                .confirmation { 
                                  font-family: monospace; 
                                  font-size: 18px; 
                                  background: #f1f5f9;
                                  padding: 5px 10px;
                                  border-radius: 4px;
                                  margin: 10px 0;
                                  display: inline-block;
                                }
                              </style>
                            </head>
                            <body>
                              <h1>Dock Appointment Check-In</h1>
                              <p class="info">Scan this QR code when you arrive at the facility</p>
                              <div class="qr-wrapper">
                                <img src="${document.querySelector('canvas')?.toDataURL()}" width="200" height="200" />
                              </div>
                              <p><strong>Confirmation Code:</strong></p>
                              <div class="confirmation">HC${appointment.id.toString().padStart(6, '0')}</div>
                              <p class="info">Your Local Time: ${userTimeFormatted} ${userTimeZoneAbbr}</p>
                              <p class="info">Facility Time: ${facilityTimeFormatted} ${facilityTimeZoneAbbr}</p>
                              <p class="info">Carrier: ${appointment.carrierName || "Not specified"}</p>
                              <p class="info">Type: ${appointment.type === "inbound" ? "Inbound" : "Outbound"}</p>
                              <script>
                                window.onload = function() { window.print(); }
                              </script>
                            </body>
                          </html>
                        `);
                      }
                    }}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print QR Code
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          {/* Notes */}
          <div className="border-t py-4">
            <h3 className="text-sm font-medium mb-3">Notes</h3>
            <div className="rounded-md border bg-slate-50 p-3">
              {isEditing ? (
                <textarea 
                  value={formData.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="w-full h-24 p-2 text-sm rounded border border-input"
                  placeholder="Add notes about this appointment..."
                />
              ) : (
                <p className="text-sm whitespace-pre-line">{appointment.notes}</p>
              )}
            </div>
          </div>
          
          {/* History Button */}
          <div className="border-t py-4">
            <Button 
              variant="outline" 
              size="sm"
              className="text-xs flex items-center gap-1"
              onClick={() => setIsHistoryDialogOpen(true)}
            >
              <History className="h-3.5 w-3.5" />
              View Appointment History
            </Button>
            
            {/* Appointment History Dialog */}
            <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Appointment History</DialogTitle>
                  <DialogDescription>
                    View the full history and changes for this appointment.
                  </DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventHistory.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium capitalize">
                            {event.type.replace('-', ' ')}
                          </TableCell>
                          <TableCell>
                            {format(new Date(event.timestamp), "MM/dd/yyyy hh:mm a")}
                          </TableCell>
                          <TableCell>
                            {typeof event.user === 'number' 
                              ? `User #${event.user}` 
                              : event.user}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsHistoryDialogOpen(false)}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          {/* Actions Footer */}
          <DialogFooter className="flex justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              {/* Delete button (only for admin users) */}
              <Button 
                variant="outline" 
                size="sm"
                className="text-xs text-destructive border-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this appointment? This action cannot be undone.')) {
                    deleteAppointmentMutation.mutate();
                  }
                }}
                disabled={deleteAppointmentMutation.isPending}
              >
                {deleteAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Edit or Save button */}
              {isEditing ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs"
                  onClick={() => updateAppointmentMutation.mutate(formData)}
                  disabled={updateAppointmentMutation.isPending}
                >
                  {updateAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Save
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
              )}
              
              {/* Reschedule button (only if not completed or cancelled) */}
              {!["completed", "cancelled"].includes(appointment.status) && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsRescheduling(true)}
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Reschedule
                </Button>
              )}
              
              {/* Status-based action buttons */}
              {appointment.status === "scheduled" && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-xs"
                    onClick={() => cancelAppointmentMutation.mutate()}
                    disabled={cancelAppointmentMutation.isPending}
                  >
                    {cancelAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                    Cancel
                  </Button>
                  
                  <Button 
                    variant="default"
                    size="sm"
                    className="text-xs bg-blue-600 hover:bg-blue-700"
                    onClick={() => checkInAppointmentMutation.mutate()}
                    disabled={checkInAppointmentMutation.isPending}
                  >
                    {checkInAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                    Check In
                  </Button>
                </>
              )}
              
              {appointment.status === "in-progress" && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-xs"
                    onClick={() => cancelAppointmentMutation.mutate()}
                    disabled={cancelAppointmentMutation.isPending}
                  >
                    {cancelAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                    Cancel
                  </Button>
                  
                  <Button 
                    variant="default"
                    size="sm"
                    className="text-xs bg-green-600 hover:bg-green-700"
                    onClick={() => checkOutAppointmentMutation.mutate()}
                    disabled={checkOutAppointmentMutation.isPending}
                  >
                    {checkOutAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                    Check Out
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}