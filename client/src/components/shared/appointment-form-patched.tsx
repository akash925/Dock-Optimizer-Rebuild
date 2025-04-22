import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { format, addMinutes } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useAppointmentAvailability } from '@/hooks/use-appointment-availability-patch';
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
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  ArrowLeft, 
  ArrowRight, 
  CalendarIcon, 
  Check, 
  Clock, 
  Users 
} from 'lucide-react';

// Custom components
import { SimplifiedCarrierSelector } from '@/components/shared/carrier-selector-simple';
import BolUpload from '@/components/shared/bol-upload';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { useLocation } from 'wouter';

// Define Carrier type
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
});

// Types from schema
type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

// Component props
interface AppointmentFormProps {
  facilityId?: number;
  appointmentTypeId?: number;
  initialDate?: Date;
  facilityTimezone?: string;
  onSubmitSuccess?: (data: any) => void;
  bookingPageSlug?: string;
}

export default function AppointmentForm({
  facilityId,
  appointmentTypeId,
  initialDate,
  facilityTimezone = "America/New_York",
  onSubmitSuccess,
  bookingPageSlug,
}: AppointmentFormProps) {
  // State
  const [step, setStep] = useState(1);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [appointmentType, setAppointmentType] = useState<AppointmentType | null>(null);
  const [bolProcessing, setBolProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appointmentMode, setAppointmentMode] = useState<"trailer" | "container">("trailer");

  // Hooks
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Form
  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      customerName: "",
      mcNumber: "",
      truckNumber: "",
      trailerNumber: "",
      driverName: "",
      driverPhone: "",
      type: "inbound",
      appointmentMode: "trailer",
      appointmentDate: initialDate ? format(initialDate, 'yyyy-MM-dd') : "",
      appointmentTime: "",
    },
  });

  // Availability API functions
  const { 
    fetchAvailabilityForDate, 
    availableTimeSlots, 
    isLoading: isLoadingAvailability, 
    error: availabilityError 
  } = useAppointmentAvailability({
    facilityId,
    typeId: appointmentTypeId,
    mode: appointmentMode,
    facilityTimezone
  });

  // Fetch facilities and appointment types
  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const res = await apiRequest('GET', '/api/facilities');
        if (!res.ok) throw new Error('Failed to load facilities');
        const facilities = await res.json();
        setFacilities(facilities);
      } catch (error) {
        console.error('Error fetching facilities:', error);
        toast({ title: 'Error', description: 'Failed to load facilities', variant: 'destructive' });
      }
    };

    const fetchAppointmentType = async () => {
      if (!appointmentTypeId) return;
      try {
        const res = await apiRequest('GET', `/api/appointment-types/${appointmentTypeId}`);
        if (!res.ok) throw new Error('Failed to load appointment type');
        const type = await res.json();
        setAppointmentType(type);
        
        // Set default appointment mode based on duration
        const recommendedMode = type.duration <= 60 ? "trailer" : "container";
        setAppointmentMode(recommendedMode);
        form.setValue("appointmentMode", recommendedMode);
      } catch (error) {
        console.error('Error fetching appointment type:', error);
        toast({ title: 'Error', description: 'Failed to load appointment details', variant: 'destructive' });
      }
    };

    fetchFacilities();
    fetchAppointmentType();
  }, [appointmentTypeId, toast, form]);

  // Effect to handle date selection
  useEffect(() => {
    const appointmentDate = form.watch("appointmentDate");
    if (appointmentDate && facilityId) {
      fetchAvailabilityForDate(appointmentDate);
    }
  }, [form.watch("appointmentDate"), facilityId, fetchAvailabilityForDate]);

  // Helper to get default end time based on selected appointment type
  const getDefaultEndTime = (startDate: Date) => {
    const durationInMinutes = appointmentType?.duration || 60;
    return addMinutes(startDate, durationInMinutes);
  };

  // BOL Processing callback
  const handleBolProcessed = (data: any) => {
    // Update form with extracted data
    if (data.bolNumber) form.setValue("bolNumber", data.bolNumber);
    if (data.palletCount) form.setValue("palletCount", data.palletCount.toString());
    if (data.weight) form.setValue("weight", data.weight.toString());
    
    toast({
      title: "BOL Processed",
      description: "Information has been extracted from the document.",
    });
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
      
      // Create Date object
      const startTime = new Date(`${appointmentDate}T${appointmentTime}`);
      if (isNaN(startTime.getTime())) {
        throw new Error("Invalid date/time");
      }
      
      // Calculate end time
      const endTime = getDefaultEndTime(startTime);
      
      // API payload
      const scheduleData = {
        facilityId: facilityId || null,
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
        palletCount: data.palletCount || 0,
        weight: data.weight || 0,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        type: data.type,
        appointmentTypeId: appointmentTypeId || null,
        notes: data.notes,
        status: "scheduled",
        bookingPageSlug: bookingPageSlug,
        mode: "external",
      };
      
      console.log('Submitting appointment:', scheduleData);
      
      const response = await apiRequest('POST', '/api/schedules', scheduleData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to schedule appointment');
      }
      
      const appointment = await response.json();
      
      // Reset form
      form.reset();
      
      // Success notification
      toast({
        title: "Appointment Scheduled",
        description: "Your appointment has been successfully scheduled.",
      });
      
      // Step to confirmation page
      setStep(3);
      
      // Call success callback if provided
      if (onSubmitSuccess) {
        onSubmitSuccess(appointment);
      }
    } catch (error: any) {
      console.error('Error scheduling appointment:', error);
      toast({
        title: "Scheduling Failed",
        description: error.message || "Failed to schedule appointment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Carrier selection handler
  const handleCarrierSelect = (carrier: Carrier) => {
    if (carrier) {
      form.setValue("carrierId", carrier.id);
      form.setValue("mcNumber", carrier.mcNumber || "");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(step === 1 ? onTruckInfoSubmit : onSubmit)}>
        {/* Step 1: Truck Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              {/* Customer Name */}
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
              
              {/* Carrier */}
              <div>
                <FormField
                  control={form.control}
                  name="carrierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Carrier (Optional)</FormLabel>
                      <FormControl>
                        <SimplifiedCarrierSelector
                          onSelect={handleCarrierSelect}
                          selectedCarrierId={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* MC Number */}
              <FormField
                control={form.control}
                name="mcNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MC Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter MC number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Truck Number */}
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

              {/* Trailer Number */}
              <FormField
                control={form.control}
                name="trailerNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trailer Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter trailer number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Driver Name */}
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

              {/* Driver Phone */}
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

              {/* Appointment Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Appointment Type*</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="inbound" id="inbound" />
                          <label htmlFor="inbound">Inbound</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="outbound" id="outbound" />
                          <label htmlFor="outbound">Outbound</label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Appointment Mode */}
            <FormField
              control={form.control}
              name="appointmentMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Appointment Mode*</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="trailer" id="trailer" />
                        <label htmlFor="trailer">Trailer (1 hour)</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="container" id="container" />
                        <label htmlFor="container">Container (2 hours)</label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Form Actions */}
            <div className="flex justify-end">
              <Button type="submit">
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Schedule */}
        {step === 2 && (
          <div className="space-y-6">
            {/* BOL Upload */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Bill of Lading (Optional)</h3>
              <p className="text-sm text-muted-foreground">
                Upload a BOL document to automatically extract information
              </p>
              <BolUpload
                onBolProcessed={handleBolProcessed}
                onProcessingStateChange={setBolProcessing}
              />
            </div>

            {/* BOL and PO Fields */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="bolNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BOL Number (Optional)</FormLabel>
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
                    <FormLabel>PO Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter PO number" {...field} />
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
                    <FormLabel>Weight (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter weight in lbs"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseInt(e.target.value) : "")
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="palletCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pallet Count (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter pallet count"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseInt(e.target.value) : "")
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date & Time Selection */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              {/* Date Picker */}
              <FormField
                control={form.control}
                name="appointmentDate"
                render={({ field }) => (
                  <FormItem>
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
                control={form.control}
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
                        disabled={isLoadingAvailability || !form.watch("appointmentDate")}
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
                                {!form.watch("appointmentDate") 
                                  ? "Please select a date first" 
                                  : "No available time slots for selected date"}
                              </div>
                            ) : (
                              availableTimeSlots.map((slot) => (
                                <SelectItem
                                  key={slot.time}
                                  value={slot.time}
                                  disabled={!slot.available}
                                  className={!slot.available ? "opacity-50" : ""}
                                >
                                  {slot.time} {!slot.available && `(${slot.reason || "Unavailable"})`}
                                  {slot.available && slot.remaining !== undefined && 
                                    slot.remaining > 0 && ` (${slot.remaining} slots remaining)`}
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
            
            {/* Notes */}
            <FormField
              control={form.control}
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
                      {form.getValues("appointmentDate") && form.getValues("appointmentTime") ? (
                        format(
                          new Date(`${form.getValues("appointmentDate")}T${form.getValues("appointmentTime")}`),
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
                    <div className="font-medium">{form.getValues("customerName")}</div>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Clock className="h-5 w-5 mr-2 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-500">Appointment Type</div>
                    <div className="font-medium">
                      {appointmentType?.name || "Standard Appointment"}
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
                  form.reset();
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
}