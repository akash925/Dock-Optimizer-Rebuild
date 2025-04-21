import { useState, useEffect, ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
import { AlertCircle, ArrowLeft, ArrowRight, Calendar as CalendarIcon, CheckCircle, Clock, Loader2, Upload } from "lucide-react";
import { utcToFacilityTime, facilityTimeToUtc, utcToUserTime, formatInFacilityTimeZone } from "@/lib/timezone-utils";

// Types that will be common to both internal and external flows
type AppointmentFormMode = "internal" | "external";

// Step 1: Truck Information Schema
const truckInfoSchema = z.object({
  carrierId: z.coerce.number().optional(),
  carrierName: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  mcNumber: z.string().optional(), // MC Number field
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(6, "Valid phone number is required"),
  type: z.enum(["inbound", "outbound"]),
  appointmentMode: z.enum(["trailer", "container"]),
}).refine(
  (data) => {
    // Either carrierId or carrierName must be provided, unless carrierName is explicitly empty string
    return data.carrierId !== undefined || (data.carrierName !== undefined && data.carrierName !== '');
  },
  {
    message: "Either select a carrier or enter a custom carrier name",
    path: ["carrierId"],
  }
);

// Step 2: Schedule Details Schema
const scheduleDetailsSchema = z.object({
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Time is required"),
  dockId: z.coerce.number().optional(), // Make dock optional
  bolNumber: z.string().optional(),
  poNumber: z.string().optional(),
  palletCount: z.string().optional(),
  weight: z.string().optional(),
  notes: z.string().optional(),
  facilityTimezone: z.string().optional(), // Added for timezone conversion
}).refine(
  (data) => {
    // Combine date and time into a single datetime object
    const [year, month, day] = data.appointmentDate.split('-').map(Number);
    const [hour, minute] = data.appointmentTime.split(':').map(Number);
    
    const appointmentDateTime = new Date(year, month - 1, day, hour, minute);
    const now = new Date();
    
    // Check if the appointment is in the future
    return appointmentDateTime > now;
  },
  {
    message: "Appointment must be scheduled for a future date and time",
    path: ["appointmentTime"], // Show the error on the time field
  }
);

// Combined schema for validation
const appointmentFormSchema = z.object({
  // Truck info fields
  carrierId: z.coerce.number().optional(),
  carrierName: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  mcNumber: z.string().optional(),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(6, "Valid phone number is required"),
  type: z.enum(["inbound", "outbound"]),
  appointmentMode: z.enum(["trailer", "container"]),
  
  // Schedule details fields
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Time is required"),
  dockId: z.coerce.number().optional(),
  bolNumber: z.string().optional(),
  poNumber: z.string().optional(),
  palletCount: z.string().optional(),
  weight: z.string().optional(),
  notes: z.string().optional(),
  facilityTimezone: z.string().optional(), // Added for timezone conversion
  
  // Other fields that might be required for internal mode
  createdBy: z.number().optional(),
  status: z.string().optional(),
});

// Form value types
type TruckInfoFormValues = z.infer<typeof truckInfoSchema>;
type ScheduleDetailsFormValues = z.infer<typeof scheduleDetailsSchema>;
type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

// Data transfer objects
interface NewCarrierDto {
  name: string;
  mcNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

interface ScheduleDataDto {
  carrierId: number | null;
  customerName: string;
  mcNumber: string;
  dockId: number | null;
  truckNumber: string;
  trailerNumber: string;
  driverName: string;
  driverPhone: string;
  bolNumber: string;
  poNumber: string;
  palletCount: number;
  weight: number;
  startTime: string;
  endTime: string;
  type: "inbound" | "outbound";
  appointmentTypeId: number | null;
  appointmentMode: "trailer" | "container";
  status: string;
  notes: string;
  createdBy: number | null;
  facilityId: number | null;
  newCarrier?: NewCarrierDto;
  facilityTimezone?: string;
}

interface UnifiedAppointmentFormProps {
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
}

export default function UnifiedAppointmentForm({
  mode,
  isOpen = true, // Internal form is displayed in a dialog, default to open
  onClose = () => {}, // Default no-op for onClose
  initialData,
  editMode = "create",
  initialDate,
  initialDockId,
  appointmentTypeId,
  facilityId,
  facilityTimezone = "America/New_York", // Default timezone
  onSubmitSuccess,
  bookingPageSlug,
  preSelectedLocation,
  preSelectedType,
  containerClass = "",
  showBackButton = true,
}: UnifiedAppointmentFormProps) {
  const [step, setStep] = useState(1);
  // Form data state for tracking between steps
  const [formData, setFormData] = useState<Partial<TruckInfoFormValues>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bolFile, setBolFile] = useState<File | null>(null);
  const [bolProcessing, setBolProcessing] = useState(false);
  const [bolPreviewText, setBolPreviewText] = useState<string | null>(null);
  
  // State for availability rules
  const [availabilityRules, setAvailabilityRules] = useState<any[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<{ time: string; available: boolean; reason?: string }[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Fetch appointment type if specified
  const { data: selectedAppointmentType } = useQuery({
    queryKey: ["/api/appointment-types", appointmentTypeId],
    queryFn: async () => {
      if (!appointmentTypeId) return null;
      const res = await apiRequest("GET", `/api/appointment-types/${appointmentTypeId}`);
      return await res.json();
    },
    enabled: !!appointmentTypeId,
  });
  
  // For external mode - fetch booking page if needed
  const { data: bookingPage } = useQuery({
    queryKey: [`/api/booking-pages/slug/${bookingPageSlug}`],
    enabled: mode === "external" && !!bookingPageSlug,
  });
  
  // Set up default end time based on appointment type
  const getDefaultEndTime = (startDate: Date, appointmentMode: "trailer" | "container") => {
    // If we have a selected appointment type, use its duration
    if (selectedAppointmentType) {
      // Convert minutes to hours for the addHours function
      const durationInMinutes = selectedAppointmentType.duration;
      return addMinutes(startDate, durationInMinutes);
    }
    
    // Fallback: Trailer = 1 hour, Container = 4 hours
    const defaultHours = appointmentMode === "trailer" ? 1 : 4;
    return addHours(startDate, defaultHours);
  };
  
  // Fetch facilities
  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ["/api/facilities"],
  });
  
  // Fetch docks
  const { data: allDocks = [] } = useQuery<Dock[]>({
    queryKey: ["/api/docks"],
  });
  
  // Get selected facility ID from the appointment type or direct prop
  const selectedFacilityId = facilityId || selectedAppointmentType?.facilityId;
  
  // Filter docks by facility if a facility is selected
  const docks = selectedFacilityId 
    ? allDocks.filter(dock => dock.facilityId === selectedFacilityId)
    : allDocks;
  
  // Fetch carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });
  
  // Set up forms for each step
  // Step 1 Form: Truck Information
  const truckInfoForm = useForm<TruckInfoFormValues>({
    resolver: zodResolver(truckInfoSchema),
    defaultValues: initialData
      ? {
          carrierId: initialData.carrierId,
          customerName: initialData.customerName || "",
          mcNumber: initialData.mcNumber || "",
          truckNumber: initialData.truckNumber,
          trailerNumber: initialData.trailerNumber || "",
          driverName: initialData.driverName || "",
          driverPhone: initialData.driverPhone || "",
          type: initialData.type === "outbound" ? "outbound" : "inbound",
          appointmentMode: initialData.appointmentMode === "container" ? "container" : "trailer"
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
          type: preSelectedType === "outbound" ? "outbound" : "inbound",
          appointmentMode: "trailer"
        },
  });
  
  // Effect to set MC Number when a carrier is selected
  useEffect(() => {
    // Don't clear MC Number field on component mount
    if (initialData && initialData.mcNumber) {
      truckInfoForm.setValue("mcNumber", initialData.mcNumber);
    }
  }, [truckInfoForm, initialData]);
  
  // Set appointment mode based on appointment type when it loads
  useEffect(() => {
    if (selectedAppointmentType) {
      // Determine the appropriate mode based on duration
      const recommendedMode = selectedAppointmentType.duration <= 60 ? "trailer" : "container";
      console.log(`Setting appointment mode to ${recommendedMode} based on appointment type duration: ${selectedAppointmentType.duration} minutes`);
      
      // Update the form
      truckInfoForm.setValue("appointmentMode", recommendedMode);
    }
  }, [selectedAppointmentType, truckInfoForm]);
  
  // Step 2 Form: Schedule Details
  const scheduleDetailsForm = useForm<ScheduleDetailsFormValues>({
    resolver: zodResolver(scheduleDetailsSchema),
    defaultValues: initialData
      ? {
          appointmentDate: (() => {
            try {
              // Ensure initialData.startTime is a valid date string
              const dateObj = new Date(initialData.startTime);
              if (!isNaN(dateObj.getTime())) {
                return format(dateObj, "yyyy-MM-dd");
              }
            } catch (error) {
              console.error("Error formatting initialData.startTime:", error);
            }
            // Default to today if there's an error
            return format(new Date(), "yyyy-MM-dd");
          })(),
          appointmentTime: (() => {
            try {
              // Ensure initialData.startTime is a valid date string
              const dateObj = new Date(initialData.startTime);
              if (!isNaN(dateObj.getTime())) {
                return format(dateObj, "HH:mm");
              }
            } catch (error) {
              console.error("Error formatting initialData.startTime:", error);
            }
            // Default to 9:00 AM if there's an error
            return "09:00";
          })(),
          dockId: initialData.dockId || undefined,
          bolNumber: initialData.bolNumber || "",
          poNumber: initialData.poNumber || "",
          palletCount: initialData.palletCount?.toString() || "",
          weight: initialData.weight?.toString() || "",
          notes: initialData.notes || "",
          facilityTimezone: facilityTimezone,
        }
      : {
          appointmentDate: (() => {
            if (initialDate) {
              try {
                // Ensure initialDate is a valid Date object
                const dateObj = initialDate instanceof Date ? initialDate : new Date(initialDate);
                // Check that dateObj is a valid date
                if (!isNaN(dateObj.getTime())) {
                  return format(dateObj, "yyyy-MM-dd");
                }
              } catch (error) {
                console.error("Error formatting initialDate:", error);
              }
            }
            // Default to today's date
            return format(new Date(), "yyyy-MM-dd");
          })(),
          appointmentTime: (() => {
            if (initialDate) {
              try {
                // Ensure initialDate is a valid Date object
                const dateObj = initialDate instanceof Date ? initialDate : new Date(initialDate);
                // Check that dateObj is a valid date
                if (!isNaN(dateObj.getTime())) {
                  return format(dateObj, "HH:mm");
                }
              } catch (error) {
                console.error("Error formatting initialDate for time:", error);
              }
            }
            // Default to 9:00 AM
            return "09:00";
          })(),
          dockId: initialDockId,
          bolNumber: "",
          poNumber: "",
          palletCount: "",
          weight: "",
          notes: "",
          facilityTimezone: facilityTimezone,
        },
  });
  
  // Effect to update dock selection when initialDockId changes
  useEffect(() => {
    if (initialDockId && !initialData) {
      console.log("Setting dockId from initialDockId:", initialDockId);
      scheduleDetailsForm.setValue("dockId", initialDockId);
    }
  }, [initialDockId, scheduleDetailsForm, initialData]);
  
  // Fetch availability rules when appointment type and facility are known
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!appointmentTypeId || !selectedFacilityId) return;
      
      setIsLoadingAvailability(true);
      setAvailabilityError(null);
      
      try {
        const response = await apiRequest(
          "GET", 
          `/api/appointment-master/availability-rules?typeId=${appointmentTypeId}&facilityId=${selectedFacilityId}`
        );
        
        if (!response.ok) {
          throw new Error("Failed to fetch availability rules");
        }
        
        const data = await response.json();
        setAvailabilityRules(data);
        
        // Generate available slots for the selected date if we have one
        if (scheduleDetailsForm.getValues().appointmentDate) {
          const date = scheduleDetailsForm.getValues().appointmentDate;
          const duration = selectedAppointmentType?.duration || 60;
          
          // Import functions from appointment-availability.ts
          import("@/lib/appointment-availability").then(({ generateAvailableTimeSlots }) => {
            const slots = generateAvailableTimeSlots(
              date,
              data,
              duration,
              facilityTimezone,
              15 // 15-minute intervals
            );
            setAvailableTimeSlots(slots);
          });
        }
      } catch (error) {
        console.error("Failed to fetch availability rules:", error);
        setAvailabilityError("Failed to fetch availability rules. Please try again.");
      } finally {
        setIsLoadingAvailability(false);
      }
    };
    
    fetchAvailability();
  }, [appointmentTypeId, selectedFacilityId, facilityTimezone, selectedAppointmentType?.duration]);
  
  // Update available time slots when date changes
  useEffect(() => {
    const updateAvailableSlots = async () => {
      const date = scheduleDetailsForm.watch("appointmentDate");
      const defaultDuration = 60;
      const duration = selectedAppointmentType?.duration || defaultDuration;
      
      // Log parameters for debugging
      console.log('Fetching slots for', {
        date,
        typeId: appointmentTypeId,
        facilityId: selectedFacilityId,
        timezone: facilityTimezone,
        appointmentType: selectedAppointmentType?.name,
        duration
      });

      try {
        // Import functions from appointment-availability.ts
        const { generateAvailableTimeSlots } = await import("@/lib/appointment-availability");
        
        // If there are no rules, or date is not selected, show all time slots as a fallback
        if (!date) {
          console.log('No date selected, not generating time slots');
          return;
        }
        
        let slots = [];
        
        if (!availabilityRules.length) {
          console.log('No availability rules found, generating all slots');
          // Generate all slots but mark them as unavailable
          slots = Array.from({ length: 24 }).flatMap((_, hour) => 
            Array.from({ length: 4 }).map((_, quarterHour) => {
              const h = hour;
              const m = quarterHour * 15;
              return {
                time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
                available: true, // Mark as available for now, until we have rules
                reason: 'No rules configured'
              };
            })
          );
        } else {
          // Use actual availability rules
          console.log('Generating slots with', availabilityRules.length, 'availability rules');
          slots = generateAvailableTimeSlots(
            date,
            availabilityRules,
            duration,
            facilityTimezone,
            15 // 15-minute intervals
          );
        }
        
        console.log('Generated', slots.length, 'time slots,', 
          slots.filter((s: any) => s.available).length, 'available');
        
        setAvailableTimeSlots(slots);
      } catch (err: any) {
        console.error('Error generating time slots:', err);
        setAvailabilityError(`Error loading time slots: ${err.message || 'Unknown error'}`);
      }
      
      // If the currently selected time is not available, reset the time field
      const currentTime = scheduleDetailsForm.getValues().appointmentTime;
      if (currentTime && availableTimeSlots.length > 0) {
        const currentSlot = availableTimeSlots.find(slot => slot.time === currentTime);
        if (currentSlot && !currentSlot.available) {
          scheduleDetailsForm.setValue("appointmentTime", "", {
            shouldValidate: true,
            shouldDirty: true
          });
        }
      }
    };
    
    updateAvailableSlots();
  }, [scheduleDetailsForm.watch("appointmentDate"), availabilityRules, selectedAppointmentType?.duration, facilityTimezone]);
  
  // Callbacks for form submission
  // Handler for carrier selection
  const handleCarrierSelect = (carrier: Carrier) => {
    console.log("Selecting carrier:", carrier);
    truckInfoForm.setValue("carrierId", carrier.id);
    truckInfoForm.setValue("carrierName", undefined); // Clear custom carrier name when selecting from dropdown
    
    // If carrier has an MC Number, set it in the form
    if (carrier.mcNumber) {
      console.log("Setting MC Number to:", carrier.mcNumber);
      truckInfoForm.setValue("mcNumber", carrier.mcNumber);
    }
  };
  
  // Handle BOL file upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setBolFile(file);
      setBolProcessing(true);
      
      // Here we would integrate with a real document processing service
      // For now, simulate processing with setTimeout
      try {
        setTimeout(() => {
          // Create a realistic extraction example (but still simulated)
          const extractedBolNumber = `BOL-${Math.floor(Math.random() * 10000)}`;
          
          setBolPreviewText(`Bill of Lading #${extractedBolNumber} uploaded successfully`);
          setBolProcessing(false);
          
          // Set the BOL number
          scheduleDetailsForm.setValue("bolNumber", extractedBolNumber);
          
          toast({
            title: "BOL Uploaded and Processed",
            description: "We've extracted information to help you with your appointment.",
          });
        }, 1500);
      } catch (error) {
        // Handle any error with BOL processing
        setBolProcessing(false);
        toast({
          title: "BOL Processing Error",
          description: "There was an error processing your document. Please enter information manually.",
          variant: "destructive",
        });
      }
    }
  };
  
  // Step 1 submission handler
  const onTruckInfoSubmit = (data: TruckInfoFormValues) => {
    try {
      // Track error warnings we will display to the user
      const warnings = [];
      
      // Validate the appointment type is selected for internal mode
      if (mode === "internal" && !appointmentTypeId && !selectedAppointmentType) {
        warnings.push("Please select an appointment type before continuing.");
      }
      
      // Ensure data is properly formatted
      console.log("Truck info form data:", data);
      
      // Validate required fields
      if (!data.customerName) {
        warnings.push("Customer name is required.");
      }
      
      if (!data.appointmentMode) {
        warnings.push("Please select an appointment mode (trailer or container).");
      }
      
      // If we found issues, don't proceed
      if (warnings.length > 0) {
        toast({
          title: "Missing Information",
          description: (
            <ul className="list-disc pl-5">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          ),
          variant: "destructive",
        });
        return;
      }
      
      // Save form data for next step
      setFormData(data);
      
      // Move to next step
      setStep(2);
    } catch (error) {
      console.error("Error in truck info form submission:", error);
      toast({
        title: "Form Error",
        description: "There was a problem with your submission. Please check your inputs and try again.",
        variant: "destructive",
      });
    }
  };
  
  // Step 2 submission handler
  const onScheduleDetailsSubmit = async (data: ScheduleDetailsFormValues) => {
    setIsSubmitting(true);
    
    try {
      console.log("Schedule details form data:", data);
      console.log("Previous truck info data:", formData);
      
      // Create date objects from form inputs
      const appointmentDate = data.appointmentDate;
      const appointmentTime = data.appointmentTime;
      
      // Add validation for required fields
      if (!appointmentDate || !appointmentTime) {
        toast({
          title: "Missing Fields",
          description: "Date and time are required for scheduling an appointment.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Validate against availability rules if they exist
      if (availabilityRules && availabilityRules.length > 0) {
        try {
          // Dynamically import validation function
          const { validateAppointmentDateTime } = await import("@/lib/appointment-availability");
          
          // Get duration from selected appointment type or use default based on mode
          const duration = selectedAppointmentType?.duration || 
            (formData.appointmentMode === "container" ? 240 : 60);
            
          // Validate against rules
          const validationResult = validateAppointmentDateTime(
            appointmentDate,
            appointmentTime,
            availabilityRules,
            duration,
            facilityTimezone
          );
          
          if (!validationResult.valid) {
            toast({
              title: "Time Slot Not Available",
              description: validationResult.message || "The selected time slot is not available. Please choose another time.",
              variant: "destructive",
            });
            setIsSubmitting(false);
            return;
          }
        } catch (validationError) {
          console.error("Availability validation error:", validationError);
          // Continue with submission but log the error
        }
      }
      
      // Create Date object from input with validation
      let startTime: Date;
      try {
        // Use facility timezone to properly convert to UTC
        const { dateTimeToUtcIso } = await import("@/lib/appointment-availability");
        const utcIsoString = dateTimeToUtcIso(appointmentDate, appointmentTime, facilityTimezone);
        startTime = new Date(utcIsoString);
        
        // Validate that we have a proper date
        if (isNaN(startTime.getTime())) {
          throw new Error("Invalid date created from inputs");
        }
        
        // Check if date is in the past
        const now = new Date();
        if (startTime < now) {
          toast({
            title: "Invalid Time",
            description: "You cannot schedule an appointment in the past.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      } catch (dateError) {
        console.error("Date creation error:", dateError);
        toast({
          title: "Date Error",
          description: dateError instanceof Error ? dateError.message : "There was a problem with the appointment date/time. Please try again.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Get appointment mode for duration calculation with fallback
      const appointmentMode = formData.appointmentMode === "container" ? "container" : "trailer";
      const duration = selectedAppointmentType?.duration || (appointmentMode === "container" ? 240 : 60);
      const endTime = addMinutes(startTime, duration);
      
      // Handle dockId field - ensure it's a number or null
      let dockId = null;
      if (data.dockId) {
        // Convert to number if a string, or keep as is if already a number
        dockId = typeof data.dockId === 'string' ? parseInt(data.dockId, 10) : data.dockId;
        
        // Check if conversion resulted in NaN
        if (isNaN(dockId)) {
          dockId = null;
        }
      }
      
      // Prepare clean base data with all required fields
      const scheduleData: ScheduleDataDto = {
        // Set default values to avoid undefined or null fields that cause server errors
        carrierId: formData.carrierId || null,
        customerName: formData.customerName || "",
        mcNumber: formData.mcNumber || "", 
        dockId: dockId, // Use our sanitized dockId that's already been validated
        truckNumber: formData.truckNumber || "",
        trailerNumber: formData.trailerNumber || "",
        driverName: formData.driverName || "",
        driverPhone: formData.driverPhone || "",
        bolNumber: data.bolNumber || "",
        poNumber: data.poNumber || "",
        // Handle numeric fields carefully
        palletCount: data.palletCount ? 
          (isNaN(Number(data.palletCount)) ? 0 : Number(data.palletCount)) : 0,
        weight: data.weight ? 
          (isNaN(Number(data.weight)) ? 0 : Number(data.weight)) : 0,
        // Format dates properly to avoid timezone issues
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        type: formData.type === "outbound" ? "outbound" : "inbound",
        // Ensure appointment type is properly set
        appointmentTypeId: selectedAppointmentType ? selectedAppointmentType.id : (appointmentTypeId || null),
        appointmentMode: (appointmentMode === "container" ? "container" : "trailer"),
        status: "scheduled",
        notes: data.notes || "",
        createdBy: user?.id || null,
        // Add facility ID if selected appointment type has one
        facilityId: selectedFacilityId || null,
        facilityTimezone: data.facilityTimezone || facilityTimezone,
      };
      
      console.log("Prepared schedule data:", scheduleData);
      
      // Handle custom carrier creation if necessary
      if (!formData.carrierId && formData.carrierName) {
        const newCarrier: NewCarrierDto = {
          name: formData.carrierName,
          mcNumber: formData.mcNumber || '',
          // Add required fields for carrier creation that might be missing
          contactName: formData.driverName || '',
          contactEmail: '',
          contactPhone: formData.driverPhone || '',
        };
        
        // Add to the schedule data object
        scheduleData.newCarrier = newCarrier;
        console.log("Including new carrier data:", newCarrier);
      }
      
      // Different API endpoints for internal vs external modes
      let endpoint = '/api/schedules';
      if (mode === "external") {
        endpoint = '/api/external-booking';
      }
      
      // Submit based on mode and editMode
      if (editMode === "create") {
        const res = await apiRequest("POST", endpoint, scheduleData);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to create appointment");
        }
        
        const createdAppointment = await res.json();
        
        // Show success message
        toast({
          title: "Appointment Created",
          description: "Your appointment has been created successfully.",
        });
        
        // Call onSubmitSuccess callback if provided
        if (onSubmitSuccess) {
          onSubmitSuccess(createdAppointment);
        }
        
        // For internal mode, close the dialog
        if (mode === "internal" && onClose) {
          onClose();
        }
        
        // For external mode, we might move to a confirmation page
        if (mode === "external") {
          // Move to step 3 (confirmation) or handle as needed
          setStep(3);
        }
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      } else if (editMode === "edit" && initialData) {
        const res = await apiRequest("PATCH", `/api/schedules/${initialData.id}`, scheduleData);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to update appointment");
        }
        
        const updatedAppointment = await res.json();
        
        // Show success message
        toast({
          title: "Appointment Updated",
          description: "Your appointment has been updated successfully.",
        });
        
        // Call onSubmitSuccess callback if provided
        if (onSubmitSuccess) {
          onSubmitSuccess(updatedAppointment);
        }
        
        // Close the dialog
        if (onClose) {
          onClose();
        }
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      } else {
        console.error("Invalid form mode or missing initialData for edit");
        toast({
          title: "Form Error",
          description: "There was a problem with the form configuration.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "Submission Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Go back to previous step
  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else if (mode === "internal" && onClose) {
      // If in step 1 of internal mode, close the dialog
      onClose();
    }
  };
  
  // Determine if we should show the form based on mode
  const shouldShowForm = mode === "external" || (mode === "internal" && isOpen);
  
  if (!shouldShowForm) {
    return null;
  }
  
  // Calculate content based on steps
  const renderFormContent = () => {
    // Common error state
    if (!selectedAppointmentType && appointmentTypeId && mode === "internal") {
      return (
        <div className="p-6 text-center">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Unable to load appointment type. Please try again or contact support.
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    
    // Render based on current step
    switch (step) {
      case 1:
        return (
          <Form {...truckInfoForm}>
            <form onSubmit={truckInfoForm.handleSubmit(onTruckInfoSubmit)} className="space-y-4">
              <div className="space-y-4">
                {/* Carrier Selection */}
                <div className="space-y-4">
                  <FormField
                    control={truckInfoForm.control}
                    name="carrierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carrier*</FormLabel>
                        <CarrierSelector 
                          form={truckInfoForm}
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
                    control={truckInfoForm.control}
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
                              // Clear carrierId when entering a custom carrier name
                              if (e.target.value) {
                                truckInfoForm.setValue("carrierId", undefined);
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
                    control={truckInfoForm.control}
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
                  control={truckInfoForm.control}
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
                  control={truckInfoForm.control}
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
                  control={truckInfoForm.control}
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
                    control={truckInfoForm.control}
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
                    control={truckInfoForm.control}
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
                    control={truckInfoForm.control}
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
                    control={truckInfoForm.control}
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
              </div>
              
              {/* Form Actions */}
              <div className="flex justify-between mt-6">
                {showBackButton && (
                  <Button type="button" variant="outline" onClick={goBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                )}
                <Button type="submit" className="ml-auto">
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        );
        
      case 2:
        return (
          <Form {...scheduleDetailsForm}>
            <form onSubmit={scheduleDetailsForm.handleSubmit(onScheduleDetailsSubmit)} className="space-y-4">
              <div className="space-y-4">
                {/* Date and Time Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={scheduleDetailsForm.control}
                    name="appointmentDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Appointment Date*</FormLabel>
                        <div className="flex flex-col space-y-2">
                          {/* Use Input instead of Popover for more reliable date selection */}
                          <FormControl>
                            <Input 
                              type="date" 
                              value={field.value || ''} 
                              onChange={(e) => {
                                console.log("Date changed to:", e.target.value);
                                scheduleDetailsForm.setValue("appointmentDate", e.target.value, { 
                                  shouldValidate: true,
                                  shouldDirty: true,
                                  shouldTouch: true
                                });
                              }}
                              min={format(new Date(), "yyyy-MM-dd")}
                              className="w-full"
                              placeholder="mm/dd/yyyy"
                            />
                          </FormControl>
                        </div>
                        <FormDescription>
                          Select a date for your appointment (must be in the future)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={scheduleDetailsForm.control}
                    name="appointmentTime"
                    render={({ field }) => {
                      console.log("Appointment time field value:", field.value);
                      return (
                        <FormItem>
                          <FormLabel>Appointment Time*</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              console.log("Setting time to:", value);
                              scheduleDetailsForm.setValue("appointmentTime", value, {
                                shouldValidate: true,
                                shouldDirty: true,
                                shouldTouch: true
                              });
                            }}
                            value={field.value}
                            disabled={isLoadingAvailability}
                          >
                            <FormControl>
                              <SelectTrigger>
                                {isLoadingAvailability && (
                                  <div className="flex items-center">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading available times...
                                  </div>
                                )}
                                <SelectValue placeholder="Select time">
                                  {field.value && (
                                    <div className="flex items-center">
                                      <Clock className="mr-2 h-4 w-4" />
                                      {(() => {
                                        const t = field.value;
                                        if (!t || typeof t !== 'string' || !/^\d{2}:\d{2}$/.test(t)) {
                                          return '—';
                                        }
                                        const [hour, minute] = t.split(':').map(Number);
                                        const timeDate = new Date();
                                        timeDate.setHours(hour, minute, 0, 0);
                                        return format(timeDate, 'h:mm a');
                                      })()}
                                    </div>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {/* Show either available slots or all slots */}
                              {availabilityRules && availabilityRules.length > 0 && availableTimeSlots.length > 0 ? (
                                // Show only available time slots based on rules
                                availableTimeSlots
                                  .filter((slot: any) => slot.available)
                                  .map((slot: any) => {
                                    // Add validation for time format
                                    const t = slot.time;
                                    if (!t || typeof t !== 'string' || !/^\d{2}:\d{2}$/.test(t)) {
                                      return null; // Skip invalid time values
                                    }
                                    const [hour, minute] = t.split(':').map(Number);
                                    const timeDate = new Date();
                                    timeDate.setHours(hour, minute, 0, 0);
                                    const timeDisplay = format(timeDate, 'h:mm a');
                                    return (
                                      <SelectItem key={slot.time} value={slot.time}>
                                        {timeDisplay}
                                      </SelectItem>
                                    );
                                  })
                              ) : (
                                // Fallback to all time slots if no rules or slots available
                                Array.from({ length: 24 }).flatMap((_, hour) => 
                                  Array.from({ length: 4 }).map((_, quarterHour) => {
                                    const h = hour;
                                    const m = quarterHour * 15;
                                    const timeValue = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                                    // Create a proper date object instead of using timestamp
                                    const timeDate = new Date();
                                    // Ensure h and m are valid numbers
                                    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
                                      return null; // Skip invalid values
                                    }
                                    timeDate.setHours(h, m, 0, 0);
                                    const timeDisplay = format(timeDate, 'h:mm a');
                                    return (
                                      <SelectItem key={`${h}-${m}`} value={timeValue}>
                                        {timeDisplay}
                                      </SelectItem>
                                    );
                                  })
                                )
                              )}
                              {availabilityRules && availabilityRules.length > 0 && 
                               availableTimeSlots.filter((slot: any) => slot.available).length === 0 && (
                                <div className="p-2 text-center text-sm text-gray-500">
                                  No available time slots for this date.
                                  Please select a different date.
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          {availabilityError && (
                            <div className="mt-1 text-sm text-red-500">
                              {availabilityError}
                            </div>
                          )}
                          <FormDescription>
                            Select an available time slot for your appointment
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>
                
                {/* Dock Selection (if internal mode) */}
                {mode === "internal" && (
                  <FormField
                    control={scheduleDetailsForm.control}
                    name="dockId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          Dock 
                          <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                        </FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            // Handle the 'none' case
                            if (value === 'none') {
                              field.onChange(undefined);
                            } else {
                              field.onChange(parseInt(value));
                            }
                          }}
                          value={field.value ? field.value.toString() : undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select dock (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No dock selected</SelectItem>
                            {docks.length > 0 ? (
                              docks.map((dock) => (
                                <SelectItem key={dock.id} value={dock.id.toString()}>
                                  {dock.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>No docks available</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Can be defined now, or closer to time of appointment
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* BOL and PO Numbers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={scheduleDetailsForm.control}
                    name="bolNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bill of Lading Number</FormLabel>
                        <FormControl>
                          <div className="flex">
                            <Input className="flex-grow" placeholder="Enter BOL number" {...field} />
                            <Button
                              type="button"
                              variant="outline"
                              className="ml-2 whitespace-nowrap"
                              onClick={() => document.getElementById('bolUpload')?.click()}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload
                            </Button>
                            <input
                              id="bolUpload"
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={handleFileUpload}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={scheduleDetailsForm.control}
                    name="poNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Order Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter PO number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* BOL Preview if uploaded */}
                {(bolProcessing || bolPreviewText) && (
                  <div className="p-4 border rounded-md bg-gray-50">
                    <p className="font-semibold mb-2">Bill of Lading Preview</p>
                    {bolProcessing ? (
                      <div className="flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing document...
                      </div>
                    ) : (
                      <div className="text-sm">
                        {bolPreviewText && (
                          <p className="whitespace-pre-line">{bolPreviewText}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Pallet Count and Weight */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={scheduleDetailsForm.control}
                    name="palletCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pallet Count</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Enter pallet count" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={scheduleDetailsForm.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Enter weight" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Notes */}
                <FormField
                  control={scheduleDetailsForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter any additional information or special instructions" 
                          className="min-h-[100px]" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Form Actions */}
              <div className="flex justify-between mt-6">
                <Button type="button" variant="outline" onClick={goBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting 
                    ? "Submitting..." 
                    : mode === "internal" 
                      ? (editMode === "create" ? "Create Appointment" : "Update Appointment")
                      : "Book Appointment"
                  }
                </Button>
              </div>
            </form>
          </Form>
        );
        
      case 3:
        // This is primarily for external mode - confirmation page
        return (
          <div className="text-center py-8">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Appointment Booked Successfully!</h3>
              <p className="text-gray-600">
                Your appointment has been scheduled. Please check your email for confirmation details.
              </p>
            </div>
            
            <div className="max-w-md mx-auto bg-gray-50 rounded-lg p-6 mb-6 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Appointment Date</p>
                  <p className="font-medium">
                    {scheduleDetailsForm.getValues().appointmentDate
                      ? format(new Date(scheduleDetailsForm.getValues().appointmentDate), "PPP")
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Appointment Time</p>
                  <p className="font-medium">
                    {(() => {
                        const t = scheduleDetailsForm.getValues().appointmentTime;
                        if (!t || typeof t !== 'string' || !/^\d{2}:\d{2}$/.test(t)) {
                          return 'N/A';
                        }
                        const [hour, minute] = t.split(':').map(Number);
                        const timeDate = new Date();
                        timeDate.setHours(hour, minute, 0, 0);
                        return format(timeDate, "h:mm a");
                      })()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{formData.customerName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Carrier</p>
                  <p className="font-medium">
                    {formData.carrierId 
                      ? carriers.find(c => c.id === formData.carrierId)?.name
                      : formData.carrierName || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Truck Number</p>
                  <p className="font-medium">{formData.truckNumber || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium capitalize">{formData.type || "N/A"}</p>
                </div>
              </div>
            </div>
            
            <div>
              <Button 
                onClick={() => {
                  // Reset the form and go back to step 1
                  setStep(1);
                  setFormData({});
                  truckInfoForm.reset();
                  scheduleDetailsForm.reset();
                }}
              >
                Book Another Appointment
              </Button>
            </div>
          </div>
        );
        
      default:
        return <div>Invalid step</div>;
    }
  };
  
  // Render content differently based on mode
  if (mode === "internal") {
    // For internal mode, render inside a dialog
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMode === "create" ? "Create New Appointment" : "Edit Appointment"}
            </DialogTitle>
            <DialogDescription>
              {step === 1 
                ? "Enter truck and carrier information" 
                : step === 2 
                  ? "Schedule appointment details"
                  : "Appointment summary"}
            </DialogDescription>
          </DialogHeader>
          
          {renderFormContent()}
        </DialogContent>
      </Dialog>
    );
  } else {
    // For external mode, render as a regular component
    return (
      <div className={`${containerClass}`}>
        {renderFormContent()}
      </div>
    );
  }
}