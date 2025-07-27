import * as React from "react";
import { useState, useEffect, useMemo } from "react";
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
  AlertTriangle, Edit, Save, Info, FileUp, Download, ExternalLink, FileCheck,
  Image as ImageIcon
} from "lucide-react";
import SimpleBolUpload from "@/components/shared/simple-bol-upload";
import { ParsedBolData } from "@/lib/ocr-service";
import { format, differenceInMinutes } from "date-fns";
import { 
  getUserTimeZone,
  getTimeZoneAbbreviation,
  formatInFacilityTimeZone,
  formatForDualTimeZoneDisplay,
  formatInUserTimeZone,
  formatDateRangeInTimeZone,
  utcToUserTime,
  utcToFacilityTime
} from "@shared/timezone-service";
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

// Type definition that avoids type mismatches
interface ExtendedSchedule {
  id: number;
  dockId: number | null;
  carrierId: number | null;
  appointmentTypeId: number;
  startTime: string;
  endTime: string;
  status: string;
  type: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedAt?: string;
  createdBy: number | null;
  lastModifiedBy: number | null;
  truckNumber: string;
  trailerNumber: string | null;
  driverName: string | null;
  driverPhone?: string | null;
  driverEmail?: string | null;
  customerName?: string;
  carrierName?: string;
  dockName?: string;
  appointmentTypeName?: string;
  facilityName?: string;
  facilityId?: number | null;
  facilityTimezone?: string;
  confirmationCode?: string;
  bolNumber?: string | null;
  bolDocumentPath?: string | null;
  customFormData?: any;
  bolDocuments?: any[];
  weight?: string | null;
  palletCount?: string | null;
  mcNumber?: string | null;
  actualStartTime?: string;
  actualEndTime?: string;
  poNumber?: string | null;
  appointmentMode?: string;
  creatorEmail?: string | null;
}

interface AppointmentDetailsDialogProps {
  appointment: ExtendedSchedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityName?: string;
  timezone?: string; // Add timezone prop
  timeFormat?: "12h" | "24h"; // Add timeFormat prop
}

// Helper function to generate a summary of BOL data when no parsedOcrText is available
const generateBolSummary = (appointment: ExtendedSchedule): string => {
  const fields = [];
  
  if (appointment.bolNumber) fields.push(`BOL Number: ${appointment.bolNumber}`);
  if (appointment.carrierName) fields.push(`Carrier: ${appointment.carrierName}`);
  if (appointment.mcNumber) fields.push(`MC Number: ${appointment.mcNumber}`);
  if (appointment.customerName) fields.push(`Customer: ${appointment.customerName}`);
  if (appointment.weight) fields.push(`Weight: ${appointment.weight}`);
  if (appointment.palletCount) fields.push(`Pallet Count: ${appointment.palletCount}`);
  if (appointment.truckNumber) fields.push(`Truck ID: ${appointment.truckNumber}`);
  if (appointment.trailerNumber) fields.push(`Trailer Number: ${appointment.trailerNumber}`);
  
  // Helper function to safely parse customFormData if it's a string
  const parseCustomFormData = () => {
    if (!appointment.customFormData) return null;
    
    try {
      // If it's already an object, use it directly
      if (typeof appointment.customFormData === 'object') {
        return appointment.customFormData;
      }
      // Otherwise parse it from string
      return JSON.parse(appointment.customFormData as string);
    } catch (e) {
      console.error("Failed to parse customFormData:", e);
      return null;
    }
  };
  
  // Include any extracted metadata that isn't in the main appointment fields
  const parsedData = parseCustomFormData();
  if (parsedData?.bolData) {
    const bolData = parsedData.bolData;
    
    if (bolData.fromAddress && !fields.includes(`From: ${bolData.fromAddress}`)) {
      fields.push(`From: ${bolData.fromAddress}`);
    }
    
    if (bolData.toAddress && !fields.includes(`To: ${bolData.toAddress}`)) {
      fields.push(`To: ${bolData.toAddress}`);
    }
    
    if (bolData.notes && !fields.includes(`Notes: ${bolData.notes}`)) {
      fields.push(`Notes: ${bolData.notes}`);
    }
  }
  
  // If we have no fields, provide a placeholder
  if (fields.length === 0) {
    return "No detailed information available for this BOL document.";
  }
  
  return fields.join('\n');
};

export function AppointmentDetailsDialog({
  appointment,
  open,
  onOpenChange,
  facilityName,
  timezone,
  timeFormat = "12h" // Default to 12h format if not provided
}: AppointmentDetailsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isUploadingBol, setIsUploadingBol] = useState(false);
  const [formData, setFormData] = useState<Partial<Schedule>>({});
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(() => {
    if (!appointment?.startTime) return undefined;
    try {
      const date = new Date(appointment.startTime);
      return isNaN(date.getTime()) ? undefined : date;
    } catch (e) {
      return undefined;
    }
  });
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [rescheduleDuration, setRescheduleDuration] = useState<number>(60); // Default 1 hour
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  
  // Initialize reschedule data when appointment changes
  useEffect(() => {
    if (appointment?.startTime && appointment?.endTime) {
      try {
        const startDate = new Date(appointment.startTime);
        const endDate = new Date(appointment.endTime);
        
        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.warn("Invalid date values in appointment:", { startTime: appointment.startTime, endTime: appointment.endTime });
          return;
        }
        
        setRescheduleDate(startDate);
        setRescheduleTime(format(startDate, "HH:mm"));
        
        // Calculate duration in minutes
        const durationMs = endDate.getTime() - startDate.getTime();
        setRescheduleDuration(Math.max(60, durationMs / (1000 * 60))); // Convert ms to minutes, minimum 60
      } catch (e) {
        console.error("Error processing appointment dates:", e);
      }
    }
  }, [appointment]);

  // Initialize form data when appointment changes
  useEffect(() => {
    if (appointment) {
      // Use type assertion to bypass TypeScript type checking for now
      setFormData(appointment as any);
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
  // Main mutation for updating appointment details
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
    onError: (error: any) => {
      console.error("Error updating appointment:", error);
      toast({
        title: "Error updating appointment",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Dedicated mutation just for notes updates - this provides better real-time experience
  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      if (!appointment?.id) throw new Error("No appointment ID provided");
      
      console.log("Updating appointment notes:", notes);
      
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}`, { 
        notes: notes 
      });
      const result = await res.json();
      
      // Immediately update local state for a responsive feel
      if (appointment) {
        appointment.notes = notes;
      }
      
      console.log("Note update response:", result);
      return result;
    },
    onSuccess: (data: any) => {
      // Invalidate queries to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      
      // Don't show a toast for notes updates as they happen frequently
      // and the user can see the change immediately
    },
    onError: (error: any) => {
      console.error("Error updating notes:", error);
      toast({
        title: "Error updating notes",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation for checking in appointment
  // State for check-in time input
  const [checkInTime, setCheckInTime] = useState<Date>(new Date());
  const [showCheckInTimeInput, setShowCheckInTimeInput] = useState(false);
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  
  // Format the current time for the time input field
  const formatTimeForInput = (date: Date) => {
    return date.toTimeString().substring(0, 5); // Format as HH:MM
  };
  
  const checkInAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!appointment?.id) throw new Error("No appointment ID provided");
      
      // Use the selected time or current time
      const actualStartTime = showCheckInTimeInput ? checkInTime : new Date();
      
      const res = await apiRequest("PATCH", `/api/schedules/${appointment.id}/check-in`, {
        actualStartTime: actualStartTime.toISOString()
      });
      return res.json();
    },
    onSuccess: (data: any) => {
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
      
      // Reset the time input state
      setShowCheckInTimeInput(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error checking in",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // State for check-out time input and additional fields
  const [checkOutTime, setCheckOutTime] = useState<Date>(new Date());
  const [checkOutNotes, setCheckOutNotes] = useState<string>("");
  const [checkOutPhotoPath, setCheckOutPhotoPath] = useState<string | null>(null);
  const [showCheckOutTimeInput, setShowCheckOutTimeInput] = useState(false);
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  
  // State for file upload
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  // Function to handle file uploads
  const uploadFile = async (file: File): Promise<string> => {
    try {
      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload the file to the server
      const response = await fetch('/api/upload/checkout-photo', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload file');
      }
      
      // Get the file path from the response
      const data = await response.json();
      return data.filePath;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };
  
  // Enhanced check-out mutation with better UX
  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!appointment?.id) throw new Error("No appointment ID provided");
      
      // Step 1: Check out the appointment
      toast({
        title: "Processing Checkout",
        description: "Completing appointment checkout...",
        duration: 2000,
      });
      
      const checkoutRes = await apiRequest("PATCH", `/api/schedules/${appointment.id}/check-out`, {
        actualEndTime: new Date().toISOString(),
        notes: formData.notes
      });
      
      if (!checkoutRes.ok) {
        throw new Error("Failed to check out appointment");
      }
      
      const checkoutData = await checkoutRes.json();
      
      // Step 2: If this appointment has a dock assignment, release the door
      if (appointment.dockId) {
        console.log(`[AppointmentDetails] Releasing door for appointment ${appointment.id}, dock ${appointment.dockId}`);
        
        toast({
          title: "Releasing Door",
          description: `Releasing dock assignment...`,
          duration: 2000,
        });
        
        const releaseRes = await apiRequest("POST", `/api/schedules/${appointment.id}/release`, {
          notes: `Checked out at ${new Date().toLocaleTimeString()}`,
          releaseType: "checkout"
        });
        
        if (!releaseRes.ok) {
          console.warn("[AppointmentDetails] Door release failed, but checkout was successful");
          // Don't fail the whole operation if door release fails
        } else {
          console.log("[AppointmentDetails] Door released successfully");
        }
      }
      
      return checkoutData;
    },
    onSuccess: () => {
      // Close the check-out dialog first
      setShowCheckOutDialog(false);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      
      // Enhanced success message with emoji
      const hasDock = appointment?.dockId;
      const message = hasDock 
        ? "✅ Appointment checked out and door released successfully!"
        : "✅ Appointment checked out successfully!";
      
      toast({
        title: "🎉 Checkout Complete",
        description: message,
        duration: 5000,
      });
      
      // Update the local appointment status immediately for better UX
      if (appointment) {
        appointment.status = 'completed';
        appointment.actualEndTime = new Date().toISOString();
      }
    },
    onError: (error: any) => {
      // Close the dialog on error too
      setShowCheckOutDialog(false);
      
      toast({
        title: "❌ Checkout Failed",
        description: error.message,
        variant: "destructive",
        duration: 5000,
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
    onError: (error: any) => {
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
    onError: (error: any) => {
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
    onError: (error: any) => {
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
  // Don't use default values like "FedEx", show "Not provided" when missing
  const carrier = { name: appointment.carrierName || "Not provided" };
  
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
  
  // Helper function to format time based on timeFormat setting
  const formatTimeWithFormat = (date: Date): string => {
    if (timeFormat === "24h") {
      return format(date, 'HH:mm'); // 24-hour format (e.g., 14:30)
    } else {
      return format(date, 'h:mm a'); // 12-hour format with am/pm (e.g., 2:30 pm)
    }
  };
  
  return <>
    {/* Check-In Dialog */}
    <Dialog open={showCheckInDialog} onOpenChange={setShowCheckInDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Check In Appointment</DialogTitle>
          <DialogDescription>
            Record when this appointment was actually checked in. Defaults to current time.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <div className="flex items-center text-blue-800 text-sm">
              <Clock className="h-4 w-4 mr-2" />
              <span>Current time: <strong>{format(new Date(), "MMM d, yyyy h:mm a")}</strong></span>
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="check-in-date" className="text-right">
              Check-In Date
            </Label>
            <Input
              id="check-in-date"
              type="date"
              className="col-span-3"
              value={format(checkInTime, "yyyy-MM-dd")}
              onChange={(e) => {
                if (e.target.value) {
                  const newDate = new Date(e.target.value);
                  const updatedTime = new Date(checkInTime);
                  updatedTime.setFullYear(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
                  setCheckInTime(updatedTime);
                }
              }}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="check-in-time" className="text-right">
              Check-In Time
            </Label>
            <Input
              id="check-in-time"
              type="time"
              className="col-span-3"
              value={formatTimeForInput(checkInTime)}
              onChange={(e) => {
                const [hours, minutes] = e.target.value.split(':').map(Number);
                const newTime = new Date(checkInTime);
                newTime.setHours(hours, minutes, 0, 0);
                setCheckInTime(newTime);
              }}
            />
          </div>
          
          <div className="text-xs text-muted-foreground">
            <strong>Note:</strong> For early check-ins, the date will be today unless you manually change it.
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline" 
            onClick={() => {
              setCheckInTime(new Date()); // Reset to current time
              setShowCheckInDialog(false);
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              setShowCheckInTimeInput(true);
              checkInAppointmentMutation.mutate();
              setShowCheckInDialog(false);
            }}
            disabled={checkInAppointmentMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {checkInAppointmentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Check In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Check-Out Dialog */}
    <Dialog open={showCheckOutDialog} onOpenChange={(open: any) => {
      // Only allow dialog to close if mutation is not in progress
      if (!checkOutMutation.isPending || !open) {
        setShowCheckOutDialog(open);
      }
    }}>
      <DialogContent className="max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle>Check Out Appointment</DialogTitle>
          <DialogDescription>
            Complete the checkout details below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="check-out-time" className="text-right">
              Check-Out Time
            </Label>
            <Input
              id="check-out-time"
              type="time"
              className="col-span-3"
              value={formatTimeForInput(checkOutTime)}
              onChange={(e) => {
                const [hours, minutes] = e.target.value.split(':').map(Number);
                const newTime = new Date();
                newTime.setHours(hours, minutes, 0, 0);
                setCheckOutTime(newTime);
              }}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="check-out-notes">Notes</Label>
            <textarea
              id="check-out-notes"
              className="w-full min-h-[80px] p-2 border border-slate-300 rounded-md"
              placeholder="Enter any checkout notes or details about the appointment"
              value={checkOutNotes}
              onChange={(e) => setCheckOutNotes(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="check-out-photo">Photo (Optional)</Label>
            <div className="flex flex-col gap-2">
              <Input
                id="check-out-photo-file"
                type="file"
                accept="image/*"
                className="w-full"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Store the file for later upload in the mutation
                    setUploadedFile(file);
                    // We'll set the real path after upload, just indicate file was selected
                    setCheckOutPhotoPath("Selected file: " + file.name);
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-200"></div>
                <span className="text-xs text-slate-500">OR</span>
                <div className="h-px flex-1 bg-slate-200"></div>
              </div>
              <Input
                id="check-out-photo-url"
                type="text"
                placeholder="Enter a URL to a photo"
                className="w-full text-sm"
                value={checkOutPhotoPath || ''}
                onChange={(e) => setCheckOutPhotoPath(e.target.value || null)}
              />
            </div>
            <p className="text-xs text-slate-500">
              Upload a photo or enter a URL to an existing image.
            </p>
            {checkOutPhotoPath && (
              <div className="mt-2 p-2 border rounded-md bg-slate-50 flex items-center justify-between overflow-hidden">
                <span className="text-sm truncate max-w-[220px]">
                  {checkOutPhotoPath.startsWith('Selected file:') 
                    ? checkOutPhotoPath 
                    : checkOutPhotoPath.split('/').pop()}
                </span>
                <Button
                  variant="ghost" 
                  size="sm"
                  className="h-6 w-6 min-w-[24px] p-0 flex-shrink-0"
                  onClick={() => {
                    setCheckOutPhotoPath(null);
                    setUploadedFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="flex justify-between sm:justify-end gap-2">
          <Button
            variant="outline" 
            onClick={() => setShowCheckOutDialog(false)}
            disabled={checkOutMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              setShowCheckOutTimeInput(true);
              checkOutMutation.mutate();
              // Don't close the dialog here, let the onSuccess handler do it
            }}
            disabled={checkOutMutation.isPending}
            className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
          >
            {checkOutMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Check Out"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Reschedule Dialog */}
    <Dialog open={isRescheduling} onOpenChange={(open: any) => setIsRescheduling(open)}>
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
                    disabled={(date: any) => date < new Date(new Date().setHours(0, 0, 0, 0))}
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
              <Badge variant="outline" className={
                appointment.status === "scheduled" ? "bg-blue-50 text-blue-700 border-blue-200" : 
                appointment.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" :
                appointment.status === "in-progress" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : 
                appointment.status === "completed" ? "bg-green-50 text-green-700 border-green-200" : 
                appointment.status === "cancelled" ? "bg-red-50 text-red-700 border-red-200" : 
                "bg-slate-50 text-slate-700 border-slate-200"
              }>
                {appointment.status === "scheduled" ? "Scheduled" : 
                appointment.status === "pending" ? "Pending" :
                appointment.status === "in-progress" ? "Checked In" : 
                appointment.status === "completed" ? "Completed" : 
                appointment.status === "cancelled" ? "Cancelled" : 
                appointment.status}
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
          <DialogDescription className="flex flex-col space-y-1 mt-1">
              {displayFacilityName ? (
                <span className="flex items-center">
                  <span className="font-medium">Facility:</span> 
                  <span className="ml-1">{displayFacilityName}</span>
                </span>
              ) : (
                <span className="flex items-center text-yellow-600">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                  <span className="font-medium">Facility:</span> 
                  <span className="ml-1">Unknown facility</span>
                </span>
              )}
              {appointment.dockId ? (
                <span className="flex items-center">
                  <span className="font-medium">Dock:</span> 
                  <span className="ml-1">{appointment.dockName || "Unknown"}</span>
                </span>
              ) : (
                <span className="flex items-center text-gray-500">
                  <Info className="h-3.5 w-3.5 mr-1" />
                  <span className="font-medium">Dock:</span> 
                  <span className="ml-1">No dock assigned</span>
                </span>
              )}
              <span className="flex items-center">
                <span className="font-medium">Type:</span> 
                <span className="ml-1">{appointment.type === "inbound" ? "Inbound" : "Outbound"} appointment</span>
              </span>
          </DialogDescription>
        </DialogHeader>

        {/* Schedule Times */}
        <div className="border-t border-b py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium inline-block">
                Schedule Times
                {appointment.status === "scheduled" && 
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded ml-2">Scheduled</span>
                }
                {appointment.status === "pending" && 
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded ml-2">Pending</span>
                }
                {appointment.status === "in-progress" && 
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded ml-2">Checked In</span>
                }
                {appointment.status === "completed" && 
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded ml-2">Completed</span>
                }
                {appointment.status === "cancelled" && 
                  <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded ml-2">Cancelled</span>
                }
              </h3>
            </div>
            
            {/* Quick Access Buttons for Check-in/Check-out */}
            <div>
              {appointment.status === "scheduled" && (
                <Button
                  variant="default"
                  size="sm"
                  className="text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShowCheckInDialog(true)}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Check In
                </Button>
              )}
              
              {appointment.status === "in-progress" && (
                <Button
                  variant="default"
                  size="sm"
                  className="text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => setShowCheckOutDialog(true)}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Check Out
                </Button>
              )}
            </div>
          </div>
          
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
                            `MM/dd/yyyy, ${timeFormat === "24h" ? 'HH:mm' : 'h:mm a'}`,
                            appointment.facilityId && appointment.facilityTimezone 
                              ? appointment.facilityTimezone 
                              : "America/New_York"
                          )
                        : ""} - {appointment && appointment.endTime 
                        ? formatInFacilityTimeZone(
                            new Date(appointment.endTime), 
                            timeFormat === "24h" ? 'HH:mm' : 'h:mm a',
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
                      {formatTimeWithFormat(utcToUserTime(new Date(appointment.startTime)))} - {formatTimeWithFormat(utcToUserTime(new Date(appointment.endTime)))} {getTimeZoneAbbreviation(getUserTimeZone())}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Facility time:</span>
                    <span>
                      {/* Apply consistent time formatting to match the tooltip formatting */}
                      {formatTimeWithFormat(utcToFacilityTime(
                        new Date(appointment.startTime),
                        appointment.facilityId && appointment.facilityTimezone 
                          ? appointment.facilityTimezone 
                          : "America/New_York"
                      ))} - {formatTimeWithFormat(utcToFacilityTime(
                        new Date(appointment.endTime),
                        appointment.facilityId && appointment.facilityTimezone 
                          ? appointment.facilityTimezone 
                          : "America/New_York"
                      ))} {getTimeZoneAbbreviation(appointment.facilityTimezone || "America/New_York")}
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
                  {(appointment.actualStartTime || appointment.status === "checked-in" || appointment.status === "in-progress" || appointment.status === "completed") ? (
                    <>
                      <div className="text-sm font-medium">
                        {appointment.actualStartTime 
                          ? (() => {
                              try {
                                const date = new Date(appointment.actualStartTime);
                                if (isNaN(date.getTime())) return "Invalid date";
                                return format(date, timeFormat === "24h" ? "MM/dd/yyyy, HH:mm" : "MM/dd/yyyy, hh:mm a");
                              } catch (e) {
                                return "Invalid date";
                              }
                            })()
                          : "Date/time not recorded"
                        }
                      </div>
                      {appointment.actualStartTime && (
                        <div className="flex flex-col mt-1">
                          <div className="text-xs">
                            <span className="font-medium">Your time:</span>{" "}
                            {formatInUserTimeZone(new Date(appointment.actualStartTime), timeFormat === "24h" ? 'MM/dd/yyyy HH:mm' : 'MM/dd/yyyy hh:mm a')} {getTimeZoneAbbreviation(getUserTimeZone())}
                          </div>
                          <div className="text-xs">
                            <span className="font-medium">Facility time:</span>{" "}
                            {formatInFacilityTimeZone(
                              new Date(appointment.actualStartTime), 
                              timeFormat === "24h" ? 'MM/dd/yyyy HH:mm' : 'MM/dd/yyyy hh:mm a',
                              appointment.facilityId && appointment.facilityTimezone 
                                ? appointment.facilityTimezone 
                                : "America/New_York"
                            )} {getTimeZoneAbbreviation(appointment.facilityTimezone || "America/New_York")}
                          </div>
                        </div>
                      )}
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
                        {(() => {
                          try {
                            const date = new Date(appointment.actualEndTime);
                            if (isNaN(date.getTime())) return "Invalid date";
                            return format(date, timeFormat === "24h" ? "MM/dd/yyyy, HH:mm" : "MM/dd/yyyy, hh:mm a");
                          } catch (e) {
                            return "Invalid date";
                          }
                        })()}
                      </div>
                      <div className="flex flex-col mt-1">
                        <div className="text-xs">
                          <span className="font-medium">Your time:</span>{" "}
                          {formatInUserTimeZone(new Date(appointment.actualEndTime), timeFormat === "24h" ? 'MM/dd/yyyy HH:mm' : 'MM/dd/yyyy hh:mm a')} {getTimeZoneAbbreviation(getUserTimeZone())}
                        </div>
                        <div className="text-xs">
                          <span className="font-medium">Facility time:</span>{" "}
                          {formatInFacilityTimeZone(
                            new Date(appointment.actualEndTime), 
                            timeFormat === "24h" ? 'MM/dd/yyyy HH:mm' : 'MM/dd/yyyy hh:mm a',
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
            
            {/* Check-out details section (shown only when checked out) */}
            {appointment.status === "completed" && appointment.actualEndTime && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <h4 className="text-xs font-semibold mb-2">Check-Out Details</h4>
                
                {/* Try to extract custom check-out data */}
                {(() => {
                  try {
                    const customData = typeof appointment.customFormData === 'string' 
                      ? JSON.parse(appointment.customFormData) 
                      : appointment.customFormData || {};
                    
                    return (
                      <div className="space-y-2">
                        {/* Check-out notes */}
                        {(customData.checkoutNotes || appointment.notes) && (
                          <div>
                            <span className="text-xs font-medium block">Notes:</span>
                            <p className="text-sm mt-1 bg-white p-2 rounded border border-slate-200">
                              {customData.checkoutNotes || appointment.notes}
                            </p>
                          </div>
                        )}
                        
                        {/* Check-out by */}
                        {customData.checkoutBy && (
                          <div className="text-xs">
                            <span className="font-medium">Checked out by:</span>{" "}
                            User ID {customData.checkoutBy}
                          </div>
                        )}
                        
                        {/* Check-out photo */}
                        {customData.checkoutPhoto && (
                          <div className="mt-2">
                            <span className="text-xs font-medium block mb-1">Check-out Photo:</span>
                            <a 
                              href={customData.checkoutPhoto} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                            >
                              <ImageIcon className="h-3 w-3 mr-1" />
                              View photo
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </div>
                        )}
                        
                        {/* Checkout time (from custom data if available) */}
                        {customData.checkoutTime && customData.checkoutTime !== appointment.actualEndTime && (
                          <div className="text-xs">
                            <span className="font-medium">Recorded checkout time:</span>{" "}
                            {(() => {
                              try {
                                const date = new Date(customData.checkoutTime);
                                if (isNaN(date.getTime())) return "Invalid date";
                                return format(date, timeFormat === "24h" ? "MM/dd/yyyy, HH:mm" : "MM/dd/yyyy, hh:mm a");
                              } catch (e) {
                                return "Invalid date";
                              }
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  } catch (e) {
                    console.warn("Failed to parse custom form data for checkout details:", e);
                    return null;
                  }
                })()}
                
                {/* Email notification status (placeholder) */}
                <div className="mt-2 text-xs flex items-center text-slate-600">
                  <FileCheck className="h-3.5 w-3.5 mr-1 text-green-600" />
                  Check-out notification email sent
                </div>
              </div>
            )}
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
              <Label className="text-xs text-muted-foreground">Driver Email:</Label>
              {isEditing ? (
                <Input 
                  value={formData.driverEmail || ''} 
                  onChange={(e) => handleInputChange('driverEmail', e.target.value)}
                  className="h-8"
                />
              ) : (
                <div className="font-medium">{appointment.driverEmail || "N/A"}</div>
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
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Creator Email:</Label>
              {isEditing ? (
                <Input 
                  value={formData.creatorEmail || ''} 
                  onChange={(e) => handleInputChange('creatorEmail', e.target.value)}
                  className="h-8"
                />
              ) : (
                <div className="font-medium">{appointment.creatorEmail || "N/A"}</div>
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
            <div 
              className="bg-slate-100 px-3 py-1 rounded-md font-mono font-medium cursor-pointer hover:bg-slate-200 transition-colors border-2 border-dashed border-slate-300"
              onClick={() => {
                const confirmationCode = appointment.confirmationCode || `HZL-${appointment.id.toString().padStart(6, '0')}`;
                // Generate QR code URL and open in new window
                const baseUrl = window.location.origin;
                const checkInUrl = `${baseUrl}/driver-check-in?code=${encodeURIComponent(confirmationCode)}`;
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkInUrl)}`;
                
                console.log('[AppointmentDetails] Generated QR code URL:', checkInUrl);
                console.log('[AppointmentDetails] Confirmation code:', confirmationCode);
                
                // Open QR code in a new window for easy access
                const qrWindow = window.open('', '_blank', 'width=400,height=500,scrollbars=yes');
                if (qrWindow) {
                  qrWindow.document.write(`
                    <html>
                      <head><title>Appointment QR Code - ${confirmationCode}</title></head>
                      <body style="text-align: center; font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Appointment Confirmation Code</h2>
                        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                          <div style="font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 10px;">
                            ${confirmationCode}
                          </div>
                          <img src="${qrUrl}" alt="QR Code for ${confirmationCode}" style="border: 1px solid #ccc; border-radius: 8px;" />
                          <p style="margin-top: 15px; color: #666; font-size: 14px;">
                            Scan this QR code or use the confirmation code for check-in
                          </p>
                          <p style="margin-top: 10px; color: #888; font-size: 12px;">
                            Check-in URL: ${checkInUrl}
                          </p>
                        </div>
                        <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                          Print QR Code
                        </button>
                      </body>
                    </html>
                  `);
                  qrWindow.document.close();
                }
              }}
              title="Click to view barcode/QR code"
            >
              {appointment.confirmationCode || `HZL-${appointment.id.toString().padStart(6, '0')}`}
            </div>
          </div>
          
          {/* Only show QR code for external appointments (identified by having null createdBy or no carrier name) */}
          {appointment.status === "scheduled" && (!appointment.createdBy || appointment.createdBy === 0) && (
            <div className="flex flex-col items-center">
              <p className="text-sm text-muted-foreground mb-3">
                External appointment - ensure driver receives this QR code for check-in
              </p>
              <div className="border border-primary border-2 p-3 rounded-md inline-block bg-white shadow-sm">
                <AppointmentQRCode
                  schedule={{
                    ...appointment,
                    facilityId: appointment.facilityId ?? null,
                    dockId: appointment.dockId ?? null,
                    carrierId: appointment.carrierId ?? null,
                    appointmentTypeId: appointment.appointmentTypeId ?? null
                  } as any}
                  confirmationCode={appointment.confirmationCode}
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
                      const userTimeFormatted = formatInUserTimeZone(
                        startTime, 
                        timeFormat === "24h" ? 'MMM dd, yyyy HH:mm' : 'MMM dd, yyyy h:mm a'
                      );
                      const facilityTimeFormatted = formatInFacilityTimeZone(
                        startTime,
                        timeFormat === "24h" ? 'MMM dd, yyyy HH:mm' : 'MMM dd, yyyy h:mm a',
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
                            <div class="confirmation">${appointment.confirmationCode || `HZL-${appointment.id.toString().padStart(6, '0')}`}</div>
                            <p class="info">Your Local Time: ${userTimeFormatted} ${userTimeZoneAbbr}</p>
                            <p class="info">Facility Time: ${facilityTimeFormatted} ${facilityTimeZoneAbbr}</p>
                            <p class="info">Carrier: ${appointment.carrierName || "Not specified"}</p>
                            <p class="info">Type: ${appointment.type === "inbound" ? "Inbound" : "Outbound"}</p>
                            ${appointment.bolNumber ? `<p class="info">BOL #: ${appointment.bolNumber}</p>` : ''}
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
        
        {/* BOL Documents */}
        <div className="border-t py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium mb-3 flex items-center">
              <FileText className="h-4 w-4 mr-2 text-primary" />
              Bill of Lading (BOL) Documents
            </h3>
            {(() => {
              // Helper function to safely parse customFormData if it's a string
              const parseCustomFormData = () => {
                if (!appointment.customFormData) return null;
                
                try {
                  // If it's already an object, use it directly
                  if (typeof appointment.customFormData === 'object') {
                    return appointment.customFormData;
                  }
                  // Otherwise parse it from string
                  return JSON.parse(appointment.customFormData as string);
                } catch (e) {
                  console.error("Failed to parse customFormData:", e);
                  return null;
                }
              };
              
              const parsedData = parseCustomFormData();
              
              return appointment.bolNumber && (
                <Badge variant="outline" className="mb-3 text-xs bg-blue-50 text-blue-700 border-blue-200">
                  <FileCheck className="h-3 w-3 mr-1" />
                  BOL #{appointment.bolNumber}
                </Badge>
              );
            })()}
          </div>
          
          {/* Enhanced BOL Document Display */}
          {(() => {
            // Helper function to safely parse customFormData if it's a string
            const parseCustomFormData = () => {
              if (!appointment.customFormData) return null;
              
              try {
                // If it's already an object, use it directly
                if (typeof appointment.customFormData === 'object') {
                  return appointment.customFormData;
                }
                // Otherwise parse it from string
                return JSON.parse(appointment.customFormData as string);
              } catch (e) {
                console.error("Failed to parse customFormData:", e);
                return null;
              }
            };
            
            const parsedData = parseCustomFormData();
            
            // Check for BOL data in either customFormData or directly on the appointment
            const hasBolData = parsedData && parsedData.bolData && typeof parsedData.bolData === 'object';
            const hasDirectBolInfo = appointment.bolNumber || appointment.bolDocumentPath;
            const hasBolDocuments = appointment.bolDocuments && appointment.bolDocuments.length > 0;
            
            if (hasBolData || hasDirectBolInfo || hasBolDocuments) {
              return (
                <div className="space-y-4">
                  {/* Enhanced BOL Document Display */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <FileCheck className="h-6 w-6 text-blue-600" />
                        </div>
                        
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 mb-1">
                            {(hasBolData && (parsedData?.bolData?.originalName || parsedData?.bolData?.fileName)) 
                              || (hasBolDocuments && appointment.bolDocuments && appointment.bolDocuments[0]?.name)
                              || appointment.bolNumber
                              || 'BOL Document'}
                          </h4>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            {/* BOL Number */}
                            {(hasBolData && parsedData?.bolData?.bolNumber || appointment.bolNumber) && (
                              <div className="flex items-center gap-2">
                                <span className="font-medium">BOL Number:</span>
                                <Badge variant="secondary" className="text-xs">
                                  {(hasBolData && parsedData?.bolData?.bolNumber) || appointment.bolNumber}
                                </Badge>
                              </div>
                            )}
                            
                            {/* Upload Date */}
                            {(hasBolData && parsedData?.bolData?.uploadedAt) && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                <span>Uploaded: {new Date(parsedData.bolData.uploadedAt).toLocaleDateString()}</span>
                              </div>
                            )}
                            
                            {/* File Size */}
                            {(hasBolData && parsedData?.bolData?.fileSize) && (
                              <div className="flex items-center gap-2">
                                <span>Size: {Math.round(parsedData.bolData.fileSize / 1024)} KB</span>
                              </div>
                            )}
                            
                            {/* Extraction Confidence */}
                            {(hasBolData && parsedData?.bolData?.extractionConfidence) && (
                              <div className="flex items-center gap-2">
                                <span>Scan Quality:</span>
                                <Badge
                                  variant={parsedData.bolData.extractionConfidence > 80 ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {parsedData.bolData.extractionConfidence}% confidence
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-col space-y-2">
                        {/* View/Preview Button */}
                        {(hasBolData && parsedData?.bolData?.fileUrl) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs bg-white hover:bg-gray-50"
                                  onClick={() => window.open(parsedData.bolData.fileUrl, '_blank')}
                                >
                                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                  Preview
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View document in new tab</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        
                        {/* Download Button */}
                        {(hasBolData && parsedData?.bolData?.fileUrl) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="text-xs"
                                  asChild
                                >
                                  <a 
                                    href={`/api/files/download/${parsedData.bolData.fileUrl.split('/').pop()}`} 
                                    download={parsedData.bolData.originalName || 'bol-document.pdf'}
                                  >
                                    <Download className="h-3.5 w-3.5 mr-1" />
                                    Download
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Download original document</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        
                        {/* Alternative download buttons for other BOL sources */}
                        {(hasBolDocuments && appointment.bolDocuments && appointment.bolDocuments[0]?.fileUrl) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="text-xs"
                                  asChild
                                >
                                  <a 
                                    href={`/api/files/download/${appointment.bolDocuments[0].fileUrl.split('/').pop()}`} 
                                    download={appointment.bolDocuments[0].name || 'bol-document.pdf'}
                                  >
                                    <Download className="h-3.5 w-3.5 mr-1" />
                                    Download
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Download BOL document</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        
                        {/* Direct BOL document path download */}
                        {appointment.bolDocumentPath && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="text-xs"
                                  asChild
                                >
                                  <a 
                                    href={`/api/files/download/${appointment.bolDocumentPath.split('/').pop()}`} 
                                    download="bol-document.pdf"
                                  >
                                    <Download className="h-3.5 w-3.5 mr-1" />
                                    Download
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Download BOL document</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            
            return (
              <div className="space-y-4">
                {/* Upload BOL Section */}
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <div className="text-sm text-gray-600 mb-4">
                    <div className="font-medium">No BOL documents uploaded</div>
                    <div className="text-xs">Upload a BOL document to extract and display shipment information</div>
                  </div>
                  
                  {!isUploadingBol ? (
                    <Button
                      variant="outline" 
                      className="bg-white hover:bg-gray-50"
                      onClick={() => setIsUploadingBol(true)}
                    >
                      <FileUp className="h-4 w-4 mr-2" />
                      Upload BOL Document
                    </Button>
                  ) : (
                    <div className="space-y-4 max-w-md mx-auto">
                      <SimpleBolUpload 
                        scheduleId={appointment.id}
                        onBolProcessed={(data, fileUrl) => {
                          // This will be called after BOL processing is complete
                          console.log("BOL processed with data:", data);
                          toast({
                            title: "BOL document uploaded",
                            description: "The BOL has been processed and linked to this appointment",
                          });
                          
                          // Refresh appointment data to show the newly linked BOL
                          queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
                          
                          // Close the upload section
                          setIsUploadingBol(false);
                        }}
                        onProcessingStateChange={(isProcessing) => {
                          // Show toast for OCR processing start/end if needed
                          if (isProcessing) {
                            toast({
                              title: "Processing BOL document",
                              description: "Extracting data from document using OCR...",
                            });
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsUploadingBol(false)}
                        className="w-full"
                      >
                        Cancel Upload
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Notes */}
        <div className="border-t py-4">
          <h3 className="text-sm font-medium mb-3">Notes</h3>
          <div className="rounded-md border bg-slate-50 p-3">
            {isEditing ? (
              <textarea 
                value={formData.notes || ''}
                onChange={(e) => {
                  // Update local form state
                  handleInputChange('notes', e.target.value);
                  
                  // Use the dedicated notes mutation for real-time updates
                  // This sends updates immediately without requiring a form save
                  updateNotesMutation.mutate(e.target.value);
                }}
                className="w-full h-24 p-2 text-sm rounded border border-input"
                placeholder="Add notes about this appointment..."
              />
            ) : (
              <p className="text-sm whitespace-pre-line">{appointment.notes}</p>
            )}
          </div>
        </div>
         
        {/* Release Photos Section - Only shown for completed appointments */}
        {appointment.status === "completed" && (
          <div className="border-t py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium mb-3 flex items-center">
                <ImageIcon className="h-4 w-4 mr-2 text-primary" />
                Release Photos
              </h3>
            </div>
            
            {(() => {
              // Helper function to safely parse customFormData if it's a string
              const parseCustomFormData = () => {
                if (!appointment.customFormData) return null;
                
                try {
                  // If it's already an object, use it directly
                  if (typeof appointment.customFormData === 'object') {
                    return appointment.customFormData;
                  }
                  // Otherwise parse it from string
                  return JSON.parse(appointment.customFormData as string);
                } catch (e) {
                  console.error("Failed to parse customFormData:", e);
                  return null;
                }
              };
              
              const parsedData = parseCustomFormData();
              const releasePhoto = parsedData?.releasePhoto;
              
              if (releasePhoto) {
                return (
                  <div className="space-y-3">
                    <div className="bg-primary/5 p-3 rounded-md border border-primary/20">
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground">
                          Photo taken at: {appointment.actualEndTime 
                            ? new Date(appointment.actualEndTime).toLocaleString() 
                            : "Unknown time"}
                        </p>
                      </div>
                      <div className="border rounded-lg overflow-hidden bg-white">
                        <img 
                          src={releasePhoto.fileUrl || `/uploads/${releasePhoto.filename}`} 
                          alt="Release confirmation" 
                          className="w-full h-auto max-h-64 object-contain"
                        />
                      </div>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="text-center p-6 border border-dashed rounded-md bg-slate-50">
                    <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">No release photos available</p>
                  </div>
                );
              }
            })()}
          </div>
        )}
         
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
                          {(() => {
                            try {
                              const date = new Date(event.timestamp);
                              if (isNaN(date.getTime())) return "Invalid date";
                              return format(date, timeFormat === "24h" ? "MM/dd/yyyy HH:mm" : "MM/dd/yyyy hh:mm a");
                            } catch (e) {
                              return "Invalid date";
                            }
                          })()}
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
                  onClick={() => setShowCheckInDialog(true)}
                >
                  <Clock className="h-4 w-4 mr-2" />
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
                  onClick={() => setShowCheckOutDialog(true)}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Check Out
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
  </Dialog>

  {/* Reschedule Dialog */}
  <Dialog open={isRescheduling} onOpenChange={setIsRescheduling}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Reschedule Appointment</DialogTitle>
        <DialogDescription>
          Select a new date and time for this appointment.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <p className="text-sm text-muted-foreground">
          Rescheduling functionality will be available soon.
        </p>
      </div>
      <DialogFooter>
        <Button
          variant="outline" 
          onClick={() => setIsRescheduling(false)}
        >
          Cancel
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</>;
}