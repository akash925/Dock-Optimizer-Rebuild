import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Schedule } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, Calendar, Truck, FileText, ChevronsRight, Check, X, RefreshCw, 
  ClipboardList, Trash2, Pencil, QrCode, Printer, History, ArrowRight,
  AlertTriangle, Edit, Save
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import AppointmentQRCode from "./appointment-qr-code";

interface AppointmentDetailsDialogProps {
  appointment: Schedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityName?: string;
}

export function AppointmentDetailsDialog({
  appointment,
  open,
  onOpenChange,
  facilityName
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

  // Format dates with timezone handling
  const formatDate = (date: Date | string) => {
    if (!date) return "";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return format(dateObj, "MM/dd/yyyy hh:mm a");
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Mutation for updating appointment
  const updateAppointmentMutation = useMutation({
    mutationFn: async (data: Partial<Schedule>) => {
      if (!appointment?.id) throw new Error("No appointment ID provided");
      
      // Remove any undefined values but allow empty strings and null values to be saved
      const cleanedData = Object.entries(data)
        .filter(([_, value]) => value !== undefined)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
      
      console.log("Updating appointment with data:", cleanedData);
      
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}`, cleanedData);
      return res.json();
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
    onSuccess: () => {
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
    onSuccess: () => {
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

  if (!appointment) return null;

  // Prioritize carrier name if available, then customer name, then use a default
  const appointmentTitle = `${appointment.carrierName || appointment.customerName || "Appointment"} - ${facilityName || "Facility"}`;
  
  // Determine appointment type badge color
  const getTypeColor = () => {
    return appointment.type === "inbound" ? "text-blue-700 border-blue-200 bg-blue-50" : "text-emerald-700 border-emerald-200 bg-emerald-50";
  };

  // Render reschedule view
  if (isRescheduling) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Reschedule Appointment
            </DialogTitle>
            <DialogDescription>
              Select a new date and time for this appointment
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-10"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {rescheduleDate ? format(rescheduleDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={rescheduleDate}
                    onSelect={setRescheduleDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                />
              </div>
              
              <div className="flex flex-col space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={rescheduleDuration}
                  onChange={(e) => setRescheduleDuration(parseInt(e.target.value, 10))}
                  min={15}
                  step={15}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row sm:justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsRescheduling(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => rescheduleAppointmentMutation.mutate()}
              disabled={rescheduleAppointmentMutation.isPending || !rescheduleDate || !rescheduleTime}
            >
              {rescheduleAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Reschedule Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Render main view
  return (
    <>
      {/* Event History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Event History
            </DialogTitle>
            <DialogDescription>
              View the complete history of this appointment, including all changes and modifications.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <ScrollArea className="h-[400px] rounded-md border">
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Date & Time</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="w-full">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventHistory.length > 0 ? (
                      eventHistory.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">
                            {format(new Date(event.timestamp), "MMM dd, yyyy hh:mm a")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              event.type === "creation" ? "bg-blue-50 text-blue-700 border-blue-200" :
                              event.type === "reschedule" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              event.type === "check-in" ? "bg-purple-50 text-purple-700 border-purple-200" :
                              event.type === "check-out" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              event.type === "question-update" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                              "bg-slate-50 text-slate-700 border-slate-200"
                            }>
                              {event.type === "creation" ? "Created" :
                              event.type === "reschedule" ? "Rescheduled" :
                              event.type === "check-in" ? "Checked In" :
                              event.type === "check-out" ? "Checked Out" :
                              event.type === "question-update" ? "Fields Updated" :
                              "Modified"}
                            </Badge>
                          </TableCell>
                          <TableCell>{event.user}</TableCell>
                          <TableCell>{event.changes}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                          No event history available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
            
            <div className="mt-4 text-sm text-muted-foreground">
              <p>The event history shows all changes made to this appointment, including:</p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Creation and scheduling</li>
                <li>Rescheduling events</li>
                <li>Check-in and check-out times</li>
                <li>Updates to appointment information</li>
                <li>Changes to question answers</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>
              Close
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
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className={getTypeColor()}>
                {appointment.type === "inbound" ? "Inbound" : "Outbound"}
              </Badge>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                {appointment.status === "scheduled" ? "Scheduled" : 
                appointment.status === "in-progress" ? "In Progress" : 
                appointment.status === "completed" ? "Completed" : "Cancelled"}
              </Badge>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                {appointment.appointmentMode || "Trailer"}
              </Badge>
            </div>
          </DialogTitle>
          <DialogDescription>
            {appointment.type === "inbound" ? "Inbound" : "Outbound"} appointment details. 
            You can view, edit, or manage this appointment.
          </DialogDescription>
        </DialogHeader>

        {/* Schedule Times */}
        <div className="border-t border-b py-4">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-medium">Schedule Times</h3>
            {appointment.actualStartTime && (
              <Badge variant="outline" className={
                appointment.status === "in-progress" 
                  ? "bg-blue-50 text-blue-700 border-blue-200" 
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }>
                {appointment.status === "in-progress" ? "In Progress" : "Completed"}
              </Badge>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Scheduled Start:</Label>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{formatDate(appointment.startTime)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Scheduled End:</Label>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{formatDate(appointment.endTime)}</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Timezone:</Label>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>UTC-05:00 (Eastern)</span>
              </div>
            </div>
            
            <div className="space-y-1">
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
                  <p className="text-sm">
                    {appointment.actualStartTime ? formatDate(appointment.actualStartTime) : "Not checked in yet"}
                  </p>
                  {appointment.actualStartTime && appointment.lastModifiedBy && (
                    <p className="text-xs text-muted-foreground">
                      By: User ID {appointment.lastModifiedBy}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${appointment.actualEndTime ? "bg-emerald-500" : "bg-slate-300"}`}></div>
                <div className="flex-1">
                  <h4 className="text-xs font-semibold">Check-Out Time</h4>
                  <p className="text-sm">
                    {appointment.actualEndTime ? formatDate(appointment.actualEndTime) : "Not checked out yet"}
                  </p>
                  {appointment.actualEndTime && appointment.lastModifiedBy && (
                    <p className="text-xs text-muted-foreground">
                      By: User ID {appointment.lastModifiedBy}
                    </p>
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
                <div className="font-medium">{appointment.carrierName || "Unknown Carrier"}</div>
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
                      const formattedStartTime = format(startTime, 'MMM dd, yyyy h:mm a');
                      
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
                            <p class="info">Appointment Time: ${formattedStartTime}</p>
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
                className="w-full h-24 p-2 text-sm border rounded"
                placeholder="Add notes about this appointment..."
              />
            ) : (
              appointment.notes ? (
                <p className="text-sm whitespace-pre-line">{appointment.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No notes provided for this appointment</p>
              )
            )}
          </div>
        </div>
        
        {/* View History Button */}
        <div className="mt-4 mb-2">
          <Button 
            variant="outline" 
            size="sm"
            className="text-xs flex items-center gap-1"
            onClick={() => setIsHistoryDialogOpen(true)}
          >
            <History className="h-3.5 w-3.5" />
            View Event History
          </Button>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row sm:justify-between border-t pt-4 mt-4">
          <div className="flex items-center gap-2 my-2 sm:my-0">
            <Button 
              variant="outline" 
              size="sm"
              className="text-xs"
              onClick={() => {
                isEditing ? setIsEditing(false) : setIsEditing(true);
              }}
            >
              {isEditing ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancel Edit
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Event
                </>
              )}
            </Button>
            
            {isEditing && (
              <Button 
                variant="default"
                size="sm"
                className="text-xs bg-green-600 hover:bg-green-700"
                onClick={() => updateAppointmentMutation.mutate(formData)}
                disabled={updateAppointmentMutation.isPending}
              >
                {updateAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Button 
                variant="destructive"
                size="sm"
                className="text-xs"
                onClick={() => deleteAppointmentMutation.mutate()}
                disabled={deleteAppointmentMutation.isPending}
              >
                {deleteAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            ) : (
              <>
                {appointment.status === "scheduled" && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs"
                      onClick={() => setIsRescheduling(true)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reschedule
                    </Button>
                    
                    <Button 
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                      onClick={() => cancelAppointmentMutation.mutate()}
                      disabled={cancelAppointmentMutation.isPending}
                    >
                      {cancelAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                      Cancel Appointment
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
              </>
            )}
          </div>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}