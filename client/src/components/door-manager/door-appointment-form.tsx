import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command"
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon, Clock, Plus, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { CarrierSelector } from "@/components/shared/carrier-selector";
import { 
  Carrier, 
  ScheduleType, 
  ScheduleStatus, 
  Schedule 
} from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

// Create a schema for the appointment form with minimal validation
const appointmentSchema = z.object({
  dockId: z.number(),
  carrierId: z.number(),
  carrierName: z.string().optional(), // Used when creating a new carrier
  customerName: z.string().optional(), // Added customer name
  truckNumber: z.string().optional(),
  startTime: z.date(),
  endTime: z.date().optional(),
  type: z.enum([ScheduleType.INBOUND, ScheduleType.OUTBOUND]),
  notes: z.string().optional(),
  // Add field for new carrier addition
  newCarrier: z.object({
    name: z.string(),
    mcNumber: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().optional(),
    contactPhone: z.string().optional()
  }).optional(),
}).refine(data => {
  // If endTime is provided, ensure it's after startTime
  if (data.endTime) {
    return data.endTime > data.startTime;
  }
  return true;
}, {
  message: "End time must be after start time",
  path: ["endTime"]
});

type AppointmentValues = z.infer<typeof appointmentSchema>;

interface DoorAppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  dockId: number;
  initialStartTime: Date;
  initialEndTime: Date;
  carriers: Carrier[];
  schedules?: Schedule[];
  onSuccess: () => void;
}

export default function DoorAppointmentForm({
  isOpen,
  onClose,
  dockId,
  initialStartTime,
  initialEndTime,
  carriers,
  schedules = [],
  onSuccess
}: DoorAppointmentFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);
  
  // Form setup
  const form = useForm<AppointmentValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      dockId,
      carrierId: carriers.length > 0 ? carriers[0].id : 0,
      carrierName: "", // For new carriers
      customerName: "", // For customer name
      truckNumber: "",
      startTime: initialStartTime,
      endTime: undefined,
      type: ScheduleType.INBOUND,
      notes: "",
      newCarrier: {
        name: "",
        mcNumber: "",
        contactName: "",
        contactEmail: "",
        contactPhone: ""
      }
    },
  });
  
  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentValues) => {
      // Add userId and status to the data, calculate endTime if not provided
      const appointmentData = {
        ...data,
        // If endTime is not provided, set it to 1 hour after startTime by default
        endTime: data.endTime || new Date(data.startTime.getTime() + 60 * 60 * 1000),
        // Set status to in-progress by default for door manager appointments
        status: ScheduleStatus.IN_PROGRESS,
        actualStartTime: new Date().toISOString(),
        createdBy: user?.id || 1,
      };
      
      // Convert dates to ISO strings for JSON serialization
      const serializedData = {
        ...appointmentData,
        // Force convert to ISO strings
        startTime: appointmentData.startTime ? appointmentData.startTime.toISOString() : new Date().toISOString(),
        endTime: appointmentData.endTime ? appointmentData.endTime.toISOString() : new Date(Date.now() + 3600000).toISOString(),
      };
      
      console.log("Sending appointment data:", JSON.stringify(serializedData, null, 2));
      
      const res = await apiRequest("POST", "/api/schedules", serializedData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Appointment created",
        description: "The door appointment has been created successfully.",
      });
      form.reset();
      onSuccess();
    },
    onError: (error: Error) => {
      console.error("Appointment creation error:", error);
      toast({
        title: "Failed to create appointment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update existing appointment mutation
  const updateAppointmentMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      const updateData = {
        dockId,
        lastModifiedBy: user?.id || 1,
        lastModifiedAt: new Date().toISOString(),
      };
      
      const res = await apiRequest("PATCH", `/api/schedules/${scheduleId}`, updateData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Door assigned",
        description: "The existing appointment has been assigned to this door.",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to assign door",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const onSubmit = async (data: AppointmentValues) => {
    setIsSubmitting(true);
    
    try {
      if (appointmentType === "existing" && selectedExistingAppointment) {
        // Update existing appointment with new dock
        await updateAppointmentMutation.mutateAsync(selectedExistingAppointment.id);
      } else {
        // Create new appointment
        await createAppointmentMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Format time for display
  const formatTimeForInput = (date: Date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  // Parse time string to Date object and round to nearest 15 minutes
  const parseTimeString = (timeString: string, baseDate: Date) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    // Round minutes to nearest 15 (0, 15, 30, 45)
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const newDate = new Date(baseDate);
    newDate.setHours(hours, roundedMinutes === 60 ? hours + 1 : hours, 
                    roundedMinutes === 60 ? 0 : roundedMinutes, 0);
    return newDate;
  };
  
  // Get existing appointments for the day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Filter schedules for today's appointments that aren't for this door
  const { data: todaysAppointments = [] } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules/today"],
    queryFn: async () => {
      // This would normally call the backend API
      // For now, let's filter the existing schedules
      return schedules.filter(s => 
        new Date(s.startTime) >= today && 
        new Date(s.startTime) < tomorrow &&
        s.dockId !== dockId
      );
    },
  });
  
  const [appointmentType, setAppointmentType] = useState<"new" | "existing">("new");
  const [selectedExistingAppointment, setSelectedExistingAppointment] = useState<Schedule | null>(null);
  
  const handleExistingAppointmentSelect = (appointmentId: string) => {
    const appointment = todaysAppointments.find(a => a.id.toString() === appointmentId);
    if (appointment) {
      setSelectedExistingAppointment(appointment);
      // We don't update the form fields since we're just connecting the appointment to this dock
    }
  };
  
  // Handle adding end time
  const handleAddEndTime = () => {
    setShowEndTime(true);
    // Set default end time to be 1 hour after start time
    const startTime = form.getValues("startTime");
    const defaultEndTime = new Date(startTime);
    defaultEndTime.setHours(defaultEndTime.getHours() + 1);
    form.setValue("endTime", defaultEndTime);
  };
  
  // Handle removing end time
  const handleRemoveEndTime = () => {
    setShowEndTime(false);
    form.setValue("endTime", undefined);
  };
  
  // We no longer need the carrier selection logic as it's handled by the CarrierSelector component.
  // No more manual filtering or state management needed for carrier selection.
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Door</DialogTitle>
          <DialogDescription>
            Create a new appointment or assign an existing appointment to this door.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Button
            type="button"
            variant={appointmentType === "new" ? "default" : "outline"}
            onClick={() => setAppointmentType("new")}
            className="w-full"
          >
            Create New Appointment
          </Button>
          <Button
            type="button"
            variant={appointmentType === "existing" ? "default" : "outline"}
            onClick={() => setAppointmentType("existing")}
            className="w-full"
          >
            Use Existing Appointment
          </Button>
        </div>
        
        {appointmentType === "existing" && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Select an existing appointment:
            </label>
            <Select onValueChange={handleExistingAppointmentSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose appointment" />
              </SelectTrigger>
              <SelectContent>
                {todaysAppointments.length > 0 ? (
                  todaysAppointments.map((appointment) => (
                    <SelectItem key={appointment.id} value={appointment.id.toString()}>
                      {carriers.find(c => c.id === appointment.carrierId)?.name} - {appointment.truckNumber} ({new Date(appointment.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No appointments available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {appointmentType === "existing" && selectedExistingAppointment ? (
              <div className="p-4 border rounded-md mb-4 bg-gray-50">
                <h3 className="font-medium mb-2">Selected Appointment Details:</h3>
                <p className="text-sm mb-1">
                  <span className="font-medium">Carrier:</span> {carriers.find(c => c.id === selectedExistingAppointment.carrierId)?.name || "N/A"}
                </p>
                <p className="text-sm mb-1">
                  <span className="font-medium">Truck #:</span> {selectedExistingAppointment.truckNumber}
                </p>
                <p className="text-sm mb-1">
                  <span className="font-medium">Type:</span> {selectedExistingAppointment.type}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Time:</span> {format(new Date(selectedExistingAppointment.startTime), "PPP")} {format(new Date(selectedExistingAppointment.startTime), "p")} - {format(new Date(selectedExistingAppointment.endTime), "p")}
                </p>
              </div>
            ) : (
              <>
                {/* Carrier Selection with Autocomplete */}
                {/* Using standardized CarrierSelector component */}
                <CarrierSelector 
                  form={form}
                  nameFieldName="carrierName"
                  idFieldName="carrierId"
                  mcNumberFieldName="newCarrier.mcNumber"
                  label="Carrier"
                  required={true}
                  placeholder="Select or enter carrier name"
                />
                
                {/* Customer Name field */}
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter customer name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="truckNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Truck Number (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter truck number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="text-left font-normal"
                              >
                                <CalendarIcon className="h-4 w-4 mr-2" />
                                {field.value ? format(field.value, "PPP") : "Select date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                if (date) {
                                  // Preserve the time part
                                  const newDate = new Date(date);
                                  newDate.setHours(
                                    field.value.getHours(),
                                    field.value.getMinutes(),
                                    0, 0
                                  );
                                  field.onChange(newDate);
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <div className="flex items-center">
                          <FormControl>
                            <Input
                              type="time"
                              value={formatTimeForInput(field.value)}
                              onChange={(e) => {
                                field.onChange(parseTimeString(e.target.value, field.value));
                              }}
                            />
                          </FormControl>
                          <Clock className="ml-2 h-4 w-4 text-gray-400" />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {showEndTime ? (
                  <div className="space-y-4 bg-gray-50 p-4 rounded-md">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium">End Date/Time</h3>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleRemoveEndTime}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>End Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className="text-left font-normal"
                                  >
                                    <CalendarIcon className="h-4 w-4 mr-2" />
                                    {field.value ? format(field.value, "PPP") : "Select date"}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value || undefined}
                                  onSelect={(date) => {
                                    if (date) {
                                      // Preserve the time part or set default time
                                      const newDate = new Date(date);
                                      if (field.value) {
                                        newDate.setHours(
                                          field.value.getHours(),
                                          field.value.getMinutes(),
                                          0, 0
                                        );
                                      } else {
                                        // If no existing time, set to an hour later than start time
                                        const startTime = form.getValues("startTime");
                                        newDate.setHours(
                                          startTime.getHours() + 1,
                                          startTime.getMinutes(),
                                          0, 0
                                        );
                                      }
                                      field.onChange(newDate);
                                    } else {
                                      field.onChange(undefined);
                                    }
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time</FormLabel>
                            <div className="flex items-center">
                              <FormControl>
                                <Input
                                  type="time"
                                  value={field.value ? formatTimeForInput(field.value) : ""}
                                  onChange={(e) => {
                                    // Always use a valid date even if empty string is provided
                                    const baseDate = field.value || form.getValues("startTime");
                                    if (e.target.value) {
                                      field.onChange(parseTimeString(e.target.value, baseDate));
                                    } else {
                                      // Instead of undefined, use the base date but add 1 hour
                                      const defaultEndTime = new Date(baseDate);
                                      defaultEndTime.setHours(defaultEndTime.getHours() + 1);
                                      field.onChange(defaultEndTime);
                                    }
                                  }}
                                />
                              </FormControl>
                              <Clock className="ml-2 h-4 w-4 text-gray-400" />
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleAddEndTime}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add End Time
                  </Button>
                )}
                
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={ScheduleType.INBOUND}>Inbound</SelectItem>
                          <SelectItem value={ScheduleType.OUTBOUND}>Outbound</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Add any additional notes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting 
                  ? appointmentType === "existing" ? "Assigning..." : "Creating..." 
                  : appointmentType === "existing" ? "Assign Door" : "Create Appointment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}