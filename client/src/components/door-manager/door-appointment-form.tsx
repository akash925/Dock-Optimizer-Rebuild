import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { 
  insertScheduleSchema, 
  ScheduleType, 
  ScheduleStatus, 
  Carrier, 
  Schedule 
} from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

// Create a schema for the appointment form with time validation
const appointmentSchema = z.object({
  dockId: z.number(),
  carrierId: z.number().optional(),
  carrierName: z.string().optional(),
  truckNumber: z.string().min(1, "Truck number is required"),
  startTime: z.date(),
  endTime: z.date(),
  type: z.enum([ScheduleType.INBOUND, ScheduleType.OUTBOUND]),
  notes: z.string().optional(),
}).refine(data => data.endTime > data.startTime, {
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
  
  // Form setup
  const form = useForm<AppointmentValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      dockId,
      carrierId: undefined,
      carrierName: "",
      truckNumber: "",
      startTime: initialStartTime,
      endTime: initialEndTime,
      type: ScheduleType.INBOUND,
      notes: "",
    },
  });
  
  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentValues) => {
      // Add userId and status to the data
      const appointmentData = {
        ...data,
        status: ScheduleStatus.SCHEDULED,
        createdBy: user?.id || 1,
      };
      
      const res = await apiRequest("POST", "/api/schedules", appointmentData);
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
      const res = await apiRequest("PATCH", `/api/schedules/${scheduleId}`, {
        dockId,
        lastModifiedBy: user?.id || 1,
        lastModifiedAt: new Date(),
      });
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
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Format time for display
  const formatTimeForInput = (date: Date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  // Parse time string to Date object
  const parseTimeString = (timeString: string, baseDate: Date) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDate = new Date(baseDate);
    newDate.setHours(hours, minutes, 0, 0);
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
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
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
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="carrierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carrier</FormLabel>
                        <Select 
                          value={field.value?.toString() || ""} 
                          onValueChange={(value) => {
                            field.onChange(value ? parseInt(value) : undefined);
                            // Find the carrier name for the selected ID
                            if (value) {
                              const carrier = carriers.find(c => c.id.toString() === value);
                              if (carrier) {
                                form.setValue("carrierName", carrier.name);
                              }
                            } else {
                              form.setValue("carrierName", "");
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a carrier (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <div className="p-2">
                              <Input 
                                placeholder="Search carriers..." 
                                className="mb-2"
                                onChange={(e) => {
                                  // This would filter the carriers list in a real implementation
                                  // For now, we'll just log the search term
                                  console.log("Searching for carrier:", e.target.value);
                                }}
                              />
                            </div>
                            {carriers.map(carrier => (
                              <SelectItem key={carrier.id} value={carrier.id.toString()}>
                                {carrier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="carrierName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Carrier Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter carrier name if not in list above" 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              // Clear carrier ID if custom name is entered
                              if (e.target.value) {
                                form.setValue("carrierId", undefined);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="truckNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Truck Number</FormLabel>
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
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
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