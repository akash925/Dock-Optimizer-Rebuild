import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Facility, AppointmentType } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, addHours, addMinutes } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CalendarIcon, Clock, Loader2 } from "lucide-react";
import { CarrierSelector } from "@/components/shared/carrier-selector";

type AppointmentFormMode = "internal" | "external";

// Schema for the form validation
const appointmentFormSchema = z.object({
  // Facility and appointment type
  facilityId: z.coerce.number({
    required_error: "Please select a location",
    invalid_type_error: "Please select a valid location",
  }),
  appointmentTypeId: z.coerce.number({
    required_error: "Please select an appointment type",
    invalid_type_error: "Please select a valid appointment type",
  }),
  
  // Carrier & truck information
  carrierId: z.coerce.number().optional(),
  carrierName: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  mcNumber: z.string().optional(),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(6, "Valid phone number is required"),
  
  // Appointment details
  type: z.enum(["inbound", "outbound"]),
  appointmentMode: z.enum(["trailer", "container"]),
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Time is required"),
  dockId: z.coerce.number().optional(),
  bolNumber: z.string().optional(),
  poNumber: z.string().optional(),
  palletCount: z.string().optional(),
  weight: z.string().optional(),
  notes: z.string().optional(),
  
  // Other details
  facilityTimezone: z.string().optional(),
  createdBy: z.number().optional(),
  status: z.string().optional().default("scheduled"),
}).refine(
  (data) => {
    // Either carrierId or carrierName must be provided
    return data.carrierId !== undefined || (data.carrierName !== undefined && data.carrierName !== '');
  },
  {
    message: "Either select a carrier or enter a custom carrier name",
    path: ["carrierId"],
  }
);

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

interface AppointmentFormProps {
  mode: AppointmentFormMode;
  isOpen?: boolean; 
  onClose?: () => void;
  initialData?: any; // Any existing appointment data
  editMode?: "create" | "edit";
  initialDate?: Date;
  initialDockId?: number;
  appointmentTypeId?: number;
  facilityId?: number;
  facilityTimezone?: string;
  onSubmitSuccess?: (data: any) => void;
  // External mode props
  bookingPageSlug?: string;
  preSelectedLocation?: string;
  preSelectedType?: string;
  containerClass?: string;
  showBackButton?: boolean;
}

export default function AppointmentForm({
  mode,
  isOpen = false,
  onClose = () => {},
  initialData,
  editMode = "create",
  initialDate,
  initialDockId,
  appointmentTypeId: initialAppointmentTypeId,
  facilityId: initialFacilityId,
  facilityTimezone = "America/New_York",
  onSubmitSuccess,
  bookingPageSlug,
  preSelectedLocation,
  preSelectedType,
  containerClass = "max-w-4xl mx-auto p-4",
  showBackButton = false,
}: AppointmentFormProps) {
  // State for the current step in the form wizard
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAppointmentType, setSelectedAppointmentType] = useState<AppointmentType | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Fetch all facilities
  const { data: facilities = [], isLoading: isLoadingFacilities } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });
  
  // Fetch all appointment types
  const { data: allAppointmentTypes = [], isLoading: isLoadingAppointmentTypes } = useQuery<AppointmentType[]>({
    queryKey: ["/api/appointment-types"],
  });
  
  // Form setup with default values
  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: initialData ? {
      // Populate with initial data if editing
      facilityId: initialData.facilityId || initialFacilityId || undefined,
      appointmentTypeId: initialData.appointmentTypeId || initialAppointmentTypeId || undefined,
      carrierId: initialData.carrierId,
      carrierName: initialData.carrierName || "",
      customerName: initialData.customerName || "",
      mcNumber: initialData.mcNumber || "",
      truckNumber: initialData.truckNumber || "",
      trailerNumber: initialData.trailerNumber || "",
      driverName: initialData.driverName || "",
      driverPhone: initialData.driverPhone || "",
      type: initialData.type || "inbound",
      appointmentMode: initialData.appointmentMode || "trailer",
      appointmentDate: initialData.startTime ? format(new Date(initialData.startTime), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      appointmentTime: initialData.startTime ? format(new Date(initialData.startTime), "HH:mm") : "09:00",
      dockId: initialData.dockId || initialDockId || undefined,
      bolNumber: initialData.bolNumber || "",
      poNumber: initialData.poNumber || "",
      palletCount: initialData.palletCount?.toString() || "",
      weight: initialData.weight?.toString() || "",
      notes: initialData.notes || "",
      facilityTimezone: facilityTimezone,
    } : {
      // Default values for new appointment
      facilityId: initialFacilityId || undefined,
      appointmentTypeId: initialAppointmentTypeId || undefined,
      carrierId: undefined,
      carrierName: "",
      customerName: "",
      mcNumber: "",
      truckNumber: "",
      trailerNumber: "",
      driverName: "",
      driverPhone: "",
      type: preSelectedType === "outbound" ? "outbound" : "inbound",
      appointmentMode: "trailer",
      appointmentDate: initialDate ? format(initialDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      appointmentTime: initialDate ? format(initialDate, "HH:mm") : "09:00",
      dockId: initialDockId,
      bolNumber: "",
      poNumber: "",
      palletCount: "",
      weight: "",
      notes: "",
      facilityTimezone: facilityTimezone,
    }
  });
  
  // Filtered appointment types based on selected facility
  const [filteredAppointmentTypes, setFilteredAppointmentTypes] = useState<AppointmentType[]>([]);
  
  // Update filtered appointment types when facility changes or appointment types load
  useEffect(() => {
    // This effect isn't needed as we handle it in the watchedFacilityId effect below
  }, []);
  
  // Watch for facilityId changes to update filtered appointment types
  const watchedFacilityId = form.watch("facilityId");
  useEffect(() => {
    if (watchedFacilityId) {
      const typesForFacility = allAppointmentTypes.filter(type => type.facilityId === watchedFacilityId);
      setFilteredAppointmentTypes(typesForFacility);
    } else {
      setFilteredAppointmentTypes(allAppointmentTypes);
    }
  }, [watchedFacilityId, allAppointmentTypes]);
  
  // Watch for appointment type changes
  const watchedAppointmentTypeId = form.watch("appointmentTypeId");
  useEffect(() => {
    if (watchedAppointmentTypeId) {
      const selectedType = allAppointmentTypes.find(type => type.id === watchedAppointmentTypeId);
      if (selectedType) {
        setSelectedAppointmentType(selectedType);
        
        // Set appointment mode based on duration (4hr = container, 1hr = trailer)
        const recommendedMode = selectedType.duration <= 60 ? "trailer" : "container";
        form.setValue("appointmentMode", recommendedMode);
        
        // If type is for a specific facility, set the facility
        if (selectedType.facilityId && !form.getValues("facilityId")) {
          form.setValue("facilityId", selectedType.facilityId);
        }
      }
    }
  }, [watchedAppointmentTypeId, allAppointmentTypes]);
  
  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentFormValues) => {
      // Prepare data for the API
      const startDate = new Date(`${data.appointmentDate}T${data.appointmentTime}`);
      
      // Calculate end time based on appointment type duration
      let endDate;
      if (selectedAppointmentType) {
        endDate = addMinutes(startDate, selectedAppointmentType.duration);
      } else {
        // Default duration based on mode
        const defaultHours = data.appointmentMode === "trailer" ? 1 : 4;
        endDate = addHours(startDate, defaultHours);
      }
      
      // Format for API
      const formattedData = {
        carrierId: data.carrierId || null,
        customerName: data.customerName,
        mcNumber: data.mcNumber || "",
        dockId: data.dockId || null,
        truckNumber: data.truckNumber,
        trailerNumber: data.trailerNumber || "",
        driverName: data.driverName,
        driverPhone: data.driverPhone,
        bolNumber: data.bolNumber || "",
        poNumber: data.poNumber || "",
        palletCount: data.palletCount ? parseInt(data.palletCount) : 0,
        weight: data.weight ? parseInt(data.weight) : 0,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        type: data.type,
        appointmentTypeId: data.appointmentTypeId,
        appointmentMode: data.appointmentMode,
        status: data.status || "scheduled",
        notes: data.notes || "",
        createdBy: user?.id || null,
        facilityId: data.facilityId,
        facilityTimezone: data.facilityTimezone || facilityTimezone,
        // If custom carrier, add the new carrier data
        newCarrier: data.carrierId ? undefined : {
          name: data.carrierName || "Custom Carrier",
          mcNumber: data.mcNumber || "",
          contactName: data.driverName || "",
          contactEmail: "",
          contactPhone: data.driverPhone || "",
        }
      };
      
      // API call
      const response = await apiRequest("POST", "/api/schedules", formattedData);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Appointment Created",
        description: "The appointment has been successfully created",
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      
      // Reset the form to defaults
      form.reset({
        facilityId: initialFacilityId || undefined,
        appointmentTypeId: initialAppointmentTypeId || undefined,
        carrierId: undefined,
        carrierName: "",
        customerName: "",
        mcNumber: "",
        truckNumber: "",
        trailerNumber: "",
        driverName: "",
        driverPhone: "",
        type: "inbound",
        appointmentMode: "trailer",
        appointmentDate: format(new Date(), "yyyy-MM-dd"),
        appointmentTime: "09:00",
        dockId: initialDockId,
        bolNumber: "",
        poNumber: "",
        palletCount: "",
        weight: "",
        notes: "",
        facilityTimezone: facilityTimezone,
      });

      // Reset step to 1
      setStep(1);
      setIsSubmitting(false);
      
      // Call the success callback if provided
      if (onSubmitSuccess) {
        onSubmitSuccess(data);
      }
      
      // Close the form/dialog
      if (onClose) {
        onClose();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create appointment: ${error.message}`,
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  });
  
  // Form submission handler
  const onSubmit = (data: AppointmentFormValues) => {
    // Only run when submitting on the final step
    // Step navigation is now handled by the Next/Back buttons directly
    setIsSubmitting(true);
    createAppointmentMutation.mutate(data);
  };
  
  // Handle going back a step
  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };
  
  // Get available times based on the selected date
  const getAvailableTimes = () => {
    // For now, return a simple array of times every 30 minutes from 8 AM to 5 PM
    const times = [];
    for (let hour = 8; hour <= 17; hour++) {
      for (let minute of [0, 30]) {
        if (hour === 17 && minute > 0) continue; // Don't go past 5 PM
        times.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
    return times;
  };
  
  // Form content based on the current step
  const renderFormContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <div className="space-y-4">
              {/* Step 1: Facility and Appointment Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="facilityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location*</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(parseInt(value));
                          // Reset appointment type when facility changes
                          form.setValue("appointmentTypeId", undefined as any);
                          // Update filtered appointment types
                          const facilityId = parseInt(value);
                          const typesForFacility = allAppointmentTypes.filter(type => 
                            type.facilityId === facilityId
                          );
                          setFilteredAppointmentTypes(typesForFacility);
                        }}
                        value={field.value?.toString()}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {facilities.map((facility) => (
                            <SelectItem key={facility.id} value={facility.id.toString()}>
                              {facility.name}
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
                  name="appointmentTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dock Appointment Type*</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(parseInt(value));
                          // Get the appointment type details
                          const typeId = parseInt(value);
                          const selectedType = allAppointmentTypes.find(type => type.id === typeId);
                          if (selectedType) {
                            console.log("Selected appointment type ID:", typeId);
                            console.log("Selected appointment type:", selectedType.name, "Duration:", selectedType.duration, "minutes");
                            setSelectedAppointmentType(selectedType);
                            // Set the appointment mode based on duration
                            const recommendedMode = selectedType.duration <= 60 ? "trailer" : "container";
                            form.setValue("appointmentMode", recommendedMode);
                          }
                        }}
                        value={field.value?.toString()}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an appointment type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* Show filtered appointment types based on selected facility */}
                          {(form.getValues("facilityId") 
                            ? filteredAppointmentTypes 
                            : allAppointmentTypes
                          ).map((type) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Appointment Type Info */}
              {selectedAppointmentType && (
                <div className="bg-muted/40 p-3 rounded-md text-sm">
                  <p><strong>Duration:</strong> {selectedAppointmentType.duration} minutes</p>
                  {selectedAppointmentType.description && (
                    <p className="mt-1"><strong>Description:</strong> {selectedAppointmentType.description}</p>
                  )}
                </div>
              )}
              
              {/* Time Selection - Moved to right after appointment type info */}
              {selectedAppointmentType && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date Picker */}
                  <FormField
                    control={form.control}
                    name="appointmentDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date*</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value), "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  // Ensure we're using the selected date exactly as is
                                  const year = date.getFullYear();
                                  const month = date.getMonth() + 1;
                                  const day = date.getDate();
                                  const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                  field.onChange(formattedDate);
                                }
                              }}
                              disabled={(date) => {
                                // Disable dates in the past
                                return date < new Date(new Date().setHours(0, 0, 0, 0));
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Time Picker */}
                  <FormField
                    control={form.control}
                    name="appointmentTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time*</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a time">
                                {field.value ? (
                                  <div className="flex items-center">
                                    <Clock className="mr-2 h-4 w-4" />
                                    {field.value}
                                  </div>
                                ) : (
                                  "Select a time"
                                )}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getAvailableTimes().map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
            
            {/* Step 1 Navigation */}
            <div className="flex justify-between mt-6">
              {mode === "external" && showBackButton ? (
                <Button type="button" variant="outline" onClick={onClose}>
                  Back
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              )}
              <Button 
                type="button" 
                onClick={() => setStep(2)}
                disabled={!form.getValues("facilityId") || !form.getValues("appointmentTypeId")}
              >
                Next
              </Button>
            </div>
          </>
        );
        
      case 2:
        return (
          <>
            <div className="space-y-4">
              {/* Step 2: Carrier Information */}
              <h3 className="text-lg font-medium">Carrier Information</h3>
              
              <FormField
                control={form.control}
                name="carrierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier*</FormLabel>
                    <CarrierSelector 
                      form={form}
                      idFieldName="carrierId"
                      nameFieldName="carrierName"
                      mcNumberFieldName="mcNumber"
                    />
                    <FormDescription>
                      Select a carrier from the list or enter a custom carrier name below.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter customer name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="mcNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MC Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter MC number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Step 2: Truck & Driver Information */}
              <h3 className="text-lg font-medium mt-6">Truck & Driver Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="truckNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Truck Number*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter truck number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="trailerNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trailer Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter trailer number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="driverName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Driver Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter driver name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="driverPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Driver Phone*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Appointment Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Appointment Type*</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="inbound" id="inbound" />
                          <Label htmlFor="inbound">Inbound (Delivery)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="outbound" id="outbound" />
                          <Label htmlFor="outbound">Outbound (Pickup)</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Step 2 Navigation */}
            <div className="flex justify-between mt-6">
              <Button type="button" variant="outline" onClick={goBack}>
                Back
              </Button>
              <Button 
                type="button" 
                onClick={() => setStep(3)}
                disabled={!form.getValues("customerName") || !form.getValues("truckNumber")}
              >
                Next
              </Button>
            </div>
          </>
        );
        
      case 3:
        return (
          <>
            <div className="space-y-4">
              {/* Step 3: Scheduling & Additional Details */}
              <h3 className="text-lg font-medium">Schedule Appointment</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date Picker */}
                <FormField
                  control={form.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date*</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(new Date(field.value), "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ? new Date(field.value) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                // Ensure we're using the selected date exactly as is
                                const year = date.getFullYear();
                                const month = date.getMonth() + 1;
                                const day = date.getDate();
                                const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                field.onChange(formattedDate);
                              }
                            }}
                            disabled={(date) => {
                              // Disable dates in the past
                              return date < new Date(new Date().setHours(0, 0, 0, 0));
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Time Picker */}
                <FormField
                  control={form.control}
                  name="appointmentTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time*</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a time">
                              {field.value ? (
                                <div className="flex items-center">
                                  <Clock className="mr-2 h-4 w-4" />
                                  {field.value}
                                </div>
                              ) : (
                                "Select a time"
                              )}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getAvailableTimes().map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Additional Details */}
              <h3 className="text-lg font-medium pt-4">Additional Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bolNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BOL Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter BOL number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="poNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PO Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter PO number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="palletCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pallet Count</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="Enter pallet count" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (lbs)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="Enter weight" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Notes Field */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any additional notes or instructions" 
                        className="min-h-[120px]" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Show a summary of the appointment */}
              <Alert className="mt-4">
                <AlertDescription>
                  <div className="font-medium">Appointment Summary:</div>
                  <div className="text-sm mt-2 space-y-1">
                    <p><strong>Location:</strong> {
                      facilities.find(f => f.id === form.getValues("facilityId"))?.name || "Unknown"
                    }</p>
                    <p><strong>Type:</strong> {
                      allAppointmentTypes.find(t => t.id === form.getValues("appointmentTypeId"))?.name || "Unknown"
                    }</p>
                    <p><strong>Date/Time:</strong> {form.getValues("appointmentDate")} at {form.getValues("appointmentTime")}</p>
                    <p><strong>Customer:</strong> {form.getValues("customerName")}</p>
                    <p><strong>Direction:</strong> {form.getValues("type") === "inbound" ? "Inbound (Delivery)" : "Outbound (Pickup)"}</p>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
            
            {/* Step 3 Navigation */}
            <div className="flex justify-between mt-6">
              <Button type="button" variant="outline" onClick={goBack}>
                Back
              </Button>
              <Button 
                type="button" 
                onClick={form.handleSubmit(onSubmit)} 
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Creating..." : "Create Appointment"}
              </Button>
            </div>
          </>
        );
        
      default:
        return null;
    }
  };
  
  // Render the form either in a dialog (internal mode) or as a regular component (external mode)
  if (mode === "internal") {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMode === "create" ? "Create New Appointment" : "Edit Appointment"}
            </DialogTitle>
            <DialogDescription>
              {step === 1 
                ? "Select location and appointment type" 
                : step === 2 
                  ? "Enter truck and carrier information" 
                  : "Schedule appointment details"}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {renderFormContent()}
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  } else {
    // External mode (embedded form)
    return (
      <div className={containerClass}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {renderFormContent()}
          </form>
        </Form>
      </div>
    );
  }
}