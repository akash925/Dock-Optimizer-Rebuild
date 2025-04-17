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
import { Clock, Calendar, Truck, FileText, ChevronsRight, Check, X, RefreshCw, ClipboardList, Trash2, Pencil, QrCode, Printer } from "lucide-react";
import { format } from "date-fns";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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

  // Render default view
  return (
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

        <div className="border-t border-b py-4 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Event Start Time:</Label>
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{formatDate(appointment.startTime)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Event End Time:</Label>
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{formatDate(appointment.endTime)}</span>
            </div>
          </div>
          
          {appointment.status === "in-progress" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Actual Start Time:</Label>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{appointment.actualStartTime ? formatDate(appointment.actualStartTime) : "Not started"}</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Actual End Time:</Label>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{appointment.actualEndTime ? formatDate(appointment.actualEndTime) : "Not completed"}</span>
                </div>
              </div>
            </>
          )}
          
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

        {/* Carrier and Driver information */}
        <div className="border-t py-4">
          <h3 className="text-sm font-medium mb-3">Carrier & Driver Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Carrier Name:</Label>
              <div className="font-medium">{appointment.carrierName || "Unknown Carrier"}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">MC Number:</Label>
              <div className="font-medium">{appointment.mcNumber || "N/A"}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Customer Name:</Label>
              <div className="font-medium">{appointment.customerName || "N/A"}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Driver Name:</Label>
              <div className="font-medium">{appointment.driverName || "N/A"}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Driver Phone:</Label>
              <div className="font-medium">{appointment.driverPhone || "N/A"}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Truck Number:</Label>
              <div className="font-medium">{appointment.truckNumber || "N/A"}</div>
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
                      
                      // Generate printable QR code page
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Appointment QR Code</title>
                            <style>
                              body { font-family: Arial; text-align: center; padding: 20px; }
                              h1 { font-size: 22px; margin-bottom: 5px; }
                              .code { font-size: 28px; font-weight: bold; margin: 15px 0; letter-spacing: 1px; }
                              .details { margin: 20px 0; }
                            </style>
                          </head>
                          <body>
                            <h1>Dock Appointment Check-In</h1>
                            <div>
                              ${document.getElementById('appointment-qr-code')?.innerHTML || ''}
                            </div>
                            <div class="code">HC${appointment.id.toString().padStart(6, '0')}</div>
                            <div class="details">
                              <p><b>Date:</b> ${formattedStartTime}</p>
                              <p><b>Type:</b> ${appointment.type === "inbound" ? "Inbound" : "Outbound"}</p>
                              <p><b>Location:</b> ${facilityName || "Warehouse"}</p>
                            </div>
                            <button onclick="window.print(); window.close();">Print</button>
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

        <div className="py-2">
          <h3 className="text-sm font-medium mb-3">Question Answers:</h3>
          
          <div className="grid grid-cols-2 gap-y-4 gap-x-6">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Customer Name:</Label>
              {isEditing ? (
                <Input 
                  value={formData.customerName || ''} 
                  onChange={(e) => handleInputChange('customerName', e.target.value)} 
                />
              ) : (
                <div>{appointment.customerName || "N/A"}</div>
              )}
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Carrier Name:</Label>
              {isEditing ? (
                <Input 
                  value={formData.carrierName || ''} 
                  onChange={(e) => handleInputChange('carrierName', e.target.value)} 
                />
              ) : (
                <div>{appointment.carrierName || "N/A"}</div>
              )}
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Carrier MC #:</Label>
              {isEditing ? (
                <Input 
                  value={formData.mcNumber || ''} 
                  onChange={(e) => handleInputChange('mcNumber', e.target.value)} 
                />
              ) : (
                <div>{appointment.mcNumber || "N/A"}</div>
              )}
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Driver/Dispatcher Email:</Label>
              {isEditing ? (
                <Input 
                  value={formData.driverEmail || ''} 
                  onChange={(e) => handleInputChange('driverEmail', e.target.value)} 
                />
              ) : (
                <div>{appointment.driverEmail || "N/A"}</div>
              )}
            </div>
            
            <div className="space-y-1 bg-slate-100 p-2 rounded">
              <Label className="text-xs text-muted-foreground">BOL Number:</Label>
              {isEditing ? (
                <Input 
                  value={formData.bolNumber || ''} 
                  onChange={(e) => handleInputChange('bolNumber', e.target.value)} 
                />
              ) : (
                <div className="font-medium">{appointment.bolNumber || "N/A"}</div>
              )}
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Truck Number:</Label>
              {isEditing ? (
                <Input 
                  value={formData.truckNumber || ''} 
                  onChange={(e) => handleInputChange('truckNumber', e.target.value)} 
                />
              ) : (
                <div>{appointment.truckNumber || "N/A"}</div>
              )}
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Trailer Number:</Label>
              {isEditing ? (
                <Input 
                  value={formData.trailerNumber || ''} 
                  onChange={(e) => handleInputChange('trailerNumber', e.target.value)} 
                />
              ) : (
                <div>{appointment.trailerNumber || "N/A"}</div>
              )}
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Driver Name:</Label>
              {isEditing ? (
                <Input 
                  value={formData.driverName || ''} 
                  onChange={(e) => handleInputChange('driverName', e.target.value)} 
                />
              ) : (
                <div>{appointment.driverName || "N/A"}</div>
              )}
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Driver Phone:</Label>
              {isEditing ? (
                <Input 
                  value={formData.driverPhone || ''} 
                  onChange={(e) => handleInputChange('driverPhone', e.target.value)} 
                />
              ) : (
                <div>{appointment.driverPhone || "N/A"}</div>
              )}
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">PO Number:</Label>
              {isEditing ? (
                <Input 
                  value={formData.poNumber || ''} 
                  onChange={(e) => handleInputChange('poNumber', e.target.value)} 
                />
              ) : (
                <div>{appointment.poNumber || "N/A"}</div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap gap-2 justify-start sm:justify-between">
          <div className="space-x-2">
            <Button 
              variant="outline" 
              className="bg-green-50 hover:bg-green-100 border-green-200"
              onClick={() => setIsEditing(!isEditing)}
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
            
            <Button 
              variant="outline"
              className="bg-slate-50 hover:bg-slate-100 border-slate-200"
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              View Event History
            </Button>
          </div>

          <div className="space-x-2">
            {isEditing ? (
              <Button 
                variant="default" 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => updateAppointmentMutation.mutate(formData)}
                disabled={updateAppointmentMutation.isPending}
              >
                {updateAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            ) : (
              <>
                {appointment.status === "scheduled" && (
                  <>
                    <Button 
                      variant="outline" 
                      className="bg-red-50 hover:bg-red-100 border-red-200"
                      onClick={() => cancelAppointmentMutation.mutate()}
                      disabled={cancelAppointmentMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel Event
                    </Button>

                    <Button 
                      variant="outline" 
                      className="bg-slate-50 hover:bg-slate-100 border-slate-200"
                      onClick={() => setIsRescheduling(true)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reschedule
                    </Button>

                    <Button 
                      variant="outline" 
                      className="bg-red-50 hover:bg-red-100 border-red-200"
                      onClick={() => deleteAppointmentMutation.mutate()}
                      disabled={deleteAppointmentMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>

                    <Button 
                      variant="default" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => checkInAppointmentMutation.mutate()}
                      disabled={checkInAppointmentMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Check-In
                    </Button>
                  </>
                )}
                
                {appointment.status === "in-progress" && (
                  <>
                    <Button 
                      variant="outline" 
                      className="bg-red-50 hover:bg-red-100 border-red-200"
                      onClick={() => cancelAppointmentMutation.mutate()}
                      disabled={cancelAppointmentMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel Event
                    </Button>
                    
                    <Button 
                      variant="default" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => checkOutAppointmentMutation.mutate()}
                      disabled={checkOutAppointmentMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Check-Out
                    </Button>
                  </>
                )}

                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}