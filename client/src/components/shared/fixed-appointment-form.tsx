import { useState, useEffect, useCallback, ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useAppointmentAvailability } from "@/hooks/use-appointment-availability";
import { AvailabilitySlot } from "@/lib/appointment-availability";
import { Schedule, Dock, Carrier, Facility, AppointmentType } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { format, addHours, addMinutes, isBefore, startOfDay, parse } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CarrierSelector } from "@/components/shared/carrier-selector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, ArrowRight, Calendar as CalendarIcon, CheckCircle, Clock, Loader2, Upload, FileText } from "lucide-react";
import BolUpload from "./bol-upload";
import { ParsedBolData } from "@/lib/ocr-service";
import { utcToFacilityTime, facilityTimeToUtc, utcToUserTime, formatInFacilityTimeZone } from "@/lib/timezone-utils";

/**
 * This is a fixed version of the appointment form that uses a single Form context
 * to prevent FormContext null errors.
 */

// Validation schemas
const appointmentFormSchema = z.object({
  // Carrier and customer info
  carrierId: z.number().optional(),
  carrierName: z.string().optional(),
  mcNumber: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  
  // Truck/appointment details
  type: z.enum(["inbound", "outbound"]),
  appointmentMode: z.enum(["trailer", "container"]),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(1, "Driver phone is required"),
  driverEmail: z.string().email("Please enter a valid email").optional(),
  
  // Schedule details
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Time is required"),
  dockId: z.number().optional(),
  bolNumber: z.string().optional(),
  poNumber: z.string().optional(),
  palletCount: z.union([z.string(), z.number()]).optional(),
  weight: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

type AppointmentFormMode = "internal" | "external";

interface FixedAppointmentFormProps {
  mode: AppointmentFormMode;
  isOpen?: boolean; // For internal mode dialog
  onClose?: () => void; // For internal mode
  initialData?: Schedule;
  editMode?: "create" | "edit";
  initialDate?: Date;
  initialDockId?: number;
  appointmentTypeId?: number;
  facilityId?: number;
  facilityTimezone?: string;
  onSubmitSuccess?: (data: any) => void;
  // For external mode
  bookingPageSlug?: string;
  preSelectedLocation?: string;
  preSelectedType?: string;
  containerClass?: string; // For styling
  showBackButton?: boolean;
  goBack?: () => void;
}

export default function FixedAppointmentForm({
  mode,
  isOpen = false,
  onClose = () => {},
  initialData,
  editMode = "create",
  initialDate,
  initialDockId,
  appointmentTypeId,
  facilityId,
  facilityTimezone = "America/New_York",
  onSubmitSuccess,
  bookingPageSlug,
  preSelectedLocation,
  preSelectedType,
  containerClass = "",
  showBackButton = false,
  goBack = () => {},
}: FixedAppointmentFormProps) {
  // State
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bolProcessing, setBolProcessing] = useState(false);
  const [bolPreviewText, setBolPreviewText] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Fetch appointment type if specified
  const { data: selectedAppointmentType } = useQuery({
    queryKey: ["/api/appointment-types", appointmentTypeId],
    queryFn: async () => {
      if (!appointmentTypeId) return null;
      const res = await apiRequest("GET", `/api/appointment-types/${appointmentTypeId}`);
      return await res.json() as AppointmentType;
    },
    enabled: !!appointmentTypeId,
  });
  
  // Fetch facilities
  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });
  
  // Fetch docks
  const { data: allDocks = [] } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });
  
  // Filter docks by selected facility
  const selectedFacilityId = selectedAppointmentType?.facilityId || facilityId;
  const docks = selectedFacilityId 
    ? allDocks.filter(dock => dock.facilityId === selectedFacilityId)
    : allDocks;
    
  // Fetch carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });
  
  // Set up default end time based on appointment type
  const getDefaultEndTime = (startDate: Date, type: "trailer" | "container") => {
    // If we have a selected appointment type, use its duration
    if (selectedAppointmentType) {
      // Convert minutes to hours for the addHours function
      const hours = selectedAppointmentType.duration / 60;
      return addHours(startDate, hours);
    }
    
    // Fallback: Trailer = 1 hour, Container = 4 hours
    return addHours(startDate, type === "trailer" ? 1 : 4);
  };
  
  // Initialize form with all fields - THIS IS THE KEY CHANGE
  // No separate forms for different steps, just ONE form
  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: initialData
      ? {
          carrierId: initialData.carrierId || undefined,
          carrierName: initialData.customerName || "",
          customerName: initialData.customerName || "",
          mcNumber: initialData.mcNumber || "",
          truckNumber: initialData.truckNumber || "",
          trailerNumber: initialData.trailerNumber || "",
          driverName: initialData.driverName || "",
          driverPhone: initialData.driverPhone || "",
          type: initialData.type as "inbound" | "outbound",
          appointmentMode: initialData.appointmentMode as "trailer" | "container",
          appointmentDate: (() => {
            try {
              const dateObj = new Date(initialData.startTime);
              if (!isNaN(dateObj.getTime())) {
                return format(dateObj, "yyyy-MM-dd");
              }
            } catch (error) {
              console.error("Error formatting initialData.startTime:", error);
            }
            return format(new Date(), "yyyy-MM-dd");
          })(),
          appointmentTime: (() => {
            try {
              const dateObj = new Date(initialData.startTime);
              if (!isNaN(dateObj.getTime())) {
                return format(dateObj, "HH:mm");
              }
            } catch (error) {
              console.error("Error formatting initialData.startTime:", error);
            }
            return "09:00";
          })(),
          dockId: initialData.dockId || undefined,
          bolNumber: initialData.bolNumber || "",
          poNumber: initialData.poNumber || "",
          palletCount: initialData.palletCount || "",
          weight: initialData.weight || "",
          notes: initialData.notes || "",
        }
      : {
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
          appointmentDate: (() => {
            if (initialDate) {
              try {
                const dateObj = initialDate instanceof Date ? initialDate : new Date(initialDate);
                if (!isNaN(dateObj.getTime())) {
                  return format(dateObj, "yyyy-MM-dd");
                }
              } catch (error) {
                console.error("Error formatting initialDate:", error);
              }
            }
            return format(new Date(), "yyyy-MM-dd");
          })(),
          appointmentTime: (() => {
            if (initialDate) {
              try {
                const dateObj = initialDate instanceof Date ? initialDate : new Date(initialDate);
                if (!isNaN(dateObj.getTime())) {
                  return format(dateObj, "HH:mm");
                }
              } catch (error) {
                console.error("Error formatting initialDate for time:", error);
              }
            }
            return "09:00";
          })(),
          dockId: initialDockId || undefined,
          bolNumber: "",
          poNumber: "",
          palletCount: "",
          weight: "",
          notes: "",
        },
  });
  
  // Watch appointment mode for duration changes
  const appointmentMode = form.watch("appointmentMode");
  
  // Effect to update dock selection when initialDockId changes
  useEffect(() => {
    if (initialDockId && !initialData) {
      console.log("Setting dockId from initialDockId:", initialDockId);
      form.setValue("dockId", initialDockId);
    }
  }, [initialDockId, form, initialData]);
  
  // Set appointment mode based on appointment type when it loads
  useEffect(() => {
    if (selectedAppointmentType) {
      const recommendedMode = selectedAppointmentType.duration <= 60 ? "trailer" : "container";
      console.log(`Setting appointment mode to ${recommendedMode} based on appointment type`);
      form.setValue("appointmentMode", recommendedMode);
    }
  }, [selectedAppointmentType, form]);
  
  // Availability API functions
  const { 
    fetchAvailabilityForDate, 
    availableTimeSlots, 
    isLoading: isLoadingAvailability, 
    error: availabilityError 
  } = useAppointmentAvailability({
    facilityId: selectedFacilityId,
    typeId: appointmentTypeId,  // Use typeId as expected by the hook's API
    appointmentTypeId: appointmentTypeId,  // Also include for backward compatibility
    mode: appointmentMode,
    facilityTimezone: facilityTimezone
  });
  
  // Wrapper function for availability
  const fetchAvailability = useCallback((dateString: string) => {
    if (dateString && selectedFacilityId) {
      fetchAvailabilityForDate(dateString);
    }
  }, [fetchAvailabilityForDate, selectedFacilityId]);
  
  // Effect to fetch availability when date changes
  useEffect(() => {
    const appointmentDate = form.watch("appointmentDate");
    if (appointmentDate && selectedFacilityId) {
      fetchAvailability(appointmentDate);
    }
  }, [form.watch("appointmentDate"), selectedFacilityId, fetchAvailability]);
  
  // Handle BOL processing
  const handleBolProcessed = (data: ParsedBolData, fileUrl: string) => {
    // Update form with extracted data
    if (data.bolNumber) {
      form.setValue("bolNumber", data.bolNumber);
    }
    
    if (data.palletCount) {
      form.setValue("palletCount", data.palletCount.toString());
    }
    
    // Preview text
    setBolPreviewText(
      `Bill of Lading #${data.bolNumber || "N/A"}
      Pallet Count: ${data.palletCount || "N/A"}
      Weight: ${data.weight || "N/A"}`
    );
    
    toast({
      title: "BOL Processed",
      description: "Information has been extracted from the document.",
    });
  };
  
  // Helper for BOL processing state
  const handleBolProcessingStateChange = (isProcessing: boolean) => {
    setBolProcessing(isProcessing);
  };
  
  // Handle carrier selection
  const handleCarrierSelect = (carrier: Carrier) => {
    if (carrier) {
      form.setValue("carrierId", carrier.id);
      form.setValue("mcNumber", carrier.mcNumber || "");
    }
  };
  
  // For next step transition
  const handleNextStep = async () => {
    // Validate only the first step fields
    const result = await form.trigger([
      "carrierId", "carrierName", "customerName", "mcNumber", 
      "truckNumber", "trailerNumber", "driverName", "driverPhone",
      "type", "appointmentMode"
    ]);
    
    if (result) {
      setStep(2);
    }
  };
  
  // Create mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/schedules", data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || `Server error: ${res.status}`);
      }
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Appointment created",
        description: "The appointment has been created successfully.",
      });
      
      if (onSubmitSuccess) {
        onSubmitSuccess(data);
      }
      
      if (mode === "internal") {
        onClose();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create appointment",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });
  
  // Update mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/schedules/${id}`, data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || `Server error: ${res.status}`);
      }
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Appointment updated",
        description: "The appointment has been updated successfully.",
      });
      
      if (onSubmitSuccess) {
        onSubmitSuccess(data);
      }
      
      if (mode === "internal") {
        onClose();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update appointment",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });
  
  // Form submission
  const onSubmit = async (data: AppointmentFormValues) => {
    setIsSubmitting(true);
    
    try {
      // Create date objects from form inputs
      const appointmentDate = data.appointmentDate;
      const appointmentTime = data.appointmentTime;
      
      if (!appointmentDate || !appointmentTime) {
        toast({
          title: "Missing Fields",
          description: "Date and time are required for scheduling an appointment.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Create Date object from input
      let startTime: Date;
      try {
        startTime = new Date(`${appointmentDate}T${appointmentTime}`);
        
        // Validate that we have a proper date
        if (isNaN(startTime.getTime())) {
          throw new Error("Invalid date created from inputs");
        }
      } catch (error) {
        console.error("Error creating date:", error);
        toast({
          title: "Invalid Date/Time",
          description: "Please select a valid date and time.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Calculate end time based on appointment type or default duration
      const endTime = getDefaultEndTime(startTime, data.appointmentMode);
      
      // Prepare API payload
      const scheduleData = {
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
        palletCount: data.palletCount ? parseInt(data.palletCount.toString()) : 0,
        weight: data.weight ? parseInt(data.weight.toString()) : 0,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        type: data.type as "inbound" | "outbound",
        appointmentTypeId: appointmentTypeId || null,
        appointmentMode: data.appointmentMode as "trailer" | "container",
        status: "scheduled",
        notes: data.notes || "",
        createdBy: user?.id || null,
        facilityId: selectedFacilityId || null,
        facilityTimezone: facilityTimezone,
      };
      
      // Execute create or update mutation
      if (initialData && editMode === "edit") {
        updateScheduleMutation.mutate({ id: initialData.id, data: scheduleData });
      } else {
        createScheduleMutation.mutate(scheduleData);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "Form Error",
        description: "There was a problem processing the form data. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };
  
  // Render component based on mode
  if (mode === "internal") {
    // Modal dialog mode for internal scheduling
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode === "create" ? "Create New Appointment" : "Edit Appointment"}</DialogTitle>
            <DialogDescription>
              {editMode === "create" 
                ? "Fill out the form below to create a new dock appointment." 
                : "Update the appointment details below."}
            </DialogDescription>
          </DialogHeader>
          
          {/* Common error state */}
          {!selectedAppointmentType && appointmentTypeId && (
            <div className="p-6 text-center">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Unable to load appointment type. Please try again or contact support.
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          {/* Form with single context - KEY IMPLEMENTATION */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Step 1: Carrier Information */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Facility Section */}
                  {mode === "internal" && (
                    <>
                      {/* Facility Selection (Location) */}
                      <div className="space-y-2">
                        <Label htmlFor="facility-select">Location*</Label>
                        <Select
                          value={selectedFacilityId?.toString() || ""}
                          onValueChange={(value) => {
                            const facilityId = parseInt(value);
                            window.location.href = `/schedules/new?facilityId=${facilityId}`;
                          }}
                          disabled={!!facilityId || !!selectedAppointmentType}
                        >
                          <SelectTrigger id="facility-select">
                            <SelectValue placeholder="Select Facility" />
                          </SelectTrigger>
                          <SelectContent>
                            {facilities.map((facility) => (
                              <SelectItem key={facility.id} value={facility.id.toString()}>
                                {facility.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Appointment Type Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="appointment-type-select">Dock Appointment Type*</Label>
                        <Select
                          value={appointmentTypeId?.toString() || ""}
                          onValueChange={(value) => {
                            const typeId = parseInt(value);
                            window.location.href = `/schedules/new?appointmentTypeId=${typeId}`;
                          }}
                          disabled={!!appointmentTypeId || !!selectedAppointmentType}
                        >
                          <SelectTrigger id="appointment-type-select">
                            <SelectValue placeholder="Select Appointment Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Filter appointment types by facility */}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  
                  {/* Carrier Selection */}
                  <div className="space-y-4">
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
                    
                    {/* Custom carrier name */}
                    <FormField
                      control={form.control}
                      name="carrierName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Custom Carrier Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter carrier name if not in the list above" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
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
                      
                    {/* MC Number */}
                    <FormField
                      control={form.control}
                      name="mcNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MC Number</FormLabel>
                          <FormControl>
                            <Input placeholder="MC123456" {...field} />
                          </FormControl>
                          <FormDescription>
                            Motor Carrier Number (if applicable)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Customer */}
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
                  
                  {/* Type (Inbound/Outbound) */}
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type*</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="inbound">Inbound</SelectItem>
                            <SelectItem value="outbound">Outbound</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Appointment Mode (Trailer/Container) */}
                  <FormField
                    control={form.control}
                    name="appointmentMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appointment Mode*</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select mode" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="trailer">Trailer</SelectItem>
                            <SelectItem value="container">Container</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Truck and Trailer Information */}
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
                            <Input placeholder="Enter trailer number (optional)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Driver Information */}
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
                      name="driverEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Driver Email <span className="text-xs text-muted-foreground">(for confirmations)</span></FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Enter driver email" {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Email address is needed to send appointment confirmations
                          </FormDescription>
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
                            <Input placeholder="Enter driver phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Step 1 Actions */}
                  <div className="flex justify-between mt-6">
                    {showBackButton && (
                      <Button type="button" variant="outline" onClick={goBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                    )}
                    <Button 
                      type="button" 
                      className="ml-auto"
                      onClick={handleNextStep}
                    >
                      Next <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Step 2: Date/Time Selection */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Date and Time Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Date selection */}
                    <FormField
                      control={form.control}
                      name="appointmentDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Appointment Date*</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(parse(field.value, "yyyy-MM-dd", new Date()), "PPP")
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
                                selected={field.value ? parse(field.value, "yyyy-MM-dd", new Date()) : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    const formattedDate = format(date, "yyyy-MM-dd");
                                    field.onChange(formattedDate);
                                    // Fetch availability when date changes
                                    fetchAvailability(formattedDate);
                                  }
                                }}
                                disabled={(date) => {
                                  // Can't select dates in the past
                                  return isBefore(date, startOfDay(new Date()));
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Time selection */}
                    <FormField
                      control={form.control}
                      name="appointmentTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Appointment Time*</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={availableTimeSlots.length === 0 || isLoadingAvailability}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select time" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isLoadingAvailability ? (
                                <div className="p-2 text-center">
                                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                  Loading available times...
                                </div>
                              ) : availableTimeSlots.length === 0 ? (
                                <div className="p-2 text-center text-muted-foreground">
                                  No available time slots
                                </div>
                              ) : (
                                availableTimeSlots.map((slot) => (
                                  <SelectItem
                                    key={slot.time}
                                    value={slot.time}
                                    disabled={!slot.available}
                                    className={!slot.available ? "opacity-50" : ""}
                                  >
                                    <div className="flex items-center">
                                      <Clock className="h-3 w-3 mr-2" />
                                      <span>
                                        {slot.time}{" "}
                                        {!slot.available && slot.reason && (
                                          <span className="text-xs text-muted-foreground ml-1">
                                            ({slot.reason})
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {availabilityError && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{availabilityError}</AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Dock selection */}
                  <FormField
                    control={form.control}
                    name="dockId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dock (Optional)</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(parseInt(value))} 
                          value={field.value?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a dock (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {docks.map((dock) => (
                              <SelectItem key={dock.id} value={dock.id.toString()}>
                                {dock.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Bill of Lading and PO Number */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bolNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bill of Lading Number</FormLabel>
                          <FormControl>
                            <div className="flex flex-col">
                              <Input className="flex-grow mb-2" placeholder="Enter BOL number" {...field} />
                              <BolUpload
                                onBolProcessed={handleBolProcessed}
                                onProcessingStateChange={handleBolProcessingStateChange}
                              />
                            </div>
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
                  
                  {/* BOL Preview (if available) */}
                  {(bolProcessing || bolPreviewText) && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-md">
                      <p className="font-semibold mb-2">Bill of Lading Preview</p>
                      {bolProcessing ? (
                        <div className="flex items-center">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span>Processing Bill of Lading...</span>
                        </div>
                      ) : (
                        <>
                          {bolPreviewText && (
                            <p className="whitespace-pre-line">{bolPreviewText}</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Cargo Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="palletCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pallet Count</FormLabel>
                          <FormControl>
                            <Input placeholder="Number of pallets" {...field} />
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
                            <Input placeholder="Total weight" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter any special instructions or notes" 
                            className="min-h-24"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Step 2 Actions */}
                  <div className="flex justify-between mt-6">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button type="submit" className="ml-auto">
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editMode === "create" ? "Create Appointment" : "Update Appointment"}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  } else {
    // External booking mode - embedded form (non-dialog)
    return (
      <div className={`space-y-6 ${containerClass}`}>
        <h2 className="text-2xl font-bold">Book a Dock Appointment</h2>
        
        {/* Form with single context - KEY IMPLEMENTATION */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Step 1: Carrier Information */}
            {step === 1 && (
              <div className="space-y-4">
                {/* Same fields as internal, but with any external-specific customizations */}
                {/* Carrier Selection */}
                <div className="space-y-4">
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
                  
                  {/* Custom carrier name */}
                  <FormField
                    control={form.control}
                    name="carrierName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Carrier Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter carrier name if not in the list above" 
                            {...field} 
                            onChange={(e) => {
                              field.onChange(e);
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
                    
                  {/* MC Number */}
                  <FormField
                    control={form.control}
                    name="mcNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MC Number</FormLabel>
                        <FormControl>
                          <Input placeholder="MC123456" {...field} />
                        </FormControl>
                        <FormDescription>
                          Motor Carrier Number (if applicable)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Customer */}
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
                
                {/* Type (Inbound/Outbound) */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type*</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="inbound">Inbound</SelectItem>
                          <SelectItem value="outbound">Outbound</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Rest of step 1 fields */}
                
                {/* Step 1 Actions */}
                <div className="flex justify-between mt-6">
                  {showBackButton && (
                    <Button type="button" variant="outline" onClick={goBack}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                  )}
                  <Button 
                    type="button" 
                    className="ml-auto"
                    onClick={handleNextStep}
                  >
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {/* Step 2: Date/Time Selection - same as internal mode */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Same fields as internal */}
                
                {/* Step 2 Actions */}
                <div className="flex justify-between mt-6">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button type="submit" className="ml-auto">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Book Appointment
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </div>
    );
  }
}