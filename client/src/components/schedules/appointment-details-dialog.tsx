import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Schedule } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Clock, Calendar, Truck, FileText, ChevronsRight, Check, X, RefreshCw, ClipboardList, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";

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
  const [formData, setFormData] = useState<Partial<Schedule>>({});

  // Initialize form data when appointment changes
  useState(() => {
    if (appointment) {
      setFormData(appointment);
    }
  });

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
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}`, data);
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

  if (!appointment) return null;

  const appointmentTitle = `${appointment.carrierName || "Unknown Carrier"} - ${facilityName || "Facility"} Appointment`;
  
  // Determine appointment type badge color
  const getTypeColor = () => {
    return appointment.type === "inbound" ? "text-blue-700 border-blue-200 bg-blue-50" : "text-emerald-700 border-emerald-200 bg-emerald-50";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
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

                    <Button variant="outline" className="bg-slate-50 hover:bg-slate-100 border-slate-200">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reschedule
                    </Button>

                    <Button variant="outline" className="bg-red-50 hover:bg-red-100 border-red-200"
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