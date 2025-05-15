import React, { useState, useEffect, useMemo } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';

// Safe toString helper to prevent crashes when calling toString on undefined values
function safeToString(val: unknown): string {
  return typeof val === 'number' || typeof val === 'string' ? val.toString() : '';
}
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from '@/lib/utils';
import { CarrierSelector } from '@/components/shared/carrier-selector';
import { StandardQuestionsFormFields } from '@/components/shared/standard-questions-form-fields';
import { useStandardQuestions } from '@/hooks/use-standard-questions';
import { useBookingTheme, BookingThemeProvider } from '@/hooks/use-booking-theme';
import dockOptimizerLogo from '@/assets/dock_optimizer_logo.jpg';
import { z } from 'zod';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * External Booking Page Component
 * 
 * This component displays the booking wizard for external booking pages.
 * It handles the entire flow from selecting services to confirmation.
 */
export default function ExternalBooking({ slug }: { slug: string }) {
  const [match, params] = useRoute('/external/:slug');
  
  // Fetch booking page data
  const { 
    data: bookingPage, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    enabled: !!slug,
  });
  
  // Get the theme for the booking page
  const { isLoading: isThemeLoading } = useBookingTheme();
  
  // Loading state
  if (isLoading || isThemeLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  // Error state
  if (error || !bookingPage) {
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
  
  // Render the booking wizard
  return (
    <BookingThemeProvider slug={slug}>
      <BookingWizardContent bookingPage={bookingPage} />
    </BookingThemeProvider>
  );
}

// Booking progress indicator
function BookingProgress() {
  const { currentStep } = useBookingWizard();
  
  const steps = [
    { number: 1, label: "Select Services" },
    { number: 2, label: "Choose Date & Time" },
    { number: 3, label: "Enter Details" },
    { number: 4, label: "Confirmation" },
  ];
  
  return (
    <div className="booking-progress">
      {steps.map((step) => (
        <div 
          key={step.number}
          className={cn(
            "booking-progress-step",
            currentStep >= step.number && "booking-progress-step-active",
            currentStep > step.number && "booking-progress-step-completed"
          )}
        >
          <div className="booking-progress-number">{step.number}</div>
          <div className="booking-progress-label">{step.label}</div>
        </div>
      ))}
    </div>
  );
}

// Main content based on current step
function BookingStepContent({ 
  bookingPage, 
  confirmationCode,
  setConfirmationCode
}: { 
  bookingPage: any;
  confirmationCode: string | null;
  setConfirmationCode: (code: string | null) => void;
}) {
  const { currentStep } = useBookingWizard();
  
  // Render the appropriate step based on currentStep
  switch (currentStep) {
    case 1:
      return <ServiceSelectionStep bookingPage={bookingPage} />;
    case 2:
      return <DateTimeSelectionStep bookingPage={bookingPage} />;
    case 3:
      return <CustomerInfoStep bookingPage={bookingPage} setConfirmationCode={setConfirmationCode} />;
    case 4:
      return <ConfirmationStep bookingPage={bookingPage} confirmationCode={confirmationCode} />;
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
  facilityId: z.number({
    required_error: "Please select a facility.",
  }),
  appointmentTypeId: z.number({
    required_error: "Please select a service type.",
  }),
});

// Service Selection Step
function ServiceSelectionStep({ bookingPage }: { bookingPage: any }) {
  const { updateBookingData, setCurrentStep } = useBookingWizard();
  
  // Setup form with Zod validation
  const form = useForm<z.infer<typeof serviceSelectionSchema>>({
    resolver: zodResolver(serviceSelectionSchema),
    defaultValues: {
      facilityId: undefined,
      appointmentTypeId: undefined,
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
  };
  
  // Submit handler
  const onSubmit = (values: z.infer<typeof serviceSelectionSchema>) => {
    // Find the selected facility and appointment type for additional info
    const selectedFacility = facilities.find((f: any) => f.id === values.facilityId);
    const selectedAppointmentType = appointmentTypes.find((t: any) => t.id === values.appointmentTypeId);
    
    // Update the booking data context
    updateBookingData({
      facilityId: values.facilityId,
      appointmentTypeId: values.appointmentTypeId,
      facilityName: selectedFacility?.name || '',
      appointmentTypeName: selectedAppointmentType?.name || '',
      timezone: selectedFacility?.timezone || 'America/New_York', // Default timezone
    });
    
    // Move to the next step
    setCurrentStep(2);
  };
  
  return (
    <div className="booking-step-content">
      <h2 className="booking-step-title">Select Services</h2>
      <p className="booking-step-description">
        Choose the facility and service type for your appointment.
      </p>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="booking-form">
          <FormField
            control={form.control}
            name="facilityId"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">Facility</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(Number(value))}
                  value={safeToString(field.value)}
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
                  value={safeToString(field.value)}
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
                onProcessingStateChange={() => {}}
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
              Next <span className="ml-2">→</span>
            </Button>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <pre className="text-xs bg-muted p-2 mt-4 rounded">
              {JSON.stringify(form.watch(), null, 2)}
            </pre>
          )}
        </form>
      </Form>
    </div>
  );
}

// Date Time Selection Schema
const dateTimeSelectionSchema = z.object({
  date: z.date({
    required_error: "Please select a date.",
  }),
  time: z.string({
    required_error: "Please select a time slot.",
  }),
});

// Date Time Selection Step
function DateTimeSelectionStep({ bookingPage }: { bookingPage: any }) {
  const { bookingData, updateBookingData, setCurrentStep } = useBookingWizard();
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState(false);
  
  // Setup form with Zod validation
  const form = useForm<z.infer<typeof dateTimeSelectionSchema>>({
    resolver: zodResolver(dateTimeSelectionSchema),
    defaultValues: {
      date: bookingData.date || undefined,
      time: bookingData.time || undefined,
    },
  });
  
  const timezone = bookingData.timezone || 'America/New_York';
  
  // Handle date change to fetch available time slots
  const handleDateChange = async (date: Date) => {
    if (!date || !isValid(date)) return;
    
    try {
      setIsLoadingTimeSlots(true);
      form.setValue('date', date);
      form.setValue('time', ''); // Reset time when date changes
      
      // Format date to YYYY-MM-DD for API call
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      // Fetch available time slots from API
      const response = await fetch(`/api/availability?date=${formattedDate}&facilityId=${bookingData.facilityId}&appointmentTypeId=${bookingData.appointmentTypeId}`);
      
      if (!response.ok) {
        console.error("Error fetching time slots:", response.statusText);
        setAvailableTimeSlots([]);
        setIsLoadingTimeSlots(false);
        return;
      }
      
      const slots = await response.json();
      setAvailableTimeSlots(slots);
    } catch (error) {
      console.error("Error fetching time slots:", error);
      setAvailableTimeSlots([]);
    } finally {
      setIsLoadingTimeSlots(false);
    }
  };
  
  // Submit handler
  const onSubmit = (values: z.infer<typeof dateTimeSelectionSchema>) => {
    // Update booking data with date and time information
    updateBookingData({
      date: values.date,
      time: values.time,
      // Parse the time to create a full datetime
      dateTime: parse(
        `${format(values.date, 'yyyy-MM-dd')} ${values.time}`, 
        'yyyy-MM-dd HH:mm', 
        new Date()
      ),
    });
    
    // Move to the next step
    setCurrentStep(3);
  };
  
  // Reset form with initial values when bookingData changes
  useEffect(() => {
    if (bookingData.date) {
      console.log("[DEBUG] Setting date from bookingData:", bookingData.date);
      form.setValue('date', bookingData.date);
      handleDateChange(bookingData.date);
    }
    if (bookingData.time) {
      console.log("[DEBUG] Setting time from bookingData:", bookingData.time);
      form.setValue('time', bookingData.time);
    }
  }, [bookingData.date, bookingData.time]);
  
  // Go back to previous step
  const handleBack = () => {
    setCurrentStep(1);
  };
  
  return (
    <div className="booking-step-content">
      <h2 className="booking-step-title">Select Date & Time</h2>
      <p className="booking-step-description">
        Choose an available date and time slot for your appointment.
      </p>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="booking-form">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">Date</FormLabel>
                <DatePicker
                  date={field.value}
                  onDateChange={(date) => {
                    if (date) handleDateChange(date);
                  }}
                  disablePastDates={true}
                  disabledDays={(date) => {
                    // Custom disabled days logic could go here
                    return false;
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">Time Slot</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={safeToString(field.value)}
                  disabled={!form.watch('date') || isLoadingTimeSlots}
                >
                  <FormControl>
                    <SelectTrigger className="booking-select">
                      <SelectValue placeholder={
                        isLoadingTimeSlots 
                          ? "Loading time slots..." 
                          : form.watch('date') 
                            ? availableTimeSlots.length > 0 
                              ? "Select a time slot" 
                              : "No available time slots" 
                            : "Please select a date first"
                      } />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingTimeSlots ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span>Loading...</span>
                      </div>
                    ) : availableTimeSlots.length > 0 ? (
                      availableTimeSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))
                    ) : form.watch('date') ? (
                      <div className="p-2 text-center text-muted-foreground">
                        No available time slots for the selected date
                      </div>
                    ) : null}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Display selected date/time with timezone */}
          {form.watch('date') && form.watch('time') && (
            <div className="booking-selected-datetime">
              <div className="flex items-center text-sm text-muted-foreground mb-4">
                <ClockIcon className="h-4 w-4 mr-2" />
                <span>
                  Your appointment: {format(form.watch('date'), 'EEEE, MMMM d, yyyy')} at {form.watch('time')} 
                  {timezone && ` (${getTimeZoneAbbreviation(timezone)})`}
                </span>
              </div>
            </div>
          )}
          
          <div className="booking-nav-buttons">
            <Button 
              type="button" 
              variant="outline" 
              className="booking-back-button"
              onClick={handleBack}
            >
              <span className="mr-2">←</span> Back
            </Button>
            <Button 
              type="submit" 
              className="booking-button"
              disabled={!form.watch('date') || !form.watch('time')}
            >
              Next <span className="ml-2">→</span>
            </Button>
          </div>
          
          {process.env.NODE_ENV === 'development' && (
            <pre className="text-xs bg-muted p-2 mt-4 rounded">
              {JSON.stringify(form.watch(), null, 2)}
            </pre>
          )}
        </form>
      </Form>
    </div>
  );
}

// Customer Info Schema
const customerInfoSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  contactName: z.string().min(2, "Contact name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number").optional(),
  customerRef: z.string().optional(),
  carrierName: z.string().min(2, "Carrier name is required"),
  mcNumber: z.string().optional(),
  driverName: z.string().min(2, "Driver name is required"),
  driverPhone: z.string().min(10, "Please enter a valid phone number").optional(),
  truckNumber: z.string().optional(),
  trailerNumber: z.string().optional(),
  notes: z.string().optional(),
});

// Customer Info Step
function CustomerInfoStep({ 
  bookingPage, 
  setConfirmationCode 
}: { 
  bookingPage: any;
  setConfirmationCode: (code: string | null) => void;
}) {
  const { bookingData, updateBookingData, setCurrentStep } = useBookingWizard();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { questions, isLoading: questionsLoading } = useStandardQuestions({ 
    appointmentTypeId: bookingData.appointmentTypeId 
  });
  
  // Get any BOL data that might have been extracted
  const parsedBolData = bookingData.bolData;
  
  // Setup form with Zod validation
  const form = useForm<z.infer<typeof customerInfoSchema>>({
    resolver: zodResolver(customerInfoSchema),
    defaultValues: {
      companyName: bookingData.companyName || parsedBolData?.shipper || '',
      contactName: bookingData.contactName || '',
      email: bookingData.email || '',
      phone: bookingData.phone || '',
      customerRef: bookingData.customerRef || parsedBolData?.bolNumber || '',
      carrierName: bookingData.carrierName || parsedBolData?.carrier || '',
      mcNumber: bookingData.mcNumber || '',
      driverName: bookingData.driverName || '',
      driverPhone: bookingData.driverPhone || '',
      truckNumber: bookingData.truckNumber || '',
      trailerNumber: bookingData.trailerNumber || parsedBolData?.trailerNumber || '',
      notes: bookingData.notes || '',
    },
  });
  
  // For debugging
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Submit handler
  const onSubmit = async (values: z.infer<typeof customerInfoSchema>) => {
    try {
      setIsSubmitting(true);
      setApiError(null);
      
      // Update booking data with form values
      updateBookingData(values);
      
      // Create the appointment data
      const appointmentData = {
        facilityId: bookingData.facilityId,
        appointmentTypeId: bookingData.appointmentTypeId,
        // Format the date and time for the API
        startTime: format(
          parse(
            `${format(bookingData.date!, 'yyyy-MM-dd')} ${bookingData.time}`, 
            'yyyy-MM-dd HH:mm', 
            new Date()
          ),
          "yyyy-MM-dd'T'HH:mm:ss"
        ),
        // Customer/contact info
        companyName: values.companyName,
        contactName: values.contactName,
        email: values.email,
        phone: values.phone,
        customerRef: values.customerRef,
        // Carrier/driver info
        carrierName: values.carrierName,
        mcNumber: values.mcNumber,
        driverName: values.driverName,
        driverPhone: values.driverPhone,
        truckNumber: values.truckNumber,
        trailerNumber: values.trailerNumber,
        notes: values.notes,
        // BOL info
        bolFileUrl: bookingData.bolData?.fileUrl || null,
        
        // Include answers to standard questions if available
        standardQuestionAnswers: bookingData.standardQuestionAnswers || null,
        
        // Flag this as an external booking
        source: 'external',
        bookingPageId: bookingPage.id,
      };
      
      // Send data to API
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentData),
      });
      
      // Handle response
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to create appointment:", errorData);
        setApiError(errorData.message || "Failed to create appointment. Please try again.");
        setIsSubmitting(false);
        return;
      }
      
      // Get confirmation code
      const data = await response.json();
      setApiResponse(data);
      console.log("Appointment created successfully:", data);
      
      // Set confirmation code for the confirmation step
      setConfirmationCode(data.confirmationCode);
      
      // Move to confirmation step
      setCurrentStep(4);
    } catch (error) {
      console.error("Error creating appointment:", error);
      setApiError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle carrier selection from the CarrierSelector component
  const handleCarrierSelect = (carrierId: number, carrier: any) => {
    form.setValue('carrierName', carrier.name);
    if (carrier.mcNumber) {
      form.setValue('mcNumber', carrier.mcNumber);
    }
    
    // Update booking data
    updateBookingData({
      carrierId,
      carrierName: carrier.name,
      mcNumber: carrier.mcNumber || bookingData.mcNumber
    });
  };
  
  // Go back to previous step
  const handleBack = () => {
    setCurrentStep(2);
  };
  
  return (
    <div className="booking-step-content">
      <h2 className="booking-step-title">Enter Details</h2>
      <p className="booking-step-description">
        Please provide your contact information and additional details.
      </p>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="booking-form">
          <div className="booking-form-section">
            <h3 className="booking-form-section-title">Company Information</h3>
            
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Company Name*</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="customerRef"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">PO/BOL Number</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="booking-form-field">
              <Label className="booking-label">Carrier</Label>
              <CarrierSelector
                onCarrierSelect={handleCarrierSelect}
              />
            </div>
            
            <FormField
              control={form.control}
              name="carrierName"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Carrier Name*</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="mcNumber"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">MC Number</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="booking-form-section">
            <h3 className="booking-form-section-title">Contact Information</h3>
            
            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Contact Name*</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Email*</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Phone</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="booking-form-section">
            <h3 className="booking-form-section-title">Driver Information</h3>
            
            <FormField
              control={form.control}
              name="driverName"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Driver Name*</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="driverPhone"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Driver Phone</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="truckNumber"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Truck Number</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="trailerNumber"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Trailer Number</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {questions && questions.length > 0 && (
            <div className="booking-form-section">
              <h3 className="booking-form-section-title">Additional Information</h3>
              <StandardQuestionsFormFields
                questions={questions}
                isLoading={questionsLoading}
                onAnswersChange={(answers) => {
                  updateBookingData({ standardQuestionAnswers: answers });
                }}
                existingAnswers={bookingData.standardQuestionAnswers || {}}
              />
            </div>
          )}
          
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">Notes</FormLabel>
                <FormControl>
                  <Textarea {...field} className="booking-textarea" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {apiError && (
            <Alert variant="destructive" className="my-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          )}
          
          <div className="booking-nav-buttons">
            <Button 
              type="button" 
              variant="outline" 
              className="booking-back-button"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              <span className="mr-2">←</span> Back
            </Button>
            <Button 
              type="submit" 
              className="booking-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>Submit</>
              )}
            </Button>
          </div>
          
          {/* Debug information accordion removed for stability */}
        </form>
      </Form>
    </div>
  );
}

// Confirmation Step
function ConfirmationStep({ 
  bookingPage, 
  confirmationCode 
}: { 
  bookingPage: any;
  confirmationCode: string | null;
}) {
  const { bookingData } = useBookingWizard();
  
  // Format date for display
  const formattedDate = bookingData.date 
    ? format(bookingData.date, 'EEEE, MMMM d, yyyy')
    : '';
  
  // Get timezone abbreviation
  const tzAbbr = bookingData.timezone
    ? getTimeZoneAbbreviation(bookingData.timezone)
    : '';
  
  return (
    <div className="booking-step-content">
      <div className="booking-confirmation">
        <div className="booking-confirmation-icon">
          <CheckCircle className="h-12 w-12 text-green-500" />
        </div>
        <h2 className="booking-confirmation-title">Appointment Confirmed!</h2>
        <p className="booking-confirmation-text">
          Your appointment has been scheduled successfully.
        </p>
        
        <div className="booking-confirmation-code">
          <p className="booking-confirmation-code-label">Confirmation Code:</p>
          <p className="booking-confirmation-code-value">{confirmationCode}</p>
        </div>
        
        <Card className="booking-confirmation-details">
          <CardHeader>
            <CardTitle>Appointment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="booking-detail-item">
              <span className="booking-detail-label">Facility:</span>
              <span className="booking-detail-value">{bookingData.facilityName}</span>
            </div>
            <div className="booking-detail-item">
              <span className="booking-detail-label">Service Type:</span>
              <span className="booking-detail-value">{bookingData.appointmentTypeName}</span>
            </div>
            <div className="booking-detail-item">
              <span className="booking-detail-label">Date:</span>
              <span className="booking-detail-value">{formattedDate}</span>
            </div>
            <div className="booking-detail-item">
              <span className="booking-detail-label">Time:</span>
              <span className="booking-detail-value">{bookingData.time} {tzAbbr}</span>
            </div>
            <div className="booking-detail-item">
              <span className="booking-detail-label">Company:</span>
              <span className="booking-detail-value">{bookingData.companyName}</span>
            </div>
            <div className="booking-detail-item">
              <span className="booking-detail-label">Contact:</span>
              <span className="booking-detail-value">{bookingData.contactName}</span>
            </div>
            {bookingData.customerRef && (
              <div className="booking-detail-item">
                <span className="booking-detail-label">PO/BOL Number:</span>
                <span className="booking-detail-value">{bookingData.customerRef}</span>
              </div>
            )}
          </CardContent>
        </Card>
        
        <p className="booking-confirmation-email">
          A confirmation email has been sent to {bookingData.email} with all the details.
        </p>
        
        <div className="booking-confirmation-actions">
          <Button variant="outline" onClick={() => window.location.reload()} className="booking-confirmation-button">
            Book Another Appointment
          </Button>
        </div>
      </div>
    </div>
  );
}