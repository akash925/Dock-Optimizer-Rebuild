import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useBookingWizard } from '@/contexts/BookingWizardContext';
import { useQuery } from '@tanstack/react-query';
import { Facility, BookingPage, AppointmentType } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useStandardQuestions } from '@/hooks/use-standard-questions';
import { StandardQuestionsFormFields } from './standard-questions-form-fields';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowRight, ArrowLeft, Upload, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

// Define a type for the step schemas
type StepSchema = z.ZodObject<any>;

// Define the schemas for each step
const step1Schema = z.object({
  facilityId: z.number({
    required_error: "Please select a facility",
  }),
  appointmentTypeId: z.number({
    required_error: "Please select an appointment type",
  }),
  pickupOrDropoff: z.enum(["pickup", "dropoff"], {
    required_error: "Please select pickup or dropoff",
  }),
});

// Date and time step now comes second (step 2)
const step2Schema = z.object({
  // No fields needed for validation here as date/time selection is handled separately
  // But we could add validation if needed in the future
});

// Company and contact info step now comes third (step 3)
const step3Schema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  contactName: z.string().min(2, "Contact name is required"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  // Allow customFields to hold any type of value (string, array, or file)
  customFields: z.record(z.any()).optional(),
  // Carrier info has been moved to this step
  carrierId: z.number().optional(),
  carrierName: z.string().min(1, "Carrier name is required"),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(10, "Please enter a valid phone number"),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  notes: z.string().optional(),
});

export interface BookingWizardContentProps {
  bookingPage?: BookingPage;
  isLoadingBookingPage: boolean;
  bookingPageError: Error | null;
  shouldReset: boolean;
  slug?: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  toast: any;
  initialFacilityId?: number;
  initialAppointmentTypeId?: number;
  initialDate?: Date;
  initialDockId?: number;
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
  internalMode?: boolean;
}

export function BookingWizardContent({
  bookingPage,
  isLoadingBookingPage,
  bookingPageError,
  shouldReset,
  slug,
  navigate,
  toast,
  initialFacilityId,
  initialAppointmentTypeId,
  initialDate,
  initialDockId,
  onSubmitSuccess,
  onCancel,
  internalMode = false
}: BookingWizardContentProps) {
  // Get data from context
  const { 
    currentStep, 
    setCurrentStep, 
    bookingData, 
    updateBookingData,
    resetBookingData,
    isLoading,
    setIsLoading
  } = useBookingWizard();

  // Local state for UI management
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate || null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);

  // Fetch facilities
  const { data: facilities = [], isLoading: isLoadingFacilities } = useQuery<Facility[]>({
    queryKey: internalMode ? ['/api/facilities'] : [`/api/booking-pages/slug/${slug}/facilities`],
    enabled: !isLoadingBookingPage && !!bookingPage,
  });

  // Fetch appointment types based on selected facility
  const { data: appointmentTypes = [], isLoading: isLoadingAppointmentTypes } = useQuery<AppointmentType[]>({
    queryKey: internalMode 
      ? ['/api/appointment-types', { facilityId: selectedFacility?.id || initialFacilityId }] 
      : [`/api/booking-pages/slug/${slug}/facilities/${selectedFacility?.id || initialFacilityId}/appointment-types`],
    enabled: !!selectedFacility || !!initialFacilityId,
  });

  // Fetch standard questions for the selected appointment type
  const { questions: standardQuestions, isLoading: isLoadingQuestions } = useStandardQuestions({
    appointmentTypeId: bookingData.appointmentTypeId || undefined,
    bookingPageSlug: slug,
  });

  // Create a form for the current step
  const getSchemaForStep = (step: number): StepSchema => {
    switch (step) {
      case 1:
        return step1Schema;
      case 2:
        return step2Schema;
      case 3:
        return step3Schema;
      default:
        return step1Schema;
    }
  };

  const currentStepSchema = getSchemaForStep(currentStep);

  const form = useForm<z.infer<typeof currentStepSchema>>({
    resolver: zodResolver(currentStepSchema),
    defaultValues: {
      // Step 1
      facilityId: bookingData.facilityId || initialFacilityId || undefined,
      appointmentTypeId: bookingData.appointmentTypeId || initialAppointmentTypeId || undefined,
      pickupOrDropoff: bookingData.pickupOrDropoff || undefined,
      
      // Step 2
      companyName: bookingData.companyName || '',
      contactName: bookingData.contactName || '',
      email: bookingData.email || '',
      phone: bookingData.phone || '',
      customFields: bookingData.customFields || {},
      
      // Step 3
      carrierId: bookingData.carrierId || undefined,
      carrierName: bookingData.carrierName || '',
      driverName: bookingData.driverName || '',
      driverPhone: bookingData.driverPhone || '',
      truckNumber: bookingData.truckNumber || '',
      trailerNumber: bookingData.trailerNumber || '',
      notes: bookingData.notes || '',
    }
  });

  // Initialize from props
  useEffect(() => {
    if (initialFacilityId && facilities.length > 0) {
      const facility = facilities.find(f => f.id === initialFacilityId);
      if (facility) {
        setSelectedFacility(facility);
        updateBookingData({ facilityId: initialFacilityId });
      }
    }
  }, [initialFacilityId, facilities, updateBookingData]);

  useEffect(() => {
    if (initialAppointmentTypeId && appointmentTypes.length > 0) {
      const appointmentType = appointmentTypes.find(at => at.id === initialAppointmentTypeId);
      if (appointmentType) {
        updateBookingData({ appointmentTypeId: initialAppointmentTypeId });
      }
    }
  }, [initialAppointmentTypeId, appointmentTypes, updateBookingData]);

  // Handle facility selection
  const handleFacilityChange = (facilityId: string) => {
    const id = parseInt(facilityId, 10);
    const facility = facilities.find(f => f.id === id);
    setSelectedFacility(facility || null);
    updateBookingData({ facilityId: id });
    // Reset appointment type when facility changes
    form.setValue('appointmentTypeId', undefined as any);
    updateBookingData({ appointmentTypeId: null });
  };

  // Handle form submission for each step
  const onSubmit = async (data: any) => {
    console.log(`Step ${currentStep} data:`, data);
    
    // Update context with form data
    updateBookingData(data);
    
    // Move to next step or submit appointment
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - submit appointment
      setIsLoading(true);
      
      try {
        // Format data for submission
        const formattedData = {
          facilityId: bookingData.facilityId,
          appointmentTypeId: bookingData.appointmentTypeId,
          type: bookingData.pickupOrDropoff === 'pickup' ? 'outbound' : 'inbound',
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          customerName: bookingData.companyName, 
          contactName: bookingData.contactName,
          contactEmail: bookingData.email,
          contactPhone: bookingData.phone,
          // Use 0 as default carrierId if not provided to avoid "Invalid carrier ID" error
          carrierId: bookingData.carrierId || 0,
          carrierName: bookingData.carrierName,
          driverName: bookingData.driverName,
          driverPhone: bookingData.driverPhone,
          truckNumber: bookingData.truckNumber,
          trailerNumber: bookingData.trailerNumber,
          notes: bookingData.notes,
          // Include custom fields with standard questions properly wrapped
          customFields: {
            standardQuestions: bookingData.customFields || {}
          },
          // Additional fields for internal booking
          status: 'scheduled',
          source: internalMode ? 'internal' : 'external',
          dockId: initialDockId
        };
        
        console.log("Submitting appointment:", formattedData);
        
        if (onSubmitSuccess) {
          onSubmitSuccess(formattedData);
        } else {
          // Default submission logic for external booking
          const res = await apiRequest('POST', '/api/schedules/external', formattedData);
          
          if (!res.ok) {
            throw new Error('Failed to create appointment');
          }
          
          const result = await res.json();
          
          toast({
            title: "Appointment Scheduled",
            description: "Your appointment has been successfully scheduled.",
          });
          
          // Navigate to confirmation page
          navigate(`/booking-confirmation/${result.confirmationCode}`, { replace: true });
        }
      } catch (error) {
        console.error("Error submitting appointment:", error);
        toast({
          title: "Error",
          description: "Failed to schedule appointment. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle going back to previous step
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else if (onCancel) {
      onCancel();
    }
  };

  // If still loading the booking page, show loading indicator
  if (isLoadingBookingPage) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="mt-2">Loading booking page...</p>
      </div>
    );
  }

  // If there was an error loading the booking page, show error message
  if (bookingPageError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load booking page. Please try again later or contact support.
        </AlertDescription>
      </Alert>
    );
  }

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="facilityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location*</FormLabel>
                  <Select
                    disabled={isLoadingFacilities}
                    onValueChange={(value) => {
                      field.onChange(parseInt(value, 10));
                      handleFacilityChange(value);
                    }}
                    value={field.value?.toString()}
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
                    disabled={!selectedFacility || isLoadingAppointmentTypes}
                    onValueChange={(value) => {
                      field.onChange(parseInt(value, 10));
                      updateBookingData({ appointmentTypeId: parseInt(value, 10) });
                    }}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an appointment type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {appointmentTypes.map((type) => (
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

            <FormField
              control={form.control}
              name="pickupOrDropoff"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Is this a pickup or dropoff?*</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dropoff" id="dropoff" />
                        <Label htmlFor="dropoff">Dropoff (Inbound)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pickup" id="pickup" />
                        <Label htmlFor="pickup">Pickup (Outbound)</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            {/* Date selection */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Select Date and Time</h3>
              <div className="rounded-md border">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    if (date) {
                      // When date is selected, we'll update the booking data
                      updateBookingData({ selectedDate: date });
                      
                      // In a real implementation, we would fetch available times here
                      setIsCheckingAvailability(true);
                      // Simulate API call
                      setTimeout(() => {
                        // Sample available times - in a real app, this would come from an API
                        const times = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM'];
                        setAvailableTimes(times);
                        setIsCheckingAvailability(false);
                      }, 500);
                    }
                  }}
                  className="rounded-md border"
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today;
                  }}
                  initialFocus
                />
              </div>
              {selectedDate && (
                <p className="text-sm text-muted-foreground">
                  Selected date: {format(selectedDate, 'EEEE, MMMM do, yyyy')}
                </p>
              )}
            </div>

            {/* Time selection */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Available Times</h3>
              {!selectedDate ? (
                <div className="text-sm text-muted-foreground">
                  Please select a date to see available times.
                </div>
              ) : isCheckingAvailability ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading available times...</span>
                </div>
              ) : availableTimes.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No available times for the selected date. Please choose another date.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableTimes.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      onClick={() => {
                        setSelectedTime(time);
                        
                        // When time is selected, set the start/end times in booking data
                        if (selectedDate) {
                          const [hour, minute] = time.match(/(\d+):(\d+)/)[0].split(':');
                          const isPM = time.includes('PM');
                          let hourNum = parseInt(hour, 10);
                          if (isPM && hourNum < 12) hourNum += 12;
                          if (!isPM && hourNum === 12) hourNum = 0;
                          
                          const startDate = new Date(selectedDate);
                          startDate.setHours(hourNum, parseInt(minute, 10), 0, 0);
                          
                          // Assume appointments are 1 hour long by default
                          const endDate = new Date(startDate);
                          endDate.setHours(endDate.getHours() + 1);
                          
                          updateBookingData({
                            startTime: startDate,
                            endTime: endDate,
                          });
                        }
                      }}
                      className="justify-center"
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              )}
              {selectedTime && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected time: {selectedTime}
                </p>
              )}
            </div>

            {/* Show available slots if needed */}
            {selectedTime && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Available</AlertTitle>
                <AlertDescription className="text-green-700">
                  This time slot is available for booking.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            {/* Company and contact information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Company Information</h3>
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name*</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name*</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email*</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone*</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Carrier information */}
            <div className="space-y-4 pt-4">
              <Separator className="my-2" />
              <h3 className="text-lg font-medium">Carrier Information</h3>
              <FormField
                control={form.control}
                name="carrierName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier Name*</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input {...field} />
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
                      <Input type="tel" {...field} />
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
                      <Input {...field} />
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Standard questions from the appointment type - only show if there are included questions */}
            {bookingData.appointmentTypeId && standardQuestions && standardQuestions.filter(q => q.included).length > 0 && (
              <>
                <Separator className="my-4" />
                <h3 className="text-lg font-medium mb-4">Additional Information</h3>
                <StandardQuestionsFormFields
                  form={form}
                  questions={standardQuestions}
                  isLoading={isLoadingQuestions}
                />
              </>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="py-2">
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-center">
          <div className="flex items-center">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                    currentStep >= step
                      ? "border-primary bg-primary text-white"
                      : "border-muted bg-background"
                  }`}
                >
                  {currentStep > step ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <span>{step}</span>
                  )}
                </div>
                {step < 3 && (
                  <div
                    className={`mx-2 h-1 w-10 ${
                      currentStep > step ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {renderStepContent()}
          
          <div className="mt-8 flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
            >
              {currentStep === 1 ? "Cancel" : (
                <>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </>
              )}
            </Button>
            
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                  {currentStep === 3 ? "Scheduling..." : "Processing..."}
                </>
              ) : (
                <>
                  {currentStep === 3 ? "Schedule Appointment" : "Next Step"} 
                  {currentStep < 3 && <ArrowRight className="ml-2 h-4 w-4" />}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}