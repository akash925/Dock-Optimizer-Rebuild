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
import { Loader2, Clock as ClockIcon, CheckCircle } from 'lucide-react';
import { format, addHours, isValid, parseISO, parse } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { getUserTimeZone, formatTimeRangeForDualZones, formatDateRangeInTimeZone, getTimeZoneAbbreviation } from '@/lib/timezone-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import BolUpload from '@/components/shared/bol-upload';
import { ParsedBolData } from '@/lib/ocr-service';
import { BookingWizardProvider, useBookingWizard } from '@/contexts/BookingWizardContext';
import { BookingThemeProvider, useBookingTheme } from '@/contexts/BookingThemeContext';
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage, FormField } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CarrierSelector } from '@/components/shared/carrier-selector';
import '../styles/booking-wizard.css';
import hanzoLogo from '@assets/hanzo logo.jpeg';

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
    <BookingThemeProvider slug={slug}>
      <BookingWizardProvider>
        <BookingWizardContent bookingPage={bookingPage} />
      </BookingWizardProvider>
    </BookingThemeProvider>
  );
}

// Import our fixed version of BookingWizardContent 
import { FixedBookingWizardContent } from './fixed-booking-wizard-content';

// The main content component that uses both contexts
function BookingWizardContent({ bookingPage }: { bookingPage: any }) {
  // Simply render the fixed component
  return <FixedBookingWizardContent bookingPage={bookingPage} />;
}

// Export these components so they can be imported in fixed-booking-wizard-content.tsx
export { DateTimeSelectionStep, CustomerInfoStep, ConfirmationStep };

// Define the step 1 form schema
const serviceSelectionSchema = z.object({
  facilityId: z.string().min(1, { message: "Location is required" }),
  appointmentTypeId: z.string().min(1, { message: "Appointment type is required" }),
  pickupOrDropoff: z.enum(["pickup", "dropoff"], { 
    required_error: "Please select if this is a pickup or dropoff" 
  })
});

type ServiceSelectionFormValues = z.infer<typeof serviceSelectionSchema>;

// Import the new ServiceSelectionStep component
import ServiceSelectionStepForm from './service-selection-step';

// Renamed to avoid collision with imported component
function ServiceSelectionStepOld({ bookingPage }: { bookingPage: any }) {
  const { bookingData, updateBookingData, setCurrentStep } = useBookingWizard();
  
  // Set up react-hook-form
  const form = useForm<ServiceSelectionFormValues>({
    resolver: zodResolver(serviceSelectionSchema),
    defaultValues: {
      facilityId: bookingData.facilityId?.toString() || "",
      appointmentTypeId: bookingData.appointmentTypeId?.toString() || "",
      pickupOrDropoff: bookingData.pickupOrDropoff as "pickup" | "dropoff" || undefined
    }
  });
  const [bolPreviewText, setBolPreviewText] = useState<string | null>(null);
  const [bolProcessing, setBolProcessing] = useState(false);
  
  // Fetch facilities data
  const { 
    data: facilities = [], 
    isLoading: facilitiesLoading 
  } = useQuery<any[]>({
    queryKey: [`/api/facilities`, { bookingPageSlug: slug }],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, params] = queryKey as [string, { bookingPageSlug: string }];
      // Use relative URL path for API requests to work in any environment
      const apiUrl = `${baseUrl}?bookingPageSlug=${params.bookingPageSlug}`;
      console.log(`[ExternalBookingFixed] Fetching facilities with URL: ${apiUrl}`);
      
      try {
        const response = await fetch(apiUrl);
        console.log(`[ExternalBookingFixed] Facilities API response status:`, response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[ExternalBookingFixed] Error fetching facilities: ${errorText}`);
          throw new Error(`Failed to fetch facilities: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`[ExternalBookingFixed] Successfully fetched ${data.length} facilities`);
        return data;
      } catch (err) {
        console.error(`[ExternalBookingFixed] Exception fetching facilities:`, err);
        throw err;
      }
    },
    enabled: !!slug,
  });
  
  // Fetch appointment types
  const { 
    data: appointmentTypes = [], 
    isLoading: typesLoading 
  } = useQuery<any[]>({
    queryKey: [`/api/appointment-types`, { bookingPageSlug: slug }],
    queryFn: async ({ queryKey }) => {
      const [baseUrl, params] = queryKey as [string, { bookingPageSlug: string }];
      // Use relative URL path for API requests to work in any environment
      const apiUrl = `${baseUrl}?bookingPageSlug=${params.bookingPageSlug}`;
      console.log(`[ExternalBookingFixed] Fetching appointment types with URL: ${apiUrl}`);
      
      try {
        const response = await fetch(apiUrl);
        console.log(`[ExternalBookingFixed] Appointment types API response status:`, response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[ExternalBookingFixed] Error fetching appointment types: ${errorText}`);
          throw new Error(`Failed to fetch appointment types: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`[ExternalBookingFixed] Successfully fetched ${data.length} appointment types`);
        return data;
      } catch (err) {
        console.error(`[ExternalBookingFixed] Exception fetching appointment types:`, err);
        throw err;
      }
    },
    enabled: !!slug,
  });
  
  // Filter facilities based on booking page configuration
  const availableFacilities = useMemo(() => {
    if (!facilities || !bookingPage?.facilities) return [];
    
    return bookingPage.facilities && Array.isArray(bookingPage.facilities)
      ? facilities.filter((f: any) => bookingPage.facilities.includes(f.id))
      : facilities;
  }, [facilities, bookingPage]);
  
  // Get appointment types for the selected facility
  const facilityAppointmentTypes = useMemo(() => {
    if (!appointmentTypes || !bookingData.facilityId) return [];
    
    console.log("[ExternalBooking] Filtering appointment types for facility:", bookingData.facilityId);
    console.log("[ExternalBooking] Booking page excludedAppointmentTypes:", bookingPage?.excludedAppointmentTypes);
    
    // Get excluded appointment types from booking page
    const excludedTypes = bookingPage?.excludedAppointmentTypes || [];
    
    // Filter for the selected facility and sort alphabetically by name
    const filteredTypes = appointmentTypes
      .filter((type: any) => {
        // First filter by facility ID
        const matchesFacility = type.facilityId === bookingData.facilityId;
        
        // Then check if type is not excluded
        const typeId = typeof type.id === 'string' ? parseInt(type.id, 10) : type.id;
        const isExcluded = Array.isArray(excludedTypes) && excludedTypes.includes(typeId);
        
        const shouldInclude = matchesFacility && !isExcluded;
        console.log(`[ExternalBooking] Type ${type.id} (${type.name}): facilityMatch=${matchesFacility}, excluded=${isExcluded}, include=${shouldInclude}`);
        
        return shouldInclude;
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    
    console.log(`[ExternalBooking] Found ${filteredTypes.length} appointment types for facility ${bookingData.facilityId}`);
    return filteredTypes;
  }, [appointmentTypes, bookingData.facilityId, bookingPage?.excludedAppointmentTypes]);
  
  // Handle BOL processing from the BolUpload component
  const handleBolProcessed = (data: ParsedBolData, fileUrl: string) => {
    // Update booking data with the parsed BOL information
    updateBookingData({
      bolExtractedData: {
        bolNumber: data.bolNumber || '',
        customerName: data.customerName || '',
        carrierName: data.carrierName || '',
        mcNumber: data.mcNumber || '',
        weight: data.weight || '',
        notes: data.notes || ''
      },
      bolFileUploaded: true
    });
    
    // Create preview text from the extracted data for display
    const preview = `
BOL Number: ${data.bolNumber || ''}
Customer: ${data.customerName || ''}
Carrier: ${data.carrierName || ''} ${data.mcNumber ? `(${data.mcNumber})` : ''}
${data.weight ? `Weight: ${data.weight}` : ''}
${data.notes ? `Notes: ${data.notes}` : ''}
    `.trim();
    
    setBolPreviewText(preview);
  };
  
  // Handle BOL processing state changes
  const handleProcessingStateChange = (isProcessing: boolean) => {
    setBolProcessing(isProcessing);
  };
  
  // Handle next button click
  const handleNext = () => {
    if (!bookingData.facilityId || !bookingData.appointmentTypeId || !bookingData.pickupOrDropoff) {
      alert('Please complete all required fields before continuing.');
      return;
    }
    
    setCurrentStep(2);
  };
  
  // Loading state
  if (facilitiesLoading || typesLoading) {
    return (
      <div className="flex justify-center my-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  
  // Check if Next button should be enabled
  const isNextDisabled = !bookingData.facilityId || 
                         !bookingData.appointmentTypeId || 
                         !bookingData.pickupOrDropoff;
  
  // When facilityId changes, reset appointmentTypeId
  const handleFacilityChange = (value: string) => {
    form.setValue("facilityId", value);
    form.setValue("appointmentTypeId", "");
    // Update the main booking data context as well
    updateBookingData({
      facilityId: parseInt(value, 10),
      appointmentTypeId: null
    });
  };
  
  // Handle form submission
  const onSubmit = (values: ServiceSelectionFormValues) => {
    // Update the booking wizard state
    updateBookingData({
      facilityId: parseInt(values.facilityId, 10),
      appointmentTypeId: parseInt(values.appointmentTypeId, 10),
      pickupOrDropoff: values.pickupOrDropoff
    });
    
    // Move to the next step
    setCurrentStep(2);
  };

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
      {/* Left side - Information panel */}
      <div className="md:col-span-1 space-y-6">
        <div className="prose max-w-none">
          <h2 className="text-xl font-bold">Schedule Your Appointment</h2>
          <p className="text-sm">
            Please use this form to schedule a dock appointment at Hanzo Logistics. 
            For support using this page, please <a href="#" className="text-blue-600 hover:underline">check out this video</a>.
          </p>
          
          <p className="text-sm mt-4 font-semibold">
            Effective August 1st, 2023, MC Numbers are required for all
            incoming and outgoing shipments. This is to protect the
            security of our customer's shipments and reduce the risk of
            fraud.
          </p>
        </div>
      </div>
      
      {/* Right side - Form Card */}
      <div className="md:col-span-2">
        <Card className="w-full">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Step 1: Location */}
                <FormField
                  control={form.control}
                  name="facilityId"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="font-medium">
                        Location<span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={(value) => handleFacilityChange(value)}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger id="facilityId">
                            <SelectValue placeholder="Select a location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableFacilities.map((facility: any) => (
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
                
                {/* Step 2: Dock Appointment Type */}
                <FormField
                  control={form.control}
                  name="appointmentTypeId"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="font-medium">
                        Dock Appointment Type<span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          updateBookingData({ appointmentTypeId: parseInt(value, 10) });
                        }}
                        defaultValue={field.value}
                        disabled={!form.watch("facilityId")}
                      >
                        <FormControl>
                          <SelectTrigger id="appointmentTypeId">
                            <SelectValue placeholder={
                              !form.watch("facilityId") 
                                ? "Please select a location first" 
                                : "Select an appointment type"
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {facilityAppointmentTypes.map((type: any) => (
                            <SelectItem 
                              key={type.id} 
                              value={type.id.toString()}
                            >
                              {type.name} ({type.duration} min)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      
                      {facilityAppointmentTypes.length === 0 && form.watch("facilityId") && (
                        <p className="text-sm text-orange-600 mt-1">
                          No appointment types are available for this location.
                        </p>
                      )}
                    </FormItem>
                  )}
                />
                
                {/* Step 3: Pickup or Dropoff */}
                <FormField
                  control={form.control}
                  name="pickupOrDropoff"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="font-medium">
                        Pickup or Dropoff<span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-2 gap-4">
                          <div
                            className={`border rounded-md p-4 cursor-pointer transition-colors ${
                              field.value === 'pickup'
                                ? 'border-primary bg-primary/10'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => {
                              form.setValue("pickupOrDropoff", "pickup");
                              updateBookingData({ pickupOrDropoff: 'pickup' });
                            }}
                          >
                            <div className="font-medium">Pickup</div>
                            <div className="text-sm text-gray-500">I'm picking up goods from the facility</div>
                          </div>
                          
                          <div
                            className={`border rounded-md p-4 cursor-pointer transition-colors ${
                              field.value === 'dropoff'
                                ? 'border-primary bg-primary/10'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => {
                              form.setValue("pickupOrDropoff", "dropoff");
                              updateBookingData({ pickupOrDropoff: 'dropoff' });
                            }}
                          >
                            <div className="font-medium">Dropoff</div>
                            <div className="text-sm text-gray-500">I'm delivering goods to the facility</div>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Step 4: Bill of Lading Upload */}
                <div className="space-y-2">
                  <Label className="font-medium">
                    Bill of Lading Upload (optional)
                  </Label>
                  
                  <BolUpload 
                    onBolProcessed={handleBolProcessed}
                    onProcessingStateChange={handleProcessingStateChange}
                  />
                  
                  {/* BOL Preview shown when file uploaded but not while processing */}
                  {bolProcessing && (
                    <div className="p-4 border rounded-md mt-3 animate-pulse flex items-center justify-center">
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      <p className="text-sm text-gray-600">Processing Bill of Lading...</p>
                    </div>
                  )}
                </div>
                
                {/* Navigation buttons */}
                <div className="flex justify-end pt-4">
                  <Button 
                    type="submit"
                    className="booking-button"
                  >
                    Next
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Define the DateTimeForm schema
const dateTimeSelectionSchema = z.object({
  selectedDate: z.date({
    required_error: "Please select a date"
  }),
  selectedTime: z.string({
    required_error: "Please select a time"
  })
});

type DateTimeFormValues = z.infer<typeof dateTimeSelectionSchema>;

// Step 2: Date and Time Selection
// Define the AvailabilitySlot interface
interface AvailabilitySlot {
  time: string;
  available: boolean;
  reason?: string;
  remaining: number;
}

function DateTimeSelectionStep({ bookingPage }: { bookingPage: any }) {
  const { bookingData, updateBookingData, setCurrentStep } = useBookingWizard();
  
  // Try to parse BOL date if available
  const getBolDate = () => {
    if (bookingData.bolExtractedData?.scheduledDate || bookingData.bolExtractedData?.shipDate) {
      // First try to use scheduledDate, then fall back to shipDate
      const dateStr = bookingData.bolExtractedData.scheduledDate || bookingData.bolExtractedData.shipDate;
      console.log('Found BOL date:', dateStr);
      
      try {
        // Try different date formats, common in shipping docs
        const formats = [
          'MM/dd/yyyy', 'M/d/yyyy', 'MM/dd/yy', 'M/d/yy', // US format with slashes
          'dd/MM/yyyy', 'd/M/yyyy', 'dd/MM/yy', 'd/M/yy', // European format with slashes
          'yyyy-MM-dd', 'yyyy-M-d', // ISO format
          'MMMM d, yyyy', 'MMM d, yyyy', // Full month format
          'MMMM d yyyy', 'MMM d yyyy' // Month format without comma
        ];
        
        // Try each format until one works
        for (const format of formats) {
          try {
            const parsedDate = parse(dateStr, format, new Date());
            if (isValid(parsedDate) && parsedDate > new Date()) {
              console.log('Successfully parsed BOL date as:', parsedDate);
              return parsedDate;
            }
          } catch (err) {
            // Just try the next format
          }
        }
        
        // If all formats fail, check for Unix timestamp (seconds)
        const numericDate = parseInt(dateStr);
        if (!isNaN(numericDate)) {
          const date = new Date(numericDate * 1000); // Convert seconds to milliseconds
          if (isValid(date) && date > new Date()) {
            return date;
          }
        }
      } catch (error) {
        console.error('Error parsing BOL date:', error);
      }
    }
    return undefined;
  };
  
  // Get a date from BOL if available, otherwise use existing or undefined
  const bolDate = getBolDate();
  const initialDate = bolDate || (bookingData.startTime ? new Date(bookingData.startTime) : undefined);
  
  // Set up react-hook-form
  const form = useForm<DateTimeFormValues>({
    resolver: zodResolver(dateTimeSelectionSchema),
    defaultValues: {
      selectedDate: initialDate,
      selectedTime: ""
    }
  });
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [organizationHolidays, setOrganizationHolidays] = useState<string[]>([]);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  
  // Get the appointment type to determine duration
  const { data: appointmentTypes } = useQuery({
    queryKey: ['/api/appointment-types'],
  });
  
  // Get the facility to determine timezone
  const { data: facilities } = useQuery({
    queryKey: ['/api/facilities'],
  });
  
  // Get the selected appointment type
  const selectedAppointmentType = Array.isArray(appointmentTypes) 
    ? appointmentTypes.find((type: any) => type.id === bookingData.appointmentTypeId)
    : undefined;
  
  // Get the selected facility
  const selectedFacility = Array.isArray(facilities)
    ? facilities.find((facility: any) => facility.id === bookingData.facilityId)
    : undefined;
    
  // Fetch organization holidays when facility changes
  useEffect(() => {
    if (!selectedFacility || !selectedFacility.id) return;
    
    const fetchOrganizationHolidays = async () => {
      setIsLoadingHolidays(true);
      
      try {
        // First, get the organization ID for this facility
        // Use relative URL path for API requests to work in any environment
        const orgApiUrl = `/api/facilities/${selectedFacility.id}/organization`;
        console.log(`[ExternalBookingFixed] Fetching organization for facility with URL: ${orgApiUrl}`);
        
        let organizationId;
        try {
          const orgResponse = await fetch(orgApiUrl);
          console.log(`[ExternalBookingFixed] Organization API response status:`, orgResponse.status);
          
          if (!orgResponse.ok) {
            const errorText = await orgResponse.text();
            console.error(`[ExternalBookingFixed] Error fetching organization: ${errorText}`);
            console.warn(`Failed to fetch organization for facility ${selectedFacility.id}`);
            return;
          }
          
          const orgData = await orgResponse.json();
          organizationId = orgData.organizationId;
          
          if (!organizationId) {
            console.warn(`No organization found for facility ${selectedFacility.id}`);
            return;
          }
          
          // Get holidays for this organization
          // Important: Use port 5000 directly for API requests
          const holidaysApiUrl = `http://localhost:5000/api/organizations/${organizationId}/holidays`;
          console.log(`[ExternalBookingFixed] Fetching holidays with URL: ${holidaysApiUrl}`);
          
          const holidaysResponse = await fetch(holidaysApiUrl);
          console.log(`[ExternalBookingFixed] Holidays API response status:`, holidaysResponse.status);
          
          if (!holidaysResponse.ok) {
            const errorText = await holidaysResponse.text();
            console.error(`[ExternalBookingFixed] Error fetching holidays: ${errorText}`);
            console.warn(`Failed to fetch holidays for organization ${organizationId}`);
            return;
          }
          
          const holidays = await holidaysResponse.json();
          
          // Filter only enabled holidays and extract dates
          const enabledHolidayDates = holidays
            .filter((holiday: any) => holiday.enabled)
            .map((holiday: any) => holiday.date);
          
          console.log(`[EXTERNAL BOOKING] Found ${enabledHolidayDates.length} enabled holidays for organization ${organizationId}:`, enabledHolidayDates);
          
          setOrganizationHolidays(enabledHolidayDates);
        } catch (err) {
          console.error(`[ExternalBookingFixed] Exception fetching organization data:`, err);
          return;
        }
      } catch (error) {
        console.error("Error fetching organization holidays:", error);
      } finally {
        setIsLoadingHolidays(false);
      }
    };
    
    fetchOrganizationHolidays();
  }, [selectedFacility]);
  
  // When date changes, fetch available times
  useEffect(() => {
    if (!selectedDate || !bookingData.facilityId || !bookingData.appointmentTypeId) return;
    
    const fetchAvailableTimes = async () => {
      try {
        setLoading(true);
        setAvailableTimes([]); // Clear previous times while loading
        
        // Format the date for the API
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        
        console.log(`Fetching available times for date=${dateStr}, facilityId=${bookingData.facilityId}, typeId=${bookingData.appointmentTypeId}`);
        
        // Call the API to get available times using the standardized parameter name (typeId)
        // Include bookingPageSlug to ensure proper tenant context
        // Use relative URL path for API requests to work in any environment
        const apiUrl = `/api/availability?date=${dateStr}&facilityId=${bookingData.facilityId}&typeId=${bookingData.appointmentTypeId}&bookingPageSlug=${slug}`;
        console.log(`[ExternalBookingFixed] Fetching availability with URL: ${apiUrl}`);
        
        let data;
        try {
          const response = await fetch(apiUrl);
          console.log(`[ExternalBookingFixed] Availability API response status:`, response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[ExternalBookingFixed] Error fetching availability: ${errorText}`);
            throw new Error(`Failed to fetch availability: ${response.status} ${errorText}`);
          }
          
          data = await response.json();
          console.log("[ExternalBookingFixed] Available times response:", data);
        } catch (err) {
          console.error(`[ExternalBookingFixed] Exception fetching availability:`, err);
          throw err;
        }
        
        // Log the response data structure in detail
        console.log('[EXTERNAL FLOW] API response data structure:', JSON.stringify(data, null, 2));
        console.log('[EXTERNAL FLOW] Checking for remaining slots in response:', 
          data.slots ? 'has slots array with details' : 'only has simple availableTimes array');
          
        // Store all availability slot data if available
        if (data.slots && Array.isArray(data.slots)) {
          console.log('[EXTERNAL FLOW] Using enhanced slot data with capacity information');
          // Filter for available slots and sort by time
          const availableSlots = data.slots
            .filter((slot: any) => slot.available)
            .sort((a: any, b: any) => a.time.localeCompare(b.time));
          setAvailabilitySlots(availableSlots);
          
          // Set the available times for backward compatibility
          const times = availableSlots.map((slot: any) => slot.time);
          setAvailableTimes(times);
        } else {
          // Fallback to old format if slots aren't available
          console.log('[EXTERNAL FLOW] Using backward compatible simple time array');
          const sortedTimes = [...(data.availableTimes || [])].sort();
          setAvailableTimes(sortedTimes);
          
          // Create basic slots with default remaining = 1
          const basicSlots = sortedTimes.map(time => ({
            time,
            available: true,
            remaining: 1
          }));
          setAvailabilitySlots(basicSlots);
        }
        
        // If we previously had a selected time on this date, check if it's still available
        if (bookingData.startTime) {
          const existingTimeString = format(new Date(bookingData.startTime), 'HH:mm');
          const times = availabilitySlots.map(slot => slot.time);
          if (!times.includes(existingTimeString)) {
            // Previous time is no longer available
            setSelectedTime('');
          } else {
            setSelectedTime(existingTimeString);
          }
        } else {
          // No time was previously selected
          setSelectedTime('');
        }
        
        if (availabilitySlots.length === 0) {
          console.log("No available times for selected date");
        }
      } catch (error) {
        console.error('Error fetching available times:', error);
        setAvailableTimes([]);
        setSelectedTime('');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAvailableTimes();
  }, [selectedDate, bookingData.facilityId, bookingData.appointmentTypeId]);
  
  // When time changes, update the bookingData
  useEffect(() => {
    if (!selectedDate || !selectedTime || !selectedAppointmentType) return;
    
    // Parse the selected time
    const [hours, minutes] = selectedTime.split(':').map(Number);
    
    // Create a new date with the selected date and time
    const startDate = new Date(selectedDate);
    startDate.setHours(hours, minutes, 0, 0);
    
    // Calculate the end time based on appointment duration
    const endDate = addHours(startDate, selectedAppointmentType.duration / 60);
    
    // Update the booking data
    updateBookingData({
      startTime: startDate,
      endTime: endDate,
      timezone: selectedFacility?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }, [selectedDate, selectedTime, selectedAppointmentType, selectedFacility]);
  
  // Handle date change
  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime(''); // Clear time when date changes
  };
  
  // Handle time selection
  const handleTimeChange = (value: string) => {
    setSelectedTime(value);
  };
  
  // Handle back button
  const handleBack = () => {
    setCurrentStep(1);
  };
  
  // Handle next button
  const handleNext = () => {
    if (!bookingData.startTime || !bookingData.endTime) {
      alert('Please select both a date and time.');
      return;
    }
    
    setCurrentStep(3);
  };
  
  // Handle form submission
  const onSubmit = (values: DateTimeFormValues) => {
    if (!values.selectedDate || !values.selectedTime || !selectedAppointmentType) {
      return;
    }
    
    // Get the facility timezone or fallback to browser's timezone
    const facilityTimezone = selectedFacility?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Parse the selected time
    const [hours, minutes] = values.selectedTime.split(':').map(Number);
    
    // Create the start date in the facility's timezone
    // First make a date string in ISO format without timezone info
    const dateString = format(values.selectedDate, 'yyyy-MM-dd');
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    const zonedDateTime = `${dateString}T${timeString}`;
    
    // Create a simpler approach to handle timezones
    // First, create a Date object from the date and time strings
    const localDate = new Date(`${dateString}T${timeString}`);
    
    // Get the timezone offset between the browser timezone and UTC
    const browserOffsetMinutes = localDate.getTimezoneOffset();
    
    // Create a date object in the browser's locale to get info
    const targetTzDate = new Date(localDate.toLocaleString('en-US', { timeZone: facilityTimezone }));
    
    // Calculate the offset between the facility timezone and the browser timezone
    const facilityOffsetHours = (targetTzDate.getHours() - localDate.getHours()) + 
                               (targetTzDate.getMinutes() - localDate.getMinutes()) / 60;
    
    // Adjust the start time by the difference in timezone offsets
    const startDate = new Date(localDate.getTime() - (facilityOffsetHours * 60 * 60 * 1000));
    
    // Calculate the end time based on appointment duration
    const endDate = addHours(startDate, selectedAppointmentType.duration / 60);
    
    console.log('Original selected time:', values.selectedTime);
    console.log('Facility timezone:', facilityTimezone);
    console.log('Browser timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('Browser offset (minutes):', browserOffsetMinutes);
    console.log('Facility offset (hours):', facilityOffsetHours);
    console.log('Adjusted start date (UTC):', startDate.toISOString());
    console.log('Adjusted end date (UTC):', endDate.toISOString());
    
    // Update the booking data
    updateBookingData({
      startTime: startDate,
      endTime: endDate,
      timezone: facilityTimezone,
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
                        
                        // Get the day of the week (0 = Sunday, 6 = Saturday)
                        const dayOfWeek = date.getDay();
                        
                        // Log facility open status for debugging
                        if (dayOfWeek === 0 || dayOfWeek === 6) {
                          // First check if we have any data about facility opening days
                          const hasSundayOpenInfo = selectedFacility.sundayOpen !== undefined && selectedFacility.sundayOpen !== null;
                          const hasSaturdayOpenInfo = selectedFacility.saturdayOpen !== undefined && selectedFacility.saturdayOpen !== null;
                          
                          console.log(`Facility ${selectedFacility.name} (ID: ${selectedFacility.id}):`, {
                            day: dayOfWeek === 0 ? 'Sunday' : 'Saturday',
                            sundayOpen: selectedFacility.sundayOpen,
                            saturdayOpen: selectedFacility.saturdayOpen,
                            hasSundayOpenInfo,
                            hasSaturdayOpenInfo
                          });
                          
                          // If we don't have specific info, default to standard behavior (closed on weekends)
                          if (dayOfWeek === 0 && !hasSundayOpenInfo) {
                            console.log('No explicit sundayOpen setting for facility - defaulting to closed on Sunday');
                            return true; // Disable Sunday by default
                          }
                          
                          if (dayOfWeek === 6 && !hasSaturdayOpenInfo) {
                            console.log('No explicit saturdayOpen setting for facility - defaulting to closed on Saturday');
                            return true; // Disable Saturday by default
                          }
                        }
                        
                        // Check if the facility is closed on this day
                        if (dayOfWeek === 0) {
                          // Sunday - check if facility is open on Sunday
                          return selectedFacility.sundayOpen === false;
                        } else if (dayOfWeek === 6) {
                          // Saturday - check if facility is open on Saturday
                          return selectedFacility.saturdayOpen === false;
                        }
                        
                        // Weekdays are usually open
                        return false;
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
            name="selectedTime"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">
                  Available Times
                  {selectedFacility?.timezone && (
                    <span className="ml-2 text-sm text-muted-foreground font-normal">
                      (All times shown in {selectedFacility.timezone.replace(/_/g, ' ')} - Facility's timezone)
                    </span>
                  )}
                </FormLabel>
                <FormControl>
                  <>
                    {loading ? (
                      <div className="flex justify-center my-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : selectedDate ? (
                      availableTimes.length > 0 ? (
                        <>
                          {/* Show timezone information above time selection grid */}
                          <div className="flex items-center mb-3 p-2 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                            <ClockIcon className="h-4 w-4 mr-2" />
                            <div className="text-sm">
                              <p>
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

                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {availabilitySlots.map((slot) => {
                              // Create a date object from the time string for display formatting
                              const [hours, minutes] = slot.time.split(':').map(Number);
                              const timeObj = new Date();
                              timeObj.setHours(hours, minutes, 0, 0);
                              
                              // Format for display (e.g., "9:30 AM")
                              const displayTime = format(timeObj, 'h:mm a');
                              
                              // Get the selected appointment type to check if we should show remaining slots
                              const selectedType = Array.isArray(appointmentTypes)
                                ? appointmentTypes.find((type: any) => type.id === bookingData.appointmentTypeId)
                                : undefined;
                              
                              // Always show remaining slots, regardless of the showRemainingSlots setting
                              return (
                                <Button
                                  key={slot.time}
                                  type="button"
                                  variant={field.value === slot.time ? "default" : "outline"}
                                  className={`relative min-w-[120px] h-auto min-h-[85px] py-2 px-1 ${field.value === slot.time ? "booking-button" : "booking-button-secondary"}`}
                                  onClick={() => {
                                    field.onChange(slot.time);
                                    handleTimeChange(slot.time);
                                  }}
                                >
                                  <div className="flex flex-col w-full justify-center">
                                    {/* Primary display: Facility Time with facility timezone identifier */}
                                    <div className="font-medium text-sm text-center">
                                      <span>{displayTime}</span>
                                      {selectedFacility?.timezone && (
                                        <div className="text-xs">
                                          ({getTimeZoneAbbreviation(selectedFacility.timezone)})
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Secondary display: User's local time if different */}
                                    {Intl.DateTimeFormat().resolvedOptions().timeZone !== selectedFacility?.timezone && (
                                      <div className="text-xs text-gray-500 mt-1 text-center">
                                        {/* Convert to user's timezone */}
                                        {(() => {
                                          try {
                                            const [hours, minutes] = slot.time.split(':').map(Number);
                                            const date = new Date(selectedDate);
                                            date.setHours(hours, minutes, 0, 0);
                                            
                                            // Format this date according to user's timezone
                                            const userTime = new Date(date.toLocaleString('en-US', {
                                              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                                            }));
                                            
                                            const userTzAbbr = getTimeZoneAbbreviation(
                                              Intl.DateTimeFormat().resolvedOptions().timeZone
                                            );
                                            
                                            return (
                                              <>
                                                <div>{format(userTime, 'h:mm a')}</div>
                                                <div>({userTzAbbr})</div>
                                              </>
                                            );
                                          } catch (e) {
                                            console.error("Error converting timezone:", e);
                                            return "";
                                          }
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Always show capacity badge */}
                                  <span className="absolute top-0 right-0 -mt-2 -mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                                    {slot.remaining}
                                  </span>
                                </Button>
                              );
                            })}
                          </div>
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
            <Button type="button" className="booking-button-secondary" onClick={handleBack}>
              Back
            </Button>
            <Button 
              type="submit"
              className="booking-button" 
              disabled={!selectedDate || !selectedTime}
            >
              Next
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Define the customer info form schema
const customerInfoSchema = z.object({
  companyName: z.string().min(1, { message: "Company name is required" }),
  contactName: z.string().min(1, { message: "Contact name is required" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  phone: z.string().min(5, { message: "Phone number is required" }),
  customerRef: z.string().min(1, { message: "BOL Identifier is required" }),
  // Make carrierId completely optional without validation
  carrierId: z.number().optional().or(z.literal(undefined)), 
  // Always allow carrier name to pass validation
  carrierName: z.string().optional().default(""),
  driverName: z.string().min(1, { message: "Driver name is required" }),
  driverPhone: z.string().min(5, { message: "Driver phone is required" }),
  // Ensure mcNumber works with any string value including empty string
  mcNumber: z.string().optional().default(""),
  truckNumber: z.string().min(1, { message: "Truck number is required" }),
  trailerNumber: z.string().optional(),
  notes: z.string().optional()
}
);

type CustomerInfoFormValues = z.infer<typeof customerInfoSchema>;

// Step 3: Customer Information
function CustomerInfoStep({ bookingPage, onSubmit }: { bookingPage: any; onSubmit: () => Promise<void> }) {
  const { bookingData, updateBookingData, setCurrentStep, isLoading } = useBookingWizard();
  
  // Setup react-hook-form
  const form = useForm<CustomerInfoFormValues>({
    resolver: zodResolver(customerInfoSchema),
    defaultValues: {
      companyName: bookingData.companyName || (bookingData.bolExtractedData?.customerName !== 'contain logistics information.' ? bookingData.bolExtractedData?.customerName : '') || '',
      contactName: bookingData.contactName || '',
      email: bookingData.email || '',
      phone: bookingData.phone || '',
      customerRef: bookingData.customerRef || bookingData.bolExtractedData?.bolNumber || '',
      carrierId: bookingData.carrierId || undefined,
      carrierName: bookingData.carrierName || bookingData.bolExtractedData?.carrierName || '',
      driverName: bookingData.driverName || bookingData.bolExtractedData?.driverName || '',
      driverPhone: bookingData.driverPhone || bookingData.bolExtractedData?.driverPhone || '',
      mcNumber: bookingData.mcNumber || bookingData.bolExtractedData?.mcNumber || '',
      truckNumber: bookingData.truckNumber || '',
      trailerNumber: bookingData.trailerNumber || '',
      notes: bookingData.notes || bookingData.bolExtractedData?.notes || ''
    }
  });
  
  // Populate form after mount - this ensures the form is updated if BOL data changes
  useEffect(() => {
    console.log("Step 3: BOL extracted data available:", bookingData.bolExtractedData);
    
    // Only update fields that are empty
    if (bookingData.bolExtractedData) {
      const { bolExtractedData } = bookingData;
      
      if (bolExtractedData.customerName && !form.getValues('companyName')) {
        form.setValue('companyName', bolExtractedData.customerName);
      }
      
      if (bolExtractedData.carrierName && !form.getValues('carrierName')) {
        form.setValue('carrierName', bolExtractedData.carrierName);
      }
      
      if (bolExtractedData.mcNumber && !form.getValues('mcNumber')) {
        form.setValue('mcNumber', bolExtractedData.mcNumber);
      }
      
      if (bolExtractedData.bolNumber && !form.getValues('customerRef')) {
        form.setValue('customerRef', bolExtractedData.bolNumber);
      }
    }
  }, [bookingData.bolExtractedData, form]);
  
  // Get the custom questions if any
  const { data: customQuestions } = useQuery({
    queryKey: [`/api/appointment-types/${bookingData.appointmentTypeId}/questions`],
    enabled: !!bookingData.appointmentTypeId,
  });
  
  // Handle back button
  const handleBack = () => {
    setCurrentStep(2);
  };
  
  // Handle field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    updateBookingData({
      [e.target.name]: e.target.value
    });
  };
  
  // Handle custom field changes
  const handleCustomFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, questionId: number) => {
    updateBookingData({
      customFields: {
        ...bookingData.customFields,
        [questionId]: e.target.value
      }
    });
  };
  
  // Handle BOL processing
  const handleBolProcessed = (data: ParsedBolData, fileUrl: string) => {
    console.log('BOL Processed:', data);
    
    // Validate the extracted data before using it
    const validatedData = {
      bolNumber: data.bolNumber || '',
      customerName: (data.customerName && data.customerName !== 'contain logistics information.') ? data.customerName : '',
      carrierName: data.carrierName || '',
      mcNumber: data.mcNumber || '',
      weight: data.weight || '',
      notes: data.notes || ''
    };
    
    console.log('Validated BOL data:', validatedData);
    
    // Update booking data with the validated BOL information
    updateBookingData({
      bolExtractedData: validatedData,
      bolFileUploaded: true
    });
    
    // Pre-fill form fields if they're empty and we have BOL data
    if (validatedData.customerName && !bookingData.companyName) {
      updateBookingData({ companyName: validatedData.customerName });
    }
    
    if (validatedData.carrierName && !bookingData.carrierName) {
      updateBookingData({ carrierName: validatedData.carrierName });
      // Also set carrierId to null to ensure carrier is properly validated
      updateBookingData({ carrierId: null });
    }
  };
  
  // Handle BOL processing state changes
  const handleProcessingStateChange = (isProcessing: boolean) => {
    // You can use this to show a loading indicator
    console.log('BOL processing state:', isProcessing);
  };
  
  // Handle form submission
  const handleFormSubmit = async (values: CustomerInfoFormValues) => {
    // Update the booking data with form values
    updateBookingData({
      ...values
    });
    
    // Submit the form
    await onSubmit();
  };

  return (
    <div className="booking-form-section">
      <h2 className="booking-form-section-title">Customer Information</h2>
      
      {bookingData.bolExtractedData && (
        <div className="mb-6 p-4 rounded-md bg-green-50 border border-green-200">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
            <div>
              <h3 className="font-medium text-green-800">BOL Document Detected</h3>
              <p className="text-sm text-green-700 mt-1">
                We've automatically populated some fields from your Bill of Lading.
                {bookingData.bolExtractedData.bolNumber && (
                  <span> BOL Number: <strong>{bookingData.bolExtractedData.bolNumber}</strong></span>
                )}
                {bookingData.bolExtractedData.shipDate && (
                  <span className="block mt-1">Ship Date from BOL: <strong>{bookingData.bolExtractedData.shipDate}</strong></span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">Company Name *</FormLabel>
                <FormControl>
                  <Input
                    id="companyName"
                    className="booking-input"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      updateBookingData({ companyName: e.target.value });
                    }}
                  />
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
                <FormLabel className="booking-label">Contact Name *</FormLabel>
                <FormControl>
                  <Input
                    id="contactName"
                    className="booking-input"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      updateBookingData({ contactName: e.target.value });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Email *</FormLabel>
                  <FormControl>
                    <Input
                      id="email"
                      type="email"
                      className="booking-input"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        updateBookingData({ email: e.target.value });
                      }}
                    />
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
                  <FormLabel className="booking-label">Phone *</FormLabel>
                  <FormControl>
                    <Input
                      id="phone"
                      type="tel"
                      className="booking-input"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        updateBookingData({ phone: e.target.value });
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="customerRef"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">BOL Identifier *</FormLabel>
                <FormControl>
                  <Input
                    id="customerRef"
                    className="booking-input"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      updateBookingData({ customerRef: e.target.value });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <h2 className="booking-form-section-title mt-8">Carrier Information</h2>
          
          {/* Carrier Selection Section */}
          <div className="sm:col-span-2">
            <FormField
              control={form.control}
              name="carrierName"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Carrier *</FormLabel>
                  <CarrierSelector 
                    form={form}
                    idFieldName="carrierId"
                    nameFieldName="carrierName"
                    mcNumberFieldName="mcNumber"
                  />
                  <FormDescription className="text-xs">
                    Select from the list or type to search. If your carrier isn't listed, type a new name to create it.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 mb-4">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> MC Numbers are required for all shipments as of August 1st, 2023.
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="driverName"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Driver Name *</FormLabel>
                  <FormControl>
                    <Input
                      id="driverName"
                      className="booking-input"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        updateBookingData({ driverName: e.target.value });
                      }}
                    />
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
                  <FormLabel className="booking-label">Driver Phone *</FormLabel>
                  <FormControl>
                    <Input
                      id="driverPhone"
                      type="tel"
                      className="booking-input"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        updateBookingData({ driverPhone: e.target.value });
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {/* MC Number Field */}
          <FormField
            control={form.control}
            name="mcNumber"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">MC Number *</FormLabel>
                <FormControl>
                  <Input
                    id="mcNumber"
                    className="booking-input"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      updateBookingData({ mcNumber: e.target.value });
                    }}
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  MC Numbers are required for all shipments as of August 1st, 2023.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="truckNumber"
              render={({ field }) => (
                <FormItem className="booking-form-field">
                  <FormLabel className="booking-label">Truck Number *</FormLabel>
                  <FormControl>
                    <Input
                      id="truckNumber"
                      className="booking-input"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        updateBookingData({ truckNumber: e.target.value });
                      }}
                    />
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
                    <Input
                      id="trailerNumber"
                      className="booking-input"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        updateBookingData({ trailerNumber: e.target.value });
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {/* Bill of Lading Upload */}
          <div className="booking-form-field">
            <Label className="booking-label">Bill of Lading (Optional)</Label>
            {bookingData.bolFileUploaded && bookingData.bolExtractedData ? (
              <div className="p-4 border rounded-md bg-green-50 border-green-200 mb-2">
                <div className="flex items-center mb-2">
                  <CheckCircle className="text-green-600 mr-2 h-5 w-5" />
                  <p className="font-medium text-green-800">BOL successfully uploaded</p>
                </div>
                {bookingData.bolExtractedData.bolNumber && (
                  <p className="text-sm text-green-700">BOL Number: {bookingData.bolExtractedData.bolNumber}</p>
                )}
                <div className="mt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      updateBookingData({
                        bolFileUploaded: false,
                        bolExtractedData: undefined
                      });
                    }}
                  >
                    Replace BOL
                  </Button>
                </div>
              </div>
            ) : (
              <BolUpload
                onBolProcessed={handleBolProcessed}
                onProcessingStateChange={handleProcessingStateChange}
              />
            )}
          </div>
          
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="booking-form-field">
                <FormLabel className="booking-label">Notes</FormLabel>
                <FormControl>
                  <Textarea
                    id="notes"
                    className="booking-input"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      updateBookingData({ notes: e.target.value });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Custom questions if any */}
          {Array.isArray(customQuestions) && customQuestions.length > 0 && (
            <>
              <h2 className="booking-form-section-title mt-8">Additional Information</h2>
              
              {customQuestions.map((question: any) => (
                <div key={question.id} className="booking-form-field">
                  <Label className="booking-label" htmlFor={`custom-${question.id}`}>
                    {question.questionText} {question.isRequired && <span className="text-red-500">*</span>}
                  </Label>
                  
                  {question.fieldType === 'text' ? (
                    <Input
                      id={`custom-${question.id}`}
                      className="booking-input"
                      value={bookingData.customFields?.[question.id] || ''}
                      onChange={(e) => handleCustomFieldChange(e, question.id)}
                      required={question.isRequired}
                    />
                  ) : question.fieldType === 'textarea' ? (
                    <Textarea
                      id={`custom-${question.id}`}
                      className="booking-input"
                      value={bookingData.customFields?.[question.id] || ''}
                      onChange={(e) => handleCustomFieldChange(e, question.id)}
                      required={question.isRequired}
                    />
                  ) : question.fieldType === 'select' ? (
                    <Select
                      value={bookingData.customFields?.[question.id] || ''}
                      onValueChange={(value) => {
                        updateBookingData({
                          customFields: {
                            ...bookingData.customFields,
                            [question.id]: value
                          }
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {question.options?.split(',').map((option: string) => (
                          <SelectItem key={option.trim()} value={option.trim()}>
                            {option.trim()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
              ))}
            </>
          )}
          
          <div className="booking-nav-buttons">
            <Button type="button" className="booking-button-secondary" onClick={handleBack} disabled={isLoading}>
              Back
            </Button>
            <Button 
              type="submit"
              className="booking-button" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Book Appointment'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Step 4: Confirmation
function ConfirmationStep({ bookingPage, confirmationCode }: { bookingPage: any; confirmationCode: string | null }) {
  const { bookingData, resetBookingData } = useBookingWizard();
  
  // Fetch facilities data to get the facility timezone
  const { data: facilities } = useQuery({
    queryKey: ['/api/facilities'],
  });
  
  // Get the selected facility
  const selectedFacility = Array.isArray(facilities)
    ? facilities.find((facility: any) => facility.id === bookingData.facilityId)
    : undefined;
  
  // Use the timezone utilities imported at the top of the file
  
  // Format the appointment date and time for display with dual timezones
  const formatAppointmentTime = () => {
    if (!bookingData.startTime || !bookingData.endTime || !selectedFacility?.timezone) return '';
    
    const start = new Date(bookingData.startTime);
    const end = new Date(bookingData.endTime);
    
    // Format the date in facility timezone
    const dateStr = format(start, 'EEEE, MMMM d, yyyy');
    
    // Get the time ranges in both user and facility timezones
    const { userTimeRange, facilityTimeRange, userZoneAbbr, facilityZoneAbbr, showBothTimezones } = 
      formatTimeRangeForDualZones(start, end, selectedFacility.timezone);
    
    return (
      <div className="space-y-1">
        <div>{dateStr}</div>
        <div>
          <span className="font-medium">Facility time:</span> {facilityTimeRange} ({facilityZoneAbbr})
        </div>
        {showBothTimezones && (
          <div>
            <span className="font-medium">Your local time:</span> {userTimeRange} ({userZoneAbbr})
          </div>
        )}
      </div>
    );
  };
  
  // Get facility name for display
  const getFacilityName = () => {
    // First check bookingData for a direct facilityName value
    if (bookingData.facilityName) {
      return bookingData.facilityName;
    }
    
    // Then try to look it up from facilities array
    if (bookingData.facilityId && Array.isArray(facilities)) {
      const facility = facilities.find((f: any) => f.id === bookingData.facilityId);
      if (facility?.name) {
        return facility.name;
      }
    }
    
    return 'Unknown Facility';
  };

  // Get appointment type name if available
  const getAppointmentTypeName = () => {
    // First check if we have the name directly in bookingData
    if (bookingData.appointmentTypeName) {
      return bookingData.appointmentTypeName;
    }
    
    // Then try to find it in appointment types array
    if (bookingData.appointmentTypeId && bookingData.appointmentTypes) {
      const type = bookingData.appointmentTypes.find(
        (t: any) => t.id === bookingData.appointmentTypeId
      );
      if (type?.name) {
        return type.name;
      }
    }
    
    return 'Standard Appointment';
  };

  return (
    <div className="booking-form-section confirmation-container">
      <div className="text-center mb-6">
        <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
          <CheckCircle className="h-12 w-12 text-green-600 confirmation-icon" />
        </div>
        <CardTitle className="text-2xl text-green-700 confirmation-title">Appointment Confirmed!</CardTitle>
        <p className="text-green-700 mb-6">
          Your appointment has been successfully scheduled. Please save your confirmation code for reference.
        </p>
      </div>
      
      <Card className="border-green-500 shadow-lg">
        <CardHeader className="border-b border-green-100 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-green-800">{getFacilityName()}</h2>
              <p className="text-green-700">{getAppointmentTypeName()}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm text-green-700">Confirmation Code</span>
              <span className="text-xl font-bold text-green-800">{confirmationCode}</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="confirmation-code-container mb-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md text-center">
              <div className="text-sm font-medium text-green-700 mb-1">Your appointment has been confirmed at</div>
              <div className="text-xl font-bold text-green-800">{getFacilityName()}</div>
              {formatAppointmentTime()}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="border-b pb-2 border-gray-200">
                <h3 className="font-semibold text-gray-700">Appointment Details</h3>
              </div>
              
              <div className="confirmation-detail">
                <span className="confirmation-label">Facility:</span> {getFacilityName()}
              </div>
              
              <div className="confirmation-detail">
                <span className="confirmation-label">Appointment Type:</span> {getAppointmentTypeName()}
              </div>
              
              <div className="confirmation-detail">
                <span className="confirmation-label">Purpose:</span> {bookingData.pickupOrDropoff === 'pickup' ? 'Pickup (Outbound)' : 'Dropoff (Inbound)'}
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="border-b pb-2 border-gray-200">
                <h3 className="font-semibold text-gray-700">Contact Information</h3>
              </div>
              
              <div className="confirmation-detail">
                <span className="confirmation-label">Contact Person:</span> {bookingData.contactName || 'N/A'}
              </div>
              
              <div className="confirmation-detail">
                <span className="confirmation-label">Company:</span> {bookingData.companyName || 'N/A'}
              </div>
              
              <div className="confirmation-detail">
                <span className="confirmation-label">Email:</span> {bookingData.email || 'N/A'}
              </div>
              
              <div className="confirmation-detail">
                <span className="confirmation-label">Phone:</span> {bookingData.phone || 'N/A'}
              </div>
            </div>
          </div>
          
          <div className="mt-6 border-t pt-4 border-gray-200">
            <div className="border-b pb-2 border-gray-200 mb-4">
              <h3 className="font-semibold text-gray-700">Carrier Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="confirmation-detail">
                <span className="confirmation-label">Carrier Name:</span> {bookingData.carrierName || 'N/A'}
              </div>
              
              <div className="confirmation-detail">
                <span className="confirmation-label">MC Number:</span> {bookingData.mcNumber || 'N/A'}
              </div>
              
              <div className="confirmation-detail">
                <span className="confirmation-label">Driver Name:</span> {bookingData.driverName || 'N/A'}
              </div>
              
              <div className="confirmation-detail">
                <span className="confirmation-label">Driver Phone:</span> {bookingData.driverPhone || 'N/A'}
              </div>
              
              <div className="confirmation-detail">
                <span className="confirmation-label">Truck Number:</span> {bookingData.truckNumber || 'N/A'}
              </div>
              
              <div className="confirmation-detail">
                <span className="confirmation-label">Trailer Number:</span> {bookingData.trailerNumber || 'N/A'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-600 mb-2">
          A confirmation email has been sent to your email address.
          Please arrive on time for your appointment.
        </p>
        <Button
          className="booking-button"
          onClick={() => {
            resetBookingData();
            window.location.reload();
          }}
        >
          Book Another Appointment
        </Button>
      </div>
    </div>
  );
}