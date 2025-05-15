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
import dockOptimizerLogo from '@/assets/logo-text-horizontal.svg';
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
interface ExternalBookingProps {
  slug: string;
}

export default function ExternalBooking({ slug }: ExternalBookingProps) {
  // Get the booking page data
  const { data: bookingPage, isLoading } = useQuery({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    queryFn: async () => {
      const response = await fetch(`/api/booking-pages/slug/${slug}`);
      if (!response.ok) {
        throw new Error('Failed to fetch booking page');
      }
      return response.json();
    },
  });

  // Loading state while fetching booking page data
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading booking page...</span>
      </div>
    );
  }

  // Error handling if booking page not found
  if (!bookingPage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <XCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Booking Page Not Found</h1>
        <p className="text-muted-foreground">The booking page you're looking for doesn't exist or has been removed.</p>
      </div>
    );
  }

  // Render booking page with its theme
  return (
    <BookingThemeProvider slug={slug}>
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
        <ServiceSelectionStep 
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
      
      // Format date for API
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      // Fetch available time slots
      const response = await fetch(`/api/availability?date=${formattedDate}&facilityId=${bookingData.facilityId}&appointmentTypeId=${bookingData.appointmentTypeId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch availability: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Set available time slots
      setAvailableTimeSlots(data || []);
    } catch (error) {
      console.error('Error fetching time slots:', error);
      setAvailableTimeSlots([]);
    } finally {
      setIsLoadingTimeSlots(false);
    }
  };
  
  // Submit handler
  const onSubmit = (values: z.infer<typeof dateTimeSelectionSchema>) => {
    // Parse the time string to get hours and minutes
    const [hours, minutes] = values.time.split(':').map(Number);
    
    // Create a new date object with the selected date and time
    const startDate = new Date(values.date);
    startDate.setHours(hours, minutes, 0, 0);
    
    // Calculate end time based on appointment type duration (default 1 hour)
    const selectedAppointmentType = bookingPage.appointmentTypes.find(
      (t: any) => t.id === bookingData.appointmentTypeId
    );
    const durationHours = selectedAppointmentType?.durationMinutes 
      ? selectedAppointmentType.durationMinutes / 60 
      : 1;
    
    const endDate = addHours(startDate, durationHours);
    
    // Update booking data
    updateBookingData({
      date: values.date,
      time: values.time,
      startTime: startDate,
      endTime: endDate
    });
    
    // Move to the next step
    setCurrentStep(3);
  };
  
  // Reset form with initial values when bookingData changes
  useEffect(() => {
    if (bookingData.date) {
      form.setValue('date', bookingData.date);
      handleDateChange(bookingData.date);
    }
    if (bookingData.time) {
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
                  selected={field.value}
                  onSelect={(date) => {
                    if (date) handleDateChange(date);
                  }}
                  disabled={(date) => {
                    // Disable dates in the past
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today;
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
                  value={field.value}
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
          
          <div className="booking-nav-buttons">
            <Button 
              type="button" 
              variant="outline" 
              className="booking-back-button"
              onClick={handleBack}
            >
              <span className="mr-2">←</span> Back
            </Button>
            <Button type="submit" className="booking-button">
              Next <span className="ml-2">→</span>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Customer Info Schema
const customerInfoSchema = z.object({
  companyName: z.string().min(1, "Company name is required."),
  contactName: z.string().min(1, "Contact name is required."),
  email: z.string().email("Please enter a valid email address."),
  phone: z.string().min(1, "Phone number is required."),
  customerRef: z.string().optional(),
  carrierName: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  mcNumber: z.string().optional(),
  truckNumber: z.string().optional(),
  trailerNumber: z.string().optional(),
  notes: z.string().optional(),
});

// Customer Info Step
function CustomerInfoStep({ bookingPage, onSubmit }: { bookingPage: any; onSubmit: () => Promise<void> }) {
  const { bookingData, updateBookingData, setCurrentStep, isLoading, setIsLoading } = useBookingWizard();
  const { data: standardQuestionsData } = useStandardQuestions(bookingData.appointmentTypeId);
  
  // Setup form with Zod validation
  const form = useForm<z.infer<typeof customerInfoSchema>>({
    resolver: zodResolver(customerInfoSchema),
    defaultValues: {
      companyName: bookingData.companyName || '',
      contactName: bookingData.contactName || '',
      email: bookingData.email || '',
      phone: bookingData.phone || '',
      customerRef: bookingData.customerRef || '',
      carrierName: bookingData.carrierName || '',
      driverName: bookingData.driverName || '',
      driverPhone: bookingData.driverPhone || '',
      mcNumber: bookingData.mcNumber || '',
      truckNumber: bookingData.truckNumber || '',
      trailerNumber: bookingData.trailerNumber || '',
      notes: bookingData.notes || '',
    },
  });
  
  // Handle BOL upload processing result
  const handleBolProcessed = (data: ParsedBolData, fileUrl: string) => {
    console.log("BOL data extracted:", data);
    
    // Update booking data with BOL information
    updateBookingData({
      bolData: { ...data, fileUrl }
    });
    
    // Auto-fill form fields with BOL data if available
    if (data.driverName) {
      form.setValue('driverName', data.driverName);
    }
    if (data.truckNumber) {
      form.setValue('truckNumber', data.truckNumber);
    }
    if (data.customerRef) {
      form.setValue('customerRef', data.customerRef);
    }
  };
  
  // Get standard questions for this appointment type
  const standardQuestions = standardQuestionsData?.questions || [];
  
  // Handle form submission
  const handleFormSubmit = async (values: z.infer<typeof customerInfoSchema>) => {
    try {
      setIsLoading(true);
      
      // Update booking data with form values
      updateBookingData({
        ...values,
        standardQuestions: form.getValues('standardQuestions')
      });
      
      // Pass to parent component to handle final submission
      await onSubmit();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsLoading(false);
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
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="booking-form">
          <div className="booking-form-section">
            <h3 className="booking-section-title">Company Information</h3>
            
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Company Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Contact Name</FormLabel>
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
                  <FormLabel className="booking-label">Email</FormLabel>
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
                    <Input {...field} type="tel" className="booking-input" />
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
                  <FormLabel className="booking-label">Your Reference # (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="booking-form-section">
            <h3 className="booking-section-title">Carrier & Driver Information</h3>
            
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
                  <FormLabel className="booking-label">Carrier Name</FormLabel>
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
                  <FormLabel className="booking-label">MC Number (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="driverName"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Driver Name (Optional)</FormLabel>
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
                  <FormLabel className="booking-label">Driver Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="tel" className="booking-input" />
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
                  <FormLabel className="booking-label">Truck Number (Optional)</FormLabel>
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
                  <FormLabel className="booking-label">Trailer Number (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} className="booking-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {/* Standard Questions */}
          {standardQuestions.length > 0 && (
            <div className="booking-form-section">
              <h3 className="booking-section-title">Additional Questions</h3>
              <StandardQuestionsFormFields
                questions={standardQuestions}
                form={form}
              />
            </div>
          )}
          
          {/* BOL Upload */}
          {bookingPage.enableBolUpload && (
            <div className="booking-form-section">
              <h3 className="booking-section-title">Upload Documents</h3>
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
            </div>
          )}
          
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea 
                    {...field} 
                    className="booking-textarea" 
                    placeholder="Any additional information for this appointment..." 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="booking-nav-buttons">
            <Button 
              type="button" 
              variant="outline" 
              className="booking-back-button"
              onClick={handleBack}
              disabled={isLoading}
            >
              <span className="mr-2">←</span> Back
            </Button>
            <Button 
              type="submit" 
              className="booking-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Appointment...
                </>
              ) : (
                <>Submit Appointment</>
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
  
  if (!confirmationCode) {
    return (
      <div className="booking-step-content">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            There was an error processing your appointment. Please try again or contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Format dates for display
  const formatDate = (date: Date) => {
    if (!date) return "N/A";
    return format(date, 'EEEE, MMMM d, yyyy');
  };
  
  const formatTime = (time: string) => {
    if (!time) return "N/A";
    return time;
  };
  
  return (
    <div className="booking-step-content">
      <div className="booking-confirmation-header">
        <CheckCircle className="h-12 w-12 text-success mb-4" />
        <h2 className="booking-step-title">Appointment Confirmed!</h2>
        <p className="booking-confirmation-description">
          Your appointment has been successfully scheduled. Please save your confirmation code.
        </p>
      </div>
      
      <Card className="booking-confirmation-card">
        <CardHeader>
          <CardTitle className="booking-confirmation-card-title">
            Your Confirmation Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="booking-confirmation-code">
            {confirmationCode}
          </div>
          
          <div className="booking-confirmation-details">
            <div className="booking-confirmation-section">
              <h3 className="booking-confirmation-section-title">Appointment Details</h3>
              
              <div className="booking-confirmation-item">
                <span className="booking-confirmation-label">Facility:</span>
                <span className="booking-confirmation-value">{bookingData.facilityName}</span>
              </div>
              
              <div className="booking-confirmation-item">
                <span className="booking-confirmation-label">Service Type:</span>
                <span className="booking-confirmation-value">{bookingData.appointmentTypeName}</span>
              </div>
              
              <div className="booking-confirmation-item">
                <span className="booking-confirmation-label">Date:</span>
                <span className="booking-confirmation-value">{bookingData.date ? formatDate(bookingData.date) : "N/A"}</span>
              </div>
              
              <div className="booking-confirmation-item">
                <span className="booking-confirmation-label">Time:</span>
                <span className="booking-confirmation-value">{bookingData.time ? formatTime(bookingData.time) : "N/A"}</span>
              </div>
            </div>
            
            <div className="booking-confirmation-section">
              <h3 className="booking-confirmation-section-title">Contact Information</h3>
              
              <div className="booking-confirmation-item">
                <span className="booking-confirmation-label">Company:</span>
                <span className="booking-confirmation-value">{bookingData.companyName}</span>
              </div>
              
              <div className="booking-confirmation-item">
                <span className="booking-confirmation-label">Contact:</span>
                <span className="booking-confirmation-value">{bookingData.contactName}</span>
              </div>
              
              <div className="booking-confirmation-item">
                <span className="booking-confirmation-label">Email:</span>
                <span className="booking-confirmation-value">{bookingData.email}</span>
              </div>
              
              <div className="booking-confirmation-item">
                <span className="booking-confirmation-label">Phone:</span>
                <span className="booking-confirmation-value">{bookingData.phone}</span>
              </div>
            </div>
            
            {/* Standard Questions if any */}
            {bookingData.standardQuestions && bookingData.standardQuestions.length > 0 && (
              <div className="booking-confirmation-section">
                <h3 className="booking-confirmation-section-title">Additional Information</h3>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="additional-info">
                    <AccordionTrigger>View Responses</AccordionTrigger>
                    <AccordionContent>
                      {bookingData.standardQuestions.map((qa: any, index: number) => (
                        <div key={index} className="booking-confirmation-item">
                          <span className="booking-confirmation-label">{qa.question}:</span>
                          <span className="booking-confirmation-value">{qa.answer}</span>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>
          
          <div className="booking-confirmation-message">
            <p>
              A confirmation email has been sent to your provided email address. You will also receive a reminder email before your appointment.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}