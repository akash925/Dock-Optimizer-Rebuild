import React, { useState, useEffect, ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useBookingWizard } from '@/contexts/BookingWizardContext';
import { useQuery } from '@tanstack/react-query';
import { Facility, BookingPage, AppointmentType } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useStandardQuestions } from '@/hooks/use-standard-questions';
import { StandardQuestionsFormFields } from './standard-questions-form-fields';
import { useToast } from '@/hooks/use-toast';
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
import { CarrierSelector } from '@/components/shared/carrier-selector';
import { format, parse } from 'date-fns';

// Create a type for our parsed facilities data
interface ParsedFacilities {
  [facilityId: string]: {
    facility: Facility;
    excludedAppointmentTypes: number[];
  }
}

// Step 1: Initial Selections
const initialSelectionSchema = z.object({
  location: z.string().min(1, 'Please select a location'),
  appointmentType: z.string().min(1, 'Please select an appointment type'),
  pickupOrDropoff: z.enum(['pickup', 'dropoff'], {
    required_error: 'Please select whether this is a pickup or dropoff',
  }),
});

// Step 2: Customer Information
const companyInfoSchema = z.object({
  customerName: z.string().min(2, 'Customer name is required'),
  contactName: z.string().min(2, 'Contact name is required'),
  contactEmail: z.string().email('Please enter a valid email'),
  contactPhone: z.string().min(10, 'Please enter a valid phone number'),
});

// Step 3: Appointment Details
const appointmentDetailsSchema = z.object({
  appointmentDate: z.string().min(1, 'Please select a date'),
  appointmentTime: z.string().min(1, 'Please select a time'),
  carrierName: z.string().min(1, 'Carrier name is required'),
  carrierId: z.number().optional(),
  // Added validation for MC Number format
  mcNumber: z.string().regex(/^\d{3}-\d{3}-\d{4}$/, 'MC Number must be in format: XXX-XXX-XXXX').optional().or(z.literal('')),
  truckNumber: z.string().min(1, 'Truck number is required'),
  trailerNumber: z.string().optional(),
  driverName: z.string().min(1, 'Driver name is required'),
  driverPhone: z.string().min(10, 'Please enter a valid phone number'),
  poNumber: z.string().optional(),
  bolNumber: z.string().optional(), 
  palletCount: z.string().optional(),
  weight: z.string().optional(),
  additionalNotes: z.string().optional(),
});

type InitialSelectionFormValues = z.infer<typeof initialSelectionSchema>;
type CompanyInfoFormValues = z.infer<typeof companyInfoSchema>;
type AppointmentDetailsFormValues = z.infer<typeof appointmentDetailsSchema>;

interface BookingWizardContentProps {
  bookingPage?: BookingPage;
  isLoadingBookingPage: boolean;
  bookingPageError: Error | null;
  shouldReset: boolean;
  slug?: string;
  internalMode?: boolean;
  initialDate?: Date;
  initialDockId?: number;
  initialAppointmentTypeId?: number;
  initialFacilityId?: number;
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
  navigate?: (to: string, options?: { replace?: boolean }) => void;
  toast?: any;
}

export function BookingWizardContent({
  bookingPage,
  isLoadingBookingPage,
  bookingPageError,
  shouldReset,
  slug,
  internalMode = false,
  initialDate,
  initialDockId,
  initialAppointmentTypeId,
  initialFacilityId,
  onSubmitSuccess,
  onCancel,
  navigate,
  toast: externalToast,
}: BookingWizardContentProps) {
  const { 
    bookingData, 
    resetBooking, 
    updateTruckInfo,
    updateScheduleDetails,
    setBolFile,
    setAppointmentDateTime
  } = useBookingWizard();
  
  const { toast: internalToast } = useToast();
  const toast = externalToast || internalToast;
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bolProcessing, setBolProcessing] = useState(false);
  const [parsedFacilities, setParsedFacilities] = useState<ParsedFacilities>({});
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedAppointmentTypeId, setSelectedAppointmentTypeId] = useState<number | undefined>(
    initialAppointmentTypeId
  );
  
  // Reference to prevent infinite re-renders
  const parsedFacilitiesRef = React.useRef<ParsedFacilities>({});
  
  // Fetch facilities
  const { data: facilities = [], isLoading: isLoadingFacilities } = useQuery<Facility[]>({
    queryKey: ['/api/facilities'],
    enabled: !!(bookingPage || internalMode),
  });
  
  // Fetch appointment types
  const { data: appointmentTypes = [], isLoading: isLoadingAppointmentTypes } = useQuery<AppointmentType[]>({
    queryKey: ['/api/appointment-types'],
    enabled: !!(bookingPage || internalMode) && !!facilities?.length,
  });
  
  // Fetch standard questions for the selected appointment type
  const { 
    standardQuestions, 
    isLoading: isLoadingStandardQuestions 
  } = useStandardQuestions({
    appointmentTypeId: selectedAppointmentTypeId,
    bookingPageSlug: internalMode ? undefined : slug
  });
  
  // Process facilities data when it's available
  useEffect(() => {
    if ((bookingPage || internalMode) && facilities?.length && appointmentTypes?.length) {
      console.log('Processing facilities and appointment types...');
      
      // Only process facilities once
      if (Object.keys(parsedFacilitiesRef.current).length === 0) {
        try {
          // Use all facilities by default
          const facilitiesMap: ParsedFacilities = {};
          
          // Add every facility to the map
          facilities.forEach(facility => {
            facilitiesMap[facility.id] = {
              facility,
              excludedAppointmentTypes: []
            };
          });
          
          console.log('Available facilities:', Object.keys(facilitiesMap).length);
          
          // Store in ref to prevent infinite updates
          parsedFacilitiesRef.current = facilitiesMap;
          
          // Set facilities state once
          setParsedFacilities(facilitiesMap);
          
          // If initialFacilityId is provided, set it as the selected location
          if (initialFacilityId) {
            initialSelectionForm.setValue('location', String(initialFacilityId));
            setSelectedLocation(String(initialFacilityId));
          }
          
          // If initialAppointmentTypeId is provided, set it as the selected type
          if (initialAppointmentTypeId) {
            initialSelectionForm.setValue('appointmentType', String(initialAppointmentTypeId));
            setSelectedAppointmentTypeId(initialAppointmentTypeId);
          }
        } catch (err) {
          console.error('Error processing facilities data:', err);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingPage, facilities, appointmentTypes, initialFacilityId, initialAppointmentTypeId]);
  
  // Handle form reset when coming from booking confirmation page or when prop changes
  useEffect(() => {
    if (shouldReset) {
      console.log('Resetting all forms');
      
      // Reset the context state
      resetBooking();
      
      // Reset forms to default values
      initialSelectionForm.reset({
        location: '',
        appointmentType: '',
        pickupOrDropoff: 'dropoff',
      });
      
      companyInfoForm.reset({
        customerName: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
      });
      
      appointmentDetailsForm.reset({
        appointmentDate: '',
        appointmentTime: '',
        carrierName: '',
        carrierId: undefined,
        mcNumber: '',
        truckNumber: '',
        trailerNumber: '',
        driverName: '',
        contactEmail: '',
        driverPhone: '',
        poNumber: '',
        bolNumber: '',
        palletCount: '',
        weight: '',
        additionalNotes: '',
      });
      
      // Reset the step
      setStep(1);
      setSelectedLocation(null);
      
      // Clean up the URL if we're in external mode
      if (navigate && !internalMode) {
        navigate('/external-booking', { replace: true });
      }
      
      toast({
        title: 'Form Reset',
        description: 'Starting a new appointment booking.',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset, resetBooking, toast]);
  
  // Step 1 Form
  const initialSelectionForm = useForm<InitialSelectionFormValues>({
    resolver: zodResolver(initialSelectionSchema),
    defaultValues: {
      location: initialFacilityId ? String(initialFacilityId) : '',
      appointmentType: initialAppointmentTypeId ? String(initialAppointmentTypeId) : '',
      pickupOrDropoff: 'dropoff', // Default to dropoff
    },
  });
  
  // Step 2 Form
  const companyInfoForm = useForm<CompanyInfoFormValues>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues: {
      customerName: bookingData.customerName || '',
      contactName: bookingData.driverName || '',
      contactEmail: bookingData.driverEmail || '',
      contactPhone: bookingData.driverPhone || '',
    },
  });
  
  // Step 3 Form
  const appointmentDetailsForm = useForm<AppointmentDetailsFormValues>({
    resolver: zodResolver(appointmentDetailsSchema),
    defaultValues: {
      appointmentDate: bookingData.scheduledStart 
        ? format(new Date(bookingData.scheduledStart), 'yyyy-MM-dd')
        : initialDate ? format(initialDate, 'yyyy-MM-dd') : '',
      appointmentTime: bookingData.scheduledStart 
        ? format(new Date(bookingData.scheduledStart), 'HH:mm')
        : '',
      carrierName: bookingData.carrierName || '',
      carrierId: bookingData.carrierId || undefined,
      mcNumber: bookingData.mcNumber || '',
      truckNumber: bookingData.truckNumber || '',
      trailerNumber: bookingData.trailerNumber || '',
      driverName: bookingData.driverName || '',
      driverPhone: bookingData.driverPhone || '',
      poNumber: bookingData.poNumber || '',
      bolNumber: bookingData.bolNumber || '',
      palletCount: bookingData.palletCount || '',
      weight: bookingData.weight || '',
      additionalNotes: bookingData.notes || '',
    },
  });
  
  // Watch the location field to update appointment types
  const watchLocation = initialSelectionForm.watch('location');
  const watchAppointmentType = initialSelectionForm.watch('appointmentType');
  
  // Update available appointment types when location changes
  useEffect(() => {
    if (watchLocation !== selectedLocation && watchLocation) {
      setSelectedLocation(watchLocation);
      
      // Reset the appointment type when location changes
      if (watchLocation && !initialAppointmentTypeId) {
        initialSelectionForm.setValue('appointmentType', '');
        setSelectedAppointmentTypeId(undefined);
      }
    }
  }, [watchLocation, selectedLocation, initialSelectionForm, initialAppointmentTypeId]);
  
  // Update selected appointment type ID when the appointment type changes
  useEffect(() => {
    if (watchAppointmentType) {
      const typeId = parseInt(watchAppointmentType);
      setSelectedAppointmentTypeId(typeId);
    }
  }, [watchAppointmentType]);
  
  // Handle BOL file upload
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      setBolProcessing(true);
      
      // Read file contents for preview
      const reader = new FileReader();
      
      reader.onload = function(event) {
        try {
          // Extract text from the file for preview
          const previewText = event.target?.result as string || `File: ${file.name}`;
          
          // Update the central state with the file and preview text
          setBolFile(file, previewText.substring(0, 500));
          
          // Get appointment type details if available
          if (watchLocation && facilities && appointmentTypes) {
            const facilityId = parseInt(watchLocation);
            const facility = facilities.find(f => f.id === facilityId);
            
            if (facility) {
              // Update facility info in context
              updateScheduleDetails({
                facilityId: facility.id,
                facilityTimezone: facility.timezone || 'America/New_York'
              });
            }
          }
          
          setBolProcessing(false);
          
          toast({
            title: 'File Uploaded',
            description: `Successfully uploaded ${file.name}`,
          });
          
        } catch (error) {
          console.error('Error processing file:', error);
          setBolProcessing(false);
          toast({
            title: 'Upload Failed',
            description: 'There was an error processing the file',
            variant: 'destructive'
          });
        }
      };
      
      // Handle errors
      reader.onerror = function() {
        setBolProcessing(false);
        toast({
          title: 'Upload Failed',
          description: 'There was an error reading the file',
          variant: 'destructive'
        });
      };
      
      // Read as text
      reader.readAsText(file);
    }
  };
  
  // Handle Step 1 Submission
  const onInitialSelectionSubmit = (data: InitialSelectionFormValues) => {
    // Get facility details
    let facilityTimezone = 'America/New_York'; // Default timezone
    let appointmentDuration = 60; // Default duration in minutes
    
    // Get facility details if possible
    if (data.location && facilities) {
      const facilityId = parseInt(data.location);
      const facility = facilities.find(f => f.id === facilityId);
      
      if (facility) {
        facilityTimezone = facility.timezone || facilityTimezone;
      }
    }
    
    // Get appointment type details if possible
    if (data.appointmentType && appointmentTypes) {
      const appointmentTypeId = parseInt(data.appointmentType);
      const appointmentType = appointmentTypes.find(t => t.id === appointmentTypeId);
      
      if (appointmentType) {
        appointmentDuration = appointmentType.duration || appointmentDuration;
      }
    }
    
    // Update booking wizard context with step 1 data
    updateScheduleDetails({
      facilityId: parseInt(data.location),
      facilityTimezone,
      appointmentTypeId: parseInt(data.appointmentType)
    });
    
    // Update direction (type) based on pickup/dropoff selection
    updateTruckInfo({
      type: data.pickupOrDropoff === 'pickup' ? 'outbound' : 'inbound'
    });
    
    // Proceed to next step
    setStep(2);
  };
  
  // Handle Step 2 Submission
  const onCompanyInfoSubmit = (data: CompanyInfoFormValues) => {
    // Update booking wizard context with step 2 data
    updateTruckInfo({
      customerName: data.customerName,
      driverName: data.contactName,
      driverEmail: data.contactEmail,
      driverPhone: data.contactPhone
    });
    
    // Set the values in the appointments form, but maintain separation of concerns
    appointmentDetailsForm.setValue('driverName', data.contactName);
    appointmentDetailsForm.setValue('driverPhone', data.contactPhone);
    
    // Proceed to step 3
    setStep(3);
  };
  
  // Handle Step 3 Submission
  const onAppointmentDetailsSubmit = async (data: AppointmentDetailsFormValues) => {
    setIsSubmitting(true);
    
    try {
      // Update booking wizard context with step 3 data
      updateTruckInfo({
        carrierId: data.carrierId || null,
        carrierName: data.carrierName,
        mcNumber: data.mcNumber || '',
        truckNumber: data.truckNumber,
        trailerNumber: data.trailerNumber || '',
        driverName: data.driverName,
        driverPhone: data.driverPhone
      });
      
      // Update schedule details
      updateScheduleDetails({
        bolNumber: data.bolNumber || '',
        poNumber: data.poNumber || '',
        palletCount: data.palletCount || '',
        weight: data.weight || '',
        notes: data.additionalNotes || ''
      });
      
      // Set the appointment date and time, properly handling timezone
      setAppointmentDateTime(
        data.appointmentDate,
        data.appointmentTime,
        bookingData.facilityTimezone || 'America/New_York'
      );
      
      // In internal mode, use the provided callback
      if (internalMode && onSubmitSuccess) {
        onSubmitSuccess(bookingData);
        setIsSubmitting(false);
        return;
      }
      
      // In external mode, make API request to create appointment
      const res = await apiRequest('POST', '/api/external-booking', bookingData);
      const result = await res.json();
      
      toast({
        title: 'Appointment Scheduled',
        description: 'Your appointment has been successfully scheduled. A confirmation email will be sent shortly.',
      });
      
      // Navigate to confirmation page with booking ID and confirmation number
      if (result && result.id && navigate) {
        navigate(`/external-booking/confirmation?id=${result.id}&confirmation=${result.confirmationNumber || 'pending'}`, { replace: true });
      }
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('Error submitting appointment:', error);
      setIsSubmitting(false);
      
      toast({
        title: 'Submission Error',
        description: error instanceof Error ? error.message : 'Failed to schedule appointment',
        variant: 'destructive'
      });
    }
  };
  
  // If loading, show loading indicator
  if (isLoadingBookingPage && !internalMode) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // If error and not in internal mode, show error message
  if (bookingPageError && !internalMode) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            We couldn't find the booking page you're looking for. Please check the URL and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div className="text-sm font-medium">
            Step {step} of 3
          </div>
          <div className="flex space-x-1 text-xs text-gray-500">
            <span className={step >= 1 ? "text-primary font-bold" : ""}>Location</span>
            <span>→</span>
            <span className={step >= 2 ? "text-primary font-bold" : ""}>Customer</span>
            <span>→</span>
            <span className={step >= 3 ? "text-primary font-bold" : ""}>Details</span>
          </div>
        </div>
        <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-300 ease-in-out" 
            style={{ width: `${(step / 3) * 100}%` }}
          ></div>
        </div>
      </div>
      
      {/* Step 1: Initial Selection */}
      {step === 1 && (
        <Form {...initialSelectionForm}>
          <form onSubmit={initialSelectionForm.handleSubmit(onInitialSelectionSubmit)} className="space-y-6">
            <FormField
              control={initialSelectionForm.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location*</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Facility" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingFacilities ? (
                        <div className="p-2 text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          <div className="text-xs mt-1">Loading facilities...</div>
                        </div>
                      ) : facilities && Object.keys(parsedFacilities).length > 0 ? (
                        Object.values(parsedFacilities).map(({ facility }) => (
                          <SelectItem 
                            key={facility.id} 
                            value={String(facility.id)}
                          >
                            {facility.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-center text-sm text-gray-500">
                          No facilities available
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={initialSelectionForm.control}
              name="appointmentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dock Appointment Type*</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                    disabled={!selectedLocation}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedLocation ? "Select Appointment Type" : "Select a location first"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingAppointmentTypes ? (
                        <div className="p-2 text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          <div className="text-xs mt-1">Loading appointment types...</div>
                        </div>
                      ) : selectedLocation && appointmentTypes ? (
                        appointmentTypes
                          .filter(type => {
                            // If in a booking page context, check for excluded types
                            if (parsedFacilities[selectedLocation]) {
                              const excluded = parsedFacilities[selectedLocation].excludedAppointmentTypes;
                              return !excluded.includes(type.id);
                            }
                            
                            // For internal mode, filter types by selected facility
                            return type.facilityId === parseInt(selectedLocation);
                          })
                          .map(type => (
                            <SelectItem 
                              key={type.id} 
                              value={String(type.id)}
                            >
                              {type.name}
                            </SelectItem>
                          ))
                      ) : (
                        <div className="p-2 text-center text-sm text-gray-500">
                          {selectedLocation ? "No appointment types available" : "Select a location first"}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={initialSelectionForm.control}
              name="pickupOrDropoff"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Is this a pickup or dropoff?*</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dropoff" id="dropoff" />
                        <Label htmlFor="dropoff">Dropoff</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pickup" id="pickup" />
                        <Label htmlFor="pickup">Pickup</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="pt-4 flex justify-between">
              {internalMode && (
                <Button 
                  variant="outline" 
                  type="button" 
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              )}
              <div className={internalMode ? "" : "ml-auto"}>
                <Button type="submit">
                  Next Step <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </form>
        </Form>
      )}
      
      {/* Step 2: Customer Information */}
      {step === 2 && (
        <Form {...companyInfoForm}>
          <form onSubmit={companyInfoForm.handleSubmit(onCompanyInfoSubmit)} className="space-y-6">
            <FormField
              control={companyInfoForm.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name*</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={companyInfoForm.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name*</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter contact name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={companyInfoForm.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email*</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email address" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={companyInfoForm.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone*</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="pt-4 flex justify-between">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button type="submit">
                Next Step <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        </Form>
      )}
      
      {/* Step 3: Appointment Details */}
      {step === 3 && (
        <Form {...appointmentDetailsForm}>
          <form onSubmit={appointmentDetailsForm.handleSubmit(onAppointmentDetailsSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={appointmentDetailsForm.control}
                name="appointmentDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Appointment Date*</FormLabel>
                    <div className="flex-grow">
                      <input
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        min={format(new Date(), 'yyyy-MM-dd')}
                        {...field}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={appointmentDetailsForm.control}
                name="appointmentTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Appointment Time*</FormLabel>
                    <FormControl>
                      <input
                        type="time"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Carrier Information</h3>
              
              <FormField
                control={appointmentDetailsForm.control}
                name="carrierName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier*</FormLabel>
                    <CarrierSelector
                      onCarrierSelect={(carrier) => {
                        appointmentDetailsForm.setValue('carrierId', carrier.id);
                        appointmentDetailsForm.setValue('carrierName', carrier.name);
                        
                        // Set MC Number if available
                        if (carrier.mcNumber) {
                          appointmentDetailsForm.setValue('mcNumber', carrier.mcNumber);
                        }
                      }}
                      initialCarrierName={field.value}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={appointmentDetailsForm.control}
                name="mcNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MC Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 123-456-7890" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={appointmentDetailsForm.control}
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
                  control={appointmentDetailsForm.control}
                  name="trailerNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trailer Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter trailer number" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Driver Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={appointmentDetailsForm.control}
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
                  control={appointmentDetailsForm.control}
                  name="driverPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Driver Phone*</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter driver phone" type="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">
                  Upload BOL Document (Optional)
                </label>
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="relative"
                    disabled={bolProcessing}
                  >
                    {bolProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload File
                      </>
                    )}
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleFileUpload}
                      accept=".pdf,.jpg,.jpeg,.png"
                      disabled={bolProcessing}
                    />
                  </Button>
                  {bookingData.bolFile && (
                    <div className="text-sm text-green-600 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      File uploaded: {bookingData.bolFile.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Shipment Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={appointmentDetailsForm.control}
                  name="poNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PO Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter PO number" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={appointmentDetailsForm.control}
                  name="bolNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BOL Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter BOL number" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={appointmentDetailsForm.control}
                  name="palletCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pallet Count</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter pallet count" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={appointmentDetailsForm.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (lbs)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter weight" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={appointmentDetailsForm.control}
                name="additionalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter any additional information about this appointment"
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Standard Questions Component */}
              {selectedAppointmentTypeId && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Additional Information</h3>
                  <StandardQuestionsFormFields
                    form={appointmentDetailsForm}
                    standardQuestions={standardQuestions}
                    isLoading={isLoadingStandardQuestions}
                  />
                </div>
              )}
            </div>
            
            <div className="pt-6 flex justify-between">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => setStep(2)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Schedule Appointment'
                )}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}