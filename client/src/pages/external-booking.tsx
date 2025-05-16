import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BookingWizardProvider, useBookingWizard } from '@/contexts/BookingWizardContext';
import { BookingThemeProvider } from '@/hooks/use-booking-theme';
import { Loader2, XCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { StandardQuestionsFormFields } from '@/components/shared/standard-questions-form-fields';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, isSunday, isSaturday, isMonday, isTuesday, isWednesday, isThursday, isFriday } from 'date-fns';
import dockOptimizerLogo from '@/assets/dock_optimizer_logo.jpg';
import { getUserTimeZone } from '@/lib/timezone-utils';
import { safeToString } from '@/lib/utils';

const serviceSelectionSchema = z.object({
  facilityId: z.coerce.number().min(1, "Please select a facility"),
  appointmentTypeId: z.coerce.number().min(1, "Please select a service type"),
});

export default function ExternalBooking({ slug }: { slug: string }) {
  const { data: bookingPage, isLoading, error } = useQuery({
    queryKey: [`/api/booking-pages/slug/${slug}`],
    queryFn: async () => {
      const res = await fetch(`/api/booking-pages/slug/${slug}`);
      if (!res.ok) throw new Error('Failed to fetch booking page');
      
      // Get the basic booking page data
      const data = await res.json();
      
      // Process appointment types to add showRemainingSlots property
      if (data?.appointmentTypes && Array.isArray(data.appointmentTypes)) {
        data.appointmentTypes = data.appointmentTypes.map((type: any) => ({
          ...type,
          showRemainingSlots: type.showRemainingSlots || false
        }));
      }
      
      return data;
    }
  });

  if (isLoading) return <Loader2 className="animate-spin" />;
  if (error || !bookingPage) return <div className="text-red-500">Invalid booking link. Please check your URL.</div>;

  return (
    <BookingThemeProvider slug={slug}>
      <BookingWizardProvider>
        <BookingPage bookingPage={bookingPage} />
      </BookingWizardProvider>
    </BookingThemeProvider>
  );
}

function BookingPage({ bookingPage }: { bookingPage: any }): JSX.Element {
  const [step, setStep] = useState(1);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [selectedAppointmentType, setSelectedAppointmentType] = useState<any>(null);
  
  // Form data for booking details
  // Dynamically populated from standard questions 
  const [bookingDetails, setBookingDetails] = useState<Record<string, any>>({});
  const { bookingData, updateBookingData } = useBookingWizard();

  const form = useForm({
    resolver: zodResolver(serviceSelectionSchema),
    defaultValues: {
      facilityId: 0,
      appointmentTypeId: 0,
    },
  });

  const facilities = bookingPage.facilities || [];
  console.log("Facilities loaded from bookingPage:", facilities);

  const appointmentTypes = useMemo(() => {
    const selectedFacilityId = form.watch('facilityId');
    
    // If we have appointment types in the booking page data and a facility is selected, filter by facilityId
    if (selectedFacilityId && bookingPage.appointmentTypes && Array.isArray(bookingPage.appointmentTypes)) {
      console.log(`Filtering appointment types for facility ID: ${selectedFacilityId}`);
      
      // Make sure we're comparing numbers to numbers
      const typesForFacility = bookingPage.appointmentTypes.filter((type: any) => {
        const typeId = Number(type.id);
        const typeFacilityId = Number(type.facilityId);
        const selectedId = Number(selectedFacilityId);
        
        // Debug data
        if (typeFacilityId === selectedId) {
          console.log(`Matched appointment type: ${type.name} (ID: ${typeId}) for facility ${selectedId}`);
        }
        
        return typeFacilityId === selectedId;
      });
      
      console.log(`Found ${typesForFacility.length} appointment types for facility ID ${selectedFacilityId}`);
      return typesForFacility;
    }
    
    return [];
  }, [bookingPage.appointmentTypes, form.watch('facilityId')]);

  const handleSubmit = (values: any) => {
    const selectedFacility = facilities.find((f: any) => f.id === values.facilityId);
    updateBookingData({
      facilityId: values.facilityId,
      appointmentTypeId: values.appointmentTypeId,
      timezone: selectedFacility?.timezone || getUserTimeZone(),
    });
    setStep(2);
  };

  // Get appointment type details - we need to know if showRemainingSlots is enabled
  const { data: appointmentTypeDetails, isLoading: loadingAppointmentType } = useQuery({
    queryKey: ["appointmentType", bookingData?.appointmentTypeId],
    queryFn: async () => {
      // Only fetch if we have an appointment type ID
      if (!bookingData?.appointmentTypeId) {
        return null;
      }
      
      // Find the appointment type in the booking page data first
      const appointmentType = bookingPage.appointmentTypes.find(
        (t: any) => t.id === Number(bookingData.appointmentTypeId)
      );
      
      if (appointmentType) {
        // Update the selectedAppointmentType state
        setSelectedAppointmentType(appointmentType);
        return appointmentType;
      }
      
      return null;
    },
    enabled: !!bookingData?.appointmentTypeId && (step === 2 || step === 3),
  });
  
  // Fetch the standard questions for the selected appointment type
  const { data: standardQuestions, isLoading: loadingQuestions } = useQuery({
    queryKey: ["standard-questions", bookingData?.appointmentTypeId],
    queryFn: async () => {
      if (!bookingData?.appointmentTypeId) {
        return [];
      }
      
      try {
        const res = await fetch(`/api/standard-questions/appointment-type/${bookingData.appointmentTypeId}`);
        if (!res.ok) {
          throw new Error("Failed to load appointment questions");
        }
        
        const questions = await res.json();
        console.log("Loaded standard questions:", questions);
        return questions || [];
      } catch (error) {
        console.error("Error loading standard questions:", error);
        return [];
      }
    },
    enabled: !!bookingData?.appointmentTypeId && step === 3,
  });
  
  // Also fetch any custom questions
  const { data: customQuestions, isLoading: loadingCustomQuestions } = useQuery({
    queryKey: ["custom-questions", bookingData?.appointmentTypeId],
    queryFn: async () => {
      if (!bookingData?.appointmentTypeId) {
        return [];
      }
      
      try {
        const res = await fetch(`/api/custom-questions/${bookingData.appointmentTypeId}`);
        if (!res.ok) {
          throw new Error("Failed to load custom questions");
        }
        
        const questions = await res.json();
        console.log("Loaded custom questions:", questions);
        return questions || [];
      } catch (error) {
        console.error("Error loading custom questions:", error);
        return [];
      }
    },
    enabled: !!bookingData?.appointmentTypeId && step === 3,
  });

  // Get the real availability using the enhanced v2 endpoint
  const { data: availability, isLoading: loadingAvailability } = useQuery({
    queryKey: ["availability/v2", bookingData?.facilityId, bookingData?.appointmentTypeId, bookingData?.date],
    queryFn: async () => {
      // Make sure we have all required data
      if (!bookingData?.date || !bookingData?.facilityId || !bookingData?.appointmentTypeId) {
        console.error("Missing required data for availability:", { 
          date: bookingData?.date,
          facilityId: bookingData?.facilityId,
          appointmentTypeId: bookingData?.appointmentTypeId
        });
        return [];
      }
      
      // Use the enhanced v2 endpoint which properly handles all scheduling rules
      const url = new URL('/api/availability/v2', window.location.origin);
      
      // Directly use the date string from booking data without any transformation
      // This ensures we're using the exact date the user selected
      const dateParam = typeof bookingData.date === 'string' ? bookingData.date : '';
      
      console.log("Using date param for availability call:", dateParam);
      
      // Add all required parameters to the URL
      url.searchParams.append('date', dateParam);
      url.searchParams.append('facilityId', String(bookingData.facilityId));
      url.searchParams.append('appointmentTypeId', String(bookingData.appointmentTypeId));
      url.searchParams.append('bookingPageSlug', window.location.pathname.split('/').pop() || '');
      
      console.log(`Fetching availability from: ${url.toString()}`);
      
      try {
        const res = await fetch(url.toString());
        
        if (!res.ok) {
          let errorMsg = "Failed to load availability";
          try {
            const errorData = await res.json();
            console.error("Availability fetch error:", errorData);
            errorMsg = errorData.message || errorMsg;
          } catch (e) {
            console.error("Could not parse error response", e);
          }
          throw new Error(errorMsg);
        }
        
        const data = await res.json();
        console.log("Availability data:", data);
        
        // Process the slot data to ensure we have all the expected properties
        return (data.slots || []).map((slot: any) => ({
          time: slot.time,
          available: !!slot.available,
          remainingCapacity: slot.remainingCapacity || 0,
          reason: slot.reason || '',
          // Add any other needed properties
        }));
      } catch (error) {
        console.error("Error fetching availability:", error);
        throw error;
      }
    },
    enabled: !!bookingData?.date && !!bookingData?.facilityId && !!bookingData?.appointmentTypeId && step === 2,
    // Re-fetch when the date or other booking data changes
    refetchOnWindowFocus: false,
  });

  const bookingMutation = useMutation({
    mutationFn: async (payload: any) => {
      console.log("Starting booking creation with payload:", payload);
      
      // Format the data for the API
      const startDate = new Date(`${payload.date}T${payload.time}`);
      
      // Calculate endDate based on appointment type duration
      const appointmentType = appointmentTypes.find((t: any) => t.id === Number(payload.appointmentTypeId));
      const durationMinutes = appointmentType?.duration || 60;
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
      
      // Prepare a properly formatted booking payload
      const apiPayload = {
        facilityId: Number(payload.facilityId),
        appointmentTypeId: Number(payload.appointmentTypeId),
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        pickupOrDropoff: payload.pickupOrDropoff || "pickup",
        status: "confirmed",
        customerName: payload.bookingDetails.companyName || payload.bookingDetails.customerName,
        contactName: payload.bookingDetails.contactName,
        email: payload.bookingDetails.email,
        phone: payload.bookingDetails.phone,
        carrierName: payload.bookingDetails.carrierName,
        driverName: payload.bookingDetails.driverName,
        driverPhone: payload.bookingDetails.driverPhone,
        truckNumber: payload.bookingDetails.truckNumber || "N/A",
        trailerNumber: payload.bookingDetails.trailerNumber || "N/A",
        customerRef: payload.bookingDetails.customerRef || "",
        customFormData: payload.bookingDetails // Store full details in customFormData
      };
      
      console.log("Submitting appointment with payload:", apiPayload);
      
      // Make API call with properly formatted payload
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Booking API error:", errorData);
        throw new Error(errorData.message || 'Failed to create booking');
      }
      
      const data = await response.json();
      console.log("Booking created successfully:", data);
      return data;
    },
    onSuccess: (data) => {
      // Extract confirmation code and set it
      const confirmationCode = data.confirmationNumber || data.confirmationCode || `CONF-${Date.now()}`;
      setConfirmationCode(confirmationCode);
      setStep(4);
    },
    onError: (error) => {
      console.error("Booking error:", error);
    }
  });

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <img src={dockOptimizerLogo} alt="Dock Optimizer Logo" className="h-12" />

      {step === 1 && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <Label>Facility</Label>
              <Select
                onValueChange={(value) => form.setValue('facilityId', Number(value))}
                value={safeToString(form.watch('facilityId'))}
              >
                <SelectTrigger><SelectValue placeholder="Select Facility" /></SelectTrigger>
                <SelectContent>
                  {facilities
                    .filter((f: any) => f?.id && f?.name)
                    .map((f: any) => {
                      const facilityId = String(f.id);
                      return (
                        <SelectItem key={`facility-${facilityId}`} value={facilityId}>
                          {f.name}
                        </SelectItem>
                      );
                    })}

                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Type</Label>
              <Select
                onValueChange={(value) => form.setValue('appointmentTypeId', Number(value))}
                value={safeToString(form.watch('appointmentTypeId'))}
                disabled={!form.watch('facilityId')}
              >
                <SelectTrigger><SelectValue placeholder="Select Service" /></SelectTrigger>
                <SelectContent>
                  {appointmentTypes.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-neutral-500">
                      No services available for this facility
                    </div>
                  ) : (
                    appointmentTypes.map((t: any) => {
                      console.log(`Rendering appointment type: ${t.name} (ID: ${t.id}, Facility: ${t.facilityId})`);
                      const typeId = String(t.id);
                      return (
                        <SelectItem key={`apptType-${typeId}`} value={typeId}>
                          {t.name}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Next</Button>
          </form>
        </Form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Label>Select Date</Label>
          <DatePicker 
            date={bookingData?.date ? 
              // Make sure we properly parse the date string that could be in yyyy-MM-dd format
              typeof bookingData.date === 'string' 
                ? new Date(
                    parseInt(bookingData.date.substring(0, 4)), // year
                    parseInt(bookingData.date.substring(5, 7)) - 1, // month (0-indexed)
                    parseInt(bookingData.date.substring(8, 10)) // day
                  ) 
                : new Date(bookingData.date) 
              : undefined}
            onDateChange={(date) => {
              if (date) {
                // Important: Keep exactly the date that was clicked without any timezone conversion
                // Get the year, month, and day directly from the date object
                const year = date.getFullYear();
                const month = date.getMonth() + 1; // JavaScript months are 0-indexed
                const day = date.getDate();
                
                // Create a formatted date string manually without using date-fns to avoid any timezone issues
                // This ensures the exact date selected in the UI is passed to the API
                const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                
                console.log("Date selected from calendar:", date);
                console.log("Year:", year, "Month:", month, "Day:", day);
                console.log("Manual formatted date:", formattedDate);
                
                // Update the context with the exact date string
                updateBookingData({ date: formattedDate });
                
                // For external API calls, we'll use this format
                console.log(`Date will be sent to API as: ${formattedDate}`);
              }
            }}
            disablePastDates={true}
          />

          {loadingAvailability ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : availability && availability.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Available Times</h3>
              
              {/* Display appointment type details if available */}
              {selectedAppointmentType && (
                <div className="bg-blue-50 text-blue-800 p-3 rounded-md mb-4">
                  <h3 className="text-lg font-medium">{selectedAppointmentType.name}</h3>
                  <div className="mt-1 text-sm">
                    <p>Duration: {selectedAppointmentType.duration || 60} minutes</p>
                    <p>Concurrent Appointments: {selectedAppointmentType.maxConcurrent || 1}</p>
                  </div>
                  
                  {/* Back button */}
                  <button 
                    onClick={() => setStep(1)} 
                    className="mt-2 text-sm text-blue-700 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Change appointment type
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availability.map((slot: any) => {
                  // Determine the button styling based on availability
                  let variant: 'default' | 'outline' = 'outline';
                  let className = '';
                  
                  if (bookingData?.time === slot.time) {
                    variant = 'default';
                  } else if (!slot.available) {
                    className = 'opacity-50';
                  } else if (slot.remainingCapacity && slot.remainingCapacity < 2) {
                    // Limited availability styling
                    className = 'border-yellow-400';
                  }
                  
                  // Check for buffer time reasons
                  const isBufferTimeSlot = !slot.available && 
                    (slot.reason?.toLowerCase().includes('buffer') || 
                     slot.reason?.toLowerCase().includes('too soon'));
                  
                  return (
                    <Button
                      key={slot.time}
                      variant={variant}
                      className={`${className} relative h-16 flex flex-col items-center justify-center p-1`}
                      onClick={() => updateBookingData({ time: slot.time })}
                      disabled={!slot.available}
                      title={slot.reason || (slot.available ? 
                        `${slot.remainingCapacity || 1} slot(s) available` : 
                        'Not available')}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="font-medium">{slot.time}</span>
                        
                        {/* Always show remaining slots count with visual indicators */}
                        {slot.available && slot.remainingCapacity > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className={`inline-block w-2 h-2 rounded-full ${
                              slot.remainingCapacity > 3 ? 'bg-green-500' : 
                              slot.remainingCapacity > 1 ? 'bg-yellow-500' : 
                              'bg-orange-500'
                            }`}></span>
                            <span className="text-xs font-medium">
                              {slot.remainingCapacity} {slot.remainingCapacity === 1 ? 'slot' : 'slots'}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Only show reason label if not available */}
                      {!slot.available && slot.reason && (
                        <span className="text-xs mt-1 text-red-600 font-medium truncate max-w-[90px] block">
                          {slot.reason.length > 12 ? `${slot.reason.substring(0, 12)}...` : slot.reason}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
              {/* Simplified UI - no legend needed */}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-muted-foreground">No availability found for selected date.</p>
              <p className="text-sm mt-2">Try selecting a different date or service type.</p>
            </div>
          )}

          <Button
            onClick={() => {
              // Make sure we have all the required data
              if (!bookingData?.facilityId || !bookingData?.appointmentTypeId || !bookingData?.date || !bookingData?.time) {
                console.error("Missing required booking data:", bookingData);
                return;
              }
              
              console.log("Submitting booking with data:", bookingData);
              
              bookingMutation.mutate({
                facilityId: Number(bookingData.facilityId),
                appointmentTypeId: Number(bookingData.appointmentTypeId),
                date: bookingData.date,
                time: bookingData.time,
                pickupOrDropoff: "pickup" // Default
              });
            }}
            disabled={!bookingData?.time || bookingMutation.isPending}
          >
            {bookingMutation.isPending ? 'Booking...' : 'Confirm Booking'}
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Enter Booking Details</h2>
          
          {(loadingQuestions || loadingCustomQuestions) ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
              <span className="ml-2">Loading booking questions...</span>
            </div>
          ) : (
            <>
              {/* Create a custom form to collect the answers from standard questions */}
              <div className="grid gap-6 md:grid-cols-2">
                {(standardQuestions || []).concat(customQuestions || [])
                  .filter((q: any) => q.included)
                  .sort((a: any, b: any) => a.orderPosition - b.orderPosition)
                  .map((question: any) => (
                    <div key={question.id} className="space-y-2">
                      <Label htmlFor={question.fieldKey}>
                        {question.label}
                        {question.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                      
                      {question.fieldType === 'TEXT' || question.fieldType === 'EMAIL' ? (
                        <Input
                          id={question.fieldKey}
                          name={question.fieldKey}
                          type={question.fieldType === 'EMAIL' ? 'email' : 'text'}
                          value={bookingDetails[question.fieldKey] || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBookingDetails(prev => ({
                              ...prev,
                              [question.fieldKey]: value
                            }));
                          }}
                          required={question.required}
                        />
                      ) : question.fieldType === 'PHONE' ? (
                        <Input
                          id={question.fieldKey}
                          name={question.fieldKey}
                          type="tel"
                          value={bookingDetails[question.fieldKey] || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBookingDetails(prev => ({
                              ...prev,
                              [question.fieldKey]: value
                            }));
                          }}
                          required={question.required}
                        />
                      ) : question.fieldType === 'TEXTAREA' ? (
                        <textarea
                          id={question.fieldKey}
                          name={question.fieldKey}
                          className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={bookingDetails[question.fieldKey] || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBookingDetails(prev => ({
                              ...prev,
                              [question.fieldKey]: value
                            }));
                          }}
                          required={question.required}
                        />
                      ) : (
                        // For other field types, default to text input
                        <Input
                          id={question.fieldKey}
                          name={question.fieldKey}
                          value={bookingDetails[question.fieldKey] || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBookingDetails(prev => ({
                              ...prev,
                              [question.fieldKey]: value
                            }));
                          }}
                          required={question.required}
                        />
                      )}
                    </div>
                  ))
                }
              </div>
              
              <div className="flex justify-between pt-4">
                <Button onClick={() => setStep(2)} variant="outline">Back</Button>
                <Button 
                  onClick={() => {
                    // Find all required questions based on the questions loaded from API
                    const requiredQuestions = [
                      ...(standardQuestions || []), 
                      ...(customQuestions || [])
                    ].filter(q => q.required);
                    
                    // Check if any required fields are missing
                    const missingFields = requiredQuestions
                      .filter(q => !bookingDetails[q.fieldKey] && q.included)
                      .map(q => q.label);
                    
                    if (missingFields.length > 0) {
                      alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
                      return;
                    }
                    
                    // Log data for debugging
                    console.log("Submitting booking with data:", bookingData);
                    console.log("Booking details:", bookingDetails);
                    
                    // Add default values for required fields
                    const completeBookingDetails = {
                      ...bookingDetails,
                      companyName: bookingDetails.companyName || bookingDetails.customerName || "Guest Company",
                      contactName: bookingDetails.contactName || bookingDetails.customerName || "Guest User",
                      email: bookingDetails.email || "guest@example.com",
                      phone: bookingDetails.phone || "555-555-5555",
                      carrierName: bookingDetails.carrierName || "External Carrier",
                      driverName: bookingDetails.driverName || "Guest Driver",
                      driverPhone: bookingDetails.driverPhone || "555-555-5555",
                      truckNumber: bookingDetails.truckNumber || "N/A",
                      trailerNumber: bookingDetails.trailerNumber || "N/A",
                      customerRef: bookingDetails.customerRef || ""
                    };
                    
                    // Create a payload that matches the API's expected format
                    const startDate = new Date(`${bookingData.date}T${bookingData.time}`);
                    
                    // Find appointment type to get duration
                    const appointmentType = appointmentTypes.find((t: any) => 
                      t.id === Number(bookingData.appointmentTypeId)
                    );
                    const durationMinutes = appointmentType?.duration || 60;
                    
                    // Calculate end time based on duration
                    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                    
                    // Create API-compatible payload
                    const payload = {
                      facilityId: Number(bookingData.facilityId),
                      appointmentTypeId: Number(bookingData.appointmentTypeId),
                      startTime: startDate.toISOString(),
                      endTime: endDate.toISOString(),
                      pickupOrDropoff: "pickup",
                      status: "confirmed",
                      customerName: completeBookingDetails.companyName,
                      contactName: completeBookingDetails.contactName,
                      email: completeBookingDetails.email,
                      phone: completeBookingDetails.phone,
                      carrierName: completeBookingDetails.carrierName,
                      driverName: completeBookingDetails.driverName,
                      driverPhone: completeBookingDetails.driverPhone,
                      truckNumber: completeBookingDetails.truckNumber,
                      trailerNumber: completeBookingDetails.trailerNumber,
                      customFormData: completeBookingDetails // Store complete details here
                    };
                    
                    console.log("Submitting appointment with payload:", payload);
                    bookingMutation.mutate(payload);
                  }}
                  disabled={bookingMutation.isPending}
                >
                  {bookingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : "Confirm Booking"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      
      {step === 4 && confirmationCode && (
        <div className="text-center space-y-4">
          <CheckCircle className="text-green-500 w-10 h-10 mx-auto" />
          <h2 className="text-lg font-bold">Booking Confirmed</h2>
          <p>Your confirmation code is: <code>{confirmationCode}</code></p>
        </div>
      )}

      {bookingMutation.error && (
        <div className="text-red-500 text-sm">{(bookingMutation.error as Error).message}</div>
      )}
    </div>
  );
}
