import React, { useState, useEffect, useMemo } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { Loader2, Clock as ClockIcon, CheckCircle, Scan, XCircle } from 'lucide-react';
import { format, addHours, isValid, parseISO, parse } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { getUserTimeZone, formatTimeRangeForDualZones, formatDateRangeInTimeZone, getTimeZoneAbbreviation } from '@/lib/timezone-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import BolUpload from '@/components/shared/bol-upload';
import { ParsedBolData } from '@/lib/ocr-service';
import { BookingWizardProvider, useBookingWizard } from '@/contexts/BookingWizardContext';
import { BookingThemeProvider, useBookingTheme } from '@/contexts/BookingThemeContext';
import { StandardQuestionsFormFields } from '@/components/shared/standard-questions-form-fields';
import { useStandardQuestions } from '@/hooks/use-standard-questions';
import { useEnabledBookingDays } from '@/hooks/use-enabled-booking-days';
import { useAppointmentAvailabilityFixed } from '@/hooks/use-appointment-availability-fixed';
import { TimeSlotPicker } from '@/components/booking/time-slot-picker';
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage, FormField } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CarrierSelector } from '@/components/shared/carrier-selector';
import '../styles/booking-wizard.css';
import hanzoLogo from '../assets/hanzo_logo.jpeg';
import freshConnectLogo from '../assets/organization_logo.jpeg'; // Using fallback for Fresh Connect
import dockOptimizerLogo from '../assets/dock_optimizer_logo.jpg';

// Define the props interface
interface ExternalBookingProps {
  slug: string;
}

// Main component
export default function ExternalBooking({ slug }: ExternalBookingProps) {
  console.log("DEBUG - ExternalBooking - Using provided slug:", slug);
  
  // Fetch booking page data
  const { 
    data: bookingPage, 
    isLoading: pageLoading, 
    error: pageError 
  } = useQuery({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    queryFn: async ({ queryKey }) => {
      const [baseUrl] = queryKey as [string];
      // Use relative URLs for API requests to work in any environment
      const apiUrl = `${baseUrl}`;
      console.log(`[ExternalBookingFixed] Fetching booking page with URL: ${apiUrl}`);
      
      try {
        const response = await fetch(apiUrl);
        console.log(`[ExternalBookingFixed] Booking page API response status:`, response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[ExternalBookingFixed] Error fetching booking page: ${errorText}`);
          throw new Error(`Failed to fetch booking page: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`[ExternalBookingFixed] Successfully fetched booking page:`, data);
        return data;
      } catch (err) {
        console.error(`[ExternalBookingFixed] Exception fetching booking page:`, err);
        throw err;
      }
    },
    enabled: !!slug,
  });
  
  if (pageLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (pageError || !bookingPage) {
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
  
  // Return the booking page with the theme provider
  return (
    <BookingThemeProvider 
      theme={bookingPage.theme || {}}
      logo={bookingPage.logoUrl || '/assets/dock_optimizer_logo.jpg'}
    >
      <BookingWizardContent bookingPage={bookingPage} />
    </BookingThemeProvider>
  );
}

// Progress Bar Component
function BookingProgress() {
  const { currentStep } = useBookingWizard();
  
  return (
    <div className="booking-progress">
      <div className={`progress-step ${currentStep >= 1 ? 'active': ''} ${currentStep > 1 ? 'completed': ''}`}>
        <div className="step-number">1</div>
        <div className="step-label">Services</div>
      </div>
      <div className="progress-line"></div>
      <div className={`progress-step ${currentStep >= 2 ? 'active': ''} ${currentStep > 2 ? 'completed': ''}`}>
        <div className="step-number">2</div>
        <div className="step-label">Date & Time</div>
      </div>
      <div className="progress-line"></div>
      <div className={`progress-step ${currentStep >= 3 ? 'active': ''} ${currentStep > 3 ? 'completed': ''}`}>
        <div className="step-number">3</div>
        <div className="step-label">Details</div>
      </div>
    </div>
  );
}

// Step Content Manager Component
function BookingStepContent({ 
  bookingPage, 
  confirmationCode,
  setConfirmationCode
}: { 
  bookingPage: any; 
  confirmationCode: string | null;
  setConfirmationCode: (code: string | null) => void;
}) {
  const { currentStep, setCurrentStep, bookingData, updateBookingData } = useBookingWizard();
  
  if (confirmationCode) {
    return (
      <ConfirmationStep 
        bookingPage={bookingPage}
        confirmationCode={confirmationCode}
      />
    );
  }
  
  switch (currentStep) {
    case 1:
      return (
        <ServiceSelectionStepOld 
          bookingPage={bookingPage} 
        />
      );
    case 2:
      return (
        <DateTimeSelectionStep 
          bookingPage={bookingPage} 
        />
      );
    case 3:
      return (
        <CustomerInfoStep 
          bookingPage={bookingPage}
          onSubmit={async () => {
            try {
              // Create the appointment
              const response = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...bookingData,
                  bookingPageId: bookingPage.id
                })
              });
              
              if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`Failed to create appointment: ${response.status} ${errorData}`);
              }
              
              const data = await response.json();
              setConfirmationCode(data.confirmationCode);
              setCurrentStep(4);
            } catch (err: any) {
              console.error('Error creating appointment:', err);
              alert(`Error creating appointment: ${err.message}`);
            }
          }}
        />
      );
    case 4:
      return (
        <ConfirmationStep 
          bookingPage={bookingPage}
          confirmationCode={confirmationCode}
        />
      );
    default:
      return <div>Invalid step</div>;
  }
}

// Booking Wizard Content
function BookingWizardContent({ bookingPage }: { bookingPage: any }) {
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  
  // Get the current theme
  const { theme, logo } = useBookingTheme();
  
  // Check which step we're on and render the appropriate component
  return (
    <BookingWizardProvider>
      <div className="booking-page-container">
        <div className="booking-header">
          <div className="booking-logo">
            <img 
              src={logo || dockOptimizerLogo} 
              alt={bookingPage.name || "Dock Optimizer"} 
              className="h-12" 
            />
          </div>
          <div className="booking-title">
            <h1 className="booking-title-text">{bookingPage.name || "Dock Appointment Booking"}</h1>
            {bookingPage.description && (
              <p className="booking-description">{bookingPage.description}</p>
            )}
          </div>
        </div>
        
        <div className="booking-wizard">
          <BookingProgress />
          <div className="booking-form-container">
            <BookingStepContent 
              bookingPage={bookingPage} 
              confirmationCode={confirmationCode}
              setConfirmationCode={setConfirmationCode}
            />
          </div>
        </div>
      </div>
    </BookingWizardProvider>
  );
}

// Service Selection Schema
const serviceSelectionSchema = z.object({
  facilityId: z.number({ required_error: "Please select a facility" }),
  appointmentTypeId: z.number({ required_error: "Please select a service type" }),
});

type ServiceSelectionFormValues = z.infer<typeof serviceSelectionSchema>;

// Service Selection Step
function ServiceSelectionStepOld({ bookingPage }: { bookingPage: any }) {
  const { currentStep, setCurrentStep, bookingData, updateBookingData } = useBookingWizard();
  
  // Create form with default values
  const form = useForm<ServiceSelectionFormValues>({
    resolver: zodResolver(serviceSelectionSchema),
    defaultValues: {
      facilityId: bookingData.facilityId || undefined,
      appointmentTypeId: bookingData.appointmentTypeId || undefined,
    },
  });
  
  // Get facility and appointment type data from the booking page
  const facilities = Array.isArray(bookingPage.facilities) ? bookingPage.facilities : [];
  const appointmentTypes = useMemo(() => {
    // If specific facility is selected, filter appointment types for that facility
    if (form.watch('facilityId')) {
      const filteredTypes = (bookingPage.appointmentTypes || []).filter(
        (type: any) => type.facilityId === form.watch('facilityId')
      );
      return filteredTypes.length > 0 ? filteredTypes : bookingPage.appointmentTypes;
    }
    return bookingPage.appointmentTypes || [];
  }, [bookingPage.appointmentTypes, form.watch('facilityId')]);

  // Handle BOL upload processing result
  const handleBolProcessed = (data: ParsedBolData, fileUrl: string) => {
    console.log("BOL data extracted:", data);
    
    // Update booking data with BOL information
    updateBookingData({
      bolData: { ...data, fileUrl }
    });
    
    // Pre-fill form fields based on BOL data
    if (data.carrierName) {
      form.setValue('facilityId', form.getValues('facilityId'));
    }
  };
  
  // Handle form submission
  const onSubmit = (values: ServiceSelectionFormValues) => {
    // Get the selected facility and update timezone
    const selectedFacility = facilities.find((f: any) => f.id === values.facilityId);
    
    // Update booking data
    updateBookingData({
      facilityId: values.facilityId,
      appointmentTypeId: values.appointmentTypeId,
      timezone: selectedFacility?.timezone || 'America/New_York'
    });
    
    // Move to the next step
    setCurrentStep(2);
  };
  
  return (
    <div className="booking-form-section">
      <h2 className="booking-form-section-title">Select Service</h2>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="facilityId"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">Facility</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(Number(value));
                    
                    // Clear appointment type when changing facility
                    form.setValue('appointmentTypeId', undefined);
                  }}
                  value={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger className="booking-select">
                      <SelectValue placeholder="Select a facility" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {facilities.map((facility: any) => (
                      <SelectItem 
                        key={facility.id} 
                        value={facility.id.toString()}
                      >
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
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">Service Type</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(Number(value))}
                  value={field.value?.toString()}
                  disabled={!form.watch('facilityId')}
                >
                  <FormControl>
                    <SelectTrigger className="booking-select">
                      <SelectValue placeholder={form.watch('facilityId') ? "Select a service type" : "Please select a facility first"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {appointmentTypes.map((type: any) => (
                      <SelectItem 
                        key={type.id} 
                        value={type.id.toString()}
                      >
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* BOL Upload component */}
          {bookingPage.enableBolUpload && (
            <div className="booking-form-field">
              <Label className="booking-label">Bill of Lading (Optional)</Label>
              <BolUpload 
                onBolProcessed={handleBolProcessed}
                onProcessingStateChange={(isProcessing) => { /* Handle processing state */ }}
                className="booking-bol-upload"
              />
              <p className="text-sm text-gray-500 mt-1">
                Upload a Bill of Lading to pre-fill some information
              </p>
            </div>
          )}
          
          <div className="booking-nav-buttons">
            <div></div> {/* Empty div for spacing */}
            <Button type="submit" className="booking-button">
              Next
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Date Time Selection Schema
const dateTimeSelectionSchema = z.object({
  selectedDate: z.date({ required_error: "Please select a date" }),
  appointmentTime: z.string({ required_error: "Please select a time" }),
});

type DateTimeFormValues = z.infer<typeof dateTimeSelectionSchema>;

// Import TimeSlot interface from the TimeSlotPicker component
import { TimeSlot } from '@/components/booking/time-slot-picker';

// Date Time Selection Step
function DateTimeSelectionStep({ bookingPage }: { bookingPage: any }) {
  const { currentStep, setCurrentStep, bookingData, updateBookingData } = useBookingWizard();
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySlots, setAvailabilitySlots] = useState<TimeSlot[]>([]);
  
  // Get the selected facility
  const selectedFacility = useMemo(() => {
    if (!bookingData.facilityId || !Array.isArray(bookingPage.facilities)) return null;
    return bookingPage.facilities.find((f: any) => f.id === bookingData.facilityId);
  }, [bookingData.facilityId, bookingPage.facilities]);
  
  // Get the selected appointment type
  const selectedAppointmentType = useMemo(() => {
    if (!bookingData.appointmentTypeId || !Array.isArray(bookingPage.appointmentTypes)) return null;
    return bookingPage.appointmentTypes.find((t: any) => t.id === bookingData.appointmentTypeId);
  }, [bookingData.appointmentTypeId, bookingPage.appointmentTypes]);
  
  // Get the organization holidays for validation
  const organizationHolidays = useMemo(() => {
    return (bookingPage.organizationHolidays || []).map((holiday: any) => holiday.date);
  }, [bookingPage.organizationHolidays]);
  
  // Use the hook to determine which days should be enabled
  const { isDayEnabled } = useEnabledBookingDays(bookingPage.organizationDefaultHours || []);
  
  // Create a form with default values
  const form = useForm<DateTimeFormValues>({
    resolver: zodResolver(dateTimeSelectionSchema),
    defaultValues: {
      selectedDate: bookingData.date || undefined,
      appointmentTime: bookingData.time || "",
    },
  });
  
  // Get the currently selected date from the form
  const selectedDate = form.watch('selectedDate');
  
  // Handle date change to fetch available times
  const handleDateChange = async (date: Date) => {
    if (!isValid(date) || !bookingData.facilityId || !bookingData.appointmentTypeId) {
      return;
    }
    
    try {
      setAvailabilityLoading(true);
      
      // Format date for API request
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      // Make API request to get availability
      const apiUrl = `/api/availability/v2?date=${formattedDate}&facilityId=${bookingData.facilityId}&appointmentTypeId=${bookingData.appointmentTypeId}`;
      
      console.log(`[ExternalBookingFixed] Fetching availability with URL: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch availability: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[ExternalBookingFixed] Received availability data:`, data);
      
      // Set the availability slots, handling the version with enhanced "slots" array
      setAvailabilitySlots(data.slots || []);
      
      // Clear the selected time when date changes
      form.setValue('appointmentTime', "");
      
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setAvailabilityLoading(false);
    }
  };
  
  // Handle time selection
  const handleTimeChange = (time: string) => {
    console.log(`[ExternalBookingFixed] Selected time: ${time}`);
  };
  
  // Handle form submission
  const onSubmit = (values: DateTimeFormValues) => {
    // Update booking data
    updateBookingData({
      date: values.selectedDate,
      time: values.appointmentTime,
      timezone: selectedFacility?.timezone
    });
    
    // Move to the next step
    setCurrentStep(3);
  };
  
  return (
    <div className="booking-form-section">
      <h2 className="booking-form-section-title">Select Date and Time</h2>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="selectedDate"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">Date</FormLabel>
                <FormControl>
                  <div className="booking-date-picker">
                    <DatePicker
                      date={field.value}
                      onDateChange={(date) => {
                        field.onChange(date);
                        handleDateChange(date);
                      }}
                      disablePastDates
                      disabledDays={(date) => {
                        // Disable days when the facility is closed
                        if (!selectedFacility) return false;
                        
                        // Format date for holiday checking
                        const formattedDate = format(date, 'yyyy-MM-dd');
                        
                        // Check if this date is an organization holiday
                        if (organizationHolidays.includes(formattedDate)) {
                          console.log(`[EXTERNAL BOOKING] Disabling date ${formattedDate} because it's a configured holiday`);
                          return true; // Disable this date since it's a holiday
                        }
                        
                        // Use the organization default hours hook to check if day is enabled
                        if (!isDayEnabled(date)) {
                          console.log(`[EXTERNAL BOOKING] Disabling date ${formattedDate} because it's not in organization hours`);
                          return true; // Disable this date since it's outside org hours
                        }
                        
                        return false; // Enable the date
                      }}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="appointmentTime"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">Time</FormLabel>
                <FormControl>
                  <>
                    {availabilityLoading ? (
                      <div className="flex justify-center items-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : selectedDate ? (
                      availabilitySlots.length > 0 ? (
                        <>
                          <div className="mb-4">
                            <div className="flex items-center space-x-2">
                              <ClockIcon className="h-4 w-4 text-primary" />
                              <p className="text-sm text-gray-600">
                                <strong>Note:</strong> Times are displayed in the facility's local timezone. 
                                {selectedFacility?.timezone && (
                                  <span> ({selectedFacility.timezone.replace(/_/g, ' ')})</span>
                                )}
                              </p>
                              {Intl.DateTimeFormat().resolvedOptions().timeZone !== selectedFacility?.timezone && (
                                <p className="mt-1">
                                  <strong>Your timezone:</strong> {Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* Temporary debug display of raw slots data from API */}
                          <details className="mb-4 text-xs border p-2 rounded bg-gray-50">
                            <summary className="font-mono cursor-pointer text-gray-700 font-medium">
                              API Slots Data (Debug)
                            </summary>
                            <pre className="mt-2 overflow-auto max-h-[300px] p-2 bg-gray-100 rounded">
                              {JSON.stringify(availabilitySlots, null, 2)}
                            </pre>
                          </details>

                          {/* Use the standardized TimeSlotPicker component with proper timezone handling */}
                          <TimeSlotPicker 
                            slots={availabilitySlots} 
                            selectedTime={field.value} 
                            onSelectTime={(time) => {
                              field.onChange(time);
                              handleTimeChange(time);
                            }}
                            timezone={selectedFacility?.timezone || undefined}
                            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
                            showRemainingSlots={true}
                          />
                        </>
                      ) : (
                        <Alert>
                          <AlertTitle>No Available Times</AlertTitle>
                          <AlertDescription>
                            There are no available times for the selected date. Please choose another date.
                          </AlertDescription>
                        </Alert>
                      )
                    ) : (
                      <Alert>
                        <AlertDescription>
                          Please select a date to see available times.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="booking-nav-buttons">
            <Button type="button" className="booking-button-secondary" onClick={() => setCurrentStep(1)}>
              Back
            </Button>
            <Button type="submit" className="booking-button" disabled={!selectedDate || !form.watch('appointmentTime')}>
              Next
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Customer Information Schema
const customerInfoSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactName: z.string().min(1, "Contact name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(1, "Phone number is required"),
  customerRef: z.string(),
  carrierName: z.string().min(1, "Carrier name is required"),
  driverName: z.string().min(1, "Driver name is required"),
  driverPhone: z.string().min(1, "Driver phone is required"),
  mcNumber: z.string().min(1, "MC number is required"),
  truckNumber: z.string().min(1, "Truck number is required"),
  trailerNumber: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerInfoFormValues = z.infer<typeof customerInfoSchema>;

// Customer Information Step
function CustomerInfoStep({ bookingPage, onSubmit }: { bookingPage: any; onSubmit: () => Promise<void> }) {
  const { currentStep, setCurrentStep, bookingData, updateBookingData } = useBookingWizard();
  const [submitting, setSubmitting] = useState(false);
  
  // Get standard questions for this appointment type, if any
  const { data: questionsData, isLoading: questionsLoading } = useQuery({
    queryKey: [`/api/standard-questions/${bookingData.appointmentTypeId}`],
    enabled: !!bookingData.appointmentTypeId,
  });
  
  // Create a form with default values
  const form = useForm<CustomerInfoFormValues>({
    resolver: zodResolver(customerInfoSchema),
    defaultValues: {
      companyName: bookingData.companyName || "",
      contactName: bookingData.contactName || "",
      email: bookingData.email || "",
      phone: bookingData.phone || "",
      customerRef: bookingData.customerRef || "",
      carrierName: bookingData.carrierName || "",
      driverName: bookingData.driverName || "",
      driverPhone: bookingData.driverPhone || "",
      mcNumber: bookingData.mcNumber || "",
      truckNumber: bookingData.truckNumber || "",
      trailerNumber: bookingData.trailerNumber || "",
      notes: bookingData.notes || "",
    },
  });
  
  // Handle BOL upload processing result
  const handleBolProcessed = (data: ParsedBolData, fileUrl: string) => {
    console.log("BOL data extracted in Customer Info Step:", data);
    
    // Update booking data with BOL information
    updateBookingData({
      bolData: { ...data, fileUrl }
    });
    
    // Pre-fill form fields based on BOL data
    if (data.carrierName) {
      form.setValue('carrierName', data.carrierName);
    }
    if (data.driverName) {
      form.setValue('driverName', data.driverName);
    }
    if (data.mcNumber) {
      form.setValue('mcNumber', data.mcNumber);
    }
    if (data.truckNumber) {
      form.setValue('truckNumber', data.truckNumber);
    }
    if (data.customerRef) {
      form.setValue('customerRef', data.customerRef);
    }
  };
  
  // Handle form submission
  const handleFormSubmit = async (values: CustomerInfoFormValues) => {
    try {
      // Get any standard question responses
      const standardQuestions = (questionsData?.questions || []).map((q: any) => {
        const fieldName = `question_${q.id}`;
        const values = form.getValues();
        return {
          questionId: q.id,
          questionText: q.text,
          answer: (fieldName in values) ? (values as any)[fieldName] || '' : ''
        };
      });
      
      setSubmitting(true);
      
      // Update booking data
      updateBookingData({
        ...values,
        standardQuestions,
      });
      
      // Call the onSubmit callback to save the appointment
      await onSubmit();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handle carrier selection if using carrier selector
  const handleCarrierSelect = (carrierId: number, carrier: any) => {
    if (carrier) {
      form.setValue('carrierId', carrierId);
      form.setValue('carrierName', carrier.name);
      
      // Also set MC number if available
      if (carrier.mcNumber) {
        form.setValue('mcNumber', carrier.mcNumber);
      }
    }
  };
  
  return (
    <div className="booking-form-section">
      <h2 className="booking-form-section-title">Enter Shipping Details</h2>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
          {/* Company Information Section */}
          <div className="booking-form-subsection">
            <h3 className="booking-form-subsection-title">Company Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
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
                    <FormLabel>Contact Name</FormLabel>
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
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
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
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="customerRef"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Reference</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          
          {/* Carrier Information Section */}
          <div className="booking-form-subsection">
            <h3 className="booking-form-subsection-title">Carrier Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookingPage.enableCarrierSelect ? (
                <FormField
                  control={form.control}
                  name="carrierId"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Carrier</FormLabel>
                      <FormControl>
                        <CarrierSelector 
                          carrierId={bookingData.carrierId || undefined}
                          onCarrierSelect={handleCarrierSelect}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="carrierName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Carrier Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="mcNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MC Number</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                    <FormLabel>Truck Number</FormLabel>
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
                    <FormLabel>Trailer Number (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          
          {/* Driver Information Section */}
          <div className="booking-form-subsection">
            <h3 className="booking-form-subsection-title">Driver Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="driverName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver Name</FormLabel>
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
                    <FormLabel>Driver Phone</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          
          {/* Standard Questions Section */}
          {questionsData?.questions && questionsData.questions.length > 0 && (
            <div className="booking-form-subsection">
              <h3 className="booking-form-subsection-title">Additional Questions</h3>
              <StandardQuestionsFormFields
                form={form}
                standardQuestions={questionsData.questions}
                isLoading={questionsLoading}
              />
            </div>
          )}
          
          {/* Notes Section */}
          <div className="booking-form-subsection">
            <h3 className="booking-form-subsection-title">Additional Notes</h3>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="min-h-[100px]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {/* BOL Upload component */}
          {bookingPage.enableBolUpload && (
            <div className="booking-form-subsection">
              <h3 className="booking-form-subsection-title">Bill of Lading</h3>
              <BolUpload 
                onProcessed={handleBolProcessed}
                className="booking-bol-upload"
              />
              <p className="text-sm text-gray-500 mt-1">
                Upload a Bill of Lading to pre-fill some information
              </p>
            </div>
          )}
          
          {/* Validation errors */}
          {Object.keys(form.formState.errors).length > 0 && (
            <div className="text-red-500 bg-red-50 p-4 rounded-md">
              <p className="font-semibold">Please fix the following errors:</p>
              <ul className="list-disc list-inside">
                {Object.entries(form.formState.errors).map(([key, error]) => (
                  <li key={key}>{error.message}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="booking-nav-buttons">
            <Button 
              type="button" 
              className="booking-button-secondary" 
              onClick={() => {
                // Save current form data before navigating back
                updateBookingData({
                  companyName: form.getValues('companyName'),
                  contactName: form.getValues('contactName'),
                  email: form.getValues('email'),
                  phone: form.getValues('phone'),
                  customerRef: form.getValues('customerRef'),
                  carrierName: form.getValues('carrierName'),
                  driverName: form.getValues('driverName'),
                  driverPhone: form.getValues('driverPhone'),
                  mcNumber: form.getValues('mcNumber'),
                  truckNumber: form.getValues('truckNumber'),
                  trailerNumber: form.getValues('trailerNumber'),
                  notes: form.getValues('notes')
                });
                setCurrentStep(2);
              }}
            >
              Back
            </Button>
            <Button type="submit" className="booking-button" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Complete Booking"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Confirmation Step
function ConfirmationStep({ bookingPage, confirmationCode }: { bookingPage: any; confirmationCode: string | null }) {
  const { bookingData } = useBookingWizard();
  
  // Get the selected facility
  const selectedFacility = useMemo(() => {
    if (!bookingData.facilityId || !Array.isArray(bookingPage.facilities)) return null;
    return bookingPage.facilities.find((f: any) => f.id === bookingData.facilityId);
  }, [bookingData.facilityId, bookingPage.facilities]);
  
  // Get the selected appointment type
  const selectedAppointmentType = useMemo(() => {
    if (!bookingData.appointmentTypeId || !Array.isArray(bookingPage.appointmentTypes)) return null;
    return bookingPage.appointmentTypes.find((t: any) => t.id === bookingData.appointmentTypeId);
  }, [bookingData.appointmentTypeId, bookingPage.appointmentTypes]);
  
  return (
    <div className="booking-form-section confirmation-section">
      <div className="confirmation-header">
        <CheckCircle className="confirmation-icon text-green-500 h-16 w-16" />
        <h2 className="booking-form-section-title">Booking Confirmed!</h2>
      </div>
      
      <Card className="confirmation-card">
        <CardHeader>
          <CardTitle className="confirmation-card-title">Appointment Details</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {confirmationCode && (
            <div className="confirmation-code">
              <h3 className="confirmation-label">Confirmation Code</h3>
              <p className="confirmation-value font-mono text-xl">{confirmationCode}</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="confirmation-label">Facility</h3>
              <p className="confirmation-value">{selectedFacility?.name || bookingData.facilityName}</p>
              {selectedFacility?.address && (
                <p className="confirmation-subvalue">{selectedFacility.address}</p>
              )}
            </div>
            
            <div>
              <h3 className="confirmation-label">Service Type</h3>
              <p className="confirmation-value">{selectedAppointmentType?.name || bookingData.appointmentTypeName}</p>
            </div>
            
            <div>
              <h3 className="confirmation-label">Date & Time</h3>
              <p className="confirmation-value">
                {bookingData.date ? format(bookingData.date, 'EEEE, MMMM d, yyyy') : ''}
                {bookingData.date && bookingData.time ? ' at ' : ''}
                {bookingData.time ? (() => {
                  // Parse the time string "HH:MM" to display in 12-hour format
                  const [hours, minutes] = bookingData.time.split(':').map(Number);
                  const hour12 = hours % 12 || 12;
                  const period = hours >= 12 ? 'PM' : 'AM';
                  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
                })() : ''}
              </p>
              {selectedFacility?.timezone && (
                <p className="confirmation-subvalue">Timezone: {selectedFacility.timezone.replace(/_/g, ' ')}</p>
              )}
            </div>
            
            <div>
              <h3 className="confirmation-label">Company</h3>
              <p className="confirmation-value">{bookingData.companyName}</p>
              <p className="confirmation-subvalue">{bookingData.contactName}</p>
            </div>
          </div>
          
          <div>
            <h3 className="confirmation-label">Carrier Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <p className="confirmation-subvalue"><strong>Carrier:</strong> {bookingData.carrierName}</p>
              <p className="confirmation-subvalue"><strong>MC#:</strong> {bookingData.mcNumber}</p>
              <p className="confirmation-subvalue"><strong>Truck#:</strong> {bookingData.truckNumber}</p>
              {bookingData.trailerNumber && (
                <p className="confirmation-subvalue"><strong>Trailer#:</strong> {bookingData.trailerNumber}</p>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="confirmation-label">Driver Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <p className="confirmation-subvalue"><strong>Driver:</strong> {bookingData.driverName}</p>
              <p className="confirmation-subvalue"><strong>Phone:</strong> {bookingData.driverPhone}</p>
            </div>
          </div>
          
          {/* Standard Questions */}
          {bookingData.standardQuestions && bookingData.standardQuestions.length > 0 && (
            <div>
              <h3 className="confirmation-label">Additional Information</h3>
              <div className="space-y-2">
                {bookingData.standardQuestions.map((q: any, index: number) => (
                  <div key={index} className="confirmation-question">
                    <p className="confirmation-question-text">{q.questionText}</p>
                    <p className="confirmation-question-answer">{q.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {bookingData.notes && (
            <div>
              <h3 className="confirmation-label">Notes</h3>
              <p className="confirmation-value whitespace-pre-line">{bookingData.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="confirmation-footer">
        <p className="confirmation-info">A confirmation email has been sent to {bookingData.email}</p>
        <p className="confirmation-info">Please present your confirmation code when you arrive at the facility.</p>
        
        <Button 
          className="booking-button mt-6"
          onClick={() => {
            // Refresh the page to start over
            window.location.reload();
          }}
        >
          Book Another Appointment
        </Button>
      </div>
    </div>
  );
}