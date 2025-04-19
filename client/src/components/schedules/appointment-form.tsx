import { useState, ChangeEvent, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertScheduleSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Schedule, Dock, Carrier, Facility } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format, addHours } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Loader2, ArrowLeft, ArrowRight, Truck, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { CarrierSelector } from "@/components/shared/carrier-selector";

// Tab 1: Truck Information
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
    return data.carrierId !== undefined || data.carrierName !== undefined || data.carrierName === '';
  },
  {
    message: "Either select a carrier or enter a custom carrier name",
    path: ["carrierId"],
  }
);

// Tab 2: Schedule Details
const scheduleDetailsSchema = z.object({
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Time is required"),
  dockId: z.coerce.number().optional(), // Make dock optional
  bolNumber: z.string().optional(),
  poNumber: z.string().optional(),
  palletCount: z.string().optional(),
  weight: z.string().optional(),
  notes: z.string().optional(),
});

// Combine schemas
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
  dockId: z.coerce.number().optional(), // Make dock optional
  bolNumber: z.string().optional(),
  poNumber: z.string().optional(),
  palletCount: z.string().optional(),
  weight: z.string().optional(),
  notes: z.string().optional(),
  
  // Other fields
  createdBy: z.number(),
  status: z.string(),
});

type TruckInfoFormValues = z.infer<typeof truckInfoSchema>;
type ScheduleDetailsFormValues = z.infer<typeof scheduleDetailsSchema>;
type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Schedule;
  mode: "create" | "edit";
  initialDate?: Date;
  initialDockId?: number;
  appointmentTypeId?: number;
}

export default function AppointmentForm({
  isOpen,
  onClose,
  initialData,
  mode,
  initialDate,
  initialDockId,
  appointmentTypeId,
}: AppointmentFormProps) {
  const [step, setStep] = useState(1);
  // Define a clear interface for our form data to avoid TypeScript confusion
  interface TruckFormData {
    carrierId?: number;
    carrierName?: string;
    mcNumber?: string;
    customerName?: string;
    truckNumber?: string;
    trailerNumber?: string;
    driverName?: string;
    driverPhone?: string;
    type?: "inbound" | "outbound";
    appointmentMode?: "trailer" | "container";
  }
  
  const [formData, setFormData] = useState<TruckFormData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bolFile, setBolFile] = useState<File | null>(null);
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
      return await res.json();
    },
    enabled: !!appointmentTypeId,
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
    const defaultHours = type === "trailer" ? 1 : 4;
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
  
  // Get selected facility ID from the appointment type
  const selectedFacilityId = selectedAppointmentType?.facilityId;
  
  // Filter docks by facility if a facility is selected via appointment type
  const docks = selectedFacilityId 
    ? allDocks.filter(dock => dock.facilityId === selectedFacilityId)
    : allDocks;
  
  // Fetch carriers
  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });
  
  // Step 1 Form: Truck Information
  const truckInfoForm = useForm<TruckInfoFormValues>({
    resolver: zodResolver(truckInfoSchema),
    defaultValues: initialData
      ? {
          carrierId: initialData.carrierId,
          customerName: initialData.customerName || "",
          mcNumber: "", // Will be set when carrier is loaded
          truckNumber: initialData.truckNumber,
          trailerNumber: initialData.trailerNumber || "",
          driverName: initialData.driverName || "",
          driverPhone: initialData.driverPhone || "",
          type: initialData.type as "inbound" | "outbound",
          appointmentMode: initialData.appointmentMode as "trailer" | "container" || "trailer"
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
          appointmentMode: "trailer"
        },
  });
  
  // Set MC Number when a carrier is selected
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
  
  // Watch the appointment mode for duration changes
  const appointmentMode = truckInfoForm.watch("appointmentMode");
  
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
          palletCount: initialData.palletCount || "",
          weight: initialData.weight || "",
          notes: initialData.notes || "",
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
          dockId: initialDockId || undefined,
          bolNumber: "",
          poNumber: "",
          palletCount: "",
          weight: "",
          notes: "",
        },
  });
  
  // Effect to update dock selection when initialDockId changes
  useEffect(() => {
    if (initialDockId && !initialData) {
      console.log("Setting dockId from initialDockId:", initialDockId);
      scheduleDetailsForm.setValue("dockId", initialDockId);
    }
  }, [initialDockId, scheduleDetailsForm, initialData]);
  
  // Handle BOL file upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setBolFile(file);
      setBolProcessing(true);
      
      // Simulate processing - this would be connected to a real document processing service
      setTimeout(() => {
        const previewText = `Bill of Lading #BOL-${Math.floor(Math.random() * 10000)}
Type: ${Math.random() > 0.5 ? 'Inbound' : 'Outbound'}
Items: ${Math.floor(Math.random() * 50) + 1} pallets
Carrier: ${carriers[Math.floor(Math.random() * carriers.length)]?.name || 'Unknown'}`;
        
        setBolPreviewText(previewText);
        setBolProcessing(false);
        
        // Set the BOL number
        scheduleDetailsForm.setValue("bolNumber", `BOL-${Math.floor(Math.random() * 10000)}`);
        
        // Set pallet count
        scheduleDetailsForm.setValue("palletCount", `${Math.floor(Math.random() * 50) + 1}`);
        
        toast({
          title: "BOL Uploaded and Processed",
          description: "We've extracted some information to help you with your appointment.",
        });
      }, 1500);
    }
  };
  
  // Handle step 1 submission
  const onTruckInfoSubmit = (data: TruckInfoFormValues) => {
    try {
      // Track error warnings we will display to the user
      const warnings = [];
      
      // Validate the appointment type is selected
      if (!appointmentTypeId && !selectedAppointmentType) {
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
          title: "Missing Required Fields",
          description: warnings.join(" "),
          variant: "destructive",
        });
        return;
      }
      
      // Create a properly cleaned version of the data with all required fields
      const cleanedData = {
        ...data,
        carrierId: data.carrierId || undefined, // Use undefined instead of null to avoid TypeScript errors
        carrierName: data.carrierName || "",
        mcNumber: data.mcNumber || '',
        customerName: data.customerName || '',
        type: data.type || 'inbound',
        appointmentMode: data.appointmentMode || 'trailer'
      };
      
      // Log that we're using settings from the appointment type
      if (selectedAppointmentType) {
        console.log("Using settings from appointment type:", selectedAppointmentType.name);
      }
      
      // Store the cleaned data in form state
      setFormData({...formData, ...cleanedData});
      setStep(2);
    } catch (error) {
      console.error("Error processing truck form data:", error);
      toast({
        title: "Form Error",
        description: "There was a problem processing the form data. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Create mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      try {
        console.log("Sending appointment data to server:", JSON.stringify(data, null, 2));
        const res = await apiRequest("POST", "/api/schedules", data);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          console.error("Server error response:", errorData);
          throw new Error(errorData?.message || `Server error: ${res.status}`);
        }
        
        return await res.json();
      } catch (err) {
        console.error("Error in createScheduleMutation:", err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Appointment created",
        description: "The appointment has been created successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      console.error("Mutation error:", error);
      toast({
        title: "Failed to create appointment",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });
  
  // Update mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AppointmentFormValues> }) => {
      try {
        console.log("Sending update data to server:", JSON.stringify(data, null, 2));
        const res = await apiRequest("PUT", `/api/schedules/${id}`, data);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          console.error("Server error response:", errorData);
          throw new Error(errorData?.message || `Server error: ${res.status}`);
        }
        
        return await res.json();
      } catch (err) {
        console.error("Error in updateScheduleMutation:", err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Appointment updated",
        description: "The appointment has been updated successfully.",
      });
      onClose();
    },
    onError: (error: Error) => {
      console.error("Update mutation error:", error);
      toast({
        title: "Failed to update appointment",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });
  
  // Final submit
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
      
      // Create Date object from input with validation
      let startTime: Date;
      try {
        const rawStartTime = new Date(`${appointmentDate}T${appointmentTime}`);
        
        // Validate that we have a proper date
        if (isNaN(rawStartTime.getTime())) {
          throw new Error("Invalid date created from inputs");
        }
        
        // Check if date is in the past
        const now = new Date();
        if (rawStartTime < now) {
          // If it's today, check if the time has passed
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (rawStartTime.getDate() === today.getDate() && 
              rawStartTime.getMonth() === today.getMonth() && 
              rawStartTime.getFullYear() === today.getFullYear()) {
            toast({
              title: "Invalid Time",
              description: "You cannot schedule an appointment in the past.",
              variant: "destructive",
            });
            setIsSubmitting(false);
            return;
          }
        }
        
        // Round to nearest 15-minute interval
        const minutes = rawStartTime.getMinutes();
        const roundedMinutes = Math.round(minutes / 15) * 15;
        const newHours = roundedMinutes === 60 ? rawStartTime.getHours() + 1 : rawStartTime.getHours();
        const newMinutes = roundedMinutes === 60 ? 0 : roundedMinutes;
        
        // Create final start time with rounded minutes
        startTime = new Date(rawStartTime);
        startTime.setHours(newHours, newMinutes, 0, 0);
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
      const appointmentMode = formData.appointmentMode || "trailer";
      const endTime = getDefaultEndTime(startTime, appointmentMode as "trailer" | "container");
      
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
      
      // Create a cleaned data type object with explicit types
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
        createdBy: number;
        facilityId: number | null;
        newCarrier?: NewCarrierDto;
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
        type: formData.type || "inbound" as "inbound",
        // Ensure appointment type is properly set
        appointmentTypeId: selectedAppointmentType ? selectedAppointmentType.id : (appointmentTypeId || null),
        appointmentMode: appointmentMode as "trailer" | "container" || "trailer" as "trailer",
        status: "scheduled",
        notes: data.notes || "",
        createdBy: user?.id || 0,
        // Add facility ID if selected appointment type has one
        facilityId: selectedAppointmentType?.facilityId || null
      };
      
      console.log("Prepared schedule data:", scheduleData);
      
      // Handle custom carrier creation if necessary
      if (!formData.carrierId && formData.carrierName) {
        scheduleData.newCarrier = {
          name: formData.carrierName,
          mcNumber: formData.mcNumber || '',
          // Add required fields for carrier creation that might be missing
          contactName: "",
          contactEmail: "",
          contactPhone: ""
        };
        console.log("Including new carrier data:", scheduleData.newCarrier);
      }
      
      // Submit based on mode
      if (mode === "create") {
        await createScheduleMutation.mutateAsync(scheduleData);
      } else if (mode === "edit" && initialData) {
        await updateScheduleMutation.mutateAsync({ id: initialData.id, data: scheduleData });
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
    }
  };
  
  // Close handler to reset state
  const handleClose = () => {
    setStep(1);
    setBolFile(null);
    setBolPreviewText(null);
    onClose();
  };
  
  // Dialog title based on mode
  const dialogTitle = mode === "create" 
    ? "Create New Appointment" 
    : "Edit Appointment";
  
  // Dialog description based on mode
  const dialogDescription = mode === "create"
    ? "Schedule a new dock appointment."
    : "Modify the existing appointment details.";
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        
        {/* Step indicator */}
        <div className="relative mb-6">
          <div className="flex justify-between">
            <div className="text-center">
              <div className={`w-8 h-8 flex items-center justify-center rounded-full border-2 ${step === 1 ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-500'} mx-auto`}>
                1
              </div>
              <div className={`text-sm mt-1 ${step === 1 ? 'text-primary font-medium' : 'text-gray-500'}`}>
                Truck Info
              </div>
            </div>
            
            <div className="flex-1 flex items-center">
              <div className={`h-1 flex-grow ${step > 1 ? 'bg-primary' : 'bg-gray-200'}`}></div>
            </div>
            
            <div className="text-center">
              <div className={`w-8 h-8 flex items-center justify-center rounded-full border-2 ${step === 2 ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-500'} mx-auto`}>
                2
              </div>
              <div className={`text-sm mt-1 ${step === 2 ? 'text-primary font-medium' : 'text-gray-500'}`}>
                Schedule Details
              </div>
            </div>
          </div>
        </div>
        
        {/* Step 1: Truck Information */}
        {step === 1 && (
          <Form {...truckInfoForm}>
            <form onSubmit={truckInfoForm.handleSubmit(onTruckInfoSubmit)} className="space-y-4">
              <Tabs defaultValue="standard" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="standard">Standard Entry</TabsTrigger>
                  <TabsTrigger value="bol">Upload BOL (Coming Soon)</TabsTrigger>
                </TabsList>
                
                <TabsContent value="standard" className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Using the standardized CarrierSelector component */}
                      <CarrierSelector 
                        form={truckInfoForm}
                        nameFieldName="carrierName"
                        idFieldName="carrierId"
                        mcNumberFieldName="mcNumber"
                        label="Carrier"
                        placeholder="Select or enter carrier name"
                      />

                      <FormField
                        control={truckInfoForm.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer Name*</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter customer name" 
                                {...field}
                                required
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      

                    </div>
                    
                    <FormField
                      control={truckInfoForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Appointment Type*</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
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
                  </div>
                  
                  <FormField
                    control={truckInfoForm.control}
                    name="appointmentMode"
                    render={({ field }) => {
                      // If we have a selected appointment type, set the appointmentMode based on duration
                      if (selectedAppointmentType && !field.value) {
                        // Set appropriate value based on appointment type's duration
                        // 60 minutes (1 hour) -> trailer, 240 minutes (4 hours) -> container
                        const suggestedMode = selectedAppointmentType.duration <= 60 ? "trailer" : "container";
                        console.log(`Setting default appointment mode to ${suggestedMode} based on appointment type duration of ${selectedAppointmentType.duration} minutes`);
                        
                        // Update the field value
                        setTimeout(() => {
                          field.onChange(suggestedMode);
                        }, 0);
                      }
                    
                      return (
                        <FormItem className="space-y-3">
                          <FormLabel>Appointment Mode*</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex space-x-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem 
                                  value="trailer" 
                                  id="trailer" 
                                  disabled={selectedAppointmentType && selectedAppointmentType.duration > 60}
                                />
                                <Label 
                                  htmlFor="trailer" 
                                  className={selectedAppointmentType && selectedAppointmentType.duration > 60 ? "text-gray-400" : ""}
                                >
                                  Trailer (1 hour)
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem 
                                  value="container" 
                                  id="container" 
                                  disabled={selectedAppointmentType && selectedAppointmentType.duration <= 60}
                                />
                                <Label 
                                  htmlFor="container" 
                                  className={selectedAppointmentType && selectedAppointmentType.duration <= 60 ? "text-gray-400" : ""}
                                >
                                  Container (4 hours)
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          {selectedAppointmentType && (
                            <FormDescription>
                              Mode selected based on the appointment type: {selectedAppointmentType.name} ({selectedAppointmentType.duration} minutes)
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={truckInfoForm.control}
                      name="truckNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Truck Number*</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter truck identification" {...field} />
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
                            <Input placeholder="Enter trailer identification" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={truckInfoForm.control}
                      name="driverName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Driver Name*</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter driver's name" {...field} />
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
                            <Input placeholder="Enter driver's phone" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="bol" className="pt-4">
                  <div className="border-2 border-dashed rounded-md border-gray-300 p-6 flex flex-col items-center justify-center bg-gray-50">
                    <FileText className="h-10 w-10 text-gray-400 mb-2" />
                    <p className="text-center text-gray-500">BOL upload functionality is coming soon.</p>
                    <p className="text-center text-sm text-gray-400 mt-1">
                      This feature will allow automatic extraction of appointment information from your BOL documents.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="flex justify-between gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
        
        {/* Step 2: Schedule Details */}
        {step === 2 && (
          <Form {...scheduleDetailsForm}>
            <form onSubmit={scheduleDetailsForm.handleSubmit(onScheduleDetailsSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={scheduleDetailsForm.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date*</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          min={format(new Date(), "yyyy-MM-dd")} // Set minimum date to today
                          onChange={(e) => {
                            // Check if date is in the past
                            const selectedDate = new Date(e.target.value);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            
                            if (selectedDate < today) {
                              // If date is in the past, set to today
                              field.onChange(format(today, "yyyy-MM-dd"));
                              toast({
                                title: "Invalid date",
                                description: "You cannot select dates in the past.",
                                variant: "destructive",
                              });
                            } else {
                              field.onChange(e.target.value);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={scheduleDetailsForm.control}
                  name="appointmentTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time*</FormLabel>
                      <Select 
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an appointment time" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* Generate time slots based on appointment type and facility settings */}
                          {(() => {
                            // Use appointment type settings if available
                            const timeInterval = 15; // Default to 15 minutes for finer time slot control
                            
                            // Use appointment type's facility business hours if available
                            // If not, use default hours
                            let startHour = 5; // Default: 5 AM
                            let endHour = 19; // Default: 7 PM
                            
                            // Track availability checks
                            let hasSpecialAvailability = false;
                            
                            // Apply appointment type settings if available
                            if (selectedAppointmentType) {
                              console.log("Using settings from appointment type:", selectedAppointmentType.name);
                              
                              // In the future, appointment types may override business hours
                              // For now, use the type's rules for appointments past business hours
                              if (!selectedAppointmentType.allowAppointmentsPastBusinessHours) {
                                hasSpecialAvailability = true;
                                // Set strict business hours (8am to 5pm) if appointments aren't allowed outside business hours
                                startHour = 8;
                                endHour = 17;
                              }
                              
                              // Check if there is a buffer time setting
                              if (selectedAppointmentType.bufferTime > 0) {
                                console.log(`Using buffer time of ${selectedAppointmentType.bufferTime} minutes between appointments`);
                                // We'll apply this buffer when calculating available slots
                                // For now, just adjust the timeInterval to ensure proper spacing
                                // In a real implementation, this would check existing appointments too
                              }
                            }
                            
                            // Calculate total minutes from start to end
                            const totalMinutes = (endHour - startHour) * 60;
                            const slots = Math.floor(totalMinutes / timeInterval);
                            
                            // Filter out past times if date is today
                            const currentDate = new Date();
                            const selectedDate = scheduleDetailsForm.getValues("appointmentDate") 
                              ? new Date(scheduleDetailsForm.getValues("appointmentDate"))
                              : null;
                            
                            const isToday = selectedDate && 
                              selectedDate.getDate() === currentDate.getDate() &&
                              selectedDate.getMonth() === currentDate.getMonth() &&
                              selectedDate.getFullYear() === currentDate.getFullYear();
                            
                            // Split time slots into morning, afternoon, and evening sections
                            const morningSlots: JSX.Element[] = [];
                            const afternoonSlots: JSX.Element[] = [];
                            const eveningSlots: JSX.Element[] = [];
                            
                            Array.from({ length: slots }).forEach((_, i) => {
                              // Calculate time for this slot
                              const minutesFromStart = i * timeInterval;
                              const hour = Math.floor(minutesFromStart / 60) + startHour;
                              const minute = minutesFromStart % 60;
                              
                              // Skip if it's today and the time has already passed
                              if (isToday) {
                                const now = new Date();
                                if (hour < now.getHours() || (hour === now.getHours() && minute < now.getMinutes())) {
                                  return; // Skip this time slot
                                }
                              }
                              
                              const formattedHour = hour.toString().padStart(2, '0');
                              const formattedMinute = minute.toString().padStart(2, '0');
                              const timeValue = `${formattedHour}:${formattedMinute}`;
                              const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                              const displayTime = `${displayHour}:${formattedMinute.padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
                              
                              const timeSlot = (
                                <SelectItem key={timeValue} value={timeValue}>
                                  {displayTime}
                                </SelectItem>
                              );
                              
                              if (hour < 12) {
                                morningSlots.push(timeSlot);
                              } else if (hour < 17) {
                                afternoonSlots.push(timeSlot);
                              } else {
                                eveningSlots.push(timeSlot);
                              }
                            });
                            
                            // If all sections are empty, show a message
                            if (morningSlots.length === 0 && afternoonSlots.length === 0 && eveningSlots.length === 0) {
                              return [
                                <SelectItem key="no-slots" value="__no_slots__" disabled>
                                  No available time slots. Please select another date.
                                </SelectItem>
                              ];
                            }
                            
                            // Create a safe array of all time slots with headers
                            const allTimeSlots = [];
                            
                            // Add morning slots if available
                            if (morningSlots.length > 0) {
                              allTimeSlots.push(
                                <SelectItem key="morning-header" value="morning-header" disabled>
                                  Morning
                                </SelectItem>
                              );
                              allTimeSlots.push(...morningSlots);
                            }
                            
                            // Add afternoon slots if available
                            if (afternoonSlots.length > 0) {
                              allTimeSlots.push(
                                <SelectItem key="afternoon-header" value="afternoon-header" disabled>
                                  Afternoon
                                </SelectItem>
                              );
                              allTimeSlots.push(...afternoonSlots);
                            }
                            
                            // Add evening slots if available
                            if (eveningSlots.length > 0) {
                              allTimeSlots.push(
                                <SelectItem key="evening-header" value="evening-header" disabled>
                                  Evening
                                </SelectItem>
                              );
                              allTimeSlots.push(...eveningSlots);
                            }
                            
                            return allTimeSlots;
                          })()}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      <FormDescription>
                        Duration: {appointmentMode === 'trailer' ? '1 hour' : '4 hours'}
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={scheduleDetailsForm.control}
                name="dockId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dock Door</FormLabel>
                    <Select 
                      value={field.value ? field.value.toString() : ''} 
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a dock" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {docks.map(dock => (
                          <SelectItem key={dock.id} value={dock.id.toString()}>
                            {dock.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <FormDescription>
                      Dock door selection is optional. You can leave it empty and assign it later.
                    </FormDescription>
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={scheduleDetailsForm.control}
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
                  control={scheduleDetailsForm.control}
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
                  control={scheduleDetailsForm.control}
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
                  control={scheduleDetailsForm.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight</FormLabel>
                      <FormControl>
                        <Input placeholder="Weight in lbs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={scheduleDetailsForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any additional information about this appointment"
                        className="resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="flex justify-between gap-2 pt-4">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="button" variant="outline" onClick={goBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                </div>
                
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : mode === "create" ? "Create Appointment" : "Update Appointment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}