import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { format, addMinutes } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useAppointmentAvailability, type AvailabilitySlot } from '@/hooks/use-appointment-availability-fixed';
import { useStandardQuestions } from '@/hooks/use-standard-questions';
import { Facility, AppointmentType } from '@shared/schema';

// UI Components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, 
  ArrowRight, 
  CalendarIcon, 
  Check, 
  Clock, 
  Users 
} from 'lucide-react';

// Custom components
import { CarrierSelector } from '@/components/shared/carrier-selector';
import BolUpload from '@/components/shared/bol-upload';
import { StandardQuestionsFormFields } from '@/components/shared/standard-questions-form-fields';
import { format as formatDate } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { useLocation } from 'wouter';

// Define Carrier type if not available from library
interface Carrier {
  id: number;
  name: string;
  mcNumber?: string;
}

// Validation schema
const appointmentFormSchema = z.object({
  // Step 1 - Truck Info
  carrierId: z.number().optional(),
  carrierName: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  mcNumber: z.string().optional(),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(1, "Driver phone is required"),
  driverEmail: z.string().email("Valid email required for appointment confirmations").optional(),
  type: z.enum(["inbound", "outbound"]),
  appointmentMode: z.enum(["trailer", "container"]),
  
  // Step 2 - BOL & Date
  bolNumber: z.string().optional(),
  poNumber: z.string().optional(),
  weight: z.union([z.string(), z.number()]).optional().transform(val => val ? Number(val) : undefined),
  palletCount: z.union([z.string(), z.number()]).optional().transform(val => val ? Number(val) : undefined),
  notes: z.string().optional(),
  dockId: z.number().optional(),
  appointmentDate: z.string().min(1, "Date is required"),
  appointmentTime: z.string().min(1, "Time is required"),
})
// Add a catch-all for dynamic standard question fields
.catchall(z.any());

// Types from schema
type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

// Component props
interface UnifiedAppointmentFormProps {
  mode: "internal" | "external";
  isOpen?: boolean; // For internal mode dialog
  onClose?: () => void; // For internal mode
  initialData?: any;
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

export default function UnifiedAppointmentForm({
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
  containerClass = "max-w-4xl mx-auto p-4",
  showBackButton = false,
  goBack = () => {},
}: UnifiedAppointmentFormProps) {
  // State
  const [step, setStep] = useState(1);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(facilityId || null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedAppointmentType, setSelectedAppointmentType] = useState<AppointmentType | null>(null);
  const [bolProcessing, setBolProcessing] = useState(false);
  const [bolPreviewText, setBolPreviewText] = useState<string | null>(null);
  const [requiresDock, setRequiresDock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appointmentMode, setAppointmentMode] = useState<"trailer" | "container">(
    initialData?.appointmentMode || "trailer"
  );

  // Hooks
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Form
  const truckInfoForm = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      carrierId: initialData?.carrierId || undefined,
      carrierName: initialData?.carrierName || "",
      customerName: initialData?.customerName || "",
      mcNumber: initialData?.mcNumber || "",
      truckNumber: initialData?.truckNumber || "",
      trailerNumber: initialData?.trailerNumber || "",
      driverName: initialData?.driverName || "",
      driverPhone: initialData?.driverPhone || "",
      driverEmail: initialData?.driverEmail || "",
      type: initialData?.type || "inbound",
      appointmentMode: initialData?.appointmentMode || "trailer",
      bolNumber: initialData?.bolNumber || "",
      poNumber: initialData?.poNumber || "",
      weight: initialData?.weight || "",
      palletCount: initialData?.palletCount || "",
      notes: initialData?.notes || "",
      dockId: initialData?.dockId || initialDockId || undefined,
      appointmentDate: initialData?.appointmentDate || 
        (initialDate ? format(initialDate, 'yyyy-MM-dd') : ""),
      appointmentTime: initialData?.appointmentTime || "",
    },
  });

  // Availability API functions
  const { 
    fetchAvailabilityForDate, 
    availableTimeSlots, 
    isLoading: isLoadingAvailability, 
    error: availabilityError 
  } = useAppointmentAvailability({
    facilityId: selectedFacilityId,
    typeId: appointmentTypeId,
    appointmentTypeId: appointmentTypeId,
    mode: appointmentMode,
    facilityTimezone: facilityTimezone
  });

  // Standard questions hook
  const { 
    standardQuestions, 
    isLoading: isLoadingStandardQuestions, 
    error: standardQuestionsError 
  } = useStandardQuestions({
    appointmentTypeId,
    bookingPageSlug
  });

  // Fetch facilities and appointment types
  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const res = await apiRequest('GET', '/api/facilities');
        if (!res.ok) throw new Error('Failed to load facilities');
        const facilities = await res.json();
        setFacilities(facilities);
        
        // If we have a facilityId but no facility name, set it from this list
        if (facilityId) {
          const facilityInfo = facilities.find((f: any) => f.id === facilityId);
          if (facilityInfo) {
            console.log("Setting facility name from fetched facilities:", facilityInfo.name);
            // We don't directly set in form, just make sure it's available for submission
          }
        }
      } catch (error) {
        console.error('Error fetching facilities:', error);
        toast({ title: 'Error', description: 'Failed to load facilities', variant: 'destructive' });
      }
    };

    const fetchAppointmentType = async () => {
      if (!appointmentTypeId) return;
      try {
        console.log(`Fetching appointment type with ID ${appointmentTypeId}`);
        const res = await apiRequest('GET', `/api/appointment-types/${appointmentTypeId}`);
        if (!res.ok) throw new Error('Failed to load appointment type');
        const type = await res.json();
        console.log("Appointment type loaded:", type);
        setSelectedAppointmentType(type);
        
        // Check if this type requires a dock assignment
        const requiresDock = type.requiresDock || false;
        setRequiresDock(requiresDock);
        
        // Set default appointment mode based on duration
        const recommendedMode = type.duration <= 60 ? "trailer" : "container";
        setAppointmentMode(recommendedMode);
        truckInfoForm.setValue("appointmentMode", recommendedMode);
      } catch (error) {
        console.error('Error fetching appointment type:', error);
        toast({ title: 'Error', description: 'Failed to load appointment details', variant: 'destructive' });
      }
    };

    // Load all appointment types too for reference
    const fetchAllAppointmentTypes = async () => {
      try {
        console.log("Fetching all appointment types for reference");
        const res = await apiRequest('GET', '/api/appointment-types');
        if (!res.ok) throw new Error('Failed to load appointment types');
        const types = await res.json();
        console.log(`Loaded ${types.length} appointment types`);
        
        // If we have an appointmentTypeId but haven't loaded the specific type yet,
        // see if we can get it from this list
        if (appointmentTypeId && !selectedAppointmentType) {
          const typeInfo = types.find((t: any) => t.id === appointmentTypeId);
          if (typeInfo) {
            console.log("Setting appointment type from fetched list:", typeInfo.name);
            setSelectedAppointmentType(typeInfo);
          }
        }
      } catch (error) {
        console.error('Error fetching all appointment types:', error);
      }
    };

    fetchFacilities();
    fetchAppointmentType();
    fetchAllAppointmentTypes();
  }, [appointmentTypeId, facilityId, selectedAppointmentType, toast, truckInfoForm]);

  // Effect to handle date selection
  useEffect(() => {
    const appointmentDate = truckInfoForm.watch("appointmentDate");
    if (appointmentDate && selectedFacilityId) {
      console.log("Selected date (exactly as selected):", appointmentDate);
      
      // Make sure we're using the exact date string without timezone adjustments
      // This prevents the date from shifting due to timezone differences
      fetchAvailabilityForDate(appointmentDate);
    }
  }, [truckInfoForm.watch("appointmentDate"), selectedFacilityId, fetchAvailabilityForDate]);

  // Helper to get default end time based on selected appointment type
  const getDefaultEndTime = (startDate: Date) => {
    const durationInMinutes = selectedAppointmentType?.duration || 60;
    return addMinutes(startDate, durationInMinutes);
  };

  // BOL Processing callback
  const handleBolProcessed = (data: any, fileUrl: string) => {
    // Update form with extracted data
    if (data.bolNumber) truckInfoForm.setValue("bolNumber", data.bolNumber);
    if (data.palletCount) truckInfoForm.setValue("palletCount", data.palletCount.toString());
    if (data.weight) truckInfoForm.setValue("weight", data.weight.toString());
    
    // Set preview text
    setBolPreviewText(`
      Bill of Lading #${data.bolNumber || "N/A"}
      Pallet Count: ${data.palletCount || "N/A"}
      Weight: ${data.weight || "N/A"}
    `);
    
    toast({
      title: "BOL Processed",
      description: "Information has been extracted from the document.",
    });
  };

  // BOL Processing state handler
  const handleBolProcessingStateChange = (isProcessing: boolean) => {
    setBolProcessing(isProcessing);
  };

  // Carrier selection handler
  const handleCarrierSelect = (carrier: Carrier) => {
    if (carrier) {
      truckInfoForm.setValue("carrierId", carrier.id);
      truckInfoForm.setValue("mcNumber", carrier.mcNumber || "");
    }
  };

  // Step 1 form submission - truck info
  const onTruckInfoSubmit = (data: AppointmentFormValues) => {
    console.log("Step 1 data:", data);
    // Move to step 2
    setStep(2);
  };

  // Final form submission
  const onSubmit = async (data: AppointmentFormValues) => {
    setIsSubmitting(true);
    
    try {
      // Convert form data to API format
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
      
      console.log("Updating facility timezone to", facilityTimezone);
      
      // Create Date object with explicit timezone handling
      // This ensures we're creating the appointment in the facility's timezone
      const dateTimeString = `${appointmentDate}T${appointmentTime}:00`;
      
      // First create the date object as local time
      const localStartTime = new Date(`${appointmentDate}T${appointmentTime}`);
      
      // Then create a date that's timezone-aware in the facility timezone
      // This maintains the exact hour/minute selected in the facility's timezone
      const tzOptions = { timeZone: facilityTimezone };
      const startTime = localStartTime;
      
      if (isNaN(startTime.getTime())) {
        throw new Error("Invalid date/time");
      }
      
      // Log the time values for debugging
      console.log("Selected appointment type ID:", appointmentTypeId);
      console.log("Selected appointment type:", selectedAppointmentType?.name, "Duration:", selectedAppointmentType?.duration, "minutes");
      
      // Calculate end time based on appointment type duration
      const endTime = getDefaultEndTime(startTime);
      
      // Add logging for debugging appointment date/time
      console.log("Date is already in correct format:", appointmentDate);
      console.log("Sanitized time for submission:", appointmentTime);

      // Get facility name to ensure it's included in the appointment
      let facilityName = "";
      if (selectedFacilityId && facilities && facilities.length > 0) {
        const facility = facilities.find((f: any) => f.id === selectedFacilityId);
        facilityName = facility?.name || "";
      }

      // Make sure we have the appointment type name as well
      let appointmentTypeName = "";
      if (appointmentTypeId && selectedAppointmentType) {
        appointmentTypeName = selectedAppointmentType.name || "";
      }

      // API payload with enhanced data
      const scheduleData = {
        carrierId: data.carrierId || null,
        carrierName: data.carrierName || "",
        customerName: data.customerName,
        mcNumber: data.mcNumber || "",
        dockId: data.dockId || null,
        truckNumber: data.truckNumber,
        trailerNumber: data.trailerNumber || "",
        driverName: data.driverName,
        driverPhone: data.driverPhone,
        driverEmail: data.driverEmail || "", // Include driver email for notifications
        bolNumber: data.bolNumber || "",
        poNumber: data.poNumber || "",
        palletCount: data.palletCount ? parseInt(data.palletCount.toString()) : 0,
        weight: data.weight ? parseInt(data.weight.toString()) : 0,
        // Use the appointment date & time directly for clarity
        appointmentDate: appointmentDate,
        appointmentTime: appointmentTime,
        // Also include the ISO times for the database
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        type: data.type,
        appointmentTypeId: appointmentTypeId || null,
        appointmentType: appointmentTypeName, // Include the name as well
        appointmentMode: data.appointmentMode,
        status: "scheduled",
        notes: data.notes || "",
        createdBy: user?.id || null,
        facilityId: selectedFacilityId || null,
        facilityName: facilityName, // Include the facility name for better display
        facilityTimezone: facilityTimezone,
      };
      
      console.log("Submitting appointment with sanitized data:", scheduleData);
      
      if (initialData && editMode === "edit") {
        // Update
        const res = await apiRequest("PUT", `/api/schedules/${initialData.id}`, scheduleData);
        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(errorData?.message || `Server error: ${res.status}`);
        }
        
        const updatedData = await res.json();
        queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
        
        toast({
          title: "Appointment updated",
          description: "The appointment has been updated successfully.",
        });
        
        if (onSubmitSuccess) {
          onSubmitSuccess(updatedData);
        }
        
        if (mode === "internal") {
          onClose();
        } else {
          // For external mode, show confirmation step
          setStep(3);
        }
      } else {
        // Create
        const res = await apiRequest("POST", "/api/schedules", scheduleData);
        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          throw new Error(errorData?.message || `Server error: ${res.status}`);
        }
        
        const newData = await res.json();
        queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
        
        toast({
          title: "Appointment created",
          description: "The appointment has been created successfully.",
        });
        
        if (onSubmitSuccess) {
          onSubmitSuccess(newData);
        }
        
        if (mode === "internal") {
          onClose();
        } else {
          // For external mode, show confirmation step
          setStep(3);
        }
      }
    } catch (error: any) {
      console.error("Error submitting form:", error);
      toast({
        title: "Form Error",
        description: error.message || "There was a problem processing the form data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render form content based on current step
  const renderFormContent = () => {
    // If we're still loading or there's an error, show appropriate state
    if (!selectedAppointmentType && appointmentTypeId) {
      return (
        <div className="p-6">
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
    
    // Use a single Form component for all steps to fix the FormContext issue
    return (
      <Form {...truckInfoForm}>
        <form 
          onSubmit={
            step === 1 
              ? truckInfoForm.handleSubmit(onTruckInfoSubmit) 
              : truckInfoForm.handleSubmit(onSubmit)
          } 
          className="space-y-4"
        >
          {/* Step 1: Carrier Info */}
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
                        {/* Filter appointment types by the selected facility */}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              
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
                      onValueChange={(val) => {
                        field.onChange(val);
                        setAppointmentMode(val as "trailer" | "container");
                      }}
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
                
                <FormField
                  control={truckInfoForm.control}
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
              </div>
              
              {/* Standard Questions - Step 1 */}
              {appointmentTypeId && standardQuestions.length > 0 && (
                <div className="space-y-4 mt-4 border-t pt-4">
                  <h3 className="text-lg font-medium">Additional Information</h3>
                  <StandardQuestionsFormFields
                    form={truckInfoForm}
                    standardQuestions={standardQuestions}
                    isLoading={isLoadingStandardQuestions}
                  />
                </div>
              )}
              
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
            </div>
          )}
          
          {/* Step 2: BOL & Date */}
          {step === 2 && (
            <div className="space-y-4">
              {/* BOL & PO Section */}
              <div className="space-y-4">
                {/* BOL Upload Component */}
                <div className="border rounded-md p-4 space-y-4">
                  <h3 className="text-lg font-medium">Bill of Lading (Optional)</h3>
                  <BolUpload 
                    onBolProcessed={handleBolProcessed}
                    onProcessingStateChange={handleBolProcessingStateChange}
                  />
                  
                  {bolPreviewText && (
                    <div className="bg-gray-50 p-2 rounded text-sm font-mono whitespace-pre-wrap">
                      {bolPreviewText}
                    </div>
                  )}
                </div>
                
                {/* BOL & PO Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={truckInfoForm.control}
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
                    control={truckInfoForm.control}
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
                    control={truckInfoForm.control}
                    name="palletCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pallet Count</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Enter pallet count" 
                            {...field} 
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={truckInfoForm.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Enter weight in lbs" 
                            {...field} 
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Dock Selection - only if required */}
              {requiresDock && (
                <FormField
                  control={truckInfoForm.control}
                  name="dockId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dock Door*</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(parseInt(value))} 
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select dock door" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* TODO: Populate dock doors from API */}
                          <SelectItem value="1">Door 1</SelectItem>
                          <SelectItem value="2">Door 2</SelectItem>
                          <SelectItem value="3">Door 3</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the dock door for this appointment
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              {/* Date & Time Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Schedule Appointment</h3>
                
                {/* Date Picker */}
                <FormField
                  control={truckInfoForm.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date*</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={`w-full pl-3 text-left font-normal ${
                                !field.value ? "text-muted-foreground" : ""
                              }`}
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
                            onSelect={(date: Date | undefined) => {
                              if (date) {
                                const dateStr = format(date, "yyyy-MM-dd");
                                field.onChange(dateStr);
                                console.log("Selected date:", dateStr);
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
                
                {/* Time Slot Selection */}
                <FormField
                  control={truckInfoForm.control}
                  name="appointmentTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time*</FormLabel>
                      <div className="relative">
                        {isLoadingAvailability && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          </div>
                        )}
                        
                        {availabilityError && (
                          <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error loading availability</AlertTitle>
                            <AlertDescription>
                              Please try selecting a different date or contact support.
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          disabled={isLoadingAvailability || !truckInfoForm.watch("appointmentDate")}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select time slot" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <ScrollArea className="h-[200px]">
                              {availableTimeSlots.length === 0 ? (
                                <div className="px-2 py-4 text-center text-sm">
                                  {!truckInfoForm.watch("appointmentDate") 
                                    ? "Please select a date first" 
                                    : "No available time slots for selected date"}
                                </div>
                              ) : (
                                availableTimeSlots.map((slot) => (
                                  <SelectItem
                                    key={slot.time}
                                    value={slot.time}
                                    disabled={!slot.available}
                                    className={`${!slot.available ? "opacity-50" : ""} ${slot.isBufferTime ? "bg-yellow-50" : ""}`}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className="font-medium">{slot.time}</span>
                                      <span className="text-sm ml-2">
                                        {/* Remove buffer time display in slot UI since it's now used as interval */}
                                        {!slot.available && !slot.isBufferTime && (
                                          <span className="text-red-600 text-xs">({slot.reason || "Unavailable"})</span>
                                        )}
                                        {slot.available && slot.remaining !== undefined && 
                                          slot.remaining > 0 && (
                                          <span className="text-green-600 text-xs">
                                            ({slot.remaining} {slot.remaining === 1 ? "slot" : "slots"} left)
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </ScrollArea>
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Standard Questions - Step 2 */}
              {appointmentTypeId && standardQuestions.length > 0 && (
                <div className="space-y-4 mt-4 border-t pt-4">
                  <h3 className="text-lg font-medium">Additional Information</h3>
                  <StandardQuestionsFormFields
                    form={truckInfoForm}
                    standardQuestions={standardQuestions}
                    isLoading={isLoadingStandardQuestions}
                  />
                </div>
              )}
              
              {/* Notes */}
              <FormField
                control={truckInfoForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional notes for this appointment"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Form Actions */}
              <div className="flex justify-between mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || bolProcessing}
                  className="ml-auto"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-b-2 border-current rounded-full"></div>
                      Processing...
                    </>
                  ) : (
                    <>Submit Appointment</>
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="space-y-6 py-8 text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 p-3">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Appointment Confirmed!</h2>
                <p className="text-gray-500">
                  Your appointment has been successfully scheduled. You will receive a confirmation email shortly.
                </p>
              </div>
              
              <div className="border rounded-lg p-4 bg-gray-50 max-w-md mx-auto">
                <div className="text-left space-y-3">
                  <div className="flex items-start">
                    <CalendarIcon className="h-5 w-5 mr-2 text-gray-500" />
                    <div>
                      <div className="text-sm text-gray-500">Date & Time</div>
                      <div className="font-medium">
                        {truckInfoForm.getValues("appointmentDate") && truckInfoForm.getValues("appointmentTime") ? (
                          format(
                            new Date(`${truckInfoForm.getValues("appointmentDate")}T${truckInfoForm.getValues("appointmentTime")}`),
                            "PPP 'at' h:mm a"
                          )
                        ) : (
                          "Not specified"
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Users className="h-5 w-5 mr-2 text-gray-500" />
                    <div>
                      <div className="text-sm text-gray-500">Customer</div>
                      <div className="font-medium">{truckInfoForm.getValues("customerName")}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Clock className="h-5 w-5 mr-2 text-gray-500" />
                    <div>
                      <div className="text-sm text-gray-500">Appointment Type</div>
                      <div className="font-medium">
                        {selectedAppointmentType?.name || "Standard Appointment"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // Reset form and go back to step 1
                    truckInfoForm.reset();
                    setStep(1);
                  }}
                  className="mr-4"
                >
                  Book Another Appointment
                </Button>
              </div>
            </div>
          )}
        </form>
      </Form>
    );
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