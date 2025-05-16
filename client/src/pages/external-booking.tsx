// This file replaces: client/src/pages/external-booking.tsx

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BookingWizardProvider, useBookingWizard } from '@/contexts/BookingWizardContext';
import { BookingThemeProvider } from '@/hooks/use-booking-theme';
import { Loader2, XCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import dockOptimizerLogo from '@/assets/dock_optimizer_logo.jpg';
import { getUserTimeZone } from '@/lib/timezone-utils';
import { safeToString } from '@/lib/utils';

const serviceSelectionSchema = z.object({
  facilityId: z.number().min(1, "Please select a facility"),
  appointmentTypeId: z.number().min(1, "Please select a service type"),
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

function BookingPage({ bookingPage }: { bookingPage: any }) {
  const [step, setStep] = useState(1);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const [selectedAppointmentType, setSelectedAppointmentType] = useState<any>(null);
  // Add a separate state for the show slots toggle
  const [showExactSlots, setShowExactSlots] = useState(false);
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
      // Prepare the booking data in the format expected by the backend
      const bookingData = {
        // Step 1: Service Selection
        facilityId: payload.facilityId,
        appointmentTypeId: payload.appointmentTypeId,
        pickupOrDropoff: payload.pickupOrDropoff || "pickup", // default to pickup if not specified
        
        // Step 2: Date/Time
        startTime: payload.date + "T" + payload.time, // Format as ISO string
        
        // Include a default set of fields for the external booking API
        companyName: "External Booking",
        contactName: "External User",
        email: "external@example.com",
        phone: "555-555-5555",
        carrierName: "External Carrier",
        driverName: "External Driver",
        driverPhone: "555-555-5555",
        truckNumber: "EXT-1",
        
        // Metadata
        createdVia: "external-booking",
        
        // Include the booking page slug for tenant identification
        bookingPageSlug: window.location.pathname.split('/').pop() || '',
      };
      
      // Log the payload for debugging
      console.log("Sending booking request with data:", bookingData);
      
      // Use the correct endpoint for external bookings
      const res = await fetch("/api/schedules/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });
      
      if (!res.ok) {
        // Try to parse the error response
        let errorMessage = "Failed to book appointment";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          console.error("Could not parse error response", e);
        }
        throw new Error(errorMessage);
      }
      
      // Parse the JSON response
      const data = await res.json();
      console.log("Booking response:", data);
      return data;
    },
    onSuccess: (data) => {
      // Extract confirmation code and set it
      const confirmationCode = data.confirmationNumber || data.confirmationCode || `CONF-${Date.now()}`;
      setConfirmationCode(confirmationCode);
      setStep(3);
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
                <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm">
                  <p className="font-medium">{selectedAppointmentType.name}</p>
                  <div className="mt-1 text-xs">
                    <p>Duration: {selectedAppointmentType.duration || 60} minutes</p>
                    {selectedAppointmentType.bufferTime > 0 && (
                      <p>Buffer Time: {selectedAppointmentType.bufferTime} minutes</p>
                    )}
                    <p>Concurrent Appointments: {selectedAppointmentType.maxConcurrent || 1}</p>
                    
                    {/* Toggle to show exact number of slots */}
                    <div className="mt-2 flex items-center">
                      <label className="flex items-center cursor-pointer">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            className="sr-only" 
                            checked={showExactSlots}
                            onChange={(e) => {
                              // Simply update our simple state variable
                              setShowExactSlots(e.target.checked);
                            }}
                          />
                          <div className="block bg-gray-300 w-10 h-5 rounded-full"></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition ${showExactSlots ? 'transform translate-x-5' : ''}`}></div>
                        </div>
                        <span className="ml-2 text-xs">Show exact available slots</span>
                      </label>
                    </div>
                  </div>
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
                      className={`${className} relative`}
                      onClick={() => updateBookingData({ time: slot.time })}
                      disabled={!slot.available}
                      title={slot.reason || (slot.available ? 
                        `${slot.remainingCapacity || 1} slot(s) available` : 
                        'Not available')}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span>{slot.time}</span>
                        
                        {/* Show exact remaining slots count when enabled */}
                        {slot.available && showExactSlots && slot.remainingCapacity > 0 && (
                          <span className="text-xs font-medium mt-1 bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">
                            {slot.remainingCapacity} {slot.remainingCapacity === 1 ? 'slot' : 'slots'}
                          </span>
                        )}
                      </div>
                      
                      {/* Buffer time indicator - specific indicator for buffer time slots */}
                      {isBufferTimeSlot && (
                        <span className="ml-1 text-xs absolute top-1 right-1">⏱️</span>
                      )}
                      
                      {/* Break time indicator - looking for various possible break reason texts */}
                      {(!slot.available || slot.reason?.toLowerCase().includes('break')) && 
                        (slot.reason?.toLowerCase().includes('break') || 
                         slot.reason?.toLowerCase().includes('lunch')) && (
                        <span className="ml-1 text-xs absolute top-1 right-1">🍽️</span>
                      )}
                      
                      {/* Outside hours indicator */}
                      {(!slot.available || slot.reason?.toLowerCase().includes('outside') || 
                         slot.reason?.toLowerCase().includes('closed')) && 
                        (slot.reason?.toLowerCase().includes('outside') || 
                         slot.reason?.toLowerCase().includes('hours') ||
                         slot.reason?.toLowerCase().includes('closed')) && (
                        <span className="ml-1 text-xs absolute top-1 right-1">🔒</span>
                      )}
                      
                      {/* Limited availability indicator - only show when not showing exact numbers */}
                      {slot.available && slot.remainingCapacity === 1 && !showExactSlots && (
                        <span className="ml-1 text-xs absolute top-1 right-1">⚠️</span>
                      )}
                      
                      {/* Tooltip for extra information (will show on hover) */}
                      {slot.reason && (
                        <span className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </Button>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                <p>🔒 - Outside facility hours</p>
                <p>🍽️ - Facility break time</p>
                <p>⏱️ - Buffer time (defined by appointment type)</p>
                <p>⚠️ - Limited availability</p>
                <p className="flex items-center mt-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                  <span>Hover for additional information</span>
                </p>
              </div>
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

      {step === 3 && confirmationCode && (
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
