import { useState, useEffect, useCallback, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  facilityName: z.string().optional(),
  facilityTimezone: z.string().optional(),
  appointmentTypeId: z.coerce.number({
    required_error: "Please select an appointment type",
    invalid_type_error: "Please select a valid appointment type",
  }),
  appointmentTypeName: z.string().optional(),
  
  // Carrier & truck information
  carrierId: z.coerce.number().optional(),
  carrierName: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  mcNumber: z.string().optional(),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(6, "Valid phone number is required"),
  driverEmail: z.string().email().optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  
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
  
  // Custom questions/fields
  customFields: z.record(z.string(), z.any()).optional(),
  
  // Other details
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
  
  // State for available time slots
  const [availableTimeSlots, setAvailableTimeSlots] = useState<{ time: string; available: boolean; remainingCapacity?: number }[]>([]);
  const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState(false);
  
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
      driverEmail: initialData.driverEmail || "",
      contactEmail: initialData.contactEmail || "",
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
      customFields: initialData.customFields || {},
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
      driverEmail: "",
      contactEmail: "",
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
      customFields: {},
    }
  });
  
  // Filtered appointment types based on selected facility
  const [filteredAppointmentTypes, setFilteredAppointmentTypes] = useState<AppointmentType[]>([]);
  
  // Watch for facilityId changes to update filtered appointment types and timezone
  const watchedFacilityId = form.watch("facilityId");
  const lastFacilityIdRef = useRef<number | undefined>(watchedFacilityId);
  
  useEffect(() => {
    // Only run if facility ID actually changed
    if (watchedFacilityId !== lastFacilityIdRef.current) {
      lastFacilityIdRef.current = watchedFacilityId;
      
      if (watchedFacilityId) {
        // Filter appointment types for this facility
        const typesForFacility = allAppointmentTypes.filter(type => type.facilityId === watchedFacilityId);
        setFilteredAppointmentTypes(typesForFacility);
        
        // Update facility timezone in the form
        const selectedFacility = facilities.find(f => f.id === watchedFacilityId);
        if (selectedFacility && selectedFacility.timezone) {
          console.log(`Updating facility timezone to ${selectedFacility.timezone}`);
          form.setValue("facilityTimezone", selectedFacility.timezone);
        }
      } else {
        setFilteredAppointmentTypes(allAppointmentTypes);
      }
    }
  }, [watchedFacilityId, allAppointmentTypes, facilities, form]);
  
  // Watch for appointment type changes - use callback to avoid triggering another render
  const watchedAppointmentTypeId = form.watch("appointmentTypeId");
  const lastAppointmentTypeIdRef = useRef<number | undefined>(watchedAppointmentTypeId);
  
  // Fetch custom questions for selected appointment type
  const { data: customQuestions = [], isLoading: isLoadingCustomQuestions } = useQuery<any[]>({
    queryKey: ["/api/custom-questions", watchedAppointmentTypeId],
    enabled: !!watchedAppointmentTypeId,
  });
  
  useEffect(() => {
    // Only run if appointment type actually changed
    if (watchedAppointmentTypeId !== lastAppointmentTypeIdRef.current) {
      lastAppointmentTypeIdRef.current = watchedAppointmentTypeId;
      
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
    }
  }, [watchedAppointmentTypeId, allAppointmentTypes]);
  
  // Watch for date changes to fetch available slots
  const watchedAppointmentDate = form.watch("appointmentDate");
  
  // Effect to fetch available time slots when date, facility or appointment type changes
  useEffect(() => {
    const fetchAvailableTimes = async () => {
      // We need date, facility ID, and appointment type ID to fetch availability
      const facilityId = form.getValues("facilityId");
      const appointmentTypeId = form.getValues("appointmentTypeId");
      const appointmentDate = form.getValues("appointmentDate");
      
      if (!facilityId || !appointmentTypeId || !appointmentDate) {
        console.log("[Internal Form] Missing required data for availability:", { 
          facilityId, appointmentTypeId, appointmentDate 
        });
        return;
      }
      
      try {
        setIsLoadingTimeSlots(true);
        console.log(`[Internal Form] Fetching available times for facilityId=${facilityId}, typeId=${appointmentTypeId}, date=${appointmentDate}`);
        
        // Call the availability API endpoint used by the external booking system
        const response = await fetch(`/api/availability?date=${appointmentDate}&facilityId=${facilityId}&typeId=${appointmentTypeId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch available times: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("[Internal Form] Available times response:", data);
        
        // Process the slots from the API response
        if (data.slots && Array.isArray(data.slots)) {
          // Sort time slots by time
          const sortedSlots = [...data.slots].sort((a: {time: string}, b: {time: string}) => a.time.localeCompare(b.time));
          setAvailableTimeSlots(sortedSlots);
        } else if (data.availableTimes && Array.isArray(data.availableTimes)) {
          // Fallback to the simple time array if no detailed slots
          const basicSlots = data.availableTimes.map((time: string) => ({
            time,
            available: true,
            remainingCapacity: 1
          }));
          setAvailableTimeSlots(basicSlots.sort((a: {time: string}, b: {time: string}) => a.time.localeCompare(b.time)));
        } else {
          // If no data, set empty array
          setAvailableTimeSlots([]);
        }
      } catch (error) {
        console.error("[Internal Form] Error fetching available times:", error);
        toast({
          title: "Error",
          description: "Failed to load available appointment times",
          variant: "destructive",
        });
        setAvailableTimeSlots([]);
      } finally {
        setIsLoadingTimeSlots(false);
      }
    };
    
    fetchAvailableTimes();
  }, [watchedAppointmentDate, watchedAppointmentTypeId, form]);
  
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
      
      // Get facility information
      const selectedFacility = facilities.find(f => f.id === data.facilityId);
      const facilityName = selectedFacility?.name || "";
      
      // Get appointment type information
      const selectedAppType = allAppointmentTypes.find(type => type.id === data.appointmentTypeId);
      const appointmentTypeName = selectedAppType?.name || "";
      
      // Make sure facilityId is always defined (preventing "No facility assigned" errors)
      const facilityId = data.facilityId ? parseInt(data.facilityId.toString()) : null;
      
      // Ensure we have facility information to display in appointments list
      if (!facilityId) {
        toast({
          title: "Missing Facility",
          description: "Please select a facility for this appointment.",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }
      
      // Get facility information from the facilities list
      const facilityInfo = facilities.find(f => f.id === facilityId);
      const facilityNameToUse = facilityInfo?.name || "Unknown Facility";
      
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
        driverEmail: data.driverEmail || "", // Add driver email for notifications
        contactEmail: data.contactEmail || "", // Additional email for notifications
        bolNumber: data.bolNumber || "",
        poNumber: data.poNumber || "",
        palletCount: data.palletCount ? parseInt(data.palletCount) : 0,
        weight: data.weight ? parseInt(data.weight) : 0,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        type: data.type,
        appointmentTypeId: data.appointmentTypeId,
        appointmentTypeName: appointmentTypeName, // Add the appointment type name
        appointmentMode: data.appointmentMode,
        status: data.status || "scheduled",
        notes: data.notes || "",
        createdBy: user?.id || null,
        facilityId: facilityId,
        facilityName: facilityNameToUse, // Ensure we're getting the correct facility name
        facilityTimezone: data.facilityTimezone || facilityTimezone,
        // Include custom fields data
        customFields: data.customFields || {}
      };
      
      // If custom carrier, add the new carrier data
      if (!data.carrierId && data.carrierName) {
        formattedData.newCarrier = {
          name: data.carrierName || "Custom Carrier",
          mcNumber: data.mcNumber || "",
          contactName: data.driverName || "",
          contactEmail: "",
          contactPhone: data.driverPhone || "",
        };
      }
      
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
        driverEmail: "",
        contactEmail: "",
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
        customFields: {},
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
    
    // Create a sanitized copy of the data
    const sanitizedData = { ...data };
    
    // Ensure date format is correct - always in YYYY-MM-DD format
    if (sanitizedData.appointmentDate) {
      try {
        // Check if it's in YYYY-MM-DD format
        if (typeof sanitizedData.appointmentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sanitizedData.appointmentDate)) {
          // Already in correct format, no need to change
          console.log("Date is already in correct format:", sanitizedData.appointmentDate);
        } else {
          // Try to parse and format it correctly
          const dateObj = new Date(sanitizedData.appointmentDate);
          if (!isNaN(dateObj.getTime())) {
            // Set time to noon to avoid timezone issues
            dateObj.setHours(12, 0, 0, 0);
            
            // Extract date components
            const year = dateObj.getFullYear();
            const monthValue = dateObj.getMonth() + 1;
            const dayValue = dateObj.getDate();
            
            // Format with proper zero-padding
            const month = String(monthValue).padStart(2, '0');
            const day = String(dayValue).padStart(2, '0');
            
            sanitizedData.appointmentDate = `${year}-${month}-${day}`;
            console.log("Reformatted date for submission:", sanitizedData.appointmentDate);
          }
        }
      } catch (e) {
        console.error("Error processing date for submission:", e);
      }
    }
    
    // Extract just the time part from appointmentTime if it includes availability info
    // and ensure it's in the correct format (HH:MM)
    if (sanitizedData.appointmentTime) {
      try {
        if (sanitizedData.appointmentTime.includes('(')) {
          // Extract just the time part
          sanitizedData.appointmentTime = sanitizedData.appointmentTime.split(' (')[0].trim();
        }
        
        // Ensure proper format (HH:MM) - many validation errors are due to incorrect time format
        if (sanitizedData.appointmentTime.match(/^\d{1,2}:\d{2}$/)) {
          // Make sure the hour portion is zero-padded
          const [hour, minute] = sanitizedData.appointmentTime.split(':');
          sanitizedData.appointmentTime = `${hour.padStart(2, '0')}:${minute}`;
        }
        
        console.log("Sanitized time for submission:", sanitizedData.appointmentTime);
      } catch (e) {
        console.error("Error processing time for submission:", e);
      }
    }
    
    console.log("Submitting appointment with sanitized data:", sanitizedData);
    
    // Call the mutation function with the sanitized data
    createAppointmentMutation.mutate(sanitizedData);
  };
  
  // Handle going back a step
  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };
  
  // Get available times based on the selected date and appointment type
  const getAvailableTimes = () => {
    // If we're loading, show loading indicator in the first slot
    if (isLoadingTimeSlots) {
      return ["Loading available times..."];
    }
    
    // If we don't have any slots, return a message
    if (availableTimeSlots.length === 0) {
      return ["No time slots available"];
    }
    
    // Get the facility timezone
    const facilityTz = form.getValues("facilityTimezone") || facilityTimezone;
    
    // Format time slots with availability information
    return availableTimeSlots
      .filter(slot => slot.available)
      .map(slot => {
        const capacity = slot.remainingCapacity !== undefined ? slot.remainingCapacity : 1;
        return `${slot.time} (${capacity} available)`;
      });
  };
  
  // Get the next available time slot (closest full hour)
  const getDefaultTimeSlot = () => {
    // First, check if we have actual available time slots from the API
    if (availableTimeSlots.length > 0 && availableTimeSlots.some(slot => slot.available)) {
      // Find the first available slot
      const firstAvailableSlot = availableTimeSlots.find(slot => slot.available);
      if (firstAvailableSlot) {
        const capacity = firstAvailableSlot.remainingCapacity !== undefined 
          ? firstAvailableSlot.remainingCapacity 
          : 1;
        return `${firstAvailableSlot.time} (${capacity} available)`;
      }
    }
    
    // Fallback to standard time slots if no API data is available
    const now = new Date();
    const currentHour = now.getHours();
    const nextHour = currentHour + 1;
    
    // Get selected date
    const selectedDate = form.getValues("appointmentDate");
    let isToday = false;
    
    // Check if the selected date is today
    if (selectedDate) {
      try {
        if (typeof selectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
          const dateParts = selectedDate.split('-');
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10);
          const day = parseInt(dateParts[2], 10);
          
          const today = new Date();
          isToday = (
            year === today.getFullYear() && 
            month === today.getMonth() + 1 && 
            day === today.getDate()
          );
        }
      } catch (e) {
        console.error("Error parsing date when getting default time slot:", e);
      }
    }
    
    // The selected appointment type 
    const appointmentType = form.getValues("appointmentTypeId") 
      ? allAppointmentTypes.find(type => type.id === form.getValues("appointmentTypeId"))
      : null;
    const maxConcurrent = appointmentType?.maxConcurrent || 1;
    
    // Get day of week from the selected date (0-6, where 0 is Sunday)
    let dayOfWeek = 0;
    if (selectedDate) {
      try {
        const dateParts = selectedDate.split('-');
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-indexed
        const day = parseInt(dateParts[2], 10);
        
        const date = new Date(year, month, day);
        dayOfWeek = date.getDay();
      } catch (e) {
        console.error("Error determining day of week:", e);
      }
    }
    
    // Default facility hours (8 AM to 5 PM)
    let facilityOpenHour = 8;
    let facilityCloseHour = 17;
    
    // Weekend handling - shorter hours on Saturday, closed on Sunday
    if (dayOfWeek === 0) { // Sunday
      // No times available - return Monday morning
      return "08:00 (1 available)";
    } else if (dayOfWeek === 6) { // Saturday
      facilityOpenHour = 9; // Open later
      facilityCloseHour = 14; // Close earlier
    }
    
    // If it's today and already past opening hours, use the next available hour
    if (isToday) {
      // If it's past closing time, default to tomorrow at opening time
      if (currentHour >= facilityCloseHour - 1) {
        return `${facilityOpenHour.toString().padStart(2, '0')}:00 (${maxConcurrent} available)`;
      }
      
      // If it's within working hours, use the next hour
      if (nextHour >= facilityOpenHour && nextHour < facilityCloseHour) {
        return `${nextHour.toString().padStart(2, '0')}:00 (${maxConcurrent} available)`;
      }
      
      // If it's before opening hours, default to opening hour
      if (nextHour < facilityOpenHour) {
        return `${facilityOpenHour.toString().padStart(2, '0')}:00 (${maxConcurrent} available)`;
      }
    }
    
    // Default to 3 PM if it's not today (or 11 AM if the facility closes before 3 PM)
    const defaultHour = facilityCloseHour > 15 ? 15 : facilityOpenHour + 2;
    return `${defaultHour.toString().padStart(2, '0')}:00 (${maxConcurrent} available)`;
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
                          // Reset time-related fields as they depend on facility and appointment type
                          form.setValue("appointmentDate", format(new Date(), "yyyy-MM-dd"));
                          form.setValue("appointmentTime", "");
                          // Reset available time slots
                          setAvailableTimeSlots([]);
                          // Update filtered appointment types for the selected facility
                          const facilityId = parseInt(value);
                          const typesForFacility = allAppointmentTypes.filter(type => 
                            type.facilityId === facilityId
                          );
                          setFilteredAppointmentTypes(typesForFacility);
                          
                          // Set facility name for later use
                          const selectedFacility = facilities.find(f => f.id === facilityId);
                          if (selectedFacility) {
                            form.setValue("facilityName", selectedFacility.name);
                            form.setValue("facilityTimezone", selectedFacility.timezone || "America/New_York");
                          }
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
                            
                            // Store the appointment type name for later use
                            form.setValue("appointmentTypeName", selectedType.name);
                            
                            // Set the appointment mode based on duration
                            const recommendedMode = selectedType.duration <= 60 ? "trailer" : "container";
                            form.setValue("appointmentMode", recommendedMode);
                            
                            // Reset time-related fields as they depend on appointment type
                            form.setValue("appointmentDate", format(new Date(), "yyyy-MM-dd"));
                            form.setValue("appointmentTime", "");
                            
                            // Reset available time slots to force fetching new ones for this type
                            setAvailableTimeSlots([]);
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
                                  (() => {
                                    try {
                                      // Ensure we have a valid date object
                                      const date = new Date(field.value);
                                      if (isNaN(date.getTime())) {
                                        return <span>Pick a date</span>;
                                      }
                                      return format(date, "PPP");
                                    } catch (e) {
                                      console.error("Error formatting date:", e);
                                      return <span>Pick a date</span>;
                                    }
                                  })()
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
                                  // Create the date in local timezone to prevent date shifts
                                  // Clone the selected date to avoid reference issues
                                  const localDate = new Date(date.getTime());
                                  
                                  // Set to noon in local timezone to prevent any date shifts due to time adjustments
                                  localDate.setHours(12, 0, 0, 0);
                                  
                                  // Extract components from the local date
                                  const year = localDate.getFullYear();
                                  const month = localDate.getMonth() + 1; // JavaScript months are 0-based
                                  const day = localDate.getDate();
                                  
                                  // Format with yyyy-MM-dd pattern with padding
                                  const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                  
                                  field.onChange(formattedDate);
                                  console.log("Selected date (exactly as selected):", formattedDate);
                                }
                              }}
                              disabled={(date) => {
                                // Disable dates in the past
                                if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
                                  return true;
                                }
                                
                                // Get facility for specific restrictions
                                const facilityId = form.getValues("facilityId");
                                const facility = facilities.find(f => f.id === facilityId);
                                if (!facility) return false; // Allow all future dates if no facility selected
                                
                                // Get day of week (0 = Sunday, 1 = Monday, etc.)
                                const dayOfWeek = date.getDay();
                                
                                // Check if this day is a closed day for the facility
                                // Note: This is a simplified check - in a real scenario you would get this from facility settings
                                if (dayOfWeek === 0) {
                                  // Disable Sundays by default unless the facility explicitly allows Sunday appointments
                                  return facility.sundayOpen !== true;
                                }
                                
                                return false; // Allow all other dates
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
                        <FormLabel>Time* (Facility Time)</FormLabel>
                        <Select
                          onValueChange={(timeWithCapacity) => {
                            // Extract just the time part from the display string (e.g., "08:00 (3 available)")
                            const timeOnly = timeWithCapacity.split(' (')[0];
                            field.onChange(timeOnly);
                            console.log(`Selected time: ${timeOnly} (extracted from ${timeWithCapacity})`);
                          }}
                          defaultValue={field.value || getDefaultTimeSlot()}
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
                            {getAvailableTimes().map((timeWithCapacity) => (
                              <SelectItem key={timeWithCapacity} value={timeWithCapacity}>
                                {timeWithCapacity}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          All times are in the facility's timezone ({form.getValues("facilityTimezone") || facilityTimezone})
                        </FormDescription>
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
                onClick={() => {
                  // Prevent date and time from step 1 from appearing in the customerName and mcNumber fields
                  // by ensuring we have default values for all relevant fields
                  if (!form.getValues("customerName")) {
                    form.setValue("customerName", "");
                  }
                  if (!form.getValues("mcNumber")) {
                    form.setValue("mcNumber", "");
                  }
                  
                  setStep(2);
                }}
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
              {/* Step 2: Customer Information First */}
              <h3 className="text-lg font-medium">Customer Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter customer name" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Appointment Type */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Direction*</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-4"
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
              
              {/* Step 2: Carrier & Driver Information combined section */}
              <h3 className="text-lg font-medium mt-6">Carrier & Driver Information</h3>
              
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
                  name="mcNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MC Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter MC number" {...field} value={field.value || ''} />
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
                      <FormLabel>Truck Number*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter truck number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <FormField
                  control={form.control}
                  name="driverEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Driver Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter driver email" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription>
                        Email for driver notifications
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter contact email for notifications" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription>
                        Additional email for appointment confirmations and updates
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Step 2 Navigation */}
            <div className="flex justify-between mt-6">
              <Button type="button" variant="outline" onClick={goBack}>
                Back
              </Button>
              <Button 
                type="button" 
                onClick={() => {
                  // Initialize additional fields to prevent data contamination when going to Step 3
                  // This prevents the truck number from appearing in the weight field
                  if (!form.getValues("weight")) {
                    form.setValue("weight", undefined as any);
                  }
                  if (!form.getValues("palletCount")) {
                    form.setValue("palletCount", undefined as any);
                  }
                  if (!form.getValues("bolNumber")) {
                    form.setValue("bolNumber", "");
                  }
                  if (!form.getValues("poNumber")) {
                    form.setValue("poNumber", "");
                  }
                  
                  setStep(3);
                }}
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
              {/* Step 3: Additional Details Only - Schedule details already entered in Step 1 */}
              <h3 className="text-lg font-medium">Additional Details</h3>
              
              {/* Date/Time Confirmation - Read-only summary of already selected date/time */}
              <div className="bg-muted/40 p-3 rounded-md text-sm mb-4">
                <p className="font-medium">Appointment Schedule:</p>
                <div className="mt-1">
                  <p>
                    <strong>Date:</strong> {
                      form.getValues("appointmentDate") 
                        ? (() => {
                            try {
                              // Parse the date string with care
                              const dateVal = form.getValues("appointmentDate");
                              // Check if the value looks like a YYYY-MM-DD date
                              if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                                const [year, month, day] = dateVal.split('-').map(num => parseInt(num, 10));
                                // Months in JS are 0-indexed
                                const date = new Date(year, month - 1, day);
                                return format(date, "PPP");
                              }
                              // Alternative date format
                              return format(new Date(dateVal), "PPP");
                            } catch (e) {
                              console.error("Error formatting date in summary:", e);
                              return form.getValues("appointmentDate") || "Not selected";
                            }
                          })()
                        : "Not selected"
                    }
                  </p>
                  <p>
                    <strong>Facility Time:</strong> {form.getValues("appointmentTime") || "Not selected"} 
                    ({form.getValues("facilityTimezone") || facilityTimezone})
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Clock className="inline-block h-3 w-3 mr-1 align-text-bottom" />
                    Times are shown in the facility timezone.
                  </p>
                </div>
              </div>
              

              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bolNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BOL Identifier</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter BOL identifier" {...field} />
                      </FormControl>
                      <FormDescription>
                        Free text field - can include letters, numbers, and special characters
                      </FormDescription>
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
              
              {/* Custom Questions Section */}
              {customQuestions && customQuestions.length > 0 && (
                <div className="space-y-4 mt-4">
                  <h4 className="font-medium">Additional Information</h4>
                  <div className="border border-border rounded-md p-4 space-y-4">
                    {customQuestions.map((question) => {
                      const fieldName = `customQuestion_${question.id}`;
                      
                      switch (question.type) {
                        case 'text':
                        case 'email':
                          return (
                            <div key={question.id} className="space-y-2">
                              <label className="text-sm font-medium">
                                {question.label} {question.is_required && <span className="text-destructive">*</span>}
                              </label>
                              <Input 
                                type={question.type} 
                                placeholder={question.placeholder || `Enter ${question.label}`}
                                onChange={(e) => {
                                  // Store in form data under a dynamic field name
                                  const customFields = form.getValues('customFields') || {};
                                  form.setValue('customFields', {
                                    ...customFields,
                                    [fieldName]: e.target.value
                                  });
                                }} 
                                required={question.is_required}
                              />
                            </div>
                          );
                          
                        case 'textarea':
                          return (
                            <div key={question.id} className="space-y-2">
                              <label className="text-sm font-medium">
                                {question.label} {question.is_required && <span className="text-destructive">*</span>}
                              </label>
                              <Textarea 
                                placeholder={question.placeholder || `Enter ${question.label}`}
                                onChange={(e) => {
                                  const customFields = form.getValues('customFields') || {};
                                  form.setValue('customFields', {
                                    ...customFields,
                                    [fieldName]: e.target.value
                                  });
                                }}
                                required={question.is_required}
                              />
                            </div>
                          );
                          
                        case 'select':
                          return (
                            <div key={question.id} className="space-y-2">
                              <label className="text-sm font-medium">
                                {question.label} {question.is_required && <span className="text-destructive">*</span>}
                              </label>
                              <Select
                                onValueChange={(value) => {
                                  const customFields = form.getValues('customFields') || {};
                                  form.setValue('customFields', {
                                    ...customFields,
                                    [fieldName]: value
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Select ${question.label}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {question.options && Array.isArray(question.options) && 
                                    question.options.map((option: string, index: number) => (
                                      <SelectItem key={index} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))
                                  }
                                </SelectContent>
                              </Select>
                            </div>
                          );
                          
                        case 'checkbox':
                          return (
                            <div key={question.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`checkbox-${question.id}`}
                                onCheckedChange={(checked) => {
                                  const customFields = form.getValues('customFields') || {};
                                  form.setValue('customFields', {
                                    ...customFields,
                                    [fieldName]: checked
                                  });
                                }}
                                required={question.is_required}
                              />
                              <label 
                                htmlFor={`checkbox-${question.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {question.label} {question.is_required && <span className="text-destructive">*</span>}
                              </label>
                            </div>
                          );
                          
                        case 'radio':
                          return (
                            <div key={question.id} className="space-y-3">
                              <label className="text-sm font-medium">
                                {question.label} {question.is_required && <span className="text-destructive">*</span>}
                              </label>
                              <RadioGroup
                                onValueChange={(value) => {
                                  const customFields = form.getValues('customFields') || {};
                                  form.setValue('customFields', {
                                    ...customFields,
                                    [fieldName]: value
                                  });
                                }}
                                required={question.is_required}
                              >
                                {question.options && Array.isArray(question.options) && 
                                  question.options.map((option: string, index: number) => (
                                    <div key={index} className="flex items-center space-x-2">
                                      <RadioGroupItem value={option} id={`radio-${question.id}-${index}`} />
                                      <Label htmlFor={`radio-${question.id}-${index}`}>{option}</Label>
                                    </div>
                                  ))
                                }
                              </RadioGroup>
                            </div>
                          );
                        
                        case 'number':
                          return (
                            <div key={question.id} className="space-y-2">
                              <label className="text-sm font-medium">
                                {question.label} {question.is_required && <span className="text-destructive">*</span>}
                              </label>
                              <Input 
                                type="number" 
                                placeholder={question.placeholder || `Enter ${question.label}`}
                                onChange={(e) => {
                                  const customFields = form.getValues('customFields') || {};
                                  form.setValue('customFields', {
                                    ...customFields,
                                    [fieldName]: e.target.value
                                  });
                                }}
                                required={question.is_required}
                              />
                            </div>
                          );
                          
                        default:
                          return null;
                      }
                    })}
                  </div>
                </div>
              )}
              
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
                    <p><strong>Date:</strong> {
                      (() => {
                        try {
                          // Parse the date string carefully
                          const dateVal = form.getValues("appointmentDate");
                          if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
                            const [year, month, day] = dateVal.split('-').map(num => parseInt(num, 10));
                            // Create date with proper timezone handling and set time to noon
                            const date = new Date(year, month - 1, day);
                            date.setHours(12, 0, 0, 0);
                            
                            // Human-readable date format
                            return format(date, "PPP");
                          }
                          
                          // Handle non-standard format
                          const date = new Date(dateVal);
                          if (!isNaN(date.getTime())) {
                            // Set time to noon to avoid timezone shifts
                            date.setHours(12, 0, 0, 0);
                            
                            return format(date, "PPP");
                          }
                          
                          return dateVal;
                        } catch (e) {
                          console.error("Error formatting date in appointment summary:", e);
                          return form.getValues("appointmentDate");
                        }
                      })()
                    }</p>
                    <p><strong>Time:</strong> {
                      (() => {
                        // Format the time part
                        let timeString = form.getValues("appointmentTime") || "";
                        if (timeString.includes('(')) {
                          timeString = timeString.split(' (')[0].trim();
                        }
                        return timeString;
                      })()
                    } <span className="text-muted-foreground">({form.getValues("facilityTimezone") || facilityTimezone} - Facility Time)</span></p>
                    <p><strong>Customer:</strong> {form.getValues("customerName")}</p>
                    <p><strong>Direction:</strong> {form.getValues("type") === "inbound" ? "Inbound (Delivery)" : "Outbound (Pickup)"}</p>
                    
                    {/* Show custom fields if any are filled */}
                    {form.getValues("customFields") && Object.keys(form.getValues("customFields") || {}).length > 0 && (
                      <>
                        <div className="mt-2 pt-2 border-t border-border">
                          <p className="font-medium">Additional Information:</p>
                          <div className="mt-1 space-y-1">
                            {Object.entries(form.getValues("customFields") || {}).map(([key, value]) => {
                              // Extract the question ID from the key (format: customQuestion_ID)
                              const questionId = key.split('_')[1];
                              const question = customQuestions.find(q => q.id.toString() === questionId);
                              
                              return (
                                <p key={key}>
                                  <strong>{question?.label || key}:</strong> {value?.toString() || ""}
                                </p>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
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